import type { KanbanColumn } from '../types/Kanban'
import type { Appointment } from '../types/Appointment'
import type { Meeting } from '../types/Meeting'
import type { Project } from '../types/Project'
import type {
  BusinessDayAdjustment,
  DeveloperMetadata,
  DeveloperReviewStatus,
  MonthlyRecurrenceMode,
  RecurrenceConfig,
  RecurrenceType,
  Task,
  TaskType
} from '../types/Task'
import type { TimeEntry } from '../types/TimeEntry'
import { computeCompletedWithDelay, normalizeDueFields } from '../utils/dueDate'
import { isCompletedStatusWithColumns } from '../utils/taskStatus'
import { devLog } from '../utils/devLog'

export const CURRENT_SCHEMA_VERSION = 6

export interface WorkSettings {
  workStartTime: string
  workEndTime: string
  workDays: number[]
}

export type HistoryType = 'move' | 'update' | 'delete' | 'restore'
export type HistoryEntity = 'task' | 'column' | 'project' | 'meeting' | 'appointment'

export interface HistoryEntry {
  id: string
  type: HistoryType
  entity: HistoryEntity
  entityId: string
  previousState: unknown
  description: string
  timestamp: string
}

export interface MigrationLog {
  tasksEvaluated: number
  entriesCreated: number
  invalidEntriesDiscarded: number
  openTimersDiscarded: number
}

export interface AppData {
  schemaVersion: number
  columns: KanbanColumn[]
  tasks: Task[]
  projects: Project[]
  meetings: Meeting[]
  appointments: Appointment[]
  taskOrder: Record<string, string[]>
  workSettings: WorkSettings
  actionHistory?: HistoryEntry[]
  labelFilter?: string | null
  timeEntries?: TimeEntry[]
}

export interface ColumnDraft {
  title: string
  status: string
  color: string
}

export const DEFAULT_COLUMNS: KanbanColumn[] = [
  { id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' },
  { id: 'col-2', title: 'Aguardando', status: 'waiting', order: 1, color: '#c990c0' },
  { id: 'col-3', title: 'Em Andamento', status: 'in_progress', order: 2, color: '#dcdcaa' },
  { id: 'col-4', title: 'Concluído', status: 'done', order: 3, color: '#89d185' }
]

export const DEFAULT_WORK_SETTINGS: WorkSettings = {
  workStartTime: '08:00',
  workEndTime: '18:00',
  workDays: [1, 2, 3, 4, 5]
}

const VALID_RECURRENCE_TYPES: RecurrenceType[] = ['daily', 'weekly', 'monthly']
const VALID_MONTHLY_MODES: MonthlyRecurrenceMode[] = [
  'first_day',
  'fixed_day',
  'last_day',
  'last_workday',
  'nth_weekday'
]
const VALID_BUSINESS_DAY_ADJUSTMENTS: BusinessDayAdjustment[] = [
  'none',
  'previous_workday',
  'next_workday'
]
const VALID_REVIEW_STATUS: DeveloperReviewStatus[] = [
  'not_required',
  'pending',
  'in_review',
  'changes_requested',
  'approved'
]

/**
 * Deep clone que preserva undefined, Date e outros tipos structuredClone-safe.
 *
 * Prefere structuredClone (disponível em browsers modernos, Node 17+, Electron/Chromium).
 * Fallback: JSON.parse(JSON.stringify(...)) — perde undefined, Date, Map, Set etc.
 *   Em runtimes sem structuredClone, campos com valor undefined são removidos do clone.
 */
export function deepClone<T>(value: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(value)
    } catch {
      // structuredClone lança DataCloneError para tipos não clonáveis
      // (funções, símbolos, DOM nodes). Fallback silencioso para JSON.
    }
  }
  return JSON.parse(JSON.stringify(value))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeDateString(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }

  const date = new Date(value)
  if (isNaN(date.getTime())) {
    return null
  }

  return date.toISOString()
}

