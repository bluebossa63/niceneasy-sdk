import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canonicalStreamEvents, runEventsToTimeline } from '../dist/index.js'

const rows = canonicalStreamEvents.map((event) => ({
  seq: event.seq,
  event_type: event.type,
  payload: event,
  ts: event.ts,
}))

describe('Run timeline chronological entries', () => {
  const timeline = runEventsToTimeline(rows)

  it('exposes a chronological entries array in raw seq order', () => {
    assert.ok(Array.isArray(timeline.entries))
    assert.ok(timeline.entries.length > 0)
    for (let i = 1; i < timeline.entries.length; i += 1) {
      assert.ok(
        timeline.entries[i].seq >= timeline.entries[i - 1].seq,
        `entry ${i} seq ${timeline.entries[i].seq} < previous ${timeline.entries[i - 1].seq}`,
      )
    }
  })

  it('interleaves text, tool, status, permission, usage and finish entries', () => {
    const kinds = timeline.entries.map((entry) => entry.kind)
    assert.ok(kinds.includes('text'))
    assert.ok(kinds.includes('tool'))
    assert.ok(kinds.includes('status'))
    assert.ok(kinds.includes('permission'))
    assert.ok(kinds.includes('usage'))
    assert.ok(kinds.includes('finish'))
  })

  it('places the first tool entry after the first text entry (arrival order)', () => {
    const firstText = timeline.entries.findIndex((entry) => entry.kind === 'text')
    const firstTool = timeline.entries.findIndex((entry) => entry.kind === 'tool')
    assert.ok(firstText >= 0 && firstTool >= 0)
    assert.ok(firstTool > firstText, 'tool call should follow the narration that preceded it')
  })

  it('places finish/usage entries at the tail as run terminators', () => {
    const finishIdx = timeline.entries.findIndex((entry) => entry.kind === 'finish')
    const lastToolIdx = timeline.entries.map((e) => e.kind).lastIndexOf('tool')
    assert.ok(finishIdx > lastToolIdx)
  })

  it('surfaces the same tool objects via entries and the aggregate array', () => {
    const toolEntry = timeline.entries.find((entry) => entry.kind === 'tool')
    assert.ok(toolEntry && toolEntry.kind === 'tool')
    assert.ok(timeline.tools.some((tool) => tool.id === toolEntry.tool.id))
    // Completed tool should carry final duration/status through the entry ref.
    const completed = timeline.entries.find(
      (entry) => entry.kind === 'tool' && entry.tool.status !== undefined,
    )
    assert.ok(completed && completed.kind === 'tool')
    assert.ok(completed.tool.durationMs !== undefined)
  })
})
