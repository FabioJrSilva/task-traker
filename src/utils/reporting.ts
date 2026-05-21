import type { Appointment } from '@/types/Appointment'
import type { KanbanColumn } from '@/types/Kanban'
import type { Meeting } from '@/types/Meeting'
import type { Project } from '@/types/Project'
import type { Task } from '@/types/Task'
import type { TimeEntry } from '@/types/TimeEntry'
import { getTaskEffectiveDueDate, parseDatePreservingLocal } from '@/utils/dueDate'
import { isCompletedStatusWithColumns } from '@/utils/taskStatus'

export type DashboardPeriod = 'today' | 'week' | 'month'

export interface LocalPeriodRange {
  start: Date
  end: Date
  key: string
}

export interface DashboardCards {
  tasksInPeriod: number
  completedInPeriod: number
  overdueActive: number
  timeMinutes: number
  agendaItems: number
  recurringGeneratedInPeriod: number
}

export interface DashboardTaskItem {
  id: string
  title: string
  status: string
  date: string
  dueAt: string | null
  projectName: string
  timeMinutes: number
  isOverdue: boolean
  completedWithDelay: boolean
}

export interface DashboardProjectTimeItem {
  projectKey: string
  projectName: string
  totalMinutes: number
}

export interface DashboardModel {
  period: DashboardPeriod
  range: LocalPeriodRange
  cards: DashboardCards
  prioritizedTasks: DashboardTaskItem[]
  completedWithDelayTasks: DashboardTaskItem[]
  projectTime: DashboardProjectTimeItem[]
  meetings: Meeting[]
  appointments: Appointment[]
}

export interface MonthlyProjectTaskRow {
  taskId: string
  title: string
  status: string
  timeMinutes: number
  isCompleted: boolean
  completedWithDelay: boolean
  isOverdueActive: boolean
}

export interface MonthlyProjectRow {
  projectKey: string
  projectName: string
  client: string
  totalMinutes: number
  tasksWithTime: number
  completedInMonth: number
  completedWithDelay: number
  overdueActive: number
  tasks: MonthlyProjectTaskRow[]
}

export interface MonthlyProjectReport {
  monthKey: string
  range: LocalPeriodRange
  projects: MonthlyProjectRow[]
  summary: {
    totalMinutes: number
    totalProjects: number
    totalTasksWithTime: number
  }
}

interface BuildDashboardParams {
  period: DashboardPeriod
  referenceDate: Date
  columns: KanbanColumn[]
  projects: Project[]
  tasks: Task[]
  meetings: Meeting[]
  appointments: Appointment[]
  timeEntries: TimeEntry[]
}

interface BuildMonthlyParams {
  referenceDate: Date
  columns: KanbanColumn[]
  projects: Project[]
  tasks: Task[]
  timeEntries: TimeEntry[]
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0)
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999)
}

function monthKeyFromDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseMonthKey(monthKey: string): Date | null {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return null
  }
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return null
  }
  return new Date(year, month - 1, 1, 12, 0, 0, 0)
}

function parseReferenceDate(value: string): Date | null {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return parseMonthKey(value)
  }
  return parseDatePreservingLocal(value)
}

function inRange(date: Date | null, range: LocalPeriodRange): boolean {
  if (!date) {
    return false
  }
  const time = date.getTime()
  return time >= range.start.getTime() && time <= range.end.getTime()
}

