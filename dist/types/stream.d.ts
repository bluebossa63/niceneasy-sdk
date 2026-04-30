export type StreamEvent = {
    type: 'session.created';
    session_id: string;
    agent: string;
    model: string;
} | {
    type: 'message.started';
    message_id: string;
    role: 'assistant' | 'user';
} | {
    type: 'text.delta';
    message_id: string;
    delta: string;
} | {
    type: 'reasoning.delta';
    message_id: string;
    delta: string;
} | {
    type: 'tool.started';
    tool_call_id: string;
    tool: string;
    args: unknown;
    iteration: number;
} | {
    type: 'tool.output.delta';
    tool_call_id: string;
    delta: string;
} | {
    type: 'tool.completed';
    tool_call_id: string;
    result_len: number;
    status: 'ok' | 'error';
    duration_ms: number;
} | {
    type: 'permission.requested';
    permission_id: string;
    tool_call_id: string;
    tool: string;
    risk?: string;
} | {
    type: 'permission.resolved';
    permission_id: string;
    decision: 'once' | 'always' | 'deny';
} | {
    type: 'status';
    message: string;
} | {
    type: 'usage';
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
} | {
    type: 'finish';
    session_id: string;
    duration_ms: number;
    run_id?: string;
    error?: string;
};
export declare function adaptLegacyEvents(raw: Record<string, unknown>): StreamEvent[];
export declare function adaptLegacyEvent(raw: Record<string, unknown>): StreamEvent | null;
