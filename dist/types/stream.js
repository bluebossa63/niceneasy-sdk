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
function legacyToolCallId(raw) {
    return asString(raw.tool_call_id, `${asString(raw.tool, 'tool')}:${asNumber(raw.iteration, 0)}`);
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
export function adaptLegacyEvents(raw) {
    switch (raw.type) {
        case 'token':
            return [{ type: 'text.delta', message_id: asString(raw.message_id, 'main'), delta: asString(raw.delta) }];
        case 'tool_call':
            return [{
                    type: 'tool.started',
                    tool_call_id: legacyToolCallId(raw),
                    tool: asString(raw.tool),
                    args: parseArgs(raw.args),
                    iteration: asNumber(raw.iteration, 0),
                }];
        case 'tool_result':
            return [{
                    type: 'tool.completed',
                    tool_call_id: legacyToolCallId(raw),
                    result_len: asNumber(raw.result_len, 0),
                    status: 'ok',
                    duration_ms: asNumber(raw.duration_ms, 0),
                }];
        case 'status':
            return [{ type: 'status', message: asString(raw.message) }];
        case 'finish': {
            const usage = {
                type: 'usage',
                tokens_in: asNumber(raw.tokens_in, 0),
                tokens_out: asNumber(raw.tokens_out, 0),
                cost_usd: asNumber(raw.cost_usd, 0),
            };
            const finish = {
                type: 'finish',
                session_id: asString(raw.session_id),
                duration_ms: asNumber(raw.duration_ms, 0),
                ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : {}),
                ...(typeof raw.error === 'string' && raw.error !== '' ? { error: raw.error } : {}),
            };
            return [usage, finish];
        }
        case 'error':
            return [{
                    type: 'finish',
                    session_id: asString(raw.session_id),
                    duration_ms: asNumber(raw.duration_ms, 0),
                    ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : {}),
                    error: asString(raw.error, 'stream error'),
                }];
        default:
            if (canonicalTypes.has(raw.type)) {
                return [raw];
            }
            return [];
    }
}
export function adaptLegacyEvent(raw) {
    return adaptLegacyEvents(raw)[0] ?? null;
}
