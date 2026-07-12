export interface SystemOverview {
  agent_count: number
  session_count: number
  total_cost_usd: number
}

export interface HealthResponse {
  status: string
}

export interface ReadyResponse extends HealthResponse {
  ready?: boolean
  agents?: number
  agents_count?: number
  tables_ok?: boolean
  skills_count?: number
}
