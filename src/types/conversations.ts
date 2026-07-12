export interface Conversation {
  session_id: string
  agent: string
  created_at: string
  updated_at: string
  message_count: number
}

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  tokens_in?: number
  tokens_out?: number
  cost_usd?: number
  model?: string
}

export interface PageEnvelope<T> {
  items: T[]
  total: number
  limit?: number
  offset?: number
  hasMore?: boolean
  has_more?: boolean
}
