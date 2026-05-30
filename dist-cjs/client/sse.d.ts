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
export declare function parseSseJson<T = Record<string, unknown>>(input: string, parser?: SseJsonParser<T>): {
    events: T[];
    rest: string;
};
export declare function createSseParser<T = Record<string, unknown>>(parser?: SseJsonParser<T>): {
    push(chunk: string): T[];
    flush(): T[];
    reset(): void;
};