function normalizeRecurrenceType(value: unknown): RecurrenceType | null {
  if (typeof value !== 'string') {
    return null
  }

  return VALID_RECURRENCE_TYPES.includes(value as RecurrenceType)
    ? (value as RecurrenceType)
    : null
}

interface NormalizedRecurrenceConfigResult {
  value?: RecurrenceConfig
  invalidFields: string[]
}

function normalizeIntegerInRange(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    return undefined
  }
  if (value < min || value > max) {
    return undefined
  }
  return value
}

function getMonthKeyFromDateValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed.slice(0, 7)
  }

  const parsed = new Date(trimmed)
  if (isNaN(parsed.getTime())) {
    return undefined
  }
  const year = parsed.getUTCFullYear()
  const month = String(parsed.getUTCMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function normalizeRecurrenceConfig(rawRecurrence: unknown): NormalizedRecurrenceConfigResult {
  if (!isObject(rawRecurrence)) {
    return { value: undefined, invalidFields: [] }
  }

  const recurrenceType = normalizeRecurrenceType(rawRecurrence.type)
  if (!recurrenceType) {
    return { value: undefined, invalidFields: ['type'] }
  }

  const recurrence = rawRecurrence as Record<string, unknown>
  const invalidFields: string[] = []
  const normalized: RecurrenceConfig = { type: recurrenceType }

  if (recurrenceType !== 'monthly') {
    if (typeof recurrence.copyChecklist === 'boolean') {
      normalized.copyChecklist = recurrence.copyChecklist
    } else if (recurrence.copyChecklist !== undefined && recurrence.copyChecklist !== null) {
      invalidFields.push('copyChecklist')
    }
    return { value: normalized, invalidFields }
  }

  if (typeof recurrence.copyChecklist === 'boolean') {
    normalized.copyChecklist = recurrence.copyChecklist
  } else if (recurrence.copyChecklist !== undefined && recurrence.copyChecklist !== null) {
    invalidFields.push('copyChecklist')
  }

  const monthlyModeRaw = recurrence.monthlyMode
  if (typeof monthlyModeRaw === 'string' && VALID_MONTHLY_MODES.includes(monthlyModeRaw as MonthlyRecurrenceMode)) {
    normalized.monthlyMode = monthlyModeRaw as MonthlyRecurrenceMode
  } else if (monthlyModeRaw === undefined || monthlyModeRaw === null || monthlyModeRaw === '') {
    normalized.monthlyMode = 'first_day'
  } else {
    invalidFields.push('monthlyMode')
    normalized.monthlyMode = 'first_day'
  }

  if (normalized.monthlyMode === 'fixed_day') {
    const dayOfMonth = normalizeIntegerInRange(recurrence.dayOfMonth, 1, 31)
    if (dayOfMonth === undefined) {
      invalidFields.push('dayOfMonth')
      normalized.dayOfMonth = 1
    } else {
      normalized.dayOfMonth = dayOfMonth
    }
  } else if (recurrence.dayOfMonth !== undefined && recurrence.dayOfMonth !== null) {
    const dayOfMonth = normalizeIntegerInRange(recurrence.dayOfMonth, 1, 31)
    if (dayOfMonth !== undefined) {
      normalized.dayOfMonth = dayOfMonth
    } else {
      invalidFields.push('dayOfMonth')
    }
  }

  if (normalized.monthlyMode === 'nth_weekday') {
    const weekOfMonth = normalizeIntegerInRange(recurrence.weekOfMonth, 1, 5)
    if (weekOfMonth !== undefined) {
      normalized.weekOfMonth = weekOfMonth
    } else {
      invalidFields.push('weekOfMonth')
    }

    const dayOfWeek = normalizeIntegerInRange(recurrence.dayOfWeek, 0, 6)
    if (dayOfWeek !== undefined) {
      normalized.dayOfWeek = dayOfWeek
    } else {
      invalidFields.push('dayOfWeek')
    }
  } else {
    const weekOfMonth = normalizeIntegerInRange(recurrence.weekOfMonth, 1, 5)
    if (weekOfMonth !== undefined) {
      normalized.weekOfMonth = weekOfMonth
    }

    const dayOfWeek = normalizeIntegerInRange(recurrence.dayOfWeek, 0, 6)
    if (dayOfWeek !== undefined) {
      normalized.dayOfWeek = dayOfWeek
    }
  }

  if (
    typeof recurrence.businessDayAdjustment === 'string'
    && VALID_BUSINESS_DAY_ADJUSTMENTS.includes(recurrence.businessDayAdjustment as BusinessDayAdjustment)
  ) {
    normalized.businessDayAdjustment = recurrence.businessDayAdjustment as BusinessDayAdjustment
  } else if (recurrence.businessDayAdjustment !== undefined && recurrence.businessDayAdjustment !== null) {
    invalidFields.push('businessDayAdjustment')
  }

  return { value: normalized, invalidFields }
}

interface NormalizedDeveloperMetadataResult {
  value?: DeveloperMetadata
  invalidFields: string[]
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized ? normalized : undefined
}

export function normalizeDeveloperMetadata(rawMetadata: unknown): NormalizedDeveloperMetadataResult {
  if (!isObject(rawMetadata)) {
    return { value: undefined, invalidFields: [] }
  }

  const invalidFields: string[] = []
  const normalized: DeveloperMetadata = {}
  const metadata = rawMetadata as Record<string, unknown>

  const repositoryUrl = normalizeOptionalString(metadata.repositoryUrl)
  if (repositoryUrl !== undefined) {
    normalized.repositoryUrl = repositoryUrl
  } else if (metadata.repositoryUrl !== undefined && metadata.repositoryUrl !== null) {
    invalidFields.push('repositoryUrl')
  }

  const branchName = normalizeOptionalString(metadata.branchName)
  if (branchName !== undefined) {
    normalized.branchName = branchName
  } else if (metadata.branchName !== undefined && metadata.branchName !== null) {
    invalidFields.push('branchName')
  }

  const pullRequestUrl = normalizeOptionalString(metadata.pullRequestUrl)
  if (pullRequestUrl !== undefined) {
    normalized.pullRequestUrl = pullRequestUrl
  } else if (metadata.pullRequestUrl !== undefined && metadata.pullRequestUrl !== null) {
    invalidFields.push('pullRequestUrl')
  }

  const issueUrl = normalizeOptionalString(metadata.issueUrl)
  if (issueUrl !== undefined) {
    normalized.issueUrl = issueUrl
  } else if (metadata.issueUrl !== undefined && metadata.issueUrl !== null) {
    invalidFields.push('issueUrl')
  }

  const environment = normalizeOptionalString(metadata.environment)
  if (environment !== undefined) {
    normalized.environment = environment
  } else if (metadata.environment !== undefined && metadata.environment !== null) {
    invalidFields.push('environment')
  }

  if (metadata.reviewStatus !== undefined && metadata.reviewStatus !== null) {
    if (
      typeof metadata.reviewStatus === 'string'
      && VALID_REVIEW_STATUS.includes(metadata.reviewStatus as DeveloperReviewStatus)
    ) {
      normalized.reviewStatus = metadata.reviewStatus as DeveloperReviewStatus
    } else {
      invalidFields.push('reviewStatus')
      normalized.reviewStatus = 'not_required'
    }
  }

  const blockedReason = normalizeOptionalString(metadata.blockedReason)
  if (blockedReason !== undefined) {
    normalized.blockedReason = blockedReason
  } else if (metadata.blockedReason !== undefined && metadata.blockedReason !== null) {
    invalidFields.push('blockedReason')
  }

  if (metadata.estimateMinutes !== undefined && metadata.estimateMinutes !== null) {
    if (
      typeof metadata.estimateMinutes === 'number'
      && Number.isFinite(metadata.estimateMinutes)
      && metadata.estimateMinutes >= 0
    ) {
      normalized.estimateMinutes = Math.round(metadata.estimateMinutes)
    } else {
      invalidFields.push('estimateMinutes')
    }
  }

  return {
    value: Object.keys(normalized).length > 0 ? normalized : undefined,
    invalidFields
  }
}

const VALID_TIME_ENTRY_SOURCES: Array<'manual' | 'timer' | 'migration'> = ['manual', 'timer', 'migration']

function isValidTimeEntrySource(value: unknown): value is 'manual' | 'timer' | 'migration' {
  return typeof value === 'string' && VALID_TIME_ENTRY_SOURCES.includes(value as 'manual')
}

function normalizeTimeEntry(entry: unknown): TimeEntry | null {
  if (!isObject(entry)) {
    return null
  }

  const id = typeof entry.id === 'string' && entry.id.trim() ? entry.id.trim() : null
  const taskId = typeof entry.taskId === 'string' && entry.taskId.trim() ? entry.taskId.trim() : null
  const startedAt = normalizeDateString(entry.startedAt)
  const source = isValidTimeEntrySource(entry.source) ? entry.source : null

  if (!id || !taskId || !startedAt || !source) {
    return null
  }

  const endedAt = entry.endedAt === null || entry.endedAt === undefined
    ? null
    : normalizeDateString(entry.endedAt)

  // Open entry is only valid for active timer, and must not persist durationMinutes.
  if (endedAt === null && source !== 'timer') {
    return null
  }

  let durationMinutes: number | undefined
  if (endedAt !== null) {
    if (typeof entry.durationMinutes !== 'number' || entry.durationMinutes < 1) {
      return null
    }
    durationMinutes = Math.round(entry.durationMinutes)
  }

  if (endedAt === null) {
    durationMinutes = undefined
  }

  if (endedAt !== null && durationMinutes === undefined) {
    return null
  }

  const projectId = typeof entry.projectId === 'string' && entry.projectId.trim()
    ? entry.projectId.trim()
    : undefined

  const note = typeof entry.note === 'string' ? entry.note : undefined

  const createdAt = normalizeDateString(entry.createdAt) || startedAt
  const updatedAt = normalizeDateString(entry.updatedAt) || createdAt

  return {
    id,
    taskId,
    ...(projectId ? { projectId } : {}),
    startedAt,
    endedAt,
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(note ? { note } : {}),
    source,
    createdAt,
    updatedAt
  }
}

function normalizeTimeEntries(rawEntries: unknown): TimeEntry[] {
  if (!Array.isArray(rawEntries)) {
    return []
  }

  const normalized: TimeEntry[] = []
  let hasOpenTimer = false
  for (const entry of rawEntries) {
    const normalizedEntry = normalizeTimeEntry(entry)
    if (normalizedEntry) {
      const isOpenTimer = normalizedEntry.source === 'timer' && normalizedEntry.endedAt === null
      if (isOpenTimer) {
        if (hasOpenTimer) {
          continue
        }
        hasOpenTimer = true
      }
      normalized.push(normalizedEntry)
    }
  }
  return normalized
}

function migrateLegacyTimeSpent(tasks: Task[], existingEntries: TimeEntry[]): { entries: TimeEntry[]; log: MigrationLog } {
  const log: MigrationLog = {
    tasksEvaluated: 0,
    entriesCreated: 0,
    invalidEntriesDiscarded: 0,
    openTimersDiscarded: 0
  }

  const migratedIds = new Set(existingEntries.map(e => e.id))
  const result = [...existingEntries]

  for (const task of tasks) {
    log.tasksEvaluated++

    if (typeof task.timeSpent !== 'number' || task.timeSpent <= 0) {
      continue
    }

    const migrationId = `migration-${task.id}`
    if (migratedIds.has(migrationId)) {
      continue
    }

    const startedAt = normalizeDateString(task.completedAt)
      || normalizeDateString(task.updatedAt)
      || normalizeDateString(task.createdAt)
      || new Date().toISOString()

    const entry: TimeEntry = {
      id: migrationId,
      taskId: task.id,
      projectId: task.projectId,
      startedAt,
      endedAt: startedAt,
      durationMinutes: Math.round(task.timeSpent),
      source: 'migration',
      createdAt: startedAt,
      updatedAt: startedAt
    }

    result.push(entry)
    migratedIds.add(migrationId)
    log.entriesCreated++
  }

  return { entries: result, log }
}

function normalizeTask(task: Task, isCompletedStatus: (status: string) => boolean): Task {
  const recurrenceResult = normalizeRecurrenceConfig(task.recurrence)
  const normalizedRecurrence = recurrenceResult.value
  const hasValidRecurrence = normalizedRecurrence !== undefined
  const isRecurring = Boolean(task.isRecurring && hasValidRecurrence) || hasValidRecurrence
  const isCompleted = isCompletedStatus(task.status)

  const normalizedCompletedAt = normalizeDateString(task.completedAt)
  const completedAt = normalizedCompletedAt

  const normalizedDue = normalizeDueFields(task)
  const developerMetadataResult = normalizeDeveloperMetadata(task.developerMetadata)
  if (developerMetadataResult.invalidFields.length > 0) {
    console.warn('Metadados de desenvolvimento inválidos normalizados.', {
      taskId: task.id,
      fields: developerMetadataResult.invalidFields
    })
  }
  if (recurrenceResult.invalidFields.length > 0) {
    console.warn('Configuração de recorrência inválida normalizada.', {
      taskId: task.id,
      fields: recurrenceResult.invalidFields
    })
  }
  const completedWithDelay = isCompleted
    ? (typeof task.completedWithDelay === 'boolean'
        ? task.completedWithDelay
        : (completedAt ? computeCompletedWithDelay(normalizedDue, completedAt) : false))
    : null

  if (!isRecurring) {
    return {
      ...task,
      ...normalizedDue,
      developerMetadata: developerMetadataResult.value,
      isRecurring: false,
      recurrence: undefined,
      recurrenceState: undefined,
      completedAt,
      completedWithDelay
    }
  }

  const occurrenceNumber = Number(task.recurrenceState?.occurrenceNumber)
  const normalizedOccurrence = Number.isInteger(occurrenceNumber) && occurrenceNumber > 0
    ? occurrenceNumber
    : 1
  const normalizedGeneratedAt = normalizeDateString(task.recurrenceState?.generatedAt) || task.createdAt
  const normalizedPeriodKey = normalizedRecurrence?.type === 'monthly'
    ? (
        typeof task.recurrenceState?.periodKey === 'string'
          && /^\d{4}-\d{2}$/.test(task.recurrenceState.periodKey)
            ? task.recurrenceState.periodKey
            : (getMonthKeyFromDateValue(task.date) || getMonthKeyFromDateValue(normalizedGeneratedAt))
      )
    : undefined

  return {
    ...task,
    ...normalizedDue,
    developerMetadata: developerMetadataResult.value,
    isRecurring: true,
    recurrence: normalizedRecurrence,
    recurrenceState: {
      seriesId: task.recurrenceState?.seriesId || task.id,
      occurrenceNumber: normalizedOccurrence,
      periodKey: normalizedPeriodKey,
      sourceTaskId: task.recurrenceState?.sourceTaskId,
      generatedAt: normalizedGeneratedAt
    },
    completedAt,
    completedWithDelay
  }
}

export function createDefaultAppData(): AppData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    columns: deepClone(DEFAULT_COLUMNS),
    tasks: [],
    projects: [],
    meetings: [],
    appointments: [],
    taskOrder: {},
    workSettings: deepClone(DEFAULT_WORK_SETTINGS),
    actionHistory: [],
    labelFilter: null,
    timeEntries: []
  }
}

