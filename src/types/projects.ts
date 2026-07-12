import type { ApprovalItem } from './approvals.js'
import type { ArtifactSummary } from './artifacts.js'
import type { BoardColumn, WorkItem, WorkItemStatus } from './workItems.js'

export * from './artifacts.js'
export * from './workspace.js'
export * from './commandCenter.js'
export * from './workItems.js'
export * from './fleets.js'

export type ProjectStatus = 'planning' | 'active' | 'blocked' | 'review' | 'done'
export type RoomEntryKind = 'agent_update' | 'human_note' | 'artifact_note' | 'approval_decision'

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

export interface CreateProjectInput {
  goal: string
  fleetName: string
  approvalModel: string
  kickoffTaskKey?: string
  model_ref?: string
}

/** @deprecated Use CreateProjectInput; the endpoint creates a project, not a local draft. */
export type ProjectDraftInput = CreateProjectInput

export interface ProjectListEnvelope {
  items: ProjectSummary[]
  total: number
  hasMore?: boolean
}

export type { WorkItem, WorkItemStatus }
