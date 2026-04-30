export interface TaskRequest {
  agent: string
  description: string
  priority: number
  task_key?: string
  due_date?: string
  max_turns?: number
}

export type TaskStatus =
  | 'pending'
  | 'ready'
  | 'planned'
  | 'executing'
  | 'needs_resume'
  | 'needs_escalation'
  | 'done'
  | 'failed'
  | 'blocked'
  | 'budget_exhausted'
  | 'stale'
  | 'dead_letter'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export interface TaskResponse {
  id: string
  task_key?: string
  status: TaskStatus
  agent: string
  description: string
  priority?: number
  created_by?: string
  result?: string
  created_at: string
  updated_at?: string
  started_at?: string
  error?: string
  retry_count?: number
  max_retries?: number
  recurring?: string
  due_date?: string
  turns_used?: number
  max_turns?: number
  project_id?: string
  parent_id?: string
  root_id?: string
  depth?: number
  child_count?: number
}

export type Task = TaskResponse

export interface TaskListResponse {
  items: TaskResponse[]
  total: number
}

export interface TaskLineageNode {
  id: string
  parent_id?: string
  description: string
  status: string
  agent: string
}

export interface TaskLineageResponse {
  task_id: string
  root_id: string
  depth: number
  lineage_ids: string[]
  items: TaskLineageNode[]
}
