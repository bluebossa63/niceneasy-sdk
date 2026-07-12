import type { RunEvent } from '../types/runs.js'
import type { SequencedStreamEvent, StreamEvent } from '../types/stream.js'
import { sequenceStreamEvent } from '../stream/events.js'

export interface TimelineToolCall {
  id: string
  tool: string
  args: unknown
  iteration: number
  startedAt?: string
  completedAt?: string
  output: string
  resultPreview?: string
  resultLen?: number
  status?: 'ok' | 'error' | string
  failureClass?: string
  retryable?: boolean
  isError?: boolean
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
  uxEventKind?: string
  tool?: string
  args?: unknown
  durationMs?: number
  iteration?: number
  diff?: string
  retry?: number
  maxRetries?: number
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

interface TimelineBuilderState {
  tools: Map<string, TimelineToolCall>
  permissions: Map<string, TimelinePermission>
  statuses: TimelineStatus[]
  errors: string[]
  assistantText: string
  reasoningText: string
  pendingTextBreak: boolean
  pendingReasoningBreak: boolean
  usage?: Extract<StreamEvent, { type: 'usage' }>
  finish?: Extract<SequencedStreamEvent, { type: 'finish' }>
  sessionId?: string
  runId?: string
  messageId?: string
  startedAt?: string
}

export function normalizeRunEvents(rows: RunEvent[]): SequencedStreamEvent[] {
  return [...rows]
    .sort((left, right) => left.seq - right.seq)
    .map((row) => sequenceStreamEvent(row.payload, row.seq, row.ts))
}

function withParagraphBreak(text: string): string {
  if (text.length === 0) return text
  if (/\n[ \t]*\n[ \t]*$/.test(text)) return text
  return `${text.replace(/\s+$/, '')}\n\n`
}

// The runtime used to store a literal assistant placeholder for tool-only turns.
// Remove standalone legacy placeholders before the UI renders the transcript.
function stripToolCallPlaceholder(text: string): string {
  if (!text.includes('(tool call)')) return text
  return text
    .replace(/(^|\n)[ \t]*\(tool call\)[ \t]*(?=\n|$)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '')
}

function createTimelineState(): TimelineBuilderState {
  return {
    tools: new Map<string, TimelineToolCall>(),
    permissions: new Map<string, TimelinePermission>(),
    statuses: [],
    errors: [],
    assistantText: '',
    reasoningText: '',
    pendingTextBreak: false,
    pendingReasoningBreak: false,
  }
}

function rememberEventContext(state: TimelineBuilderState, event: SequencedStreamEvent): void {
  state.runId = event.run_id ?? state.runId
  state.sessionId = event.session_id ?? state.sessionId
  state.messageId = event.message_id ?? state.messageId
  state.startedAt ??= event.ts
}

function appendAssistantText(state: TimelineBuilderState, delta: string): void {
  if (state.pendingTextBreak) {
    state.assistantText = withParagraphBreak(state.assistantText)
    state.pendingTextBreak = false
  }
  state.assistantText += delta
}

function appendReasoningText(state: TimelineBuilderState, delta: string): void {
  if (state.pendingReasoningBreak) {
    state.reasoningText = withParagraphBreak(state.reasoningText)
    state.pendingReasoningBreak = false
  }
  state.reasoningText += delta
}

function markToolRoundBoundary(state: TimelineBuilderState): void {
  state.pendingTextBreak = state.pendingTextBreak || state.assistantText.length > 0
  state.pendingReasoningBreak = state.pendingReasoningBreak || state.reasoningText.length > 0
}

function startTool(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.started' }>): void {
  markToolRoundBoundary(state)
  state.tools.set(event.tool_call_id, {
    id: event.tool_call_id,
    tool: event.tool,
    args: event.args,
    iteration: event.iteration,
    startedAt: event.ts,
    output: state.tools.get(event.tool_call_id)?.output ?? '',
  })
}

function appendToolOutput(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.output.delta' }>): void {
  const existing = state.tools.get(event.tool_call_id)
  state.tools.set(event.tool_call_id, {
    id: event.tool_call_id,
    tool: event.tool ?? existing?.tool ?? 'unknown',
    args: existing?.args,
    iteration: existing?.iteration ?? 0,
    startedAt: existing?.startedAt,
    completedAt: existing?.completedAt,
    output: `${existing?.output ?? ''}${event.delta}`,
    resultPreview: event.result_preview ?? existing?.resultPreview,
    resultLen: existing?.resultLen,
    status: existing?.status,
    failureClass: event.failure_class ?? existing?.failureClass,
    retryable: event.retryable ?? existing?.retryable,
    isError: event.is_error ?? existing?.isError,
    durationMs: existing?.durationMs,
  })
}

function completeTool(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.completed' }>): void {
  markToolRoundBoundary(state)
  const existing = state.tools.get(event.tool_call_id)
  state.tools.set(event.tool_call_id, {
    id: event.tool_call_id,
    tool: event.tool ?? existing?.tool ?? 'unknown',
    args: existing?.args,
    iteration: existing?.iteration ?? 0,
    startedAt: existing?.startedAt,
    completedAt: event.ts,
    output: event.result ?? existing?.output ?? '',
    resultPreview: event.result_preview ?? existing?.resultPreview,
    resultLen: event.result_len,
    status: event.status,
    failureClass: event.failure_class,
    retryable: event.retryable,
    isError: event.is_error,
    durationMs: event.duration_ms,
  })
}

function requestPermission(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'permission.requested' }>): void {
  state.permissions.set(event.permission_id, {
    id: event.permission_id,
    toolCallId: event.tool_call_id,
    tool: event.tool,
    risk: event.risk,
    requestedAt: event.ts,
  })
}

