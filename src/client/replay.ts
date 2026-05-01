import type { RunEvent } from '../types/runs.js'
import type { SequencedStreamEvent, StreamEvent } from '../types/stream.js'
import { sequenceStreamEvent } from '../types/stream.js'

export interface TimelineToolCall {
  id: string
  tool: string
  args: unknown
  iteration: number
  startedAt?: string
  completedAt?: string
  output: string
  resultLen?: number
  status?: 'ok' | 'error'
  durationMs?: number
}

export interface TimelinePermission {
  id: string
  toolCallId: string
  tool: string
  risk?: string
  decision?: 'once' | 'always' | 'deny'
  requestedAt?: string
  resolvedAt?: string
}

export interface TimelineStatus {
  seq: number
  ts: string
  message: string
}

export interface RunTimelineModel {
  events: SequencedStreamEvent[]
  assistantText: string
  reasoningText: string
  tools: TimelineToolCall[]
  permissions: TimelinePermission[]
  statuses: TimelineStatus[]
  errors: string[]
  usage?: Extract<StreamEvent, { type: 'usage' }>
  finish?: Extract<SequencedStreamEvent, { type: 'finish' }>
  sessionId?: string
  runId?: string
  messageId?: string
  startedAt?: string
  finishedAt?: string
}

export function normalizeRunEvents(rows: RunEvent[]): SequencedStreamEvent[] {
  return [...rows]
    .sort((left, right) => left.seq - right.seq)
    .map((row) => sequenceStreamEvent(row.payload, row.seq, row.ts))
}

export function buildRunTimeline(events: readonly SequencedStreamEvent[]): RunTimelineModel {
  const tools = new Map<string, TimelineToolCall>()
  const permissions = new Map<string, TimelinePermission>()
  const statuses: TimelineStatus[] = []
  const errors: string[] = []
  let assistantText = ''
  let reasoningText = ''
  let usage: Extract<StreamEvent, { type: 'usage' }> | undefined
  let finish: Extract<SequencedStreamEvent, { type: 'finish' }> | undefined
  let sessionId: string | undefined
  let runId: string | undefined
  let messageId: string | undefined
  let startedAt: string | undefined

  for (const event of events) {
    runId = event.run_id ?? runId
    sessionId = event.session_id ?? sessionId
    messageId = event.message_id ?? messageId
    startedAt ??= event.ts

    switch (event.type) {
      case 'session.created':
        sessionId = event.session_id
        break
      case 'message.started':
        messageId = event.message_id
        break
      case 'text.delta':
        assistantText += event.delta
        break
      case 'reasoning.delta':
        reasoningText += event.delta
        break
      case 'tool.started':
        tools.set(event.tool_call_id, {
          id: event.tool_call_id,
          tool: event.tool,
          args: event.args,
          iteration: event.iteration,
          startedAt: event.ts,
          output: tools.get(event.tool_call_id)?.output ?? '',
        })
        break
      case 'tool.output.delta': {
        const existing = tools.get(event.tool_call_id)
        tools.set(event.tool_call_id, {
          id: event.tool_call_id,
          tool: existing?.tool ?? event.tool_call_id,
          args: existing?.args,
          iteration: existing?.iteration ?? 0,
          startedAt: existing?.startedAt,
          completedAt: existing?.completedAt,
          output: `${existing?.output ?? ''}${event.delta}`,
          resultLen: existing?.resultLen,
          status: existing?.status,
          durationMs: existing?.durationMs,
        })
        break
      }
      case 'tool.completed': {
        const existing = tools.get(event.tool_call_id)
        tools.set(event.tool_call_id, {
          id: event.tool_call_id,
          tool: existing?.tool ?? event.tool_call_id,
          args: existing?.args,
          iteration: existing?.iteration ?? 0,
          startedAt: existing?.startedAt,
          completedAt: event.ts,
          output: existing?.output ?? '',
          resultLen: event.result_len,
          status: event.status,
          durationMs: event.duration_ms,
        })
        break
      }
      case 'permission.requested':
        permissions.set(event.permission_id, {
          id: event.permission_id,
          toolCallId: event.tool_call_id,
          tool: event.tool,
          risk: event.risk,
          requestedAt: event.ts,
        })
        break
      case 'permission.resolved': {
        const existing = permissions.get(event.permission_id)
        permissions.set(event.permission_id, {
          id: event.permission_id,
          toolCallId: existing?.toolCallId ?? '',
          tool: existing?.tool ?? '',
          risk: existing?.risk,
          requestedAt: existing?.requestedAt,
          resolvedAt: event.ts,
          decision: event.decision,
        })
        break
      }
      case 'status':
        statuses.push({ seq: event.seq, ts: event.ts, message: event.message })
        break
      case 'usage':
        usage = event
        break
      case 'finish':
        finish = event
        if (event.error) {
          errors.push(event.error)
        }
        break
    }
  }

  return {
    events: [...events],
    assistantText,
    reasoningText,
    tools: [...tools.values()],
    permissions: [...permissions.values()],
    statuses,
    errors,
    usage,
    finish,
    sessionId,
    runId,
    messageId,
    startedAt,
    finishedAt: finish?.ts,
  }
}

export function runEventsToTimeline(rows: RunEvent[]): RunTimelineModel {
  return buildRunTimeline(normalizeRunEvents(rows))
}
