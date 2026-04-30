import type { StreamEvent } from './stream.js';
export interface RunEvent {
    seq: number;
    event_type: string;
    payload: StreamEvent;
    ts: string;
}
export interface RawRunEvent {
    seq: number;
    event_type: string;
    payload: string;
    ts: string;
}
export interface RunEventsResponse {
    run_id: string;
    events: RawRunEvent[];
}
export interface RunSummary {
    run_id: string;
    session_id: string;
    agent: string;
    event_count: number;
    started_at: string;
    finished_at: string;
}
export interface RunsResponse {
    runs: RunSummary[];
}
