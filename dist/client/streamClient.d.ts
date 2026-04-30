import { type StreamEvent } from '../types/stream.js';
export interface StreamClientOptions {
    baseUrl?: string;
    onEvent: (event: StreamEvent) => void;
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
