import type { AgentCost } from './agents.js'

export interface CostOverview {
  total_cost_usd: number
  agents: AgentCost[]
}
