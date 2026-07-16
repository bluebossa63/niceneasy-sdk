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

/**
 * A single chronological item in the run/session/chat transcript. Entries are
 * emitted in raw event (seq/ts) order so every UI can render one timeline
 * instead of grouping events into fixed buckets (text, then tools, then
 * status, then permissions). Text/reasoning deltas are coalesced into
 * contiguous segments; a segment is closed whenever a non-text event breaks
 * the run of deltas, which preserves interleaving with tool calls, permission
 * prompts and status messages.
 *
 * The `tool`, `permission` and `status` payloads point at the same mutable
 * objects exposed via the aggregate arrays, so a tool entry created at
 * `tool.started` reflects its final output/duration after `tool.completed`.
 */
export type TimelineEntry =
  | { kind: 'text'; seq: number; ts: string; text: string }
  | { kind: 'reasoning'; seq: number; ts: string; text: string }
  | { kind: 'tool'; seq: number; ts: string; tool: TimelineToolCall }
  | { kind: 'permission'; seq: number; ts: string; permission: TimelinePermission }
  | { kind: 'status'; seq: number; ts: string; status: TimelineStatus }
  | { kind: 'usage'; seq: number; ts: string; usage: Extract<StreamEvent, { type: 'usage' }> }
  | { kind: 'finish'; seq: number; ts: string; finish: Extract<SequencedStreamEvent, { type: 'finish' }> }
  | { kind: 'error'; seq: number; ts: string; message: string }

export interface RunTimelineModel {
  events: SequencedStreamEvent[]
  /** Chronological, interleaved transcript in raw event order. */
  entries: TimelineEntry[]
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

interface TextSegmentAccumulator {
  entry: Extract<TimelineEntry, { kind: 'text' | 'reasoning' }>
  pendingBreak: boolean
}

interface TimelineBuilderState {
  entries: TimelineEntry[]
  tools: Map<string, TimelineToolCall>
  permissions: Map<string, TimelinePermission>
  statuses: TimelineStatus[]
  errors: string[]
  assistantText: string
  reasoningText: string
  pendingTextBreak: boolean
  pendingReasoningBreak: boolean
  textSegment?: TextSegmentAccumulator
  reasoningSegment?: TextSegmentAccumulator
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
    entries: [],
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

// Any non-(text|reasoning) event ends the current text/reasoning segment so the
// chronological entry list interleaves narration with tools/status/permissions.
function closeTextSegments(state: TimelineBuilderState): void {
  state.textSegment = undefined
  state.reasoningSegment = undefined
}

function appendAssistantText(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'text.delta' }>): void {
  if (state.pendingTextBreak) {
    state.assistantText = withParagraphBreak(state.assistantText)
    state.pendingTextBreak = false
  }
  state.assistantText += event.delta

  if (!state.textSegment) {
    const entry: Extract<TimelineEntry, { kind: 'text' }> = {
      kind: 'text',
      seq: event.seq,
      ts: event.ts,
      text: event.delta,
    }
    state.entries.push(entry)
    state.textSegment = { entry, pendingBreak: false }
    return
  }
  if (state.textSegment.pendingBreak) {
    state.textSegment.entry.text = withParagraphBreak(state.textSegment.entry.text)
    state.textSegment.pendingBreak = false
  }
  state.textSegment.entry.text += event.delta
}

function appendReasoningText(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'reasoning.delta' }>): void {
  if (state.pendingReasoningBreak) {
    state.reasoningText = withParagraphBreak(state.reasoningText)
    state.pendingReasoningBreak = false
  }
  state.reasoningText += event.delta

  if (!state.reasoningSegment) {
    const entry: Extract<TimelineEntry, { kind: 'reasoning' }> = {
      kind: 'reasoning',
      seq: event.seq,
      ts: event.ts,
      text: event.delta,
    }
    state.entries.push(entry)
    state.reasoningSegment = { entry, pendingBreak: false }
    return
  }
  if (state.reasoningSegment.pendingBreak) {
    state.reasoningSegment.entry.text = withParagraphBreak(state.reasoningSegment.entry.text)
    state.reasoningSegment.pendingBreak = false
  }
  state.reasoningSegment.entry.text += event.delta
}

function markToolRoundBoundary(state: TimelineBuilderState): void {
  state.pendingTextBreak = state.pendingTextBreak || state.assistantText.length > 0
  state.pendingReasoningBreak = state.pendingReasoningBreak || state.reasoningText.length > 0
}

