import { type SequencedStreamEvent } from '../types/stream.js';
export interface StreamClientOptions {
    baseUrl?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    onEvent: (event: SequencedStreamEvent) => void;
    onError?: (err: Error) => void;
    onDone?: () => void;
}
export interface StreamChatRequest {
    agent: string;
    prompt: string;
    session_id?: string;
    timeout?: number;
}
export declare function streamChat(request: StreamChatRequest, options: StreamClientOptions): Promise<void>;
