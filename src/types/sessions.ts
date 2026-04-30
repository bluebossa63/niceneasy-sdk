import type { ModelSelection } from './models.js'
import type { ToolCallSummary } from './tools.js'

export type SessionRole = 'user' | 'assistant' | 'system' | 'tool'
export type SessionState = 'active' | 'finished' | 'failed' | 'cancelled'

export interface SessionSummary {
  session_id: string
  agent: string
  state?: SessionState
  title?: string
  created_at: string
  updated_at: string
  message_count: number
  model?: string
  total_cost_usd?: number
}

export interface SessionMessage {
  id?: string | number
  session_id: string
  role: SessionRole
  content: string
  timestamp: string
  agent?: string
  model?: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
  toolCalls?: ToolCallSummary[]
}

export interface NewSessionRequest {
  agent: string
  prompt?: string
  model?: ModelSelection
  title?: string
}

export interface SessionListEnvelope {
  items: SessionSummary[]
  total: number
  limit?: number
  offset?: number
  has_more?: boolean
}
