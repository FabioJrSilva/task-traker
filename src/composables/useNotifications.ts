import { computed, ref } from 'vue'
import type { ComputedRef } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import type { KanbanColumn } from '@/types/Kanban'
import type { Project } from '@/types/Project'
import type { Task } from '@/types/Task'
import type { TimeEntry } from '@/types/TimeEntry'
import { isCompletedStatusWithColumns } from '@/utils/taskStatus'

const DUE_SOON_WINDOW_MS = 15 * 60 * 1000
const MAX_NOTIFICATIONS = 20

export type NotificationType = 'due-soon' | 'overdue' | 'over-time'

export interface AppNotification {
  id: string
  type: NotificationType
  taskId: string
  taskTitle: string
  projectName: string
  createdAt: Date
  read: boolean
}

export function buildTriggeredKeys(
  tasks: Task[],
  columns: KanbanColumn[],
  timeEntries: TimeEntry[],
  now: Date = new Date(),
): string[] {
  const keys: string[] = []

  for (const task of tasks) {
    if (task.deletedAt) {
      continue
    }

    const isCompleted = isCompletedStatusWithColumns(task.status, columns)

    if (task.dueAt && !isCompleted) {
      const dueMs = new Date(task.dueAt).getTime()
      const nowMs = now.getTime()

      if (dueMs > nowMs && dueMs - nowMs <= DUE_SOON_WINDOW_MS) {
        keys.push(`${task.id}-due-soon`)
      }

      if (dueMs <= nowMs) {
        keys.push(`${task.id}-overdue`)
      }
    }

    const estimateMinutes = task.developerMetadata?.estimateMinutes
    if (estimateMinutes && estimateMinutes > 0) {
      let totalMinutes = 0

      for (const entry of timeEntries) {
        if (entry.taskId !== task.id) {
          continue
        }

        if (entry.endedAt && typeof entry.durationMinutes === 'number') {
          totalMinutes += entry.durationMinutes
        } else if (!entry.endedAt) {
          totalMinutes += Math.floor(
            (now.getTime() - new Date(entry.startedAt).getTime()) / 60000,
          )
        }
      }

      if (totalMinutes >= estimateMinutes) {
        keys.push(`${task.id}-over-time`)
      }
    }
  }

  return keys
}

const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  'due-soon': 'Prazo em 15 minutos',
  overdue: 'Tarefa atrasada',
  'over-time': 'Tempo estimado excedido',
}

const notificationSuffixes: NotificationType[] = ['due-soon', 'overdue', 'over-time']

const notifications = ref<AppNotification[]>([])
const firedKeys = new Set<string>()

const unreadCount: ComputedRef<number> = computed(() =>
  notifications.value.filter(notification => !notification.read).length,
)

function resolveProjectName(task: Task, projects: Project[]): string {
  if (task.projectId) {
    const project = projects.find(item => item.id === task.projectId)
    if (project) {
      return project.name
    }
  }

  const fallbackProject = task.project.trim()
  return fallbackProject || 'Sem projeto'
}

function parseTriggeredKey(key: string): { taskId: string; type: NotificationType } | null {
  for (const type of notificationSuffixes) {
    const suffix = `-${type}`
    if (key.endsWith(suffix)) {
      return {
        taskId: key.slice(0, -suffix.length),
        type,
      }
    }
  }

  return null
}

function fireNotification(type: NotificationType, task: Task, projectName: string): void {
  notifications.value.unshift({
    id: uuidv4(),
    type,
    taskId: task.id,
    taskTitle: task.title,
    projectName,
    createdAt: new Date(),
    read: false,
  })

  if (notifications.value.length > MAX_NOTIFICATIONS) {
    notifications.value = notifications.value.slice(0, MAX_NOTIFICATIONS)
  }

  if (
    typeof window !== 'undefined'
    && 'Notification' in window
    && window.Notification.permission === 'granted'
  ) {
    const body = `${task.title} · ${projectName}`
    new window.Notification(NOTIFICATION_LABELS[type], { body })
  }
}

function checkNotifications(
  tasks: Task[],
  columns: KanbanColumn[],
  timeEntries: TimeEntry[],
  projects: Project[],
  now: Date = new Date(),
): void {
  const triggeredKeys = buildTriggeredKeys(tasks, columns, timeEntries, now)

  for (const key of triggeredKeys) {
    if (firedKeys.has(key)) {
      continue
    }

    const parsedKey = parseTriggeredKey(key)
    if (!parsedKey) {
      continue
    }

    const task = tasks.find(item => item.id === parsedKey.taskId)
    if (!task) {
      continue
    }

    firedKeys.add(key)
    fireNotification(parsedKey.type, task, resolveProjectName(task, projects))
  }
}

function markAllRead(): void {
  notifications.value = notifications.value.map(notification => ({
    ...notification,
    read: true,
  }))
}

export function useNotifications(): {
  notifications: typeof notifications
  unreadCount: typeof unreadCount
  checkNotifications: typeof checkNotifications
  markAllRead: typeof markAllRead
} {
  return {
    notifications,
    unreadCount,
    checkNotifications,
    markAllRead,
  }
}
