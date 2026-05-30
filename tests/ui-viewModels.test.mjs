import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  canonicalStreamEvents,
  permissionToViewModel,
  runEventsToTimeline,
  statusToViewModel,
  streamEventToUxViewModel,
  toolOutputToViewModel,
} from '../dist/index.js'

const rows = canonicalStreamEvents.map((event) => ({
  seq: event.seq,
  event_type: event.type,
  payload: event,
  ts: event.ts,
}))
const timeline = runEventsToTimeline(rows)

describe('SDK UI view models', () => {
  it('normalizes permission lifecycle semantics from shared fixtures', () => {
    const permission = timeline.permissions[0]
    const view = permissionToViewModel(permission)

    assert.equal(view.title, 'Permission resolved')
    assert.equal(view.tool, 'shell_exec')
    assert.equal(view.statusLabel, 'allowed once')
    assert.equal(view.tone, 'success')
    assert.equal(view.isPending, false)
    assert.equal(view.actions.length, 0)
  })

  it('keeps permission risk separate from the human-readable reason', () => {
    const view = permissionToViewModel({
      id: 'perm-risk',
      agent: 'codex',
      tool: 'shell',
      riskLevel: 'high',
      reason: 'needs to run the test suite',
      requestedAt: '2026-05-30T00:00:00Z',
      state: 'pending',
    })

    assert.equal(view.riskLabel, 'high')
    assert.equal(view.isPending, true)
  })

  it('identifies nudges and diff statuses as durable UI events', () => {
    const diffStatus = timeline.statuses.find((status) => status.uxEventKind === 'tool.inline_diff')
    const diffView = statusToViewModel(diffStatus)
    const workingView = statusToViewModel({ message: 'Working on repository state' })

    assert.equal(diffView.label, 'review diff')
    assert.equal(diffView.tone, 'info')
    assert.equal(diffView.isDurable, true)
    assert.equal(workingView.isTransient, true)
    assert.equal(workingView.isDurable, false)
  })

  it('preserves full tool output and a compact preview', () => {
    const failedTool = timeline.tools.find((tool) => tool.isError)
    const outputView = toolOutputToViewModel(failedTool)

    assert.equal(outputView.hasOutput, true)
    assert.equal(outputView.tone, 'danger')
    assert.equal(outputView.failureLabel, 'permission_denied')
    assert.match(outputView.output, /permission denied/)
    assert.match(outputView.preview, /permission denied/)
  })

  it('maps live stream events to frontend-friendly view models', () => {
    const permissionEvent = canonicalStreamEvents.find((event) => event.type === 'permission.requested')
    const statusEvent = canonicalStreamEvents.find((event) => event.type === 'status')
    const outputEvent = canonicalStreamEvents.find((event) => event.type === 'tool.output.delta' && event.is_error)

    assert.equal(streamEventToUxViewModel(permissionEvent).kind, 'permission')
    assert.equal(streamEventToUxViewModel(statusEvent).kind, 'status')
    assert.equal(streamEventToUxViewModel(outputEvent).kind, 'tool_output')
  })
})
