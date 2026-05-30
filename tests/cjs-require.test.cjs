const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

describe('CommonJS package entry', () => {
  it('loads SDK runtime helpers through require()', () => {
    const sdk = require('../dist-cjs/index.js')

    assert.equal(typeof sdk.runEventsToTimeline, 'function')
    assert.equal(typeof sdk.streamEventToUxViewModel, 'function')
    assert.equal(typeof sdk.permissionToViewModel, 'function')
  })
})
