const assert = require('node:assert/strict')
const { describe, it } = require('node:test')

describe('CommonJS package entry', () => {
  it('loads SDK runtime helpers through require()', () => {
    const sdk = require('../dist-cjs/index.js')

    assert.equal(typeof sdk.runEventsToTimeline, 'function')
    assert.equal(typeof sdk.streamEventToUxViewModel, 'function')
    assert.equal(typeof sdk.permissionToViewModel, 'function')
    assert.equal(typeof sdk.AgentApiClient, 'function')
  })

  it('loads new subpaths and compatibility barrels through require()', () => {
    const timeline = require('@niceneasy/agent-sdk/timeline/runTimeline')
    const replayCompat = require('@niceneasy/agent-sdk/client/replay')
    const chatStream = require('@niceneasy/agent-sdk/stream/chatStream')
    const streamCompat = require('@niceneasy/agent-sdk/client/streamClient')
    const ui = require('@niceneasy/agent-sdk/ui/streamViewModels')
    const uiCompat = require('@niceneasy/agent-sdk/ui/viewModels')

    assert.equal(typeof timeline.buildRunTimeline, 'function')
    assert.equal(replayCompat.buildRunTimeline, timeline.buildRunTimeline)
    assert.equal(typeof chatStream.streamChat, 'function')
    assert.equal(streamCompat.streamChat, chatStream.streamChat)
    assert.equal(uiCompat.streamEventToUxViewModel, ui.streamEventToUxViewModel)
  })
})
