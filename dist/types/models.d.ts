export type ModelProvider = 'openai' | 'anthropic' | 'swisscom' | 'local' | 'other';
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export interface ModelMetadata {
    id: string;
    label: string;
    provider: ModelProvider;
    contextWindow?: number;
    supportsTools?: boolean;
    supportsStreaming?: boolean;
    supportsReasoningEffort?: boolean;
    defaultReasoningEffort?: ReasoningEffort;
    inputCostPer1MTokens?: number;
    outputCostPer1MTokens?: number;
}
export interface ModelSelection {
    model: string;
    reasoningEffort?: ReasoningEffort;
    maxTokens?: number;
}
export interface ModelListEnvelope {
    items: ModelMetadata[];
    defaultModel?: string;
}
