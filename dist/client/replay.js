import { sequenceStreamEvent } from '../types/stream.js';
export function normalizeRunEvents(rows) {
    return [...rows]
        .sort((left, right) => left.seq - right.seq)
        .map((row) => sequenceStreamEvent(row.payload, row.seq, row.ts));
}
export function buildRunTimeline(events) {
    const tools = new Map();
    const permissions = new Map();
    const statuses = [];
    const errors = [];
    let assistantText = '';
    let reasoningText = '';
    let usage;
    let finish;
    let sessionId;
    let runId;
    let messageId;
    let startedAt;
    for (const event of events) {
        runId = event.run_id ?? runId;
        sessionId = event.session_id ?? sessionId;
        messageId = event.message_id ?? messageId;
        startedAt ??= event.ts;
        switch (event.type) {
            case 'session.created':
                sessionId = event.session_id;
                break;
            case 'message.started':
                messageId = event.message_id;
                break;
            case 'text.delta':
                assistantText += event.delta;
                break;
            case 'reasoning.delta':
                reasoningText += event.delta;
                break;
            case 'tool.started':
                tools.set(event.tool_call_id, {
                    id: event.tool_call_id,
                    tool: event.tool,
                    args: event.args,
                    iteration: event.iteration,
                    startedAt: event.ts,
                    output: tools.get(event.tool_call_id)?.output ?? '',
                });
                break;
            case 'tool.output.delta': {
                const existing = tools.get(event.tool_call_id);
                tools.set(event.tool_call_id, {
                    id: event.tool_call_id,
                    tool: existing?.tool ?? 'unknown',
                    args: existing?.args,
                    iteration: existing?.iteration ?? 0,
                    startedAt: existing?.startedAt,
                    completedAt: existing?.completedAt,
                    output: `${existing?.output ?? ''}${event.delta}`,
                    resultLen: existing?.resultLen,
                    status: existing?.status,
                    durationMs: existing?.durationMs,
                });
                break;
            }
            case 'tool.completed': {
                const existing = tools.get(event.tool_call_id);
                tools.set(event.tool_call_id, {
                    id: event.tool_call_id,
                    tool: existing?.tool ?? 'unknown',
                    args: existing?.args,
                    iteration: existing?.iteration ?? 0,
                    startedAt: existing?.startedAt,
                    completedAt: event.ts,
                    output: existing?.output ?? '',
                    resultLen: event.result_len,
                    status: event.status,
                    durationMs: event.duration_ms,
                });
                break;
            }
            case 'permission.requested':
                permissions.set(event.permission_id, {
                    id: event.permission_id,
                    toolCallId: event.tool_call_id,
                    tool: event.tool,
                    risk: event.risk,
                    requestedAt: event.ts,
                });
                break;
            case 'permission.resolved': {
                const existing = permissions.get(event.permission_id);
                permissions.set(event.permission_id, {
                    id: event.permission_id,
                    toolCallId: existing?.toolCallId ?? 'unknown',
                    tool: existing?.tool ?? 'unknown',
                    risk: existing?.risk,
                    requestedAt: existing?.requestedAt,
                    resolvedAt: event.ts,
                    decision: event.decision,
                });
                break;
            }
            case 'status':
                statuses.push({ seq: event.seq, ts: event.ts, message: event.message });
                break;
            case 'usage':
                usage = event;
                break;
            case 'finish':
                finish = event;
                if (event.error) {
                    errors.push(event.error);
                }
                break;
        }
    }
    return {
        events: [...events],
        assistantText,
        reasoningText,
        tools: [...tools.values()],
        permissions: [...permissions.values()],
        statuses,
        errors,
        usage,
        finish,
        sessionId,
        runId,
        messageId,
        startedAt,
        finishedAt: finish?.ts,
    };
}
export function runEventsToTimeline(rows) {
    return buildRunTimeline(normalizeRunEvents(rows));
}
