export type WorkItemStatus = 'backlog' | 'in_progress' | 'needs_review' | 'blocked' | 'done'
export type WorkBudgetState = 'within_budget' | 'at_risk' | 'exhausted'

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

export interface WorkItemStatusUpdate {
  status: WorkItemStatus
}

/** @deprecated Use WorkItemStatusUpdate. */
export type WorkItemStatusInput = WorkItemStatusUpdate
