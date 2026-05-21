import type { KanbanColumn } from '@/types/Kanban'

const DONE_STATUSES = new Set(['done', 'completed'])

export function isCompletedStatusWithColumns(status: string, columns: KanbanColumn[]): boolean {
  const normalizedStatus = status.trim().toLowerCase()
  if (DONE_STATUSES.has(normalizedStatus)) {
    return true
  }

  const column = columns.find(item => item.status === status)
  if (!column) {
    return false
  }

  const normalizedTitle = column.title.trim().toLowerCase()
  return normalizedTitle.includes('conclu') || normalizedTitle.includes('done')
}
