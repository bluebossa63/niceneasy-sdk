"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SseJsonParseError = void 0;
exports.parseSseMessage = parseSseMessage;
exports.parseSseMessages = parseSseMessages;
exports.parseSseJson = parseSseJson;
exports.createSseParser = createSseParser;
class SseJsonParseError extends Error {
    data;
    cause;
    constructor(data, cause) {
        const preview = data.length > 240 ? `${data.slice(0, 240)}...` : data;
        super(`Failed to parse SSE JSON data: ${preview}`);
        this.data = data;
        this.cause = cause;
        this.name = 'SseJsonParseError';
    }
}
exports.SseJsonParseError = SseJsonParseError;
function findSseSeparator(input) {
    const lf = input.indexOf('\n\n');
    const crlf = input.indexOf('\r\n\r\n');
    if (lf < 0 && crlf < 0) {
        return null;
    }
    if (lf < 0) {
        return { index: crlf, length: 4 };
    }
    if (crlf < 0) {
        return { index: lf, length: 2 };
    }
    return crlf < lf ? { index: crlf, length: 4 } : { index: lf, length: 2 };
}
function parseSseField(line) {
    const colon = line.indexOf(':');
    if (colon < 0) {
        return { field: line, value: '' };
    }
    const rawValue = line.slice(colon + 1);
    return {
        field: line.slice(0, colon),
        value: rawValue.startsWith(' ') ? rawValue.slice(1) : rawValue,
    };
}
function parseSseMessage(block) {
    const data = [];
    let event;
    let id;
    let retry;
    for (const line of block.split(/\r?\n/)) {
        if (line === '' || line.startsWith(':')) {
            continue;
        }
        const { field, value } = parseSseField(line);
        switch (field) {
            case 'event':
                event = value;
                break;
            case 'data':
                data.push(value);
                break;
            case 'id':
                id = value;
                break;
            case 'retry': {
                const parsed = Number(value);
                if (Number.isFinite(parsed)) {
                    retry = parsed;
                }
                break;
            }
        }
    }
    if (data.length === 0) {
        return null;
    }
    return { event, data: data.join('\n'), id, retry };
}
function parseSseMessages(input) {
    const messages = [];
    let rest = input;
    for (;;) {
        const separator = findSseSeparator(rest);
        if (!separator) {
            break;
        }
        const block = rest.slice(0, separator.index);
        rest = rest.slice(separator.index + separator.length);
        const message = parseSseMessage(block);
        if (message) {
            messages.push(message);
        }
    }
    return { messages, rest };
}
function parseSseJson(input, parser = (value) => (value && typeof value === 'object' ? value : null), onParseError) {
    const { messages, rest } = parseSseMessages(input);
    const events = [];
    for (const message of messages) {
        const data = message.data.trim();
        if (data === '' || data === '[DONE]') {
            continue;
        }
        let value;
        try {
            value = parseJsonData(data);
        }
        catch (err) {
            // Recovery path (S33-03): one malformed message must not abort the
            // remaining messages in the chunk. Without a handler we preserve the
            // legacy throwing behavior for direct callers.
            if (onParseError && err instanceof SseJsonParseError) {
                onParseError(err, message);
                continue;
            }
            throw err;
        }
        events.push(parser(value, message));
    }
    return { events: events.filter((event) => event !== null), rest };
}
function parseJsonData(data) {
    try {
        return JSON.parse(data);
    }
    catch (err) {
        throw new SseJsonParseError(data, err);
    }
}
function defaultParseErrorHandler(error) {
    console.warn(`[niceneasy-sdk] skipped malformed SSE message: ${error.message}`);
}
function createSseParser(parser, options) {
    let buffer = '';
    const onParseError = options?.onParseError ?? defaultParseErrorHandler;
    return {
        push(chunk) {
            buffer += chunk;
            const parsed = parseSseJson(buffer, parser, onParseError);
            buffer = parsed.rest;
            return parsed.events;
        },
        flush() {
            if (buffer.trim() === '') {
                buffer = '';
                return [];
            }
            const message = parseSseMessage(buffer);
            buffer = '';
            if (!message || message.data.trim() === '' || message.data.trim() === '[DONE]') {
                return [];
            }
            let value;
            try {
                value = parseJsonData(message.data);
            }
            catch (err) {
                if (err instanceof SseJsonParseError) {
                    onParseError(err, message);
                    return [];
                }
                throw err;
            }
            const event = parser ? parser(value, message) : (value && typeof value === 'object' ? value : null);
            return event ? [event] : [];
        },
        reset() {
            buffer = '';
        },
    };
}
