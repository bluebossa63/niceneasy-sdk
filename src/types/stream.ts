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
  | (StreamEventMeta & UXStatusFields & { type: 'status'; message: string })
  | (StreamEventMeta & { type: 'usage'; tokens_in: number; tokens_out: number; cost_usd: number })
  | (StreamEventMeta & { type: 'finish'; session_id: string; duration_ms: number; error?: string })

export type StreamEventType = StreamEvent['type']

export type SequencedStreamEvent = StreamEvent & Required<Pick<StreamEventMeta, 'seq' | 'ts'>>

export interface StreamEventContext extends StreamEventMeta {
  defaultMessageId?: string
}

export type UXEventKind = 'tool.completed' | 'tool.inline_diff' | 'warning'

export interface UXStatusFields {
  ux_event_kind?: UXEventKind | string
  tool?: string
  args?: unknown
  duration_ms?: number
  iteration?: number
  diff?: string
  retry?: number
  max_retries?: number
}

export interface ToolResultFields {
  result_preview?: string
  failure_class?: string
  retryable?: boolean
  is_error?: boolean
}

const canonicalTypes = new Set<StreamEvent['type']>([
  'session.created',
  'message.started',
  'text.delta',
  'reasoning.delta',
  'tool.started',
  'tool.output.delta',
  'tool.completed',
  'permission.requested',
  'permission.resolved',
  'status',
  'usage',
  'finish',
])

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function metaFromRaw(raw: Record<string, unknown>, context?: StreamEventContext): StreamEventMeta {
  return {
    ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : context?.run_id ? { run_id: context.run_id } : {}),
    ...(typeof raw.session_id === 'string' && raw.session_id !== '' ? { session_id: raw.session_id } : context?.session_id ? { session_id: context.session_id } : {}),
    ...(typeof raw.message_id === 'string' && raw.message_id !== '' ? { message_id: raw.message_id } : context?.message_id ? { message_id: context.message_id } : {}),
    ...(typeof raw.tool_call_id === 'string' && raw.tool_call_id !== '' ? { tool_call_id: raw.tool_call_id } : context?.tool_call_id ? { tool_call_id: context.tool_call_id } : {}),
    ...(typeof raw.seq === 'number' && Number.isFinite(raw.seq) ? { seq: raw.seq } : context?.seq !== undefined ? { seq: context.seq } : {}),
    ...(typeof raw.ts === 'string' && raw.ts !== '' ? { ts: raw.ts } : context?.ts ? { ts: context.ts } : {}),
  }
}

function legacyToolCallId(raw: Record<string, unknown>, context?: StreamEventContext): string {
  return asString(raw.tool_call_id, context?.tool_call_id ?? `${asString(raw.tool, 'tool')}:${asNumber(raw.iteration, 0)}`)
}

function parseArgs(args: unknown): unknown {
  if (typeof args !== 'string') {
    return args
  }
  try {
    return JSON.parse(args)
  } catch {
    return args
  }
}

export function withStreamEventMeta(event: StreamEvent, meta: StreamEventMeta): StreamEvent {
  return {
    ...event,
    ...(meta.run_id !== undefined && event.run_id === undefined ? { run_id: meta.run_id } : {}),
    ...(meta.session_id !== undefined && event.session_id === undefined ? { session_id: meta.session_id } : {}),
    ...(meta.message_id !== undefined && event.message_id === undefined ? { message_id: meta.message_id } : {}),
    ...(meta.tool_call_id !== undefined && event.tool_call_id === undefined ? { tool_call_id: meta.tool_call_id } : {}),
    ...(meta.seq !== undefined && event.seq === undefined ? { seq: meta.seq } : {}),
    ...(meta.ts !== undefined && event.ts === undefined ? { ts: meta.ts } : {}),
  } as StreamEvent
}

export function sequenceStreamEvent(event: StreamEvent, seq: number, ts = new Date().toISOString()): SequencedStreamEvent {
  return withStreamEventMeta(event, { seq: event.seq ?? seq, ts: event.ts ?? ts }) as SequencedStreamEvent
}

