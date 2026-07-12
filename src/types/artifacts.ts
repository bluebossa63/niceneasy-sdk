export type ArtifactState = 'draft' | 'review' | 'approved'

export interface ArtifactSummary {
  id: string
  title: string
  kind: 'brief' | 'memo' | 'deck' | 'faq' | 'plan'
  state: ArtifactState
  owner: string
  updatedAt: string
  summary: string
}
