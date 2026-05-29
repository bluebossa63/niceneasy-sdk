import type { TimelinePermission, TimelineStatus, TimelineToolCall } from '../client/replay.js'
import type { PermissionDecision, PermissionRequest } from '../types/permissions.js'
import type { StreamEvent } from '../types/stream.js'

export type UxTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export interface PermissionActionView {
  decision: PermissionDecision
  label: string
  tone: UxTone
}

export interface PermissionViewModel {
  id: string
  title: string
  tool: string
  statusLabel: string
  tone: UxTone
  isPending: boolean
  riskLabel?: string
  requestedAt?: string
  resolvedAt?: string
  actions: PermissionActionView[]
}

export interface StatusViewModel {
  label: string
  tone: UxTone
  isDurable: boolean
  isTransient: boolean
}

export interface ToolOutputViewModel {
  hasOutput: boolean
  preview: string
  output: string
  tone: UxTone
  failureLabel?: string
}

export type StreamUxViewModel =
  | { kind: 'permission'; permission: PermissionViewModel }
  | { kind: 'status'; status: StatusViewModel }
  | { kind: 'tool_output'; output: ToolOutputViewModel }
  | { kind: 'ignore' }

export const permissionActions: PermissionActionView[] = [
  { decision: 'once', label: 'Allow once', tone: 'success' },
  { decision: 'always', label: 'Allow always', tone: 'success' },
  { decision: 'deny', label: 'Deny', tone: 'danger' },
]

export function permissionDecisionLabel(decision?: PermissionDecision): string {
  if (decision === 'once') {
    return 'allowed once'
  }
  if (decision === 'always') {
    return 'allowed always'
  }
  if (decision === 'deny') {
    return 'denied'
  }
  return 'pending'
}

export function permissionTone(decision?: PermissionDecision): UxTone {
  if (decision === 'deny') {
    return 'danger'
  }
  if (decision === 'once' || decision === 'always') {
    return 'success'
  }
  return 'warning'
}

export function permissionToViewModel(permission: PermissionRequest | TimelinePermission): PermissionViewModel {
  const decision = 'decision' in permission ? permission.decision : undefined
  const riskLabel =
    'agent' in permission
      ? permission.reason ?? permission.riskLevel
      : permission.risk
  const requestedAt = permission.requestedAt
  const resolvedAt =
    'resolvedAt' in permission
      ? permission.resolvedAt
      : undefined
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
  }
}

export function isTransientWorkingStatus(status: Pick<TimelineStatus, 'message' | 'tool'>): boolean {
  const message = (status.message ?? '').toLowerCase()
  return message.startsWith('working') || message.startsWith('running ')
}

export function statusLabel(uxEventKind?: string): string {
  if (uxEventKind === 'tool.inline_diff') {
    return 'review diff'
  }
  if (uxEventKind === 'warning') {
    return 'nudge'
  }
  return uxEventKind ?? 'status'
}

export function statusTone(uxEventKind?: string): UxTone {
  if (uxEventKind === 'warning') {
    return 'warning'
  }
  if (uxEventKind === 'tool.inline_diff') {
    return 'info'
  }
  return 'neutral'
}

export function statusToViewModel(status: Pick<TimelineStatus, 'message' | 'uxEventKind' | 'tool'>): StatusViewModel {
  const isTransient = isTransientWorkingStatus(status)
  return {
    label: statusLabel(status.uxEventKind),
    tone: statusTone(status.uxEventKind),
    isDurable: Boolean(status.uxEventKind) && !isTransient,
    isTransient,
  }
}

export function toolOutputToViewModel(
  tool: Partial<Pick<TimelineToolCall, 'output' | 'resultPreview' | 'isError' | 'failureClass'>>,
): ToolOutputViewModel {
  const output = tool.output || tool.resultPreview || ''
  return {
    hasOutput: output.length > 0,
    preview: output.length > 180 ? `${output.slice(0, 180)}...` : output,
    output,
    tone: tool.isError ? 'danger' : 'neutral',
    failureLabel: tool.failureClass,
  }
}

export function streamEventToUxViewModel(event: StreamEvent): StreamUxViewModel {
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
    }
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
    }
  }
  if (event.type === 'status') {
    return {
      kind: 'status',
      status: statusToViewModel({
        message: event.message,
        uxEventKind: event.ux_event_kind,
        tool: event.tool,
      }),
    }
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
    }
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
    }
  }
  return { kind: 'ignore' }
}
