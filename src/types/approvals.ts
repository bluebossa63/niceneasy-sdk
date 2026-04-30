import type { ArtifactSummary } from './projects.js'

export type ApprovalState = 'pending' | 'approved' | 'changes_requested' | 'denied'
export type ApprovalDecision = Exclude<ApprovalState, 'pending'>

export interface ApprovalItem {
  id: string
  projectId: string
  projectName: string
  workItemId?: string
  title: string
  summary: string
  dueDate: string
  state: ApprovalState
  requestedBy: string
  requestedAt: string
  suggestedDecision: ApprovalDecision
  detailPoints: string[]
  artifactIds: string[]
}

export interface ApprovalDetail extends ApprovalItem {
  projectGoal: string
  recentSignals: string[]
  artifacts: ArtifactSummary[]
}

export interface ApprovalListEnvelope {
  items: ApprovalDetail[]
  total: number
  limit?: number
  offset?: number
  hasMore?: boolean
}

export interface ApprovalDecisionInput {
  decision: ApprovalDecision
  comment?: string
  resolution_comment?: string
}
