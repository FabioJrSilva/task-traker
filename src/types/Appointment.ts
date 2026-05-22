export interface Appointment {
  id: string
  taskId?: string          // preenchido quando vinculado a uma task
  title: string
  description?: string
  startDate: string
  startTime: string
  duration: number
  attendees?: string[]
  projectId?: string
  color?: string
  deletedAt?: string | null // soft delete
  createdAt: string
  updatedAt: string
}
