export interface SseMessage {
    event?: string;
    data: string;
    id?: string;
    retry?: number;
}
export interface SseParseResult {
    messages: SseMessage[];
    rest: string;
}
export type SseJsonParser<T> = (value: unknown, message: SseMessage) => T | null;
export declare class SseJsonParseError extends Error {
    readonly data: string;
    readonly cause: unknown;
    constructor(data: string, cause: unknown);
}
export declare function parseSseMessage(block: string): SseMessage | null;
export declare function parseSseMessages(input: string): SseParseResult;
export declare function parseSseJson<T = Record<string, unknown>>(input: string, parser?: SseJsonParser<T>, onParseError?: (error: SseJsonParseError, message: SseMessage) => void): {
    events: T[];
    rest: string;
};
export interface SseParserOptions {
    /**
     * Called when a message's JSON payload is malformed. The parser skips the
     * message, keeps its buffer consistent, and continues with the rest of the
     * stream (S33-03). Defaults to a console warning so failures stay visible.
     */
    onParseError?: (error: SseJsonParseError, message: SseMessage) => void;
}
export declare function createSseParser<T = Record<string, unknown>>(parser?: SseJsonParser<T>, options?: SseParserOptions): {
    push(chunk: string): T[];
    flush(): T[];
    reset(): void;
};
