export interface Meeting {
  id: string
  title: string
  date: string           // YYYY-MM-DD
  time?: string         // HH:mm
  duration?: number     // minutos
  projectId?: string
  description?: string
  attendees?: string[]
  createdAt: string
}
