export interface RequestEvaluationSummary {
  id: string
  created_at: string
  source_kind: string
  source_ref: string
  request_type: string
  work_mode: string
  intent_summary: string
  recommended_response_mode: string
  status: string
}

export interface RequestEvaluationDetail extends RequestEvaluationSummary {
  normalized_goal: string
  constraints_json: string
  prompt_profile_ref: string
  task_seeds_json: string
  notes_json: string
}