function escapeCSVField(value: string): string {
  const raw = String(value ?? '')
  const dangerousPrefixes = /^[=+\-@\t\r]/
  const prefix = dangerousPrefixes.test(raw) ? "'" : ''
  const safe = prefix + raw
  const needsQuotes = safe.includes(',') || safe.includes('"') || safe.includes('\n') || safe.includes('\r')
  const escaped = safe.replace(/"/g, '""')
  return needsQuotes ? `"${escaped}"` : escaped
}

function parseEntryStartedAtLocal(entry: TimeEntry): Date | null {
  return parseDatePreservingLocal(entry.startedAt)
}

function isFinalizedEntry(entry: TimeEntry): boolean {
  return entry.endedAt !== null
    && entry.endedAt !== undefined
    && typeof entry.durationMinutes === 'number'
    && entry.durationMinutes > 0
}

function resolveProjectInfo(entry: TimeEntry, projectsById: Map<string, Project>): { key: string; name: string; client: string } {
  if (entry.projectId) {
    const project = projectsById.get(entry.projectId)
    if (project) {
      return {
        key: project.id,
        name: project.name,
        client: project.client || ''
      }
    }

    return {
      key: `removed:${entry.projectId}`,
      name: 'Projeto removido',
      client: ''
    }
  }

  return {
    key: 'no-project',
    name: 'Sem projeto',
    client: ''
  }
}

function isTaskOverdue(task: Task, columns: KanbanColumn[], referenceDate: Date): boolean {
  if (isCompletedStatusWithColumns(task.status, columns)) {
    return false
  }

  const dueDate = getTaskEffectiveDueDate(task)
  if (!dueDate) {
    return false
  }

  return dueDate.getTime() < referenceDate.getTime()
}

function buildTaskTimeMap(
  entries: TimeEntry[],
  range: LocalPeriodRange,
  tasksById: Map<string, Task>
): Map<string, number> {
  const map = new Map<string, number>()

  for (const entry of entries) {
    if (!isFinalizedEntry(entry)) {
      continue
    }

    const startedAt = parseEntryStartedAtLocal(entry)
    if (!inRange(startedAt, range)) {
      continue
    }

    const task = tasksById.get(entry.taskId)
    if (task && task.deletedAt) {
      continue
    }

    map.set(entry.taskId, (map.get(entry.taskId) || 0) + (entry.durationMinutes || 0))
  }

  return map
}

export function getLocalPeriodRange(referenceDate: Date, period: DashboardPeriod): LocalPeriodRange {
  const ref = new Date(referenceDate)
  const refStart = startOfDay(ref)

  if (period === 'today') {
    return {
      start: refStart,
      end: endOfDay(refStart),
      key: localDateKey(refStart)
    }
  }

  if (period === 'week') {
    const dayIndexFromMonday = (refStart.getDay() + 6) % 7
    const weekStart = new Date(refStart)
    weekStart.setDate(refStart.getDate() - dayIndexFromMonday)
    const weekEnd = endOfDay(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6))

    return {
      start: startOfDay(weekStart),
      end: weekEnd,
      key: `${localDateKey(weekStart)}..${localDateKey(weekEnd)}`
    }
  }

  const monthStart = new Date(refStart.getFullYear(), refStart.getMonth(), 1, 0, 0, 0, 0)
  const monthEnd = endOfDay(new Date(refStart.getFullYear(), refStart.getMonth() + 1, 0))
  return {
    start: monthStart,
    end: monthEnd,
    key: monthKeyFromDate(refStart)
  }
}

export function getReferenceDateFromInput(value: string, fallback: Date = new Date()): Date {
  return parseReferenceDate(value) || fallback
}

