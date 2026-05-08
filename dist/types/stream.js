const canonicalTypes = new Set([
    'session.created',
    'message.started',
    'text.delta',
    'reasoning.delta',
    'tool.started',
    'tool.output.delta',
    'tool.completed',
    'permission.requested',
    'permission.resolved',
    'status',
    'usage',
    'finish',
]);
function asString(value, fallback = '') {
    return typeof value === 'string' ? value : fallback;
}
function asNumber(value, fallback = 0) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
function metaFromRaw(raw, context) {
    return {
        ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : context?.run_id ? { run_id: context.run_id } : {}),
        ...(typeof raw.session_id === 'string' && raw.session_id !== '' ? { session_id: raw.session_id } : context?.session_id ? { session_id: context.session_id } : {}),
        ...(typeof raw.message_id === 'string' && raw.message_id !== '' ? { message_id: raw.message_id } : context?.message_id ? { message_id: context.message_id } : {}),
        ...(typeof raw.tool_call_id === 'string' && raw.tool_call_id !== '' ? { tool_call_id: raw.tool_call_id } : context?.tool_call_id ? { tool_call_id: context.tool_call_id } : {}),
        ...(typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? { seq: raw.seq } : context?.seq !== undefined ? { seq: context.seq } : {}),
        ...(typeof raw.ts === 'string' && raw.ts !== '' ? { ts: raw.ts } : context?.ts ? { ts: context.ts } : {}),
    };
}
function legacyToolCallId(raw, context) {
    return asString(raw.tool_call_id, context?.tool_call_id ?? `${asString(raw.tool, 'tool')}:${asNumber(raw.iteration, 0)}`);
}
function parseArgs(args) {
    if (typeof args !== 'string') {
        return args;
    }
    try {
        return JSON.parse(args);
    }
    catch {
        return args;
    }
}
export function withStreamEventMeta(event, meta) {
    return {
        ...event,
        ...(meta.run_id !== undefined && event.run_id === undefined ? { run_id: meta.run_id } : {}),
        ...(meta.session_id !== undefined && event.session_id === undefined ? { session_id: meta.session_id } : {}),
        ...(meta.message_id !== undefined && event.message_id === undefined ? { message_id: meta.message_id } : {}),
        ...(meta.tool_call_id !== undefined && event.tool_call_id === undefined ? { tool_call_id: meta.tool_call_id } : {}),
        ...(meta.seq !== undefined && event.seq === undefined ? { seq: meta.seq } : {}),
        ...(meta.ts !== undefined && event.ts === undefined ? { ts: meta.ts } : {}),
    };
}
export function sequenceStreamEvent(event, seq, ts = new Date().toISOString()) {
    return withStreamEventMeta(event, { seq: event.seq ?? seq, ts: event.ts ?? ts });
}
export function adaptLegacyEvents(raw, context) {
    const meta = metaFromRaw(raw, context);
    const messageId = asString(raw.message_id, context?.defaultMessageId ?? context?.message_id ?? 'main');
    switch (raw.type) {
        case 'token':
            return [withStreamEventMeta({ ...meta, type: 'text.delta', message_id: messageId, delta: asString(raw.delta) }, meta)];
        case 'tool_call':
            return [{
                    ...meta,
                    type: 'tool.started',
                    tool_call_id: legacyToolCallId(raw, context),
                    tool: asString(raw.tool),
                    args: parseArgs(raw.args),
                    iteration: asNumber(raw.iteration, 0),
                }];
        case 'tool_result':
            return [{
                    ...meta,
                    type: 'tool.completed',
                    tool_call_id: legacyToolCallId(raw, context),
                    result_len: asNumber(raw.result_len, 0),
                    status: 'ok',
                    duration_ms: asNumber(raw.duration_ms, 0),
                }];
        case 'status':
            return [{
                    ...meta,
                    type: 'status',
                    message: asString(raw.message),
                    ...(typeof raw.ux_event_kind === 'string' && raw.ux_event_kind !== '' ? { ux_event_kind: raw.ux_event_kind } : {}),
                    ...(typeof raw.tool === 'string' && raw.tool !== '' ? { tool: raw.tool } : {}),
                    ...(raw.args !== undefined ? { args: parseArgs(raw.args) } : {}),
                    ...(typeof raw.duration_ms === 'number' && Number.isFinite(raw.duration_ms) ? { duration_ms: raw.duration_ms } : {}),
                    ...(typeof raw.iteration === 'number' && Number.isFinite(raw.iteration) ? { iteration: raw.iteration } : {}),
                    ...(typeof raw.diff === 'string' && raw.diff !== '' ? { diff: raw.diff } : {}),
                    ...(typeof raw.retry === 'number' && Number.isFinite(raw.retry) ? { retry: raw.retry } : {}),
                    ...(typeof raw.max_retries === 'number' && Number.isFinite(raw.max_retries) ? { max_retries: raw.max_retries } : {}),
                }];
        case 'finish': {
            const usage = {
                ...meta,
                type: 'usage',
                tokens_in: asNumber(raw.tokens_in, 0),
                tokens_out: asNumber(raw.tokens_out, 0),
                cost_usd: asNumber(raw.cost_usd, 0),
            };
            const finish = {
                ...meta,
                type: 'finish',
                session_id: asString(raw.session_id, context?.session_id),
                duration_ms: asNumber(raw.duration_ms, 0),
                ...(typeof raw.error === 'string' && raw.error !== '' ? { error: raw.error } : {}),
            };
            return [usage, finish];
        }
        case 'error':
            return [{
                    ...meta,
                    type: 'finish',
                    session_id: asString(raw.session_id, context?.session_id),
                    duration_ms: asNumber(raw.duration_ms, 0),
                    error: asString(raw.error, 'stream error'),
                }];
        default:
            if (canonicalTypes.has(raw.type)) {
                return [withStreamEventMeta(raw, meta)];
            }
            return [];
    }
}
export function adaptLegacyEvent(raw, context) {
    return adaptLegacyEvents(raw, context)[0] ?? null;
}
