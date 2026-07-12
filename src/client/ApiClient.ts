import type {
  AgentCost,
  AgentInfo,
  ApprovalDecision,
  ApprovalDecisionInput,
  ApprovalDetail,
  ApprovalListEnvelope,
  ChatRequest,
  ChatResponse,
  CommandCenterSummary,
  Conversation,
  ConversationMessage,
  CostOverview,
  CreateProjectInput,
  ErrorOverview,
  FleetSummary,
  HealthResponse,
  LoopInvocation,
  LoopStatus,
  ModelListEnvelope,
  Notification,
  PermissionListEnvelope,
  PermissionResolution,
  ProjectDetail,
  ProjectDraftInput,
  ProjectListEnvelope,
  ProjectSummary,
  ReadyResponse,
  RequestEvaluationDetail,
  RequestEvaluationSummary,
  RunEvent,
  RunEventsResponse,
  RunSummary,
  RunsResponse,
  SystemOverview,
  TaskLineageResponse,
  TaskListResponse,
  TaskRequest,
  TaskResponse,
  ToolListEnvelope,
  WorkItem,
  WorkItemStatus,
  WorkspaceContext,
} from '../types/index.js'
import { HttpJsonClient, chatTransportTimeoutMs } from '../http/request.js'
import type { ApiClientOptions } from '../http/request.js'
import { sequenceStreamEvent } from '../stream/events.js'
import { adaptLegacyEvent } from '../stream/legacyAdapter.js'

export { ApiError, CHAT_TRANSPORT_GRACE_MS, HttpJsonClient, chatTransportTimeoutMs } from '../http/request.js'
export type { ApiClientOptions } from '../http/request.js'

export class AgentApiClient {
  private readonly transport: HttpJsonClient

  constructor(options: ApiClientOptions) {
    this.transport = new HttpJsonClient(options)
  }

  request<T>(path: string, options?: RequestInit & { timeoutMs?: number | null }): Promise<T> {
    return this.transport.request(path, options)
  }

  healthCheck(): Promise<HealthResponse> {
    return this.request('/healthz')
  }

  readyCheck(): Promise<ReadyResponse> {
    return this.request('/readyz')
  }

  listAgents(): Promise<AgentInfo[]> {
    return this.request('/api/agents')
  }

  getAgent(name: string): Promise<AgentInfo> {
    return this.request(`/api/agents/${encodeURIComponent(name)}`)
  }

  getModels(): Promise<ModelListEnvelope> {
    return this.request('/api/models')
  }

  getTools(agent?: string): Promise<ToolListEnvelope> {
    const query = agent ? `?agent=${encodeURIComponent(agent)}` : ''
    return this.request(`/api/tools${query}`)
  }

  chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return this.request('/api/chat', {
      method: 'POST',
      body: JSON.stringify(req),
      timeoutMs: chatTransportTimeoutMs(req.timeout) ?? null,
      signal,
    })
  }

  createTask(req: TaskRequest): Promise<TaskResponse> {
    return this.request('/api/tasks', { method: 'POST', body: JSON.stringify(req) })
  }

  listTasks(): Promise<TaskResponse[]> {
    return this.request('/api/tasks')
  }

  getPendingTasks(): Promise<TaskResponse[]> {
    return this.request('/api/tasks/pending')
  }

  getCommandCenterTask(taskId: string): Promise<TaskResponse> {
    return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}`)
  }

  getCommandCenterTaskChildren(taskId: string): Promise<TaskListResponse> {
    return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}/children`)
  }

  getCommandCenterTaskLineage(taskId: string): Promise<TaskLineageResponse> {
    return this.request(`/api/command-center/tasks/${encodeURIComponent(taskId)}/lineage`)
  }

  getCommandCenterProjectTasks(projectId: string): Promise<TaskListResponse> {
    return this.request(`/api/command-center/projects/${encodeURIComponent(projectId)}/tasks`)
  }

  getCosts(): Promise<CostOverview> {
    return this.request('/api/costs')
  }

  getAgentCosts(agent: string): Promise<AgentCost> {
    return this.request(`/api/costs/${encodeURIComponent(agent)}`)
  }

  listConversations(): Promise<Conversation[]> {
    return this.request('/api/conversations')
  }

  getConversationMessages(sessionId: string): Promise<ConversationMessage[]> {
    return this.request(`/api/conversations/${encodeURIComponent(sessionId)}`)
  }

  listNotifications(): Promise<Notification[]> {
    return this.request('/api/notifications')
  }

  ackNotification(id: string): Promise<void> {
    return this.request(`/api/notifications/${encodeURIComponent(id)}/ack`, { method: 'POST' })
  }

  getOverview(): Promise<SystemOverview> {
    return this.request('/api/overview')
  }

  getErrors(): Promise<ErrorOverview> {
    return this.request('/api/errors')
  }

  getWorkspace(): Promise<WorkspaceContext> {
    return this.request('/api/workspace')
  }

  getCommandCenterSummary(): Promise<CommandCenterSummary> {
    return this.request('/api/workspace/summary')
  }

  async getProjects(): Promise<ProjectSummary[]> {
    const envelope = await this.request<ProjectListEnvelope>('/api/projects')
    return envelope.items
  }

  getProject(projectId: string): Promise<ProjectDetail> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}`)
  }

  createProject(input: CreateProjectInput): Promise<ProjectSummary> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  /** @deprecated Use createProject. */
  createProjectDraft(input: ProjectDraftInput): Promise<ProjectSummary> {
    return this.createProject(input)
  }

  moveWorkItem(projectId: string, itemId: string, targetStatus: WorkItemStatus): Promise<WorkItem> {
    return this.request(`/api/projects/${encodeURIComponent(projectId)}/work-items/${encodeURIComponent(itemId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: targetStatus }),
    })
  }

  async getApprovals(): Promise<ApprovalDetail[]> {
    const envelope = await this.request<ApprovalListEnvelope>('/api/approvals')
    return envelope.items
  }

  getApproval(approvalId: string): Promise<ApprovalDetail> {
    return this.request(`/api/approvals/${encodeURIComponent(approvalId)}`)
  }

  decideApproval(
    approvalId: string,
    decision: ApprovalDecision,
    comment?: string,
  ): Promise<ApprovalDetail> {
    const input: ApprovalDecisionInput = comment !== undefined ? { decision, comment } : { decision }
    return this.request(`/api/approvals/${encodeURIComponent(approvalId)}/decision`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  }

  getFleets(): Promise<FleetSummary[]> {
    return this.request('/api/fleets')
  }

  getPermissions(): Promise<PermissionListEnvelope> {
    return this.request('/api/permissions')
  }

  resolvePermission(resolution: PermissionResolution): Promise<PermissionResolution> {
    return this.request(`/api/permissions/${encodeURIComponent(resolution.id)}/decision`, {
      method: 'POST',
      body: JSON.stringify(resolution),
    })
  }

  getRequestEvaluations(limit = 20): Promise<RequestEvaluationSummary[]> {
    return this.request(`/api/request_evaluations?limit=${encodeURIComponent(String(limit))}`)
  }

  getRequestEvaluation(id: string): Promise<RequestEvaluationDetail> {
    return this.request(`/api/request_evaluations/${encodeURIComponent(id)}`)
  }

  getLoopInvocations(limit = 20): Promise<LoopInvocation[]> {
    return this.request(`/api/loop/invocations?limit=${encodeURIComponent(String(limit))}`)
  }

  getLoopStatus(): Promise<LoopStatus> {
    return this.request('/api/loop/status')
  }

  async fetchNormalizedRunEvents(
    runId: string,
    options?: RequestInit & { timeoutMs?: number },
  ): Promise<RunEvent[]> {
    const response = await this.request<RunEventsResponse>(
      `/api/runs/${encodeURIComponent(runId)}/events`,
      options,
    )
    return response.events.map((event) => {
      const rawPayload = event.event ?? (JSON.parse(event.payload) as Record<string, unknown>)
      const payload = adaptLegacyEvent(rawPayload as Record<string, unknown>, {
        seq: event.seq,
        ts: event.ts,
      })
      if (!payload) {
        throw new Error(`Unsupported run event payload type: ${event.event_type}`)
      }
      return { ...event, payload: sequenceStreamEvent(payload, event.seq, event.ts) }
    })
  }

  /** @deprecated Use fetchNormalizedRunEvents. */
  fetchRunEvents(
    runId: string,
    options?: RequestInit & { timeoutMs?: number },
  ): Promise<RunEvent[]> {
    return this.fetchNormalizedRunEvents(runId, options)
  }

  async fetchRuns(options?: { limit?: number } & RequestInit & { timeoutMs?: number }): Promise<RunSummary[]> {
    const limit = options?.limit ?? 20
    const response = await this.request<RunsResponse>(
      `/api/runs?limit=${encodeURIComponent(String(limit))}`,
      options,
    )
    return response.runs
  }

  abortRun(runId: string, options?: RequestInit & { timeoutMs?: number }): Promise<{ run_id: string; aborted: boolean; message?: string }> {
    return this.request(`/api/runs/${encodeURIComponent(runId)}/abort`, {
      ...options,
      method: 'POST',
    })
  }
}

/** @deprecated Use AgentApiClient. */
export class ApiClient extends AgentApiClient {}
