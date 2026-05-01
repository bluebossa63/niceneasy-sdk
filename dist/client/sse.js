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
export function parseSseMessage(block) {
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
export function parseSseMessages(input) {
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
export function parseSseJson(input, parser = (value) => (value && typeof value === 'object' ? value : null)) {
    const { messages, rest } = parseSseMessages(input);
    const events = [];
    for (const message of messages) {
        const data = message.data.trim();
        if (data === '' || data === '[DONE]') {
            continue;
        }
        events.push(parser(JSON.parse(data), message));
    }
    return { events: events.filter((event) => event !== null), rest };
}
export function createSseParser(parser) {
    let buffer = '';
    return {
        push(chunk) {
            buffer += chunk;
            const parsed = parseSseJson(buffer, parser);
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
            const value = JSON.parse(message.data);
            const event = parser ? parser(value, message) : (value && typeof value === 'object' ? value : null);
            return event ? [event] : [];
        },
        reset() {
            buffer = '';
        },
    };
}
