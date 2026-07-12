export interface WorkspaceContext {
  id: string
  name: string
  currentUser: string
  activeMode: 'mock' | 'http'
  pendingApprovals: number
  onlineFleetCount: number
}