function resolvePermission(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'permission.resolved' }>): void {
  const existing = state.permissions.get(event.permission_id)
  state.permissions.set(event.permission_id, {
    id: event.permission_id,
    toolCallId: existing?.toolCallId ?? 'unknown',
    tool: existing?.tool ?? 'unknown',
    risk: existing?.risk,
    requestedAt: existing?.requestedAt,
    resolvedAt: event.ts,
    decision: event.decision,
  })
}

function statusFromEvent(event: Extract<SequencedStreamEvent, { type: 'status' }>): TimelineStatus {
  return {
    seq: event.seq,
    ts: event.ts,
    message: event.message,
    uxEventKind: event.ux_event_kind,
    tool: event.tool,
    args: event.args,
    durationMs: event.duration_ms,
    iteration: event.iteration,
    diff: event.diff,
    retry: event.retry,
    maxRetries: event.max_retries,
  }
}

function applyTimelineEvent(state: TimelineBuilderState, event: SequencedStreamEvent): void {
  rememberEventContext(state, event)

  switch (event.type) {
    case 'session.created':
      state.sessionId = event.session_id
      break
    case 'message.started':
      state.messageId = event.message_id
      break
    case 'text.delta':
      appendAssistantText(state, event.delta)
      break
    case 'reasoning.delta':
      appendReasoningText(state, event.delta)
      break
    case 'tool.started':
      startTool(state, event)
      break
    case 'tool.output.delta':
      appendToolOutput(state, event)
      break
    case 'tool.completed':
      completeTool(state, event)
      break
    case 'permission.requested':
      requestPermission(state, event)
      break
    case 'permission.resolved':
      resolvePermission(state, event)
      break
    case 'status':
      state.statuses.push(statusFromEvent(event))
      break
    case 'usage':
      state.usage = event
      break
    case 'finish':
      state.finish = event
      if (event.error) {
        state.errors.push(event.error)
      }
      break
  }
}

export function buildRunTimeline(events: readonly SequencedStreamEvent[]): RunTimelineModel {
  const state = createTimelineState()
  for (const event of events) {
    applyTimelineEvent(state, event)
  }

  return {
    events: [...events],
    assistantText: stripToolCallPlaceholder(state.assistantText),
    reasoningText: state.reasoningText,
    tools: [...state.tools.values()],
    permissions: [...state.permissions.values()],
    statuses: state.statuses,
    errors: state.errors,
    usage: state.usage,
    finish: state.finish,
    sessionId: state.sessionId,
    runId: state.runId,
    messageId: state.messageId,
    startedAt: state.startedAt,
    finishedAt: state.finish?.ts,
  }
}

export function runEventsToTimeline(rows: RunEvent[]): RunTimelineModel {
  return buildRunTimeline(normalizeRunEvents(rows))
}
