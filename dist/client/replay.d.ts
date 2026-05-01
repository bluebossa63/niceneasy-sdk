import type { RunEvent } from '../types/runs.js';
import type { SequencedStreamEvent, StreamEvent } from '../types/stream.js';
export interface TimelineToolCall {
    id: string;
    tool: string;
    args: unknown;
    iteration: number;
    startedAt?: string;
    completedAt?: string;
    output: string;
    resultLen?: number;
    status?: 'ok' | 'error';
    durationMs?: number;
}
export interface TimelinePermission {
    id: string;
    toolCallId: string;
    tool: string;
    risk?: string;
    decision?: 'once' | 'always' | 'deny';
    requestedAt?: string;
    resolvedAt?: string;
}
export interface TimelineStatus {
    seq: number;
    ts: string;
    message: string;
}
export interface RunTimelineModel {
    events: SequencedStreamEvent[];
    assistantText: string;
    reasoningText: string;
    tools: TimelineToolCall[];
    permissions: TimelinePermission[];
    statuses: TimelineStatus[];
    errors: string[];
    usage?: Extract<StreamEvent, {
        type: 'usage';
    }>;
    finish?: Extract<SequencedStreamEvent, {
        type: 'finish';
    }>;
    sessionId?: string;
    runId?: string;
    messageId?: string;
    startedAt?: string;
    finishedAt?: string;
}
export declare function normalizeRunEvents(rows: RunEvent[]): SequencedStreamEvent[];
export declare function buildRunTimeline(events: readonly SequencedStreamEvent[]): RunTimelineModel;
export declare function runEventsToTimeline(rows: RunEvent[]): RunTimelineModel;
