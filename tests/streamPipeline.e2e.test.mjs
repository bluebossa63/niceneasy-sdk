import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildRunTimeline, streamChat, streamEventToUxViewModel } from '../dist/index.js'

// End-to-end pipeline test (fsi-ai-agent sprint S33-06).
//
// Replays a realistic backend SSE stream — in the exact wire format produced by
// the Go backend's writeSSEEvent ("event: <type>\ndata: <json>\n\n") — through
// the full SDK pipeline:
//
//   streamChat (fetch + SSE parse) → adaptLegacyEvents → buildRunTimeline
//   → streamEventToUxViewModel
//
// and asserts the final UI-facing state. The fixture covers think-only nudges,
// reasoning deltas, a successful and a failing tool call, permission
// request/resolution, a legacy `token` event, a malformed JSON message
// (S33-03 recovery), and chunk splits in the middle of SSE messages.

function sse(type, payload) {
  return `event: ${type}\ndata: ${JSON.stringify({ type, ...payload })}\n\n`
}

const WIRE = [
  sse('session.created', { session_id: 'session-e2e-001', run_id: 'run-e2e-001', agent: 'codex', model: 'deepseek-v4' }),
  sse('message.started', { message_id: 'msg-1', role: 'assistant' }),
  // Mid-stream think-only recovery: backend nudges the model and reports it.
  sse('status', {
    message: 'Model produced reasoning only; nudging it to continue (1/2)',
    ux_event_kind: 'warning',
    retry: 1,
    max_retries: 2,
  }),
  sse('reasoning.delta', { message_id: 'msg-1', delta: 'The user wants the repo status; I should run git status first. ' }),
  sse('reasoning.delta', { message_id: 'msg-1', delta: 'Then summarize the output.' }),
  // Transient progress status — must not become a durable UX row.
  sse('status', { message: 'working: running tools (iteration 1)' }),
  sse('tool.started', { tool_call_id: 'call-1', tool: 'shell_exec', args: '{"command":"git status"}', iteration: 1 }),
  sse('tool.output.delta', { tool_call_id: 'call-1', delta: 'On branch main\n' }),
  sse('tool.completed', { tool_call_id: 'call-1', result_len: 38, result: 'On branch main\nnothing to commit\n', status: 'ok', duration_ms: 420 }),
  // Permission gate before a risky write.
  sse('permission.requested', { permission_id: 'perm-1', tool_call_id: 'call-2', tool: 'write_file', risk: 'medium' }),
  sse('permission.resolved', { permission_id: 'perm-1', decision: 'once' }),
  sse('tool.started', { tool_call_id: 'call-2', tool: 'write_file', args: '{"path":"/etc/hosts"}', iteration: 2 }),
  // Failing tool call with failure classification.
  sse('tool.completed', {
    tool_call_id: 'call-2',
    result_len: 24,
    result: 'permission denied: /etc/hosts',
    status: 'error',
    is_error: true,
    failure_class: 'permission_denied',
    retryable: false,
  }),
  // Malformed JSON mid-stream (S33-03): must be skipped without killing the parser.
  'event: status\ndata: {"type":"status","message":"truncated\n\n',
  // Legacy event shape still emitted by older backends.
  `event: token\ndata: ${JSON.stringify({ type: 'token', delta: 'The repo is clean. ' })}\n\n`,
  sse('text.delta', { message_id: 'msg-1', delta: 'I could not update /etc/hosts (permission denied).' }),
  sse('usage', { tokens_in: 1450, tokens_out: 210, cost_usd: 0.0042 }),
  sse('finish', { session_id: 'session-e2e-001', duration_ms: 5200, tokens_in: 1450, tokens_out: 210, cost_usd: 0.0042 }),
  'data: [DONE]\n\n',
].join('')

// Split the wire bytes into uneven chunks so message boundaries land
// mid-line, exercising the incremental parser.
function chunkify(text, sizes) {
  const encoder = new TextEncoder()
  const chunks = []
  let offset = 0
  let i = 0
  while (offset < text.length) {
    const size = sizes[i % sizes.length]
    chunks.push(encoder.encode(text.slice(offset, offset + size)))
    offset += size
    i += 1
  }
  return chunks
}