export function adaptLegacyEvents(raw: Record<string, unknown>, context?: StreamEventContext): StreamEvent[] {
  const meta = metaFromRaw(raw, context)
  const messageId = asString(raw.message_id, context?.defaultMessageId ?? context?.message_id ?? 'main')
  switch (raw.type) {
    case 'token':
      return [withStreamEventMeta({ ...meta, type: 'text.delta', message_id: messageId, delta: asString(raw.delta) }, meta)]
    case 'tool_call':
      return [{
        ...meta,
        type: 'tool.started',
        tool_call_id: legacyToolCallId(raw, context),
        tool: asString(raw.tool),
        args: parseArgs(raw.args),
        iteration: asNumber(raw.iteration, 0),
      }]
    case 'tool_result':
      return [{
        ...meta,
        type: 'tool.completed',
        tool_call_id: legacyToolCallId(raw, context),
        result_len: asNumber(raw.result_len, 0),
        ...(typeof raw.result === 'string' && raw.result !== '' ? { result: raw.result } : {}),
        ...(typeof raw.result_preview === 'string' && raw.result_preview !== '' ? { result_preview: raw.result_preview } : {}),
        ...(typeof raw.failure_class === 'string' && raw.failure_class !== '' ? { failure_class: raw.failure_class } : {}),
        ...(typeof raw.retryable === 'boolean' ? { retryable: raw.retryable } : {}),
        ...(typeof raw.is_error === 'boolean' ? { is_error: raw.is_error } : {}),
        status: typeof raw.is_error === 'boolean' && raw.is_error ? 'error' : 'ok',
        duration_ms: asNumber(raw.duration_ms, 0),
      }]
    case 'status':
      return [{
        ...meta,
        type: 'status',
        message: asString(raw.message),
        ...(typeof raw.ux_event_kind === 'string' && raw.ux_event_kind !== '' ? { ux_event_kind: raw.ux_event_kind } : {}),
        ...(typeof raw.tool === 'string' && raw.tool !== '' ? { tool: raw.tool } : {}),
        ...(raw.args !== undefined ? { args: parseArgs(raw.args) } : {}),
        ...(typeof raw.duration_ms === 'number' && Number.isFinite(raw.duration_ms) ? { duration_ms: raw.duration_ms } : {}),
        ...(typeof raw.iteration === 'number' && Number.isFinite(raw.iteration) ? { iteration: raw.iteration } : {}),
        ...(typeof raw.diff === 'string' && raw.diff !== '' ? { diff: raw.diff } : {}),
        ...(typeof raw.retry === 'number' && Number.isFinite(raw.retry) ? { retry: raw.retry } : {}),
        ...(typeof raw.max_retries === 'number' && Number.isFinite(raw.max_retries) ? { max_retries: raw.max_retries } : {}),
      }]
    case 'finish': {
      const usage: StreamEvent = {
        ...meta,
        type: 'usage',
        tokens_in: asNumber(raw.tokens_in, 0),
        tokens_out: asNumber(raw.tokens_out, 0),
        cost_usd: asNumber(raw.cost_usd, 0),
      }
      const finish: StreamEvent = {
        ...meta,
        type: 'finish',
        session_id: asString(raw.session_id, context?.session_id),
        duration_ms: asNumber(raw.duration_ms, 0),
        ...(typeof raw.error === 'string' && raw.error !== '' ? { error: raw.error } : {}),
      }
      return [usage, finish]
    }
    case 'error':
      return [{
        ...meta,
        type: 'finish',
        session_id: asString(raw.session_id, context?.session_id),
        duration_ms: asNumber(raw.duration_ms, 0),
        error: asString(raw.error, 'stream error'),
      }]
    default:
      if (canonicalTypes.has(raw.type as StreamEvent['type'])) {
        return [withStreamEventMeta(raw as unknown as StreamEvent, meta)]
      }
      return []
  }
}

export function adaptLegacyEvent(raw: Record<string, unknown>, context?: StreamEventContext): StreamEvent | null {
  return adaptLegacyEvents(raw, context)[0] ?? null
}
