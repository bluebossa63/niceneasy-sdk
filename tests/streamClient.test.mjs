import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { streamChat } from '../dist/index.js'

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
})
