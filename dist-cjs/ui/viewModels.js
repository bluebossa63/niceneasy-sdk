"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.permissionActions = void 0;
exports.permissionDecisionLabel = permissionDecisionLabel;
exports.permissionTone = permissionTone;
exports.permissionToViewModel = permissionToViewModel;
exports.isTransientWorkingStatus = isTransientWorkingStatus;
exports.statusLabel = statusLabel;
exports.statusTone = statusTone;
exports.statusToViewModel = statusToViewModel;
exports.toolOutputToViewModel = toolOutputToViewModel;
exports.streamEventToUxViewModel = streamEventToUxViewModel;
exports.permissionActions = [
    { decision: 'once', label: 'Allow once', tone: 'success' },
    { decision: 'always', label: 'Allow always', tone: 'success' },
    { decision: 'deny', label: 'Deny', tone: 'danger' },
];
function permissionDecisionLabel(decision) {
    if (decision === 'once') {
        return 'allowed once';
    }
    if (decision === 'always') {
        return 'allowed always';
    }
    if (decision === 'deny') {
        return 'denied';
    }
    return 'pending';
}
function permissionTone(decision) {
    if (decision === 'deny') {
        return 'danger';
    }
    if (decision === 'once' || decision === 'always') {
        return 'success';
    }
    return 'warning';
}
function permissionToViewModel(permission) {
    const decision = 'decision' in permission ? permission.decision : undefined;
    const riskLabel = 'agent' in permission
        ? permission.riskLevel
        : permission.risk;
    const requestedAt = permission.requestedAt;
    const resolvedAt = 'resolvedAt' in permission
        ? permission.resolvedAt
        : undefined;
    return {
        id: permission.id,
        title: decision ? 'Permission resolved' : 'Permission needed',
        tool: permission.tool,
        statusLabel: permissionDecisionLabel(decision),
        tone: permissionTone(decision),
        isPending: !decision && (!('state' in permission) || permission.state === 'pending'),
        riskLabel,
        requestedAt,
        resolvedAt,
        actions: decision ? [] : exports.permissionActions,
    };
}
function isTransientWorkingStatus(status) {
    const message = (status.message ?? '').toLowerCase();
    return message.startsWith('working') || message.startsWith('running ');
}
function statusLabel(uxEventKind) {
    if (uxEventKind === 'tool.inline_diff') {
        return 'review diff';
    }
    if (uxEventKind === 'warning') {
        return 'nudge';
    }
    return uxEventKind ?? 'status';
}
function statusTone(uxEventKind) {
    if (uxEventKind === 'warning') {
        return 'warning';
    }
    if (uxEventKind === 'tool.inline_diff') {
        return 'info';
    }
    return 'neutral';
}
function statusToViewModel(status) {
    const isTransient = isTransientWorkingStatus(status);
    return {
        label: statusLabel(status.uxEventKind),
        tone: statusTone(status.uxEventKind),
        isDurable: Boolean(status.uxEventKind) && !isTransient,
        isTransient,
    };
}
function toolOutputToViewModel(tool) {
    const output = tool.output || tool.resultPreview || '';
    return {
        hasOutput: output.length > 0,
        preview: output.length > 180 ? `${output.slice(0, 180)}...` : output,
        output,
        tone: tool.isError ? 'danger' : 'neutral',
        failureLabel: tool.failureClass,
    };
}
function streamEventToUxViewModel(event) {
    if (event.type === 'permission.requested') {
        return {
            kind: 'permission',
            permission: permissionToViewModel({
                id: event.permission_id,
                toolCallId: event.tool_call_id,
                tool: event.tool,
                risk: event.risk,
                requestedAt: event.ts,
            }),
        };
    }
    if (event.type === 'permission.resolved') {
        return {
            kind: 'permission',
            permission: permissionToViewModel({
                id: event.permission_id,
                toolCallId: 'unknown',
                tool: 'unknown',
                decision: event.decision,
                resolvedAt: event.ts,
            }),
        };
    }
    if (event.type === 'status') {
        return {
            kind: 'status',
            status: statusToViewModel({
                message: event.message,
                uxEventKind: event.ux_event_kind,
                tool: event.tool,
            }),
        };
    }
    if (event.type === 'tool.output.delta') {
        return {
            kind: 'tool_output',
            output: toolOutputToViewModel({
                output: event.delta,
                resultPreview: event.result_preview,
                isError: event.is_error,
                failureClass: event.failure_class,
            }),
        };
    }
    if (event.type === 'tool.completed') {
        return {
            kind: 'tool_output',
            output: toolOutputToViewModel({
                output: event.result,
                resultPreview: event.result_preview,
                isError: event.is_error,
                failureClass: event.failure_class,
            }),
        };
    }
    return { kind: 'ignore' };
}
