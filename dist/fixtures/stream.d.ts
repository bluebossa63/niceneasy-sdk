import type { SequencedStreamEvent, StreamEvent } from '../types/stream.js';
export declare const streamFixtureBase: {
    run_id: string;
    session_id: string;
    message_id: string;
    tool_call_id: string;
};
export declare const canonicalStreamEvents: SequencedStreamEvent[];
export declare const legacyStreamPayloads: Array<Record<string, unknown>>;
export declare const sseFixtureStream: string;
export declare const errorStreamEvent: StreamEvent;
