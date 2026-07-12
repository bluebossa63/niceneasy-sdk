export interface LoopInvocation {
  id: string
  created_at: string
  trigger_type: string
  target_agent: string
  source_ref: string
  request_evaluation_id: string
  scope_summary: string
  decision_summary: string
  affected_task_ids_json: string
  model_summary_json: string
  tool_summary_json: string
  duration_ms: number
  outcome: string
  error: string
}

export interface LoopStatus {
  running: boolean
  last_run_time: string
  last_outcome: string
  last_invocation_id: string
}
