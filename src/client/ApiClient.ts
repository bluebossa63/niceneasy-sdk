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
  ErrorOverview,
  FleetSummary,
  HealthResponse,
  LoopInvocation,
  LoopStatus,
  ModelListEnvelope,
  PermissionListEnvelope,
  PermissionResolution,
  ProjectDetail,
  ProjectDraftInput,
  ProjectListEnvelope,
  ProjectSummary,
  Notification,
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
import { adaptLegacyEvent, sequenceStreamEvent } from '../types/index.js'

export class ApiError extends Error {
  public readonly status: number
  public readonly statusText: string

  constructor(
    status: number,
    statusText: string,
    message?: string,
  ) {
    super(message ?? `API error: ${status} ${statusText}`)
    this.name = 'ApiError'
    this.status = status
    this.statusText = statusText
  }
}

export interface ApiClientOptions {
  baseUrl: string
  headers?: Record<string, string>
  timeoutMs?: number
  fetch?: typeof fetch
}

const DEFAULT_TIMEOUT_MS = 15_000
const CHAT_TIMEOUT_MS = 120_000

function resolveFetch(fetchImpl?: typeof fetch): typeof fetch | undefined {
  if (fetchImpl) {
    return fetchImpl
  }
  if (typeof globalThis.fetch === 'function') {
    return globalThis.fetch.bind(globalThis)
  }
  return undefined
}

function parseJsonBody<T>(body: string): T | undefined {
  if (!body.trim()) {
    return undefined
  }
  return JSON.parse(body) as T
}

function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const out = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

export class ApiClient {
  private readonly baseUrl: string
  private readonly headers: Record<string, string>
  private readonly timeoutMs: number
  private readonly fetchImpl?: typeof fetch

  constructor(options: ApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '')
    this.headers = options.headers ?? {}
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = resolveFetch(options.fetch)
  }

  async request<T>(path: string, options?: RequestInit & { timeoutMs?: number }): Promise<T> {
    const url = new URL(path, `${this.baseUrl}/`)
    const timeoutMs = options?.timeoutMs ?? this.timeoutMs
    const headers = {
      'Content-Type': 'application/json',
      ...this.headers,
      ...(options?.headers ?? {}),
    } as Record<string, string>

    if (!this.fetchImpl) {
      return this.nodeRequest<T>(url, { ...options, headers, timeoutMs })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    const signal = options?.signal ?? controller.signal
    try {
      const response = await this.fetchImpl(url, { ...options, headers, signal })
      const text = await response.text()
      if (!response.ok) {
        throw new ApiError(response.status, response.statusText, text || undefined)
      }
      return parseJsonBody<T>(text) as T
    } finally {
      clearTimeout(timeout)
    }
  }

  private async nodeRequest<T>(
    url: URL,
    init: RequestInit & { timeoutMs: number },
  ): Promise<T> {
    const importNodeModule = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<{
      request: (...args: unknown[]) => {
        on: (event: string, listener: (...args: any[]) => void) => void
        write: (body: string) => void
        end: () => void
        destroy: (err?: Error) => void
      }
    }>
    const protocol = await importNodeModule(url.protocol === 'https:' ? 'node:https' : 'node:http')
    const body = typeof init.body === 'string' ? init.body : undefined
    const headers = { ...(init.headers as Record<string, string> | undefined) }
    if (body !== undefined && !('Content-Length' in headers) && !('content-length' in headers)) {
      headers['Content-Length'] = new TextEncoder().encode(body).length.toString()
    }

    return await new Promise<T>((resolve, reject) => {
      const req = protocol.request(url, { method: init.method ?? 'GET', headers })
      const timer = setTimeout(() => {
        req.destroy(new Error(`Request timed out after ${init.timeoutMs}ms`))
      }, init.timeoutMs)

      req.on('response', (res) => {
        const chunks: Uint8Array[] = []
        res.on('data', (chunk: unknown) => {
          chunks.push(typeof chunk === 'string' ? new TextEncoder().encode(chunk) : chunk as Uint8Array)
        })
        res.on('end', () => {
          clearTimeout(timer)
          const responseBody = new TextDecoder().decode(concatUint8Arrays(chunks))
          const status = res.statusCode ?? 500
          const statusText = res.statusMessage ?? 'Unknown Error'
          if (status < 200 || status >= 300) {
            reject(new ApiError(status, statusText, responseBody || undefined))
            return
          }
          try {
            resolve(parseJsonBody<T>(responseBody) as T)
          } catch (err) {
            reject(err)
          }
        })
      })
      req.on('error', (err) => {
        clearTimeout(timer)
        reject(err)
      })
      if (init.signal) {
        if (init.signal.aborted) {
          req.destroy(new Error('Request aborted'))
          return
        }
        init.signal.addEventListener('abort', () => req.destroy(new Error('Request aborted')), { once: true })
      }
      if (body !== undefined) {
        req.write(body)
      }
      req.end()
    })
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
      timeoutMs: CHAT_TIMEOUT_MS,
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

  createProjectDraft(input: ProjectDraftInput): Promise<ProjectSummary> {
    return this.request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    })
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

  async fetchRunEvents(
    runId: string,
    options?: RequestInit & { timeoutMs?: number },
  ): Promise<RunEvent[]> {
    const response = await this.request<RunEventsResponse>(
      `/api/runs/${encodeURIComponent(runId)}/events`,
      options,
    )
    return response.events.map((event) => {
      const payload = adaptLegacyEvent(JSON.parse(event.payload) as Record<string, unknown>, {
        seq: event.seq,
        ts: event.ts,
      })
      if (!payload) {
        throw new Error(`Unsupported run event payload type: ${event.event_type}`)
      }
      return { ...event, payload: sequenceStreamEvent(payload, event.seq, event.ts) }
    })
  }

  async fetchRuns(options?: { limit?: number } & RequestInit & { timeoutMs?: number }): Promise<RunSummary[]> {
    const limit = options?.limit ?? 20
    const response = await this.request<RunsResponse>(
      `/api/runs?limit=${encodeURIComponent(String(limit))}`,
      options,
    )
    return response.runs
  }
}
