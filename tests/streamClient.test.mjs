import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { ApiClient, streamChat } from '../dist/index.js'

describe('streamChat abort handling', () => {
  it('does not retry when the caller aborts the stream', async () => {
    const originalFetch = globalThis.fetch
    const controller = new AbortController()
    let attempts = 0
    globalThis.fetch = async () => {
      attempts += 1
      controller.abort()
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    try {
      await assert.rejects(
        streamChat(
          { agent: 'codex', prompt: 'stop me' },
          {
            baseUrl: 'http://localhost:9080',
            signal: controller.signal,
            onEvent() {},
          },
        ),
        /aborted/i,
      )
      assert.equal(attempts, 1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not invent a timeout when stream request omits timeout', async () => {
    const originalFetch = globalThis.fetch
    let body
    globalThis.fetch = async (_url, init) => {
      body = JSON.parse(init.body)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode('event: finish\ndata: {"type":"finish","session_id":"s1","duration_ms":1}\n\n'))
            controller.close()
          },
        }),
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      )
    }

    try {
      await streamChat(
        { agent: 'codex', prompt: 'long context test' },
        {
          baseUrl: 'http://localhost:9080',
          onEvent() {},
        },
      )
      assert.equal(body.timeout, undefined)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('does not invent a timeout when sync chat omits timeout', async () => {
    let body
    const client = new ApiClient({
      baseUrl: 'http://localhost:9080',
      fetch: async (_url, init) => {
        body = JSON.parse(init.body)
        return new Response(JSON.stringify({ agent: 'codex', routed_by: '', profile: '', model: '', response: '', session_id: 's1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    })

    await client.chat({ agent: 'codex', prompt: 'long context test' })

    assert.equal(body.timeout, undefined)
  })
})