function fetchStub(chunks) {
  return async () => {
    let index = 0
    const body = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) {
          controller.enqueue(chunks[index])
          index += 1
        } else {
          controller.close()
        }
      },
    })
    return new Response(body, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }
}

describe('streaming pipeline end-to-end', () => {
  it('replays a realistic backend stream into the final UI state', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = fetchStub(chunkify(WIRE, [7, 113, 31, 257, 64]))

    const events = []
    const parseErrors = []
    let doneCalled = false

    try {
      await streamChat(
        { agent: 'codex', prompt: 'check the repo state' },
        {
          baseUrl: 'http://localhost:9080',
          onEvent: (event) => events.push(event),
          onDone: () => {
            doneCalled = true
          },
          onParseError: (error) => parseErrors.push(error),
        },
      )
    } finally {
      globalThis.fetch = originalFetch
    }

    // --- transport layer ---
    assert.equal(doneCalled, true, 'finish event should trigger onDone')
    assert.equal(parseErrors.length, 1, 'exactly one malformed message should be reported')
    assert.equal(events.at(-1)?.type, 'finish', 'finish must be the final delivered event')
    const seqs = events.map((event) => event.seq)
    assert.deepEqual(seqs, [...seqs].sort((a, b) => a - b), 'sequence numbers must be monotonic')

    // --- timeline projection (replay layer) ---
    const timeline = buildRunTimeline(events)
    assert.equal(timeline.sessionId, 'session-e2e-001')
    assert.equal(timeline.runId, 'run-e2e-001')
    assert.equal(
      timeline.assistantText,
      'The repo is clean. I could not update /etc/hosts (permission denied).',
      'legacy token and canonical text.delta must merge into assistant text',
    )
    assert.match(timeline.reasoningText, /git status first/)
    assert.match(timeline.reasoningText, /summarize the output/)

    assert.equal(timeline.tools.length, 2)
    const [shellTool, writeTool] = timeline.tools
    assert.equal(shellTool.tool, 'shell_exec')
    assert.equal(shellTool.status, 'ok')
    assert.notEqual(shellTool.isError, true)
    assert.match(shellTool.output, /On branch main/)
    assert.equal(writeTool.tool, 'write_file')
    assert.equal(writeTool.isError, true)
    assert.equal(writeTool.failureClass, 'permission_denied')

    assert.equal(timeline.permissions.length, 1)
    assert.equal(timeline.permissions[0].decision, 'once')
    assert.equal(timeline.permissions[0].tool, 'write_file')

    const nudges = timeline.statuses.filter((status) => status.uxEventKind === 'warning')
    assert.equal(nudges.length, 1)
    assert.equal(nudges[0].retry, 1)
    assert.equal(nudges[0].maxRetries, 2)

    assert.equal(timeline.usage?.tokens_in, 1450)
    assert.equal(timeline.usage?.cost_usd, 0.0042)
    assert.equal(timeline.finish?.duration_ms, 5200)
    assert.equal(timeline.errors.length, 0)

    // --- UX view model layer ---
    const views = events.map((event) => streamEventToUxViewModel(event))

    const nudgeViews = views.filter((view) => view.kind === 'status' && view.status.label === 'nudge')
    assert.equal(nudgeViews.length, 1)
    assert.equal(nudgeViews[0].status.tone, 'warning')
    assert.equal(nudgeViews[0].status.isDurable, true)

    const transientViews = views.filter((view) => view.kind === 'status' && view.status.isTransient)
    assert.equal(transientViews.length, 1, 'working status must classify as transient')
    assert.equal(transientViews[0].status.isDurable, false)

    const permissionViews = views.filter((view) => view.kind === 'permission')
    assert.equal(permissionViews.length, 2, 'request and resolution both surface as permission views')
    assert.ok(
      permissionViews.some((view) => view.permission.actions.length > 0),
      'pending permission must expose decision actions',
    )

    const failureView = views.find((view) => view.kind === 'tool_output' && view.output.tone === 'danger')
    assert.ok(failureView, 'failing tool output must surface with danger tone')
    assert.equal(failureView.output.failureLabel, 'permission_denied')
  })
})
