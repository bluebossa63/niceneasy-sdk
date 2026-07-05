import { sequenceStreamEvent } from '../types/stream.js';
export function normalizeRunEvents(rows) {
    return [...rows]
        .sort((left, right) => left.seq - right.seq)
        .map((row) => sequenceStreamEvent(row.payload, row.seq, row.ts));
}
function withParagraphBreak(text) {
    if (text.length === 0)
        return text;
    if (/\n[ \t]*\n[ \t]*$/.test(text))
        return text;
    return `${text.replace(/\s+$/, '')}\n\n`;
}
// The runtime stores a placeholder as the content of an assistant turn that only
// issued a tool call (providers reject an empty assistant turn that carries
// tool_calls). Some models imitate a readable placeholder and echo it back as
// narration on later turns, so a literal "(tool call)" can leak into the stream.
// Strip any standalone occurrence defensively so it never reaches the UI, even
// for in-flight or legacy sessions produced before the runtime placeholder was
// neutralized. Only whole-segment matches are removed; prose that merely
// mentions a tool call is left untouched.
function stripToolCallPlaceholder(text) {
    if (!text.includes('(tool call)'))
        return text;
    const cleaned = text
        .replace(/(^|\n)[ \t]*\(tool call\)[ \t]*(?=\n|$)/g, '$1')
        .replace(/\n{3,}/g, '\n\n')
        .replace(/^\s+|\s+$/g, '');
    return cleaned;
}
export function buildRunTimeline(events) {
    const tools = new Map();
    const permissions = new Map();
    const statuses = [];
    const errors = [];
    let assistantText = '';
    let reasoningText = '';
    // A tool call between two content segments marks a round boundary. Models emit
    // the trailing text of one round and the leading text of the next as separate
    // delta streams with no separator, so concatenating them raw glues sentences
    // together (e.g. "in parallel.The quote is stale"). Insert a paragraph break at
    // those boundaries while leaving intra-round deltas untouched.
    let pendingTextBreak = false;
    let pendingReasoningBreak = false;
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
                if (pendingTextBreak) {
                    assistantText = withParagraphBreak(assistantText);
                    pendingTextBreak = false;
                }
                assistantText += event.delta;
                break;
            case 'reasoning.delta':
                if (pendingReasoningBreak) {
                    reasoningText = withParagraphBreak(reasoningText);
                    pendingReasoningBreak = false;
                }
                reasoningText += event.delta;
                break;
            case 'tool.started':
                pendingTextBreak = assistantText.length > 0;
                pendingReasoningBreak = reasoningText.length > 0;
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
                    resultPreview: event.result_preview ?? existing?.resultPreview,
                    resultLen: existing?.resultLen,
                    status: existing?.status,
                    failureClass: event.failure_class ?? existing?.failureClass,
                    retryable: event.retryable ?? existing?.retryable,
                    isError: event.is_error ?? existing?.isError,
                    durationMs: existing?.durationMs,
                });
                break;
            }
            case 'tool.completed': {
                pendingTextBreak = pendingTextBreak || assistantText.length > 0;
                pendingReasoningBreak = pendingReasoningBreak || reasoningText.length > 0;
                const existing = tools.get(event.tool_call_id);
                tools.set(event.tool_call_id, {
                    id: event.tool_call_id,
                    tool: existing?.tool ?? 'unknown',
                    args: existing?.args,
                    iteration: existing?.iteration ?? 0,
                    startedAt: existing?.startedAt,
                    completedAt: event.ts,
                    output: event.result ?? existing?.output ?? '',
                    resultPreview: event.result_preview ?? existing?.resultPreview,
                    resultLen: event.result_len,
                    status: event.status,
                    failureClass: event.failure_class,
                    retryable: event.retryable,
                    isError: event.is_error,
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
                statuses.push({
                    seq: event.seq,
                    ts: event.ts,
                    message: event.message,
                    uxEventKind: event.ux_event_kind,
                    tool: event.tool,
                    args: event.args,
                    durationMs: event.duration_ms,
                    iteration: event.iteration,
                    diff: event.diff,
                    retry: event.retry,
                    maxRetries: event.max_retries,
                });
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
        assistantText: stripToolCallPlaceholder(assistantText),
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
