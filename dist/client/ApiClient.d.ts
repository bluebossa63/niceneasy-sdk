import type { AgentCost, AgentInfo, ApprovalDecision, ApprovalDetail, ChatRequest, ChatResponse, CommandCenterSummary, Conversation, ConversationMessage, CostOverview, ErrorOverview, FleetSummary, HealthResponse, LoopInvocation, LoopStatus, ModelListEnvelope, PermissionListEnvelope, PermissionResolution, ProjectDetail, ProjectDraftInput, ProjectSummary, Notification, ReadyResponse, RequestEvaluationDetail, RequestEvaluationSummary, RunEvent, RunSummary, SystemOverview, TaskLineageResponse, TaskListResponse, TaskRequest, TaskResponse, ToolListEnvelope, WorkItem, WorkItemStatus, WorkspaceContext } from '../types/index.js';
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
    getModels(): Promise<ModelListEnvelope>;
    getTools(agent?: string): Promise<ToolListEnvelope>;
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
    getWorkspace(): Promise<WorkspaceContext>;
    getCommandCenterSummary(): Promise<CommandCenterSummary>;
    getProjects(): Promise<ProjectSummary[]>;
    getProject(projectId: string): Promise<ProjectDetail>;
    createProjectDraft(input: ProjectDraftInput): Promise<ProjectSummary>;
    moveWorkItem(projectId: string, itemId: string, targetStatus: WorkItemStatus): Promise<WorkItem>;
    getApprovals(): Promise<ApprovalDetail[]>;
    getApproval(approvalId: string): Promise<ApprovalDetail>;
    decideApproval(approvalId: string, decision: ApprovalDecision, comment?: string): Promise<ApprovalDetail>;
    getFleets(): Promise<FleetSummary[]>;
    getPermissions(): Promise<PermissionListEnvelope>;
    resolvePermission(resolution: PermissionResolution): Promise<PermissionResolution>;
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
