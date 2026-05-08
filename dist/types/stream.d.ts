export interface StreamEventMeta {
    run_id?: string;
    session_id?: string;
    message_id?: string;
    tool_call_id?: string;
    seq?: number;
    ts?: string;
}
export type StreamEvent = (StreamEventMeta & {
    type: 'session.created';
    session_id: string;
    agent: string;
    model: string;
}) | (StreamEventMeta & {
    type: 'message.started';
    message_id: string;
    role: 'assistant' | 'user';
}) | (StreamEventMeta & {
    type: 'text.delta';
    message_id: string;
    delta: string;
}) | (StreamEventMeta & {
    type: 'reasoning.delta';
    message_id: string;
    delta: string;
}) | (StreamEventMeta & {
    type: 'tool.started';
    tool_call_id: string;
    tool: string;
    args: unknown;
    iteration: number;
}) | (StreamEventMeta & {
    type: 'tool.output.delta';
    tool_call_id: string;
    delta: string;
}) | (StreamEventMeta & {
    type: 'tool.completed';
    tool_call_id: string;
    result_len: number;
    status: 'ok' | 'error';
    duration_ms: number;
}) | (StreamEventMeta & {
    type: 'permission.requested';
    permission_id: string;
    tool_call_id: string;
    tool: string;
    risk?: string;
}) | (StreamEventMeta & {
    type: 'permission.resolved';
    permission_id: string;
    decision: 'once' | 'always' | 'deny';
}) | (StreamEventMeta & UXStatusFields & {
    type: 'status';
    message: string;
}) | (StreamEventMeta & {
    type: 'usage';
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
}) | (StreamEventMeta & {
    type: 'finish';
    session_id: string;
    duration_ms: number;
    error?: string;
});
export type StreamEventType = StreamEvent['type'];
export type SequencedStreamEvent = StreamEvent & Required<Pick<StreamEventMeta, 'seq' | 'ts'>>;
export interface StreamEventContext extends StreamEventMeta {
    defaultMessageId?: string;
}
export type UXEventKind = 'tool.completed' | 'tool.inline_diff' | 'warning';
export interface UXStatusFields {
    ux_event_kind?: UXEventKind | string;
    tool?: string;
    args?: unknown;
    duration_ms?: number;
    iteration?: number;
    diff?: string;
    retry?: number;
    max_retries?: number;
}
export declare function withStreamEventMeta(event: StreamEvent, meta: StreamEventMeta): StreamEvent;
export declare function sequenceStreamEvent(event: StreamEvent, seq: number, ts?: string): SequencedStreamEvent;
export declare function adaptLegacyEvents(raw: Record<string, unknown>, context?: StreamEventContext): StreamEvent[];
export declare function adaptLegacyEvent(raw: Record<string, unknown>, context?: StreamEventContext): StreamEvent | null;
