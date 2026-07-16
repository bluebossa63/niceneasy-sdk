import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRunTimeline, canonicalStreamEvents, runEventsToTimeline, sequenceStreamEvent } from '../dist/index.js'

const base = {
  run_id: 'run-order-001',
  session_id: 'session-order-001',
  message_id: 'message-order-001',
}

// text → tool.started → tool.output/tool.completed → text → finish, with a
// status/system event interleaved between the tool events.
const orderedStream = [
  sequenceStreamEvent({ type: 'session.created', ...base, agent: 'codex', model: 'gpt' }, 0, '2026-07-10T00:00:00.000Z'),
  sequenceStreamEvent({ type: 'message.started', ...base, role: 'assistant' }, 1, '2026-07-10T00:00:00.010Z'),
  sequenceStreamEvent({ type: 'text.delta', ...base, delta: 'Let me check the repo.' }, 2, '2026-07-10T00:00:00.020Z'),
  sequenceStreamEvent({ type: 'tool.started', ...base, tool_call_id: 'tc-1', tool: 'shell_exec', args: { cmd: 'ls' }, iteration: 1 }, 3, '2026-07-10T00:00:00.030Z'),
  sequenceStreamEvent({ type: 'status', ...base, message: 'running shell_exec', ux_event_kind: 'warning' }, 4, '2026-07-10T00:00:00.035Z'),
  sequenceStreamEvent({ type: 'tool.output.delta', ...base, tool_call_id: 'tc-1', delta: 'file.txt\n' }, 5, '2026-07-10T00:00:00.040Z'),
  sequenceStreamEvent({ type: 'tool.completed', ...base, tool_call_id: 'tc-1', result_len: 9, result: 'file.txt\n', status: 'ok', duration_ms: 12 }, 6, '2026-07-10T00:00:00.050Z'),
  sequenceStreamEvent({ type: 'text.delta', ...base, delta: 'Found one file. Done.' }, 7, '2026-07-10T00:00:00.060Z'),
  sequenceStreamEvent({ type: 'usage', ...base, tokens_in: 10, tokens_out: 5, cost_usd: 0.001 }, 8, '2026-07-10T00:00:00.070Z'),
  sequenceStreamEvent({ type: 'finish', ...base, duration_ms: 90 }, 9, '2026-07-10T00:00:01.000Z'),
]

describe('run timeline chronological entries', () => {
  it('orders text, tool, status, and final text as they happened', () => {
    const timeline = buildRunTimeline(orderedStream)
    const kinds = timeline.entries.map((entry) => entry.kind)
    assert.deepEqual(kinds, ['text', 'tool', 'status', 'text', 'usage', 'finish'])

    const [firstText, tool, status, lastText] = timeline.entries
    assert.equal(firstText.kind === 'text' && firstText.text, 'Let me check the repo.')
    assert.equal(tool.kind === 'tool' && tool.tool.tool, 'shell_exec')
    assert.equal(tool.kind === 'tool' && tool.tool.output, 'file.txt\n')
    assert.equal(tool.kind === 'tool' && tool.tool.status, 'ok')
    assert.equal(status.kind === 'status' && status.status.uxEventKind, 'warning')
    assert.equal(lastText.kind === 'text' && lastText.text, 'Found one file. Done.')
  })

  it('entries are sorted by seq and the tool entry keeps its original position', () => {
    const timeline = buildRunTimeline(orderedStream)
    const seqs = timeline.entries.map((entry) => entry.seq)
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b))
    // The tool entry must appear before the interleaved status and the final
    // text — not grouped at the top or bottom.
    const toolIndex = timeline.entries.findIndex((entry) => entry.kind === 'tool')
    const statusIndex = timeline.entries.findIndex((entry) => entry.kind === 'status')
    const lastTextIndex = timeline.entries.map((entry) => entry.kind).lastIndexOf('text')
    assert.ok(toolIndex < statusIndex)
    assert.ok(statusIndex < lastTextIndex)
  })

  it('replayed persisted rows render the same ordered entries as the live stream', () => {
    const live = buildRunTimeline(orderedStream)
    const rows = orderedStream.map((event) => ({
      seq: event.seq,
      event_type: event.type,
      payload: event,
      ts: event.ts,
    }))
    const replayed = runEventsToTimeline(rows)

    const project = (t) =>
      t.entries.map((entry) => {
        if (entry.kind === 'tool') return { kind: entry.kind, seq: entry.seq, ref: entry.tool.id, output: entry.tool.output }
        if (entry.kind === 'status') return { kind: entry.kind, seq: entry.seq, ref: entry.status.message }
        if (entry.kind === 'text' || entry.kind === 'reasoning') return { kind: entry.kind, seq: entry.seq, ref: entry.text }
        if (entry.kind === 'permission') return { kind: entry.kind, seq: entry.seq, ref: entry.permission.id }
        return { kind: entry.kind, seq: entry.seq, ref: entry.message }
      })

    assert.deepEqual(project(replayed), project(live))
  })

  it('interleaves permission events chronologically with tools and text', () => {
    const timeline = buildRunTimeline(canonicalStreamEvents)
    const kinds = timeline.entries.map((entry) => entry.kind)
    // Fixture order: text, reasoning, tool(x2), status(x2), permission(req+res
    // collapse to one entry). Permission entry must sit between the statuses and
    // the end, not be hoisted above the tools.
    const firstTool = kinds.indexOf('tool')
    const permission = kinds.indexOf('permission')
    const firstStatus = kinds.indexOf('status')
    assert.ok(firstTool >= 0 && firstTool < permission, 'tools precede permission')
    assert.ok(firstStatus >= 0 && firstStatus < permission, 'status precedes permission')
    // Reasoning appears before the first tool.
    assert.ok(kinds.indexOf('reasoning') < firstTool)
  })

  it('collapses a resolved permission into a single chronological entry', () => {
    const timeline = buildRunTimeline(canonicalStreamEvents)
    const permissionEntries = timeline.entries.filter((entry) => entry.kind === 'permission')
    assert.equal(permissionEntries.length, 1)
    assert.equal(permissionEntries[0].permission.decision, 'once')
  })
})
