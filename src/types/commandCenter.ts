export interface MetricSummary {
  label: string
  value: string
  delta: string
}

export interface CommandCenterSummary {
  workspaceName: string
  heroTitle: string
  heroSubtitle: string
  metrics: MetricSummary[]
  urgentSignals: Array<{
    title: string
    detail: string
    tone: 'warm' | 'cool' | 'danger'
  }>
}
