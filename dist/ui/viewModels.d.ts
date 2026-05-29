import type { TimelinePermission, TimelineStatus, TimelineToolCall } from '../client/replay.js';
import type { PermissionDecision, PermissionRequest } from '../types/permissions.js';
import type { StreamEvent } from '../types/stream.js';
export type UxTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export interface PermissionActionView {
    decision: PermissionDecision;
    label: string;
    tone: UxTone;
}
export interface PermissionViewModel {
    id: string;
    title: string;
    tool: string;
    statusLabel: string;
    tone: UxTone;
    isPending: boolean;
    riskLabel?: string;
    requestedAt?: string;
    resolvedAt?: string;
    actions: PermissionActionView[];
}
export interface StatusViewModel {
    label: string;
    tone: UxTone;
    isDurable: boolean;
    isTransient: boolean;
}
export interface ToolOutputViewModel {
    hasOutput: boolean;
    preview: string;
    output: string;
    tone: UxTone;
    failureLabel?: string;
}
export type StreamUxViewModel = {
    kind: 'permission';
    permission: PermissionViewModel;
} | {
    kind: 'status';
    status: StatusViewModel;
} | {
    kind: 'tool_output';
    output: ToolOutputViewModel;
} | {
    kind: 'ignore';
};
export declare const permissionActions: PermissionActionView[];
export declare function permissionDecisionLabel(decision?: PermissionDecision): string;
export declare function permissionTone(decision?: PermissionDecision): UxTone;
export declare function permissionToViewModel(permission: PermissionRequest | TimelinePermission): PermissionViewModel;
export declare function isTransientWorkingStatus(status: Pick<TimelineStatus, 'message' | 'tool'>): boolean;
export declare function statusLabel(uxEventKind?: string): string;
export declare function statusTone(uxEventKind?: string): UxTone;
export declare function statusToViewModel(status: Pick<TimelineStatus, 'message' | 'uxEventKind' | 'tool'>): StatusViewModel;
export declare function toolOutputToViewModel(tool: Partial<Pick<TimelineToolCall, 'output' | 'resultPreview' | 'isError' | 'failureClass'>>): ToolOutputViewModel;
export declare function streamEventToUxViewModel(event: StreamEvent): StreamUxViewModel;
