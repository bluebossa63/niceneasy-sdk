export const permissionActions = [
    { decision: 'once', label: 'Allow once', tone: 'success' },
    { decision: 'always', label: 'Allow always', tone: 'success' },
    { decision: 'deny', label: 'Deny', tone: 'danger' },
];
export function permissionDecisionLabel(decision) {
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
export function permissionTone(decision) {
    if (decision === 'deny') {
        return 'danger';
    }
    if (decision === 'once' || decision === 'always') {
        return 'success';
    }
    return 'warning';
}
export function permissionToViewModel(permission) {
    const decision = 'decision' in permission ? permission.decision : undefined;
    const riskLabel = 'agent' in permission
        ? permission.reason ?? permission.riskLevel
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
        actions: decision ? [] : permissionActions,
    };
}
export function isTransientWorkingStatus(status) {
    const message = (status.message ?? '').toLowerCase();
    return message.startsWith('working') || message.startsWith('running ');
}
export function statusLabel(uxEventKind) {
    if (uxEventKind === 'tool.inline_diff') {
        return 'review diff';
    }
    if (uxEventKind === 'warning') {
        return 'nudge';
    }
    return uxEventKind ?? 'status';
}
export function statusTone(uxEventKind) {
    if (uxEventKind === 'warning') {
        return 'warning';
    }
    if (uxEventKind === 'tool.inline_diff') {
        return 'info';
    }
    return 'neutral';
}
export function statusToViewModel(status) {
    const isTransient = isTransientWorkingStatus(status);
    return {
        label: statusLabel(status.uxEventKind),
        tone: statusTone(status.uxEventKind),
        isDurable: Boolean(status.uxEventKind) && !isTransient,
        isTransient,
    };
}
export function toolOutputToViewModel(tool) {
    const output = tool.output || tool.resultPreview || '';
    return {
        hasOutput: output.length > 0,
        preview: output.length > 180 ? `${output.slice(0, 180)}...` : output,
        output,
        tone: tool.isError ? 'danger' : 'neutral',
        failureLabel: tool.failureClass,
    };
}
export function streamEventToUxViewModel(event) {
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