export function migrateAppData(rawData: unknown): AppData {
  if (!isObject(rawData)) {
    return createDefaultAppData()
  }

  const schemaVersion = typeof rawData.schemaVersion === 'number'
    ? rawData.schemaVersion
    : 1

  const fallback = createDefaultAppData()

  const normalizedBase: AppData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    columns: Array.isArray(rawData.columns) && rawData.columns.length > 0
      ? deepClone(rawData.columns as KanbanColumn[])
      : fallback.columns,
    tasks: Array.isArray(rawData.tasks)
      ? deepClone(rawData.tasks as Task[])
      : [],
    projects: Array.isArray(rawData.projects)
      ? deepClone(rawData.projects as Project[])
      : [],
    meetings: Array.isArray(rawData.meetings)
      ? deepClone(rawData.meetings as Meeting[])
      : [],
    appointments: Array.isArray(rawData.appointments)
      ? deepClone(rawData.appointments as Appointment[])
      : [],
    taskOrder: isObject(rawData.taskOrder)
      ? deepClone(rawData.taskOrder as Record<string, string[]>)
      : {},
    workSettings: isObject(rawData.workSettings)
      ? (() => {
          const rawWorkDays = Array.isArray(rawData.workSettings.workDays)
            ? (rawData.workSettings.workDays as unknown[])
            : []
          const normalizedWorkDays = [...new Set(
            rawWorkDays
              .filter((day): day is number => typeof day === 'number')
              .filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
          )]

          return {
            workStartTime: typeof rawData.workSettings.workStartTime === 'string'
              ? rawData.workSettings.workStartTime
              : DEFAULT_WORK_SETTINGS.workStartTime,
            workEndTime: typeof rawData.workSettings.workEndTime === 'string'
              ? rawData.workSettings.workEndTime
              : DEFAULT_WORK_SETTINGS.workEndTime,
            workDays: normalizedWorkDays.length > 0
              ? normalizedWorkDays
              : deepClone(DEFAULT_WORK_SETTINGS.workDays)
          }
        })()
      : deepClone(DEFAULT_WORK_SETTINGS),
    actionHistory: Array.isArray(rawData.actionHistory)
      ? deepClone(rawData.actionHistory as HistoryEntry[])
      : [],
    labelFilter: typeof rawData.labelFilter === 'string' || rawData.labelFilter === null
      ? rawData.labelFilter
      : null,
    timeEntries: Array.isArray((rawData as Record<string, unknown>).timeEntries)
      ? normalizeTimeEntries((rawData as Record<string, unknown>).timeEntries)
      : []
  }

  const isCompletedStatusForMigration = (status: string): boolean => {
    return isCompletedStatusWithColumns(status, normalizedBase.columns)
  }

  // Migration v5 → v6: add task type and appointment link fields
  if (schemaVersion < 6) {
    normalizedBase.tasks = normalizedBase.tasks.map(task => ({
      ...task,
      type: (task as unknown as Record<string, unknown>).type as TaskType | undefined || 'task',
      appointmentId: (task as unknown as Record<string, unknown>).appointmentId as string | undefined,
    }))

    normalizedBase.appointments = normalizedBase.appointments.map(appointment => ({
      ...appointment,
      taskId: (appointment as unknown as Record<string, unknown>).taskId as string | undefined,
      deletedAt: (appointment as unknown as Record<string, unknown>).deletedAt as string | null | undefined,
    }))

    normalizedBase.schemaVersion = CURRENT_SCHEMA_VERSION
  }

  if (schemaVersion <= 2) {
    normalizedBase.tasks = normalizedBase.tasks.map(task => normalizeTask(task, isCompletedStatusForMigration))
  } else {
    normalizedBase.tasks = normalizedBase.tasks.map(task => normalizeTask(task, isCompletedStatusForMigration))
  }

  // Keep migration idempotent even when loading partially migrated data.
  const { entries, log } = migrateLegacyTimeSpent(normalizedBase.tasks, normalizedBase.timeEntries || [])
  normalizedBase.timeEntries = entries
  if (schemaVersion < 5 || log.entriesCreated > 0 || log.invalidEntriesDiscarded > 0) {
    devLog(`Migração de tempo: ${log.tasksEvaluated} tarefas avaliadas, ${log.entriesCreated} entradas criadas, ${log.invalidEntriesDiscarded} inválidas descartadas`)
  }

  return normalizedBase
}

export function normalizeStatusId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s_-]/g, '')
    .replace(/\s+/g, '_')
}
