import type { AgentCost } from './agents.js';
export interface CostOverview {
    total_cost_usd: number;
    agents: AgentCost[];
}
export interface SystemOverview {
    agent_count: number;
    session_count: number;
    total_cost_usd: number;
}
export interface HealthResponse {
    status: string;
}
export interface ReadyResponse extends HealthResponse {
    ready?: boolean;
    agents?: number;
    agents_count?: number;
    tables_ok?: boolean;
    skills_count?: number;
}
export interface Conversation {
    session_id: string;
    agent: string;
    created_at: string;
    updated_at: string;
    message_count: number;
}
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    tokens_in?: number;
    tokens_out?: number;
    cost_usd?: number;
    model?: string;
}
export interface PageEnvelope<T> {
    items: T[];
    total: number;
    limit?: number;
    offset?: number;
    hasMore?: boolean;
    has_more?: boolean;
}
export interface Notification {
    id: number;
    task_id: string;
    type: string;
    message: string;
    created_at: string;
    acknowledged_at: string | null;
}
export interface ErrorEntry {
    [key: string]: unknown;
}
export interface ErrorOverview {
    recent_errors: ErrorEntry[];
    disabled_models: Record<string, unknown>;
}
export interface RequestEvaluationSummary {
    id: string;
    created_at: string;
    source_kind: string;
    source_ref: string;
    request_type: string;
    work_mode: string;
    intent_summary: string;
    recommended_response_mode: string;
    status: string;
}
export interface RequestEvaluationDetail extends RequestEvaluationSummary {
    normalized_goal: string;
    constraints_json: string;
    prompt_profile_ref: string;
    task_seeds_json: string;
    notes_json: string;
}
export interface LoopInvocation {
    id: string;
    created_at: string;
    trigger_type: string;
    target_agent: string;
    source_ref: string;
    request_evaluation_id: string;
    scope_summary: string;
    decision_summary: string;
    affected_task_ids_json: string;
    model_summary_json: string;
    tool_summary_json: string;
    duration_ms: number;
    outcome: string;
    error: string;
}
export interface LoopStatus {
    running: boolean;
    last_run_time: string;
    last_outcome: string;
    last_invocation_id: string;
}
export interface ChatRequest {
    agent: string;
    prompt: string;
    type?: string;
    timeout?: number;
    profile?: 'full' | 'compact';
    session_id?: string;
}
export interface ChatResponse {
    agent: string;
    routed_by: string;
    profile: string;
    model: string;
    response: string;
    tokens_in: number;
    tokens_out: number;
    cost_usd: number;
    duration: string;
    session_id: string;
    error?: string;
}
