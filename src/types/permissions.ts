import type { ToolRiskLevel } from './tools.js'

export type PermissionDecision = 'once' | 'always' | 'deny'
export type PermissionState = 'pending' | 'approved' | 'denied' | 'expired'

export interface PermissionRequest {
  id: string
  toolCallId?: string
  sessionId?: string
  runId?: string
  agent: string
  tool: string
  args?: unknown
  riskLevel?: ToolRiskLevel
  reason?: string
  requestedAt: string
  expiresAt?: string
  state: PermissionState
}

export interface PermissionResolution {
  id: string
  decision: PermissionDecision
  decidedBy?: string
  decidedAt?: string
  comment?: string
}

export interface PermissionListEnvelope {
  items: PermissionRequest[]
  total: number
}
