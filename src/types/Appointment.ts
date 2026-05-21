export interface Appointment {
  id: string
  title: string
  description?: string
  startDate: string
  startTime: string
  duration: number
  attendees?: string[]
  projectId?: string
  color?: string
  createdAt: string
  updatedAt: string
}