function startTool(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.started' }>): void {
  markToolRoundBoundary(state)
  const tool: TimelineToolCall = {
    id: event.tool_call_id,
    tool: event.tool,
    args: event.args,
    iteration: event.iteration,
    startedAt: event.ts,
    output: state.tools.get(event.tool_call_id)?.output ?? '',
  }
  const existed = state.tools.has(event.tool_call_id)
  state.tools.set(event.tool_call_id, tool)
  if (!existed) {
    state.entries.push({ kind: 'tool', seq: event.seq, ts: event.ts, tool })
  } else {
    // Re-point the existing entry at the refreshed object.
    const entry = state.entries.find((e) => e.kind === 'tool' && e.tool.id === event.tool_call_id)
    if (entry && entry.kind === 'tool') entry.tool = tool
  }
}

function ensureToolEntry(state: TimelineBuilderState, id: string, tool: TimelineToolCall, event: SequencedStreamEvent): void {
  const entry = state.entries.find((e) => e.kind === 'tool' && e.tool.id === id)
  if (entry && entry.kind === 'tool') {
    entry.tool = tool
    return
  }
  state.entries.push({ kind: 'tool', seq: event.seq, ts: event.ts, tool })
}

function appendToolOutput(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.output.delta' }>): void {
  const existing = state.tools.get(event.tool_call_id)
  const tool: TimelineToolCall = {
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
  }
  state.tools.set(event.tool_call_id, tool)
  ensureToolEntry(state, event.tool_call_id, tool, event)
}

function completeTool(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'tool.completed' }>): void {
  markToolRoundBoundary(state)
  const existing = state.tools.get(event.tool_call_id)
  const tool: TimelineToolCall = {
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
  }
  state.tools.set(event.tool_call_id, tool)
  ensureToolEntry(state, event.tool_call_id, tool, event)
}

function requestPermission(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'permission.requested' }>): void {
  const permission: TimelinePermission = {
    id: event.permission_id,
    toolCallId: event.tool_call_id,
    tool: event.tool,
    risk: event.risk,
    requestedAt: event.ts,
  }
  state.permissions.set(event.permission_id, permission)
  state.entries.push({ kind: 'permission', seq: event.seq, ts: event.ts, permission })
}

function resolvePermission(state: TimelineBuilderState, event: Extract<SequencedStreamEvent, { type: 'permission.resolved' }>): void {
  const existing = state.permissions.get(event.permission_id)
  const permission: TimelinePermission = {
    id: event.permission_id,
    toolCallId: existing?.toolCallId ?? 'unknown',
    tool: existing?.tool ?? 'unknown',
    risk: existing?.risk,
    requestedAt: existing?.requestedAt,
    resolvedAt: event.ts,
    decision: event.decision,
  }
  state.permissions.set(event.permission_id, permission)
  const entry = state.entries.find((e) => e.kind === 'permission' && e.permission.id === event.permission_id)
  if (entry && entry.kind === 'permission') {
    entry.permission = permission
  } else {
    state.entries.push({ kind: 'permission', seq: event.seq, ts: event.ts, permission })
  }
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

  // Text/reasoning deltas extend the open segment; everything else closes it so
  // the entries array reflects the true arrival order.
  if (event.type !== 'text.delta' && event.type !== 'reasoning.delta') {
    closeTextSegments(state)
  }

  switch (event.type) {
    case 'session.created':
      state.sessionId = event.session_id
      break
    case 'message.started':
      state.messageId = event.message_id
      break
    case 'text.delta':
      appendAssistantText(state, event)
      break
    case 'reasoning.delta':
      appendReasoningText(state, event)
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
      state.entries.push({ kind: 'status', seq: event.seq, ts: event.ts, status: statusFromEvent(event) })
      break
    case 'usage':
      state.usage = event
      state.entries.push({ kind: 'usage', seq: event.seq, ts: event.ts, usage: event })
      break
    case 'finish':
      state.finish = event
      state.entries.push({ kind: 'finish', seq: event.seq, ts: event.ts, finish: event })
      if (event.error) {
        state.errors.push(event.error)
        state.entries.push({ kind: 'error', seq: event.seq, ts: event.ts, message: event.error })
      }
      break
  }
}

export function buildRunTimeline(events: readonly SequencedStreamEvent[]): RunTimelineModel {
  const state = createTimelineState()
  for (const event of events) {
    applyTimelineEvent(state, event)
  }

  // Post-process text entries so standalone legacy placeholders are dropped in
  // both the aggregate assistantText and the per-segment chronological view.
  for (const entry of state.entries) {
    if (entry.kind === 'text') {
      entry.text = stripToolCallPlaceholder(entry.text)
    }
  }
  const entries = state.entries.filter((entry) => !(entry.kind === 'text' && entry.text.length === 0))

  return {
    events: [...events],
    entries,
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
