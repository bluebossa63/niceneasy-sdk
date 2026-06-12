import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createSseParser, parseSseJson, SseJsonParseError } from '../dist/index.js'

describe('SSE parser malformed JSON recovery (S33-03)', () => {
  it('skips a malformed message and keeps parsing the rest of the chunk', () => {
    const errors = []
    const parser = createSseParser(undefined, {
      onParseError: (error, message) => errors.push({ error, message }),
    })

    const events = parser.push(
      'data: {"type":"status","message":"ok-1"}\n\n' +
      'data: {broken json\n\n' +
      'data: {"type":"status","message":"ok-2"}\n\n',
    )

    assert.equal(events.length, 2)
    assert.equal(events[0].message, 'ok-1')
    assert.equal(events[1].message, 'ok-2')
    assert.equal(errors.length, 1)
    assert.ok(errors[0].error instanceof SseJsonParseError)
    assert.equal(errors[0].message.data, '{broken json')
  })

  it('keeps buffer state consistent after a malformed message', () => {
    const errors = []
    const parser = createSseParser(undefined, {
      onParseError: (error) => errors.push(error),
    })

    assert.equal(parser.push('data: not-json\n\ndata: {"type":"to').length, 0)
    assert.equal(errors.length, 1)

    // The partial message must survive the malformed one untouched.
    const events = parser.push('ken","content":"hello"}\n\n')
    assert.equal(events.length, 1)
    assert.equal(events[0].type, 'token')
    assert.equal(events[0].content, 'hello')
  })

  it('recovers in flush() for a malformed trailing message', () => {
    const errors = []
    const parser = createSseParser(undefined, {
      onParseError: (error) => errors.push(error),
    })

    parser.push('data: {oops')
    const events = parser.flush()
    assert.equal(events.length, 0)
    assert.equal(errors.length, 1)
    assert.ok(errors[0] instanceof SseJsonParseError)
  })

  it('falls back to a console warning without aborting when no handler is set', () => {
    const warnings = []
    const originalWarn = console.warn
    console.warn = (msg) => warnings.push(msg)
    try {
      const parser = createSseParser()
      const events = parser.push(
        'data: {broken\n\ndata: {"type":"status","message":"still-alive"}\n\n',
      )
      assert.equal(events.length, 1)
      assert.equal(events[0].message, 'still-alive')
      assert.equal(warnings.length, 1)
      assert.match(String(warnings[0]), /malformed SSE message/)
    } finally {
      console.warn = originalWarn
    }
  })

  it('parseSseJson keeps throwing for direct callers without a handler', () => {
    assert.throws(() => parseSseJson('data: {nope\n\n'), SseJsonParseError)
  })
})
