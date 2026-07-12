import type { SequencedStreamEvent, StreamEvent, StreamEventMeta } from '../types/stream.js'

export function withStreamEventMeta(event: StreamEvent, meta: StreamEventMeta): StreamEvent {
  return {
    ...event,
    ...(meta.run_id !== undefined && event.run_id === undefined ? { run_id: meta.run_id } : {}),
    ...(meta.session_id !== undefined && event.session_id === undefined ? { session_id: meta.session_id } : {}),
    ...(meta.message_id !== undefined && event.message_id === undefined ? { message_id: meta.message_id } : {}),
    ...(meta.tool_call_id !== undefined && event.tool_call_id === undefined ? { tool_call_id: meta.tool_call_id } : {}),
    ...(meta.seq !== undefined && event.seq === undefined ? { seq: meta.seq } : {}),
    ...(meta.ts !== undefined && event.ts === undefined ? { ts: meta.ts } : {}),
  } as StreamEvent
}

export function sequenceStreamEvent(event: StreamEvent, seq: number, ts = new Date().toISOString()): SequencedStreamEvent {
  return withStreamEventMeta(event, { seq: event.seq ?? seq, ts: event.ts ?? ts }) as SequencedStreamEvent
}
