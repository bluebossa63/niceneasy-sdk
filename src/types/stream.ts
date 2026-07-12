export interface StreamEventMeta {
  run_id?: string
  session_id?: string
  message_id?: string
  tool_call_id?: string
  seq?: number
  ts?: string
}

export type StreamEvent =
  | (StreamEventMeta & { type: 'session.created'; session_id: string; agent: string; model: string })
  | (StreamEventMeta & { type: 'message.started'; message_id: string; role: 'assistant' | 'user' })
  | (StreamEventMeta & { type: 'text.delta'; message_id: string; delta: string })
  | (StreamEventMeta & { type: 'reasoning.delta'; message_id: string; delta: string })
  | (StreamEventMeta & { type: 'tool.started'; tool_call_id: string; tool: string; args: unknown; iteration: number })
  | (StreamEventMeta & ToolResultFields & { type: 'tool.output.delta'; tool_call_id: string; delta: string })
  | (StreamEventMeta & ToolResultFields & { type: 'tool.completed'; tool_call_id: string; result_len: number; result?: string; status: 'ok' | 'error' | string; duration_ms: number })
  | (StreamEventMeta & { type: 'permission.requested'; permission_id: string; tool_call_id: string; tool: string; risk?: string })
  | (StreamEventMeta & { type: 'permission.resolved'; permission_id: string; decision: 'once' | 'always' | 'deny' })
  | (StreamEventMeta & UxStatusFields & { type: 'status'; message: string })
  | (StreamEventMeta & { type: 'usage'; tokens_in: number; tokens_out: number; cost_usd: number })
  | (StreamEventMeta & { type: 'finish'; session_id: string; duration_ms: number; error?: string })

export type StreamEventType = StreamEvent['type']

export type SequencedStreamEvent = StreamEvent & Required<Pick<StreamEventMeta, 'seq' | 'ts'>>

export interface StreamEventContext extends StreamEventMeta {
  defaultMessageId?: string
  tool?: string
}

export type UxEventKind = 'tool.completed' | 'tool.inline_diff' | 'warning'

/** @deprecated Use UxEventKind. */
export type UXEventKind = UxEventKind

export interface UxStatusFields {
  ux_event_kind?: UxEventKind | string
  tool?: string
  args?: unknown
  duration_ms?: number
  iteration?: number
  diff?: string
  retry?: number
  max_retries?: number
}

/** @deprecated Use UxStatusFields. */
export interface UXStatusFields extends UxStatusFields {}

export interface ToolResultFields {
  tool?: string
  iteration?: number
  result_preview?: string
  failure_class?: string
  retryable?: boolean
  is_error?: boolean
}

export { sequenceStreamEvent, withStreamEventMeta } from '../stream/events.js'
export { adaptLegacyEvent, adaptLegacyEvents } from '../stream/legacyAdapter.js'
