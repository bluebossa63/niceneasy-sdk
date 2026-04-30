import type { ApprovalItem } from './approvals.js'

export type ProjectStatus = 'planning' | 'active' | 'blocked' | 'review' | 'done'
export type WorkItemStatus = 'backlog' | 'in_progress' | 'needs_review' | 'blocked' | 'done'
export type WorkBudgetState = 'within_budget' | 'at_risk' | 'exhausted'
export type ArtifactState = 'draft' | 'review' | 'approved'
export type RoomEntryKind = 'agent_update' | 'human_note' | 'artifact_note' | 'approval_decision'

export interface MetricSummary {
  label: string
  value: string
  delta: string
}

export interface CommandCenterSummary {
  workspaceName: string
  heroTitle: string
  heroSubtitle: string
  metrics: MetricSummary[]
  urgentSignals: Array<{
    title: string
    detail: string
    tone: 'warm' | 'cool' | 'danger'
  }>
}

export interface WorkspaceContext {
  id: string
  name: string
  currentUser: string
  activeMode: 'mock' | 'http'
  pendingApprovals: number
  onlineFleetCount: number
}

export interface ProjectSummary {
  id: string
  name: string
  goal: string
  status: ProjectStatus
  completion: number
  dueDate: string
  fleet: string
  owners: string[]
  approvalsPending: number
  blockers: number
}

export interface WorkItem {
  id: string
  taskKey?: string
  title: string
  owner: string
  summary: string
  status: WorkItemStatus
  priority: 'low' | 'medium' | 'high'
  dueLabel?: string
  dueDate?: string
  linkedApprovalId?: string
  artifactCount: number
  turnsUsed?: number
  maxTurns?: number
  budgetState?: WorkBudgetState
  blockedReason?: string
}

export interface BoardColumn {
  id: WorkItemStatus
  label: string
  count: number
  items: WorkItem[]
}

export interface ArtifactSummary {
  id: string
  title: string
  kind: 'brief' | 'memo' | 'deck' | 'faq' | 'plan'
  state: ArtifactState
  owner: string
  updatedAt: string
  summary: string
}

export interface RoomEntry {
  id: string
  kind: RoomEntryKind
  author: string
  timestamp: string
  message: string
}

export interface ProjectDetail extends ProjectSummary {
  phase: string
  health: 'steady' | 'needs_attention' | 'critical'
  board: BoardColumn[]
  roomEntries: RoomEntry[]
  artifacts: ArtifactSummary[]
  upcomingApprovals: ApprovalItem[]
  milestones: Array<{
    id: string
    label: string
    date: string
  }>
}

export interface FleetSummary {
  id: string
  name: string
  focus: string
  capabilities: string[]
  approvalModel: string
}

export interface ProjectDraftInput {
  goal: string
  fleetName: string
  approvalModel: string
  kickoffTaskKey?: string
}

export interface ProjectListEnvelope {
  items: ProjectSummary[]
  total: number
  hasMore?: boolean
}
