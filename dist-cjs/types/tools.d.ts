export type ToolRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export interface ToolMetadata {
    name: string;
    displayName?: string;
    description: string;
    agent?: string;
    riskLevel?: ToolRiskLevel;
    requiresApproval?: boolean;
    inputSchema?: Record<string, unknown>;
}
export interface ToolCallSummary {
    id: string;
    tool: string;
    args?: unknown;
    resultPreview?: string;
    resultLen?: number;
    status: 'pending' | 'running' | 'ok' | 'error';
    iteration?: number;
    durationMs?: number;
}
export interface ToolListEnvelope {
    items: ToolMetadata[];
}
