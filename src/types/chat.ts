export interface ChatRequest {
  agent: string
  prompt: string
  type?: string
  timeout?: number
  profile?: 'full' | 'compact'
  session_id?: string
  model_ref?: string
}

export interface ChatResponse {
  agent: string
  routed_by: string
  profile: string
  model: string
  response: string
  tokens_in: number
  tokens_out: number
  cost_usd: number
  duration: string
  session_id: string
  error?: string
}
