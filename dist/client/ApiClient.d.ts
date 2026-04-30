import type { AgentCost, AgentInfo, ChatRequest, ChatResponse, Conversation, ConversationMessage, CostOverview, ErrorOverview, HealthResponse, LoopInvocation, LoopStatus, Notification, ReadyResponse, RequestEvaluationDetail, RequestEvaluationSummary, RunEvent, RunSummary, SystemOverview, TaskLineageResponse, TaskListResponse, TaskRequest, TaskResponse } from '../types/index.js';
export declare class ApiError extends Error {
    readonly status: number;
    readonly statusText: string;
    constructor(status: number, statusText: string, message?: string);
}
export interface ApiClientOptions {
    baseUrl: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    fetch?: typeof fetch;
}
export declare class ApiClient {
    private readonly baseUrl;
    private readonly headers;
    private readonly timeoutMs;
    private readonly fetchImpl?;
    constructor(options: ApiClientOptions);
    request<T>(path: string, options?: RequestInit & {
        timeoutMs?: number;
    }): Promise<T>;
    private nodeRequest;
    healthCheck(): Promise<HealthResponse>;
    readyCheck(): Promise<ReadyResponse>;
    listAgents(): Promise<AgentInfo[]>;
    getAgent(name: string): Promise<AgentInfo>;
    chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse>;
    createTask(req: TaskRequest): Promise<TaskResponse>;
    listTasks(): Promise<TaskResponse[]>;
    getPendingTasks(): Promise<TaskResponse[]>;
    getCommandCenterTask(taskId: string): Promise<TaskResponse>;
    getCommandCenterTaskChildren(taskId: string): Promise<TaskListResponse>;
    getCommandCenterTaskLineage(taskId: string): Promise<TaskLineageResponse>;
    getCommandCenterProjectTasks(projectId: string): Promise<TaskListResponse>;
    getCosts(): Promise<CostOverview>;
    getAgentCosts(agent: string): Promise<AgentCost>;
    listConversations(): Promise<Conversation[]>;
    getConversationMessages(sessionId: string): Promise<ConversationMessage[]>;
    listNotifications(): Promise<Notification[]>;
    ackNotification(id: string): Promise<void>;
    getOverview(): Promise<SystemOverview>;
    getErrors(): Promise<ErrorOverview>;
    getRequestEvaluations(limit?: number): Promise<RequestEvaluationSummary[]>;
    getRequestEvaluation(id: string): Promise<RequestEvaluationDetail>;
    getLoopInvocations(limit?: number): Promise<LoopInvocation[]>;
    getLoopStatus(): Promise<LoopStatus>;
    fetchRunEvents(runId: string, options?: RequestInit & {
        timeoutMs?: number;
    }): Promise<RunEvent[]>;
    fetchRuns(options?: {
        limit?: number;
    } & RequestInit & {
        timeoutMs?: number;
    }): Promise<RunSummary[]>;
}
