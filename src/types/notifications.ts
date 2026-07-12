export interface Notification {
  id: number
  task_id: string
  type: string
  message: string
  created_at: string
  acknowledged_at: string | null
}
