export type ConnectionState = 'connected' | 'degraded' | 'disconnected' | 'checking';
export type DiagnosticSeverity = 'info' | 'warning' | 'error';
export interface EndpointPreset {
    id: string;
    label: string;
    apiUrl: string;
    description?: string;
    authType?: 'none' | 'basic' | 'bearer';
}
export interface EndpointProfile extends EndpointPreset {
    source?: 'built_in' | 'user';
    activeAgent?: string;
}
export interface DiagnosticItem {
    id: string;
    severity: DiagnosticSeverity;
    title: string;
    detail: string;
    source?: string;
    timestamp?: string;
}
export interface DiagnosticsReport {
    endpoint: EndpointProfile;
    connectionState: ConnectionState;
    latencyMs?: number;
    backend?: ReadyResponse;
    items: DiagnosticItem[];
}
import type { ReadyResponse } from './common.js';