export function buildMonthlyProjectReport(params: BuildMonthlyParams): MonthlyProjectReport {
  const range = getLocalPeriodRange(params.referenceDate, 'month')
  const monthKey = monthKeyFromDate(params.referenceDate)
  const projectsById = new Map(params.projects.map(project => [project.id, project]))
  const tasksById = new Map(params.tasks.map(task => [task.id, task]))
  const groups = new Map<string, MonthlyProjectRow>()
  const uniqueTaskByGroup = new Map<string, Set<string>>()

  for (const entry of params.timeEntries) {
    if (!isFinalizedEntry(entry)) {
      continue
    }

    const startedAt = parseEntryStartedAtLocal(entry)
    if (!inRange(startedAt, range)) {
      continue
    }

    const task = tasksById.get(entry.taskId)
    if (task && task.deletedAt) {
      continue
    }

    const projectInfo = resolveProjectInfo(entry, projectsById)
    const existing = groups.get(projectInfo.key)
    const row: MonthlyProjectRow = existing || {
      projectKey: projectInfo.key,
      projectName: projectInfo.name,
      client: projectInfo.client,
      totalMinutes: 0,
      tasksWithTime: 0,
      completedInMonth: 0,
      completedWithDelay: 0,
      overdueActive: 0,
      tasks: []
    }

    row.totalMinutes += entry.durationMinutes || 0

    const taskKey = task?.id || `removed:${entry.taskId}`
    const taskRow = row.tasks.find(item => item.taskId === taskKey)
    if (taskRow) {
      taskRow.timeMinutes += entry.durationMinutes || 0
    } else {
      const completedAt = task ? parseDatePreservingLocal(task.completedAt || '') : null
      const isCompleted = task ? isCompletedStatusWithColumns(task.status, params.columns) : false
      const isOverdueActive = task ? isTaskOverdue(task, params.columns, range.end) : false
      row.tasks.push({
        taskId: taskKey,
        title: task?.title || 'Tarefa removida',
        status: task?.status || 'removed',
        timeMinutes: entry.durationMinutes || 0,
        isCompleted,
        completedWithDelay: Boolean(task?.completedWithDelay),
        isOverdueActive
      })

      const uniqueTasks = uniqueTaskByGroup.get(projectInfo.key) || new Set<string>()
      if (!uniqueTasks.has(taskKey)) {
        uniqueTasks.add(taskKey)
        row.tasksWithTime += 1

        if (task && inRange(completedAt, range) && isCompleted) {
          row.completedInMonth += 1
          if (task.completedWithDelay) {
            row.completedWithDelay += 1
          }
        }

        if (task && isOverdueActive) {
          row.overdueActive += 1
        }
      }
      uniqueTaskByGroup.set(projectInfo.key, uniqueTasks)
    }

    groups.set(projectInfo.key, row)
  }

  const rows = Array.from(groups.values())
    .map(row => ({
      ...row,
      tasks: [...row.tasks].sort((a, b) => b.timeMinutes - a.timeMinutes)
    }))
    .sort((a, b) => {
      if (b.totalMinutes !== a.totalMinutes) {
        return b.totalMinutes - a.totalMinutes
      }
      return a.projectName.localeCompare(b.projectName)
    })

  const summary = {
    totalMinutes: rows.reduce((sum, row) => sum + row.totalMinutes, 0),
    totalProjects: rows.length,
    totalTasksWithTime: rows.reduce((sum, row) => sum + row.tasksWithTime, 0)
  }

  return {
    monthKey,
    range,
    projects: rows,
    summary
  }
}

