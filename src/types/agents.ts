export interface AgentInfo {
  name: string
  skills: string[]
}

export type AgentStatus = 'online' | 'offline' | 'degraded'

export interface AgentWithStatus extends AgentInfo {
  status: AgentStatus
  latencyMs: number
}

export interface AgentCost {
  agent: string
  total_input_tokens: number
  total_output_tokens: number
  total_cost_usd: number
  request_count: number
  daily_cost_usd: number
  monthly_cost_usd: number
}
