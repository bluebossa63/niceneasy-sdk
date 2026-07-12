import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import * as root from '@niceneasy/agent-sdk'
import * as replayCompat from '@niceneasy/agent-sdk/client/replay'
import * as streamClientCompat from '@niceneasy/agent-sdk/client/streamClient'
import * as streamBarrel from '@niceneasy/agent-sdk/stream'
import * as chatStream from '@niceneasy/agent-sdk/stream/chatStream'
import * as legacyAdapter from '@niceneasy/agent-sdk/stream/legacyAdapter'
import * as streamTypesCompat from '@niceneasy/agent-sdk/types/stream'
import * as timeline from '@niceneasy/agent-sdk/timeline/runTimeline'
import * as streamViewModels from '@niceneasy/agent-sdk/ui/streamViewModels'
import * as viewModelsCompat from '@niceneasy/agent-sdk/ui/viewModels'

describe('public package exports', () => {
  it('exposes new names and compatibility barrels through ESM exports', () => {
    assert.equal(typeof root.AgentApiClient, 'function')
    assert.equal(typeof root.ApiClient, 'function')
    assert.equal(timeline.buildRunTimeline, root.buildRunTimeline)
    assert.equal(replayCompat.runEventsToTimeline, root.runEventsToTimeline)
    assert.equal(streamBarrel.streamChat, root.streamChat)
    assert.equal(chatStream.streamChat, root.streamChat)
    assert.equal(streamClientCompat.streamChat, chatStream.streamChat)
    assert.equal(legacyAdapter.adaptLegacyEvent, streamTypesCompat.adaptLegacyEvent)
    assert.equal(streamViewModels.streamEventToUxViewModel, viewModelsCompat.streamEventToUxViewModel)
  })
})