export function buildMonthlyProjectReportCSV(report: MonthlyProjectReport): string {
  const headers = [
    'mês',
    'projeto',
    'cliente',
    'total de horas',
    'tarefas com tempo',
    'tarefas concluídas',
    'concluídas com atraso',
    'atrasadas ativas'
  ]

  const rows = report.projects.map(row => [
    escapeCSVField(report.monthKey),
    escapeCSVField(row.projectName),
    escapeCSVField(row.client || ''),
    escapeCSVField((row.totalMinutes / 60).toFixed(2)),
    escapeCSVField(String(row.tasksWithTime)),
    escapeCSVField(String(row.completedInMonth)),
    escapeCSVField(String(row.completedWithDelay)),
    escapeCSVField(String(row.overdueActive))
  ])

  return [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
}

export function buildDashboardModel(params: BuildDashboardParams): DashboardModel {
  const range = getLocalPeriodRange(params.referenceDate, params.period)
  const activeTasks = params.tasks.filter(task => !task.deletedAt)
  const tasksById = new Map(activeTasks.map(task => [task.id, task]))
  const taskTimeMap = buildTaskTimeMap(params.timeEntries, range, tasksById)
  const projectsById = new Map(params.projects.map(project => [project.id, project]))

  const tasksInPeriod = activeTasks.filter(task => {
    const taskDate = parseDatePreservingLocal(task.date)
    return inRange(taskDate, range)
  })

  const completedInPeriod = activeTasks.filter(task => {
    if (!isCompletedStatusWithColumns(task.status, params.columns)) {
      return false
    }
    return inRange(parseDatePreservingLocal(task.completedAt || ''), range)
  })

  const overdueActive = activeTasks.filter(task => isTaskOverdue(task, params.columns, range.end))

  const projectMinutes = new Map<string, number>()
  let totalTimeMinutes = 0
  for (const entry of params.timeEntries) {
    if (!isFinalizedEntry(entry)) {
      continue
    }

    const startedAt = parseEntryStartedAtLocal(entry)
    if (!inRange(startedAt, range)) {
      continue
    }

    const task = tasksById.get(entry.taskId)
    if (task && task.deletedAt) {
      continue
    }

    const projectInfo = resolveProjectInfo(entry, projectsById)
    const minutes = entry.durationMinutes || 0
    totalTimeMinutes += minutes
    projectMinutes.set(projectInfo.name, (projectMinutes.get(projectInfo.name) || 0) + minutes)
  }

  const meetings = params.meetings.filter(meeting => inRange(parseDatePreservingLocal(meeting.date), range))
  const appointments = params.appointments.filter(appointment => inRange(parseDatePreservingLocal(appointment.startDate), range))

  const prioritizedTasks: DashboardTaskItem[] = [...tasksInPeriod]
    .sort((a, b) => {
      const aOverdue = isTaskOverdue(a, params.columns, range.end)
      const bOverdue = isTaskOverdue(b, params.columns, range.end)
      if (aOverdue !== bOverdue) {
        return aOverdue ? -1 : 1
      }

      const aDue = getTaskEffectiveDueDate(a)?.getTime() || Number.MAX_SAFE_INTEGER
      const bDue = getTaskEffectiveDueDate(b)?.getTime() || Number.MAX_SAFE_INTEGER
      if (aDue !== bDue) {
        return aDue - bDue
      }

      return a.title.localeCompare(b.title)
    })
    .map(task => {
      const project = task.projectId ? projectsById.get(task.projectId) : null
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        date: task.date,
        dueAt: task.dueAt || null,
        projectName: project?.name || 'Sem projeto',
        timeMinutes: taskTimeMap.get(task.id) || 0,
        isOverdue: isTaskOverdue(task, params.columns, range.end),
        completedWithDelay: Boolean(task.completedWithDelay)
      }
    })

  const completedWithDelayTasks = completedInPeriod
    .filter(task => Boolean(task.completedWithDelay))
    .map(task => {
      const project = task.projectId ? projectsById.get(task.projectId) : null
      return {
        id: task.id,
        title: task.title,
        status: task.status,
        date: task.date,
        dueAt: task.dueAt || null,
        projectName: project?.name || 'Sem projeto',
        timeMinutes: taskTimeMap.get(task.id) || 0,
        isOverdue: false,
        completedWithDelay: true
      }
    })

  const recurringGeneratedInPeriod = activeTasks.filter(task => inRange(parseDatePreservingLocal(task.recurrenceState?.generatedAt || ''), range)).length

  const projectTime = Array.from(projectMinutes.entries())
    .map(([projectName, totalMinutes]) => ({
      projectKey: projectName,
      projectName,
      totalMinutes
    }))
    .sort((a, b) => b.totalMinutes - a.totalMinutes)

  return {
    period: params.period,
    range,
    cards: {
      tasksInPeriod: tasksInPeriod.length,
      completedInPeriod: completedInPeriod.length,
      overdueActive: overdueActive.length,
      timeMinutes: totalTimeMinutes,
      agendaItems: meetings.length + appointments.length,
      recurringGeneratedInPeriod
    },
    prioritizedTasks,
    completedWithDelayTasks,
    projectTime,
    meetings,
    appointments
  }
}
