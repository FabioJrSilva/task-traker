export type TimeEntrySource = 'manual' | 'timer' | 'migration'

export interface TimeEntry {
  id: string
  taskId: string
  projectId?: string
  startedAt: string
  endedAt?: string | null
  durationMinutes?: number
  note?: string
  source: TimeEntrySource
  createdAt: string
  updatedAt: string
}
