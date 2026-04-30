export type StreamEvent =
  | { type: 'session.created'; session_id: string; agent: string; model: string }
  | { type: 'message.started'; message_id: string; role: 'assistant' | 'user' }
  | { type: 'text.delta'; message_id: string; delta: string }
  | { type: 'reasoning.delta'; message_id: string; delta: string }
  | { type: 'tool.started'; tool_call_id: string; tool: string; args: unknown; iteration: number }
  | { type: 'tool.output.delta'; tool_call_id: string; delta: string }
  | { type: 'tool.completed'; tool_call_id: string; result_len: number; status: 'ok' | 'error'; duration_ms: number }
  | { type: 'permission.requested'; permission_id: string; tool_call_id: string; tool: string; risk?: string }
  | { type: 'permission.resolved'; permission_id: string; decision: 'once' | 'always' | 'deny' }
  | { type: 'status'; message: string }
  | { type: 'usage'; tokens_in: number; tokens_out: number; cost_usd: number }
  | { type: 'finish'; session_id: string; duration_ms: number; run_id?: string; error?: string }

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

function legacyToolCallId(raw: Record<string, unknown>): string {
  return asString(raw.tool_call_id, `${asString(raw.tool, 'tool')}:${asNumber(raw.iteration, 0)}`)
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

export function adaptLegacyEvents(raw: Record<string, unknown>): StreamEvent[] {
  switch (raw.type) {
    case 'token':
      return [{ type: 'text.delta', message_id: asString(raw.message_id, 'main'), delta: asString(raw.delta) }]
    case 'tool_call':
      return [{
        type: 'tool.started',
        tool_call_id: legacyToolCallId(raw),
        tool: asString(raw.tool),
        args: parseArgs(raw.args),
        iteration: asNumber(raw.iteration, 0),
      }]
    case 'tool_result':
      return [{
        type: 'tool.completed',
        tool_call_id: legacyToolCallId(raw),
        result_len: asNumber(raw.result_len, 0),
        status: 'ok',
        duration_ms: asNumber(raw.duration_ms, 0),
      }]
    case 'status':
      return [{ type: 'status', message: asString(raw.message) }]
    case 'finish': {
      const usage: StreamEvent = {
        type: 'usage',
        tokens_in: asNumber(raw.tokens_in, 0),
        tokens_out: asNumber(raw.tokens_out, 0),
        cost_usd: asNumber(raw.cost_usd, 0),
      }
      const finish: StreamEvent = {
        type: 'finish',
        session_id: asString(raw.session_id),
        duration_ms: asNumber(raw.duration_ms, 0),
        ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : {}),
        ...(typeof raw.error === 'string' && raw.error !== '' ? { error: raw.error } : {}),
      }
      return [usage, finish]
    }
    case 'error':
      return [{
        type: 'finish',
        session_id: asString(raw.session_id),
        duration_ms: asNumber(raw.duration_ms, 0),
        ...(typeof raw.run_id === 'string' && raw.run_id !== '' ? { run_id: raw.run_id } : {}),
        error: asString(raw.error, 'stream error'),
      }]
    default:
      if (canonicalTypes.has(raw.type as StreamEvent['type'])) {
        return [raw as StreamEvent]
      }
      return []
  }
}

export function adaptLegacyEvent(raw: Record<string, unknown>): StreamEvent | null {
  return adaptLegacyEvents(raw)[0] ?? null
}
