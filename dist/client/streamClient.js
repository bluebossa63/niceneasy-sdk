import { adaptLegacyEvents, sequenceStreamEvent } from '../types/stream.js';
import { createSseParser } from './sse.js';
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 250;
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function emitAdapted(raw, options, context) {
    let done = false;
    for (const event of adaptLegacyEvents(raw, context)) {
        const sequenced = sequenceStreamEvent(event, context.seq ?? 0);
        context.seq = sequenced.seq + 1;
        if (sequenced.run_id)
            context.run_id = sequenced.run_id;
        if (sequenced.session_id)
            context.session_id = sequenced.session_id;
        if (sequenced.message_id)
            context.message_id = sequenced.message_id;
        if (sequenced.tool_call_id)
            context.tool_call_id = sequenced.tool_call_id;
        options.onEvent(sequenced);
        if (event.type === 'finish') {
            done = true;
        }
    }
    return done;
}
async function readStream(response, options) {
    if (!response.body) {
        throw new Error('stream response has no body');
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let done = false;
    const context = { seq: 0, defaultMessageId: 'main' };
    const parser = createSseParser((value, message) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return null;
        }
        const raw = { ...value };
        if (raw.type === undefined && message.event) {
            raw.type = message.event;
        }
        return raw;
    });
    for (;;) {
        const result = await reader.read();
        if (result.done) {
            break;
        }
        for (const raw of parser.push(decoder.decode(result.value, { stream: true }))) {
            done = emitAdapted(raw, options, context) || done;
        }
    }
    for (const raw of parser.flush()) {
        done = emitAdapted(raw, options, context) || done;
    }
    return done;
}
function streamUrl(baseUrl) {
    const browserOrigin = globalThis.location?.origin;
    const origin = baseUrl ? `${baseUrl.replace(/\/+$/, '')}/` : browserOrigin;
    if (!origin) {
        throw new Error('baseUrl is required when no browser location is available');
    }
    return new URL('/api/chat/stream', origin);
}
export async function streamChat(request, options) {
    let attempt = 0;
    let lastError;
    while (attempt <= MAX_RETRIES) {
        try {
            const response = await fetch(streamUrl(options.baseUrl), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...options.headers },
                body: JSON.stringify(request),
                signal: options.signal,
            });
            if (!response.ok) {
                const detail = await response.text();
                throw new Error(`HTTP ${response.status}: ${detail || response.statusText}`);
            }
            const finished = await readStream(response, options);
            if (finished) {
                options.onDone?.();
            }
            return;
        }
        catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            if (attempt === MAX_RETRIES) {
                options.onError?.(lastError);
                throw lastError;
            }
            await sleep(INITIAL_BACKOFF_MS * 2 ** attempt);
            attempt += 1;
        }
    }
    if (lastError) {
        options.onError?.(lastError);
        throw lastError;
    }
}
