import { type SequencedStreamEvent } from '../types/stream.js';
import { type SseJsonParseError, type SseMessage } from './sse.js';
export interface StreamClientOptions {
    baseUrl?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    onEvent: (event: SequencedStreamEvent) => void;
    onError?: (err: Error) => void;
    onDone?: () => void;
    /**
     * Non-fatal diagnostic for malformed SSE JSON messages (S33-03). The
     * stream continues with the remaining messages; when omitted, the SDK
     * logs a console warning.
     */
    onParseError?: (error: SseJsonParseError, message: SseMessage) => void;
}
export interface StreamChatRequest {
    agent: string;
    prompt: string;
    session_id?: string;
    timeout?: number;
    model_ref?: string;
}
export declare function streamChat(request: StreamChatRequest, options: StreamClientOptions): Promise<void>;
