import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import type { Task, RecurrenceConfig, MonthlyRecurrenceMode } from '@/types/Task'
import type { KanbanColumn } from '@/types/Kanban'
import type { Project } from '@/types/Project'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'
import type { TimeEntry, TimeEntrySource } from '@/types/TimeEntry'
import { v4 as uuidv4 } from 'uuid'
import { getStorage } from '@/utils/storage'
import type { ColumnDraft, WorkSettings, HistoryEntry, HistoryType, HistoryEntity, AppData } from '@/shared/appData'
import {
  DEFAULT_WORK_SETTINGS,
  DEFAULT_COLUMNS,
  CURRENT_SCHEMA_VERSION,
  migrateAppData,
  normalizeDeveloperMetadata,
  deepClone
} from '@/shared/appData'
import {
  computeCompletedWithDelay,
  getTaskEffectiveDueDate,
  normalizeDueFields,
  parseDatePreservingLocal
} from '@/utils/dueDate'
import {
  buildMonthlyProjectReport,
  buildMonthlyProjectReportCSV,
  getReferenceDateFromInput
} from '@/utils/reporting'
import { isCompletedStatusWithColumns } from '@/utils/taskStatus'

const storage = getStorage()

export const useTaskStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const columns = ref<KanbanColumn[]>([])
  const projects = ref<Project[]>([])
  const meetings = ref<Meeting[]>([])
  const appointments = ref<Appointment[]>([])
  const taskOrder = ref<Record<string, string[]>>({})
  const searchQuery = ref('')
  const columnFilter = ref<string | null>(null)
  const labelFilter = ref<string | null>(null)
  const showOnlyOverdueTasks = ref(false)
  const workSettings = ref<WorkSettings>(DEFAULT_WORK_SETTINGS)
  const timeEntries = ref<TimeEntry[]>([])
  const loaded = ref(false)
  let saveQueue: Promise<void> = Promise.resolve()
  let isDirty = false
  let saveScheduled = false

  // ============ Undo System ============
  const MAX_HISTORY = 10
  const actionHistory = ref<HistoryEntry[]>([])
  let isUndoing = false

  function saveHistory(
    type: HistoryType,
    entity: HistoryEntity,
    entityId: string,
    previousState: unknown,
    description: string
  ) {
    if (isUndoing) {
      return
    }

    const entry: HistoryEntry = {
      id: uuidv4(),
      type,
      entity,
      entityId,
      previousState,
      description,
      timestamp: new Date().toISOString()
    }
    actionHistory.value.unshift(entry)
    if (actionHistory.value.length > MAX_HISTORY) {
      actionHistory.value.pop()
    }
  }

  async function undoLastAction(): Promise<boolean> {
    const last = actionHistory.value.shift()
    if (!last) return false

    isUndoing = true

    try {
      switch (last.entity) {
        case 'task':
          if (last.type === 'move') {
            const previousMoveState = last.previousState as { status: string; generatedTaskId?: string }
            if (previousMoveState.generatedTaskId) {
              removeTaskById(previousMoveState.generatedTaskId)
            }
            // Restaurar status anterior
            await updateTask(last.entityId, { status: previousMoveState.status })
          } else if (last.type === 'update') {
            // Restaurar todos os campos anteriores
            await updateTask(last.entityId, last.previousState as Partial<Task>)
          } else if (last.type === 'delete') {
            // Restaurar tarefa deletada
            await restoreTask(last.entityId)
          } else if (last.type === 'restore') {
            // Re-deletar tarefa
            await deleteTask(last.entityId)
          }
          break

        case 'project':
          if (last.type === 'delete') {
            // Restaurar projeto deletado (implementação simples)
            await updateProject(last.entityId, last.previousState as Partial<Project>)
          }
          break

        case 'meeting':
          if (last.type === 'delete') {
            await updateMeeting(last.entityId, last.previousState as Partial<Meeting>)
          }
          break

        case 'appointment':
          if (last.type === 'delete') {
            await updateAppointment(last.entityId, last.previousState as Partial<Appointment>)
          }
          break

        case 'column':
          if (last.type === 'update') {
            await updateColumn(last.entityId, last.previousState as Partial<KanbanColumn>)
          } else if (last.type === 'delete') {
            const colData = last.previousState as KanbanColumn
            columns.value.push(colData)
            await queueSave()
          } else if (last.type === 'move') {
            const orders = last.previousState as { fromIndex: number; toIndex: number }
            await moveColumn(orders.toIndex, orders.fromIndex)
          }
          break
      }
      return true
    } catch (error) {
      // Put back in history if undo failed
      actionHistory.value.unshift(last)
      console.error('Undo failed:', error)
      return false
    } finally {
      isUndoing = false
    }
  }

  function canUndo(): boolean {
    return actionHistory.value.length > 0
  }

  function clearHistory() {
    actionHistory.value = []
  }

  const sortedColumns = computed(() => {
    if (!columns.value || !Array.isArray(columns.value)) return []
    return [...columns.value].sort((a, b) => a.order - b.order)
  })

  const tasksByStatus = computed(() => {
    return tasks.value.reduce<Record<string, Task[]>>((acc, task) => {
      if (!acc[task.status]) {
        acc[task.status] = []
      }
      acc[task.status].push(task)
      return acc
    }, {})
  })

  // Versão filtrada (sem tarefas deletadas) - usar nos componentes
  const activeTasksByStatus = computed(() => {
    return tasks.value
      .filter(t => !t.deletedAt)
      .reduce<Record<string, Task[]>>((acc, task) => {
        if (!acc[task.status]) {
          acc[task.status] = []
        }
        acc[task.status].push(task)
        return acc
      }, {})
  })

  const columnMapByStatus = computed(() => {
    return new Map(columns.value.map(column => [column.status, column]))
  })

  function getTechnicalSearchFields(task: Task): string[] {
    const metadata = task.developerMetadata
    if (!metadata) {
      return []
    }

    return [
      metadata.repositoryUrl,
      metadata.branchName,
      metadata.pullRequestUrl,
      metadata.issueUrl,
      metadata.environment,
      metadata.reviewStatus,
      metadata.blockedReason
    ].filter((field): field is string => typeof field === 'string' && field.trim().length > 0)
  }

  const filteredTasks = computed(() => {
    let result = tasks.value.filter(t => !t.deletedAt)
    
    if (columnFilter.value) {
      result = result.filter(t => t.status === columnFilter.value)
    }
    
    if (labelFilter.value) {
      result = result.filter(t => t.labels && t.labels.some(l => l.name.toLowerCase() === labelFilter.value?.toLowerCase()))
    }
    
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase()
      result = result.filter(t =>
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.project.toLowerCase().includes(query) ||
        t.labels?.some(l => l.name.toLowerCase().includes(query)) ||
        getTechnicalSearchFields(t).some(field => field.toLowerCase().includes(query))
      )
    }

    if (showOnlyOverdueTasks.value) {
      const referenceNow = new Date()
      result = result.filter(t => isTaskOverdue(t, referenceNow))
    }

    return result
  })

  const sortedTasksByColumn = computed(() => {
    const grouped = activeTasksByStatus.value
    const result: Record<string, Task[]> = {}

    for (const [status, taskList] of Object.entries(grouped)) {
      const order = taskOrder.value[status] || []
      const taskMap = new Map(taskList.map(t => [t.id, t]))

      // Sort based on taskOrder
      const sorted = order
        .map(id => taskMap.get(id))
        .filter((t): t is Task => t !== undefined)

      // Add any tasks not in order
      const remaining = taskList.filter(t => !order.includes(t.id))
      result[status] = [...sorted, ...remaining]
    }

    return result
  })

  const filteredSortedTasksByColumn = computed(() => {
    const grouped: Record<string, Task[]> = {}

    for (const task of filteredTasks.value) {
      if (!grouped[task.status]) {
        grouped[task.status] = []
      }
      grouped[task.status].push(task)
    }

    const result: Record<string, Task[]> = {}

    for (const [status, taskList] of Object.entries(grouped)) {
      const order = taskOrder.value[status] || []
      const taskMap = new Map(taskList.map(t => [t.id, t]))

      const sorted = order
        .map(id => taskMap.get(id))
        .filter((t): t is Task => t !== undefined)

      const remaining = taskList.filter(t => !order.includes(t.id))
      result[status] = [...sorted, ...remaining]
    }

    return result
  })

  // Tarefas na lixeira (soft deleted)
  const trashedTasks = computed(() => {
    return tasks.value.filter(t => t.deletedAt !== null && t.deletedAt !== undefined)
  })

  // ============ TimeEntry Computeds ============
  const activeTimerEntry = computed<TimeEntry | null>(() => {
    return timeEntries.value.find(e => e.source === 'timer' && e.endedAt === null) || null
  })

  const timeEntriesByTaskId = computed(() => {
    const map: Record<string, TimeEntry[]> = {}
    for (const entry of timeEntries.value) {
      if (!map[entry.taskId]) {
        map[entry.taskId] = []
      }
      map[entry.taskId].push(entry)
    }
    return map
  })

  const finalizedTimeEntriesByTaskId = computed(() => {
    const map: Record<string, TimeEntry[]> = {}
    for (const entry of timeEntries.value) {
      if (entry.endedAt !== null && entry.endedAt !== undefined && typeof entry.durationMinutes === 'number') {
        if (!map[entry.taskId]) {
          map[entry.taskId] = []
        }
        map[entry.taskId].push(entry)
      }
    }
    return map
  })

  const subtasksMap = computed(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks.value) {
      if (task.parentId) {
        if (!map[task.parentId]) {
          map[task.parentId] = []
        }
        map[task.parentId].push(task)
      }
    }
    return map
  })

  function getSubtasks(parentId: string): Task[] {
    return subtasksMap.value[parentId] || []
  }

  function getSubtaskProgress(parentId: string): { completed: number; total: number } {
    const subtasks = getSubtasks(parentId)
    const total = subtasks.length
    const completed = subtasks.filter(t => t.status === 'done' || t.status === 'completed').length
    return { completed, total }
  }

  function getTasksByStatus(status: string): Task[] {
    return tasksByStatus.value[status] || []
  }

  function getColumnByStatus(status: string): KanbanColumn | null {
    return columnMapByStatus.value.get(status) || null
  }

  function getStatusLabel(status: string): string {
    return getColumnByStatus(status)?.title || status
  }

  function ensureUniqueStatus(status: string, columnId?: string) {
    const duplicated = columns.value.find(column => column.status === status && column.id !== columnId)
    if (duplicated) {
      throw new Error(`Já existe uma coluna com o identificador "${status}".`)
    }
  }

  // ============ TimeEntry Actions ============
  function getTaskTimeSpent(taskId: string): number {
    const entries = finalizedTimeEntriesByTaskId.value[taskId] || []
    return entries.reduce((sum, entry) => sum + (entry.durationMinutes || 0), 0)
  }

  function syncTaskTimeSpent(taskId: string) {
    const task = tasks.value.find(t => t.id === taskId)
    if (task) {
      task.timeSpent = getTaskTimeSpent(taskId)
    }
  }

  function startTimer(taskId: string): TimeEntry {
    if (activeTimerEntry.value) {
      throw new Error('Já existe um timer ativo. Pare ou descarte o timer atual antes de iniciar outro.')
    }

    const task = tasks.value.find(t => t.id === taskId)
    if (!task) {
      throw new Error('Tarefa não encontrada.')
    }
    if (task.deletedAt) {
      throw new Error('Tarefa na lixeira não pode iniciar timer.')
    }

    const now = new Date().toISOString()
    const entry: TimeEntry = {
      id: uuidv4(),
      taskId,
      projectId: task.projectId,
      startedAt: now,
      endedAt: null,
      source: 'timer',
      createdAt: now,
      updatedAt: now
    }

    timeEntries.value.push(entry)
    queueSave()
    return entry
  }

  function stopTimer(entryId?: string): TimeEntry {
    const entry = entryId
      ? timeEntries.value.find(e => e.id === entryId && e.source === 'timer' && e.endedAt === null)
      : activeTimerEntry.value

    if (!entry) {
      throw new Error('Nenhum timer ativo encontrado.')
    }

    const started = new Date(entry.startedAt).getTime()
    const now = Date.now()
    const durationMs = now - started
    const durationMinutes = Math.max(1, Math.round(durationMs / (1000 * 60)))

    const endedAt = new Date().toISOString()
    const index = timeEntries.value.findIndex(e => e.id === entry.id)
    if (index !== -1) {
      timeEntries.value[index] = {
        ...entry,
        endedAt,
        durationMinutes,
        updatedAt: endedAt
      }
      syncTaskTimeSpent(entry.taskId)
      queueSave()
      return timeEntries.value[index]
    }

    throw new Error('Erro ao parar timer.')
  }

  function discardTimer(entryId?: string) {
    const entry = entryId
      ? timeEntries.value.find(e => e.id === entryId && e.source === 'timer' && e.endedAt === null)
      : activeTimerEntry.value

    if (!entry) {
      return
    }

    timeEntries.value = timeEntries.value.filter(e => e.id !== entry.id)
    queueSave()
  }

  function addManualTimeEntry(
    taskId: string,
    input: { durationMinutes: number; startedAt: string; note?: string }
  ): TimeEntry {
    const task = tasks.value.find(t => t.id === taskId)
    if (!task) {
      throw new Error('Tarefa não encontrada.')
    }

    const now = new Date().toISOString()
    const entry: TimeEntry = {
      id: uuidv4(),
      taskId,
      projectId: task.projectId,
      startedAt: input.startedAt,
      endedAt: input.startedAt,
      durationMinutes: Math.max(1, Math.round(input.durationMinutes)),
      ...(input.note ? { note: input.note } : {}),
      source: 'manual',
      createdAt: now,
      updatedAt: now
    }

    timeEntries.value.push(entry)
    syncTaskTimeSpent(taskId)
    queueSave()
    return entry
  }

  function updateTimeEntry(entryId: string, updates: Partial<Pick<TimeEntry, 'durationMinutes' | 'note' | 'startedAt' | 'endedAt'>>): TimeEntry {
    const index = timeEntries.value.findIndex(e => e.id === entryId)
    if (index === -1) {
      throw new Error('Entrada de tempo não encontrada.')
    }

    const current = timeEntries.value[index]
    const updated: TimeEntry = {
      ...current,
      ...(updates.durationMinutes !== undefined ? { durationMinutes: Math.max(1, Math.round(updates.durationMinutes)) } : {}),
      ...(updates.note !== undefined ? { note: updates.note } : {}),
      ...(updates.startedAt !== undefined ? { startedAt: updates.startedAt } : {}),
      ...(updates.endedAt !== undefined ? { endedAt: updates.endedAt } : {}),
      updatedAt: new Date().toISOString()
    }

    timeEntries.value[index] = updated
    syncTaskTimeSpent(current.taskId)
    queueSave()
    return updated
  }

  function deleteTimeEntry(entryId: string) {
    const entry = timeEntries.value.find(e => e.id === entryId)
    if (!entry) {
      return
    }

    timeEntries.value = timeEntries.value.filter(e => e.id !== entryId)
    syncTaskTimeSpent(entry.taskId)
    queueSave()
  }

  /**
   * Deep unwrap Vue reactive proxies para permitir structuredClone.
   *
   * toRaw() do Vue remove apenas o proxy do topo; objetos aninhados
   * permanecem reativos e quebram structuredClone. Esta função faz
   * unwrap recursivo até que todos os valores sejam plain objects/arrays.
   */
  function toDeepRaw<T>(value: T): T {
    const raw = toRaw(value as object) as unknown as T
    if (Array.isArray(raw)) {
      return raw.map((item: unknown) => toDeepRaw(item)) as unknown as T
    }
    if (raw !== null && typeof raw === 'object' && !(raw instanceof Date)) {
      const result: Record<string, unknown> = {}
      for (const key of Object.keys(raw as Record<string, unknown>)) {
        result[key] = toDeepRaw((raw as Record<string, unknown>)[key])
      }
      return result as unknown as T
    }
    return raw
  }

  function queueSave() {
    isDirty = true

    if (saveScheduled) {
      return saveQueue
    }

    saveScheduled = true

    saveQueue = saveQueue.then(async () => {
      // Microtask já agrupa mutações síncronas consecutivas — sem setTimeout
      // (que quebra vi.useFakeTimers() nos testes)

      while (isDirty) {
        isDirty = false

        const snapshot = deepClone({
          schemaVersion: CURRENT_SCHEMA_VERSION,
          columns: toDeepRaw(columns.value),
          tasks: toDeepRaw(tasks.value),
          projects: toDeepRaw(projects.value),
          meetings: toDeepRaw(meetings.value),
          appointments: toDeepRaw(appointments.value),
          taskOrder: toDeepRaw(taskOrder.value),
          workSettings: toDeepRaw(workSettings.value),
          actionHistory: toDeepRaw(actionHistory.value),
          labelFilter: labelFilter.value,
          timeEntries: toDeepRaw(timeEntries.value),
        })

        try {
          await storage.save(snapshot)
        } catch (error) {
          console.error('Failed to save app data:', error)
          // Re-mark dirty so state is not lost on save failure —
          // the next mutation will retry persistence.
          isDirty = true
        }
      }

      saveScheduled = false
    })

    return saveQueue
  }

  async function loadAppData() {
    const data = migrateAppData(await storage.load())
    columns.value = data.columns
    tasks.value = data.tasks
    projects.value = data.projects
    meetings.value = data.meetings
    appointments.value = data.appointments
    taskOrder.value = data.taskOrder
    workSettings.value = data.workSettings || DEFAULT_WORK_SETTINGS
    labelFilter.value = data.labelFilter || null
    timeEntries.value = data.timeEntries || []

    // Carregar histórico de undo com limite de MAX_HISTORY
    const loadedHistory = data?.actionHistory || []
    // Filtrar entradas muito antigas (mais de 24h) e limitar ao MAX_HISTORY
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    actionHistory.value = loadedHistory
      .filter((entry: HistoryEntry) => new Date(entry.timestamp).getTime() > oneDayAgo)
      .slice(0, MAX_HISTORY)

    await processRecurringTasks()

    loaded.value = true
  }

  async function loadFromStorage(data: AppData) {
    const migrated = migrateAppData(data)
    columns.value = migrated.columns
    tasks.value = migrated.tasks
    projects.value = migrated.projects
    meetings.value = migrated.meetings
    appointments.value = migrated.appointments
    taskOrder.value = migrated.taskOrder
    workSettings.value = migrated.workSettings || DEFAULT_WORK_SETTINGS
    labelFilter.value = migrated.labelFilter || null
    timeEntries.value = migrated.timeEntries || []
    const loadedHistory = migrated.actionHistory || []
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000
    actionHistory.value = loadedHistory
      .filter((entry: HistoryEntry) => new Date(entry.timestamp).getTime() > oneDayAgo)
      .slice(0, MAX_HISTORY)

    await processRecurringTasks()
  }

  function removeTaskById(taskId: string): void {
    const taskIndex = tasks.value.findIndex(task => task.id === taskId)
    if (taskIndex === -1) {
      return
    }

    tasks.value.splice(taskIndex, 1)
    Object.keys(taskOrder.value).forEach(status => {
      taskOrder.value[status] = (taskOrder.value[status] || []).filter(id => id !== taskId)
    })
  }

  function isCompletedStatus(status: string): boolean {
    return isCompletedStatusWithColumns(status, columns.value)
  }

  function getInitialTaskStatus(): string {
    return sortedColumns.value[0]?.status || columns.value[0]?.status || DEFAULT_COLUMNS[0].status
  }

  function toDateOnly(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  function isTaskOverdue(task: Task, referenceNow: Date = new Date()): boolean {
    if (isCompletedStatus(task.status)) {
      return false
    }

    const effectiveDueDate = getTaskEffectiveDueDate(task)
    if (!effectiveDueDate) {
      return false
    }

    return referenceNow.getTime() > effectiveDueDate.getTime()
  }

  function isTaskCompletedWithDelay(task: Task): boolean {
    return isCompletedStatus(task.status) && Boolean(task.completedWithDelay)
  }

  function getValidWorkDays(): number[] {
    const configuredWorkDays = Array.isArray(workSettings.value.workDays)
      ? workSettings.value.workDays
      : []
    const normalized = [...new Set(
      configuredWorkDays.filter(day => Number.isInteger(day) && day >= 0 && day <= 6)
    )]

    if (normalized.length > 0) {
      return normalized
    }

    return [1, 2, 3, 4, 5]
  }

  function calculateEligibleAt(completedAt: string, recurrence: RecurrenceConfig): Date | null {
    const completedDate = parseDatePreservingLocal(completedAt)
    if (!completedDate) {
      return null
    }

    const completedStart = startOfDay(completedDate)

    if (recurrence.type === 'daily') {
      const nextDay = new Date(completedStart)
      nextDay.setDate(nextDay.getDate() + 1)
      return nextDay
    }

    if (recurrence.type === 'weekly') {
      const dayOfWeek = completedStart.getDay()
      const offsetToMonday = (dayOfWeek + 6) % 7
      const nextWeekMonday = new Date(completedStart)
      nextWeekMonday.setDate(nextWeekMonday.getDate() - offsetToMonday + 7)

      const allowedWorkDays = new Set(getValidWorkDays())
      for (let index = 0; index < 7; index += 1) {
        const candidate = new Date(nextWeekMonday)
        candidate.setDate(nextWeekMonday.getDate() + index)
        if (allowedWorkDays.has(candidate.getDay())) {
          return candidate
        }
      }

      return nextWeekMonday
    }

    return calculateMonthlyEligibleAt(completedStart, recurrence)
  }

  function getMonthKey(date: Date): string {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }

  function getLastDayOfMonth(year: number, monthIndex: number): Date {
    return new Date(year, monthIndex + 1, 0)
  }

  function getFirstDayOfMonth(year: number, monthIndex: number): Date {
    return new Date(year, monthIndex, 1)
  }

  function getLastWorkdayOfMonth(year: number, monthIndex: number, workDays: Set<number>): Date {
    const monthLastDay = getLastDayOfMonth(year, monthIndex)
    for (let day = monthLastDay.getDate(); day >= 1; day -= 1) {
      const candidate = new Date(year, monthIndex, day)
      if (workDays.has(candidate.getDay())) {
        return candidate
      }
    }
    return monthLastDay
  }

  function getNthWeekdayOfMonth(
    year: number,
    monthIndex: number,
    weekOfMonth: number,
    dayOfWeek: number
  ): Date {
    const firstDayOfMonth = new Date(year, monthIndex, 1)
    const firstDayWeekday = firstDayOfMonth.getDay()
    const daysUntilTarget = (dayOfWeek - firstDayWeekday + 7) % 7
    const nthDayOfMonth = 1 + daysUntilTarget + (weekOfMonth - 1) * 7
    const lastDayOfMonth = new Date(year, monthIndex + 1, 0).getDate()

    if (nthDayOfMonth > lastDayOfMonth) {
      // Se a enésima ocorrência não existe (ex.: 5ª terça-feira em mês com 4),
      // usa a última ocorrência disponível.
      const lastOccurrenceDay = nthDayOfMonth - 7
      return new Date(year, monthIndex, lastOccurrenceDay)
    }

    return new Date(year, monthIndex, nthDayOfMonth)
  }

  function applyBusinessDayAdjustment(
    candidateDate: Date,
    adjustment: RecurrenceConfig['businessDayAdjustment']
  ): Date {
    if (!adjustment || adjustment === 'none') {
      return candidateDate
    }

    const workDays = new Set(getValidWorkDays())
    if (workDays.has(candidateDate.getDay())) {
      return candidateDate
    }

    const adjusted = new Date(candidateDate)
    if (adjustment === 'previous_workday') {
      while (!workDays.has(adjusted.getDay()) && adjusted.getMonth() === candidateDate.getMonth()) {
        adjusted.setDate(adjusted.getDate() - 1)
      }
      if (adjusted.getMonth() !== candidateDate.getMonth()) {
        return candidateDate
      }
      return adjusted
    }

    while (!workDays.has(adjusted.getDay()) && adjusted.getMonth() === candidateDate.getMonth()) {
      adjusted.setDate(adjusted.getDate() + 1)
    }
    if (adjusted.getMonth() !== candidateDate.getMonth()) {
      return candidateDate
    }
    return adjusted
  }

  function advanceMonth(year: number, monthIndex: number): { year: number; monthIndex: number } {
    let nextMonthIndex = monthIndex + 1
    let nextYear = year
    if (nextMonthIndex > 11) {
      nextMonthIndex = 0
      nextYear += 1
    }
    return { year: nextYear, monthIndex: nextMonthIndex }
  }

  function computeMonthlyCandidate(
    year: number,
    monthIndex: number,
    recurrence: RecurrenceConfig,
    mode: MonthlyRecurrenceMode,
  ): Date {
    if (mode === 'first_day') {
      return getFirstDayOfMonth(year, monthIndex)
    }

    if (mode === 'fixed_day') {
      const requestedDay = recurrence.dayOfMonth ?? 1
      const monthLastDay = getLastDayOfMonth(year, monthIndex).getDate()
      const resolvedDay = Math.min(Math.max(1, requestedDay), monthLastDay)
      const candidate = new Date(year, monthIndex, resolvedDay)
      return applyBusinessDayAdjustment(candidate, recurrence.businessDayAdjustment)
    }

    if (mode === 'last_day') {
      const candidate = getLastDayOfMonth(year, monthIndex)
      return applyBusinessDayAdjustment(candidate, recurrence.businessDayAdjustment)
    }

    if (mode === 'last_workday') {
      const workDays = new Set(getValidWorkDays())
      return getLastWorkdayOfMonth(year, monthIndex, workDays)
    }

    if (mode === 'nth_weekday') {
      if (
        typeof recurrence.weekOfMonth !== 'number'
        || typeof recurrence.dayOfWeek !== 'number'
      ) {
        console.error(
          'Recorrência nth_weekday sem weekOfMonth ou dayOfWeek. ' +
          'Utilizando fallback para primeiro dia do mês.',
          { recurrenceId: (recurrence as unknown as Record<string, unknown>)._id },
        )
        return getFirstDayOfMonth(year, monthIndex)
      }
      const weekOfMonth = recurrence.weekOfMonth
      const dayOfWeek = recurrence.dayOfWeek
      return getNthWeekdayOfMonth(year, monthIndex, weekOfMonth, dayOfWeek)
    }

    // Modo desconhecido: fallback seguro para first_day com aviso.
    console.error(
      'Modo de recorrência mensal desconhecido. Utilizando fallback para primeiro dia do mês.',
      { mode, recurrenceId: (recurrence as unknown as Record<string, unknown>)._id },
    )
    return getFirstDayOfMonth(year, monthIndex)
  }

  function calculateMonthlyEligibleAt(completedStart: Date, recurrence: RecurrenceConfig): Date {
    const mode = recurrence.monthlyMode || 'first_day'

    // Para first_day, last_day e last_workday: sempre avança para o mês seguinte.
    // São âncoras posicionais (primeiro/último dia) que sempre pertencem ao próximo período.
    if (mode === 'first_day' || mode === 'last_day' || mode === 'last_workday') {
      const next = advanceMonth(completedStart.getFullYear(), completedStart.getMonth())
      return computeMonthlyCandidate(next.year, next.monthIndex, recurrence, mode)
    }

    // Para fixed_day e nth_weekday: tenta o mês atual primeiro.
    // Se a data alvo ainda está no futuro em relação à conclusão, usa o mês atual.
    // Caso contrário, avança para o mês seguinte.
    const currentYear = completedStart.getFullYear()
    const currentMonthIndex = completedStart.getMonth()
    const currentCandidate = computeMonthlyCandidate(
      currentYear, currentMonthIndex, recurrence, mode,
    )

    if (currentCandidate.getTime() > completedStart.getTime()) {
      return currentCandidate
    }

    const next = advanceMonth(currentYear, currentMonthIndex)
    return computeMonthlyCandidate(next.year, next.monthIndex, recurrence, mode)
  }

  function buildNextDueAt(task: Task, eligibleAt: Date): { dueAt?: string | null; dueHasTime?: boolean } {
    if (!task.dueAt) {
      return { dueAt: null, dueHasTime: false }
    }

    const hasTime = typeof task.dueHasTime === 'boolean'
      ? task.dueHasTime
      : task.dueAt.includes('T')

    if (!hasTime) {
      return { dueAt: toDateOnly(eligibleAt), dueHasTime: false }
    }

    const parsedDueAt = parseDatePreservingLocal(task.dueAt)
    if (!parsedDueAt) {
      return { dueAt: null, dueHasTime: false }
    }

    const dueAtWithPreservedTime = new Date(
      eligibleAt.getFullYear(),
      eligibleAt.getMonth(),
      eligibleAt.getDate(),
      parsedDueAt.getHours(),
      parsedDueAt.getMinutes(),
      parsedDueAt.getSeconds(),
      parsedDueAt.getMilliseconds()
    )

    return {
      dueAt: dueAtWithPreservedTime.toISOString(),
      dueHasTime: true
    }
  }

  function cloneChecklistForRecurrence(task: Task): Task['subtasks'] {
    if (!task.recurrence?.copyChecklist || !Array.isArray(task.subtasks)) {
      return undefined
    }

    return task.subtasks.map(subtask => ({
      id: uuidv4(),
      title: subtask.title,
      completed: false
    }))
  }

  function generateNextRecurringTaskIfNeeded(task: Task, now: Date): string | null {
    if (!task.isRecurring || !task.recurrence || !task.completedAt || task.deletedAt) {
      return null
    }

    if (!isCompletedStatus(task.status)) {
      return null
    }

    const eligibleAt = calculateEligibleAt(task.completedAt, task.recurrence)
    if (!eligibleAt || now.getTime() < eligibleAt.getTime()) {
      return null
    }

    const seriesId = task.recurrenceState?.seriesId || task.id
    const occurrenceNumber = task.recurrenceState?.occurrenceNumber || 1
    const nextOccurrenceNumber = occurrenceNumber + 1
    const nextPeriodKey = task.recurrence.type === 'monthly'
      ? getMonthKey(eligibleAt)
      : undefined

    const alreadyGenerated = tasks.value.some(t =>
      t.recurrenceState?.sourceTaskId === task.id ||
      (t.recurrenceState?.seriesId === seriesId && t.recurrenceState?.occurrenceNumber === nextOccurrenceNumber) ||
      (
        task.recurrence?.type === 'monthly'
        && nextPeriodKey !== undefined
        && t.recurrenceState?.seriesId === seriesId
        && t.recurrenceState?.periodKey === nextPeriodKey
      )
    )

    if (alreadyGenerated) {
      return null
    }

    const generatedAt = now.toISOString()
    const nextDue = buildNextDueAt(task, eligibleAt)
    const nextTask: Task = {
      id: uuidv4(),
      title: task.title,
      description: task.description,
      status: getInitialTaskStatus(),
      date: toDateOnly(eligibleAt),
      ...nextDue,
      timeSpent: 0,
      project: task.project,
      projectId: task.projectId,
      order: undefined,
      labels: task.labels?.map(label => ({ ...label })),
      comments: undefined,
      subtasks: cloneChecklistForRecurrence(task),
      isRecurring: true,
      recurrence: { ...task.recurrence },
      recurrenceState: {
        seriesId,
        occurrenceNumber: nextOccurrenceNumber,
        periodKey: nextPeriodKey,
        sourceTaskId: task.id,
        generatedAt
      },
      developerMetadata: task.developerMetadata
        ? { ...task.developerMetadata }
        : undefined,
      completedAt: null,
      parentId: task.parentId,
      deletedAt: null,
      createdAt: generatedAt,
      updatedAt: generatedAt
    }

    tasks.value.push(nextTask)
    const status = nextTask.status
    taskOrder.value[status] = [...(taskOrder.value[status] || []), nextTask.id]
    return nextTask.id
  }

  function materializeEligibleRecurringTasks(now: Date = new Date()): string[] {
    const generatedTaskIds: string[] = []
    const snapshot = [...tasks.value]

    for (const task of snapshot) {
      const generatedTaskId = generateNextRecurringTaskIfNeeded(task, now)
      if (generatedTaskId) {
        generatedTaskIds.push(generatedTaskId)
      }
    }

    return generatedTaskIds
  }

  async function processRecurringTasks(now: Date = new Date()): Promise<string[]> {
    const generatedTaskIds = materializeEligibleRecurringTasks(now)
    if (generatedTaskIds.length > 0) {
      await queueSave()
    }

    return generatedTaskIds
  }

  function addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date().toISOString()
    const normalizedDue = normalizeDueFields(task)
    const normalizedMetadata = normalizeDeveloperMetadata(task.developerMetadata)
    if (normalizedMetadata.invalidFields.length > 0) {
      console.warn('Metadados de desenvolvimento inválidos ignorados ao salvar tarefa.', {
        action: 'addTask',
        fields: normalizedMetadata.invalidFields
      })
    }
    const isCompleted = isCompletedStatus(task.status)
    const completedAt = isCompleted ? task.completedAt ?? now : null
    const taskWithOptionalId = task as unknown as { id?: string }
    const providedId = typeof taskWithOptionalId.id === 'string'
      ? taskWithOptionalId.id
      : null
    const newTask: Task = {
      ...task,
      ...normalizedDue,
      id: providedId && providedId.trim() ? providedId : uuidv4(),
      completedAt,
      completedWithDelay: isCompleted
        ? computeCompletedWithDelay(normalizedDue, completedAt!)
        : null,
      developerMetadata: normalizedMetadata.value,
      createdAt: now,
      updatedAt: now
    }
    tasks.value.push(newTask)

    if (newTask.timeSpent > 0) {
      const entryTimestamp = newTask.completedAt || now
      const entry: TimeEntry = {
        id: uuidv4(),
        taskId: newTask.id,
        projectId: newTask.projectId,
        startedAt: entryTimestamp,
        endedAt: entryTimestamp,
        durationMinutes: Math.max(1, Math.round(newTask.timeSpent)),
        source: 'manual',
        createdAt: now,
        updatedAt: now
      }
      timeEntries.value.push(entry)
      syncTaskTimeSpent(newTask.id)
    }

    return queueSave()
  }

  function updateTask(id: string, updates: Partial<Task>) {
    const index = tasks.value.findIndex(t => t.id === id)
    if (index !== -1) {
      const previousState = { ...tasks.value[index] }
      const nextStatus = updates.status ?? previousState.status
      const isTransitionToCompleted = !isCompletedStatus(previousState.status) && isCompletedStatus(nextStatus)
      const isTransitionFromCompleted = isCompletedStatus(previousState.status) && !isCompletedStatus(nextStatus)
      const mergedTaskForDue = {
        ...previousState,
        ...updates
      }
      const normalizedDue = normalizeDueFields(mergedTaskForDue)
      const normalizedMetadata = normalizeDeveloperMetadata(mergedTaskForDue.developerMetadata)
      if (normalizedMetadata.invalidFields.length > 0) {
        console.warn('Metadados de desenvolvimento inválidos ignorados ao atualizar tarefa.', {
          action: 'updateTask',
          taskId: id,
          fields: normalizedMetadata.invalidFields
        })
      }
      const completedAt = isTransitionToCompleted
        ? (updates.completedAt ?? new Date().toISOString())
        : isTransitionFromCompleted
          ? null
          : (updates.completedAt ?? previousState.completedAt)

      const completedWithDelay = isTransitionToCompleted
        ? computeCompletedWithDelay(normalizedDue, completedAt!)
        : isTransitionFromCompleted
          ? null
          : (updates.completedWithDelay ?? previousState.completedWithDelay ?? null)

      const updatedTask: Task = {
        ...tasks.value[index],
        ...updates,
        ...normalizedDue,
        developerMetadata: normalizedMetadata.value,
        completedAt,
        completedWithDelay,
        updatedAt: new Date().toISOString()
      }

      tasks.value[index] = updatedTask

      // Salvar no histórico se for mudança de status (move)
      if (updates.status && updates.status !== previousState.status) {
        saveHistory(
          'move',
          'task',
          id,
          { status: previousState.status },
          `Mover tarefa para "${getStatusLabel(updates.status)}"`
        )
      }

      materializeEligibleRecurringTasks(new Date())
      syncAppointmentFromTask(id, tasks.value[index])
      return queueSave()
    }
    return Promise.resolve()
  }

  function deleteTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      // Salvar estado anterior para undo
      saveHistory('delete', 'task', id, { ...task }, `Excluir tarefa "${task.title}"`)

      // Soft delete - marca como deletado ao invés de remover
      task.deletedAt = new Date().toISOString()

      // Remover da ordenação do quadro
      Object.keys(taskOrder.value).forEach(status => {
        taskOrder.value[status] = (taskOrder.value[status] || []).filter(taskId => taskId !== id)
      })

      return queueSave()
    }
    return Promise.resolve()
  }

  function permanentlyDeleteTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      tasks.value = tasks.value.filter(t => t.id !== id)
      Object.keys(taskOrder.value).forEach(status => {
        taskOrder.value[status] = (taskOrder.value[status] || []).filter(taskId => taskId !== id)
      })
      // Remove associated time entries
      timeEntries.value = timeEntries.value.filter(e => e.taskId !== id)
      return queueSave()
    }
    return Promise.resolve()
  }

  function restoreTask(id: string) {
    const task = tasks.value.find(t => t.id === id)
    if (task) {
      saveHistory('restore', 'task', id, null, `Restaurar tarefa "${task.title}"`)
      task.deletedAt = null

      // Reinsere na ordenação do quadro sem duplicar
      const status = task.status
      const currentOrder = taskOrder.value[status] || []
      if (!currentOrder.includes(id)) {
        taskOrder.value[status] = [...currentOrder, id]
      }

      return queueSave()
    }
    return Promise.resolve()
  }

  function moveTask(id: string, newStatus: string) {
    return updateTask(id, { status: newStatus })
  }

  function addColumn(columnData: ColumnDraft) {
    ensureUniqueStatus(columnData.status)
    const maxOrder = Math.max(...columns.value.map(c => c.order), -1)
    const newColumn: KanbanColumn = {
      id: uuidv4(),
      title: columnData.title,
      status: columnData.status,
      order: maxOrder + 1,
      color: columnData.color
    }
    columns.value.push(newColumn)
    saveHistory('update', 'column', newColumn.id, newColumn, `Criar coluna "${newColumn.title}"`)
    return queueSave()
  }

  function updateColumn(id: string, updates: Partial<KanbanColumn>) {
    const index = columns.value.findIndex(c => c.id === id)
    if (index !== -1) {
      const currentColumn = { ...columns.value[index] }
      const nextStatus = updates.status ?? currentColumn.status
      ensureUniqueStatus(nextStatus, id)

      if (updates.status && updates.status !== currentColumn.status) {
        tasks.value = tasks.value.map(task => {
          if (task.status !== currentColumn.status) {
            return task
          }

          return {
            ...task,
            status: updates.status!,
            updatedAt: new Date().toISOString()
          }
        })
      }

      columns.value[index] = { ...currentColumn, ...updates }
      saveHistory('update', 'column', id, currentColumn, `Atualizar coluna "${currentColumn.title}"`)
      return queueSave()
    }
    return Promise.resolve()
  }

  function deleteColumn(id: string) {
    const column = columns.value.find(c => c.id === id)
    if (column) {
      const tasksInColumn = tasks.value.filter(t => t.status === column.status)
      if (tasksInColumn.length > 0) {
        throw new Error('Não é possível excluir coluna com tarefas. Mova ou exclua as tarefas primeiro.')
      }
      saveHistory('delete', 'column', id, { ...column }, `Excluir coluna "${column.title}"`)
      columns.value = columns.value.filter(c => c.id !== id)
      return queueSave()
    }
    return Promise.resolve()
  }

  function moveColumn(fromIndex: number, toIndex: number) {
    const sorted = sortedColumns.value
    const [moved] = sorted.splice(fromIndex, 1)
    sorted.splice(toIndex, 0, moved)
    
    sorted.forEach((col, idx) => {
      const original = columns.value.find(c => c.id === col.id)
      if (original) {
        original.order = idx
      }
    })
    
    saveHistory('move', 'column', moved.id, { fromIndex, toIndex }, `Mover coluna "${moved.title}"`)
    return queueSave()
  }

  function getTasksByDateRange(startDate: string, endDate: string): Task[] {
    return tasks.value.filter(task => !task.deletedAt && task.date >= startDate && task.date <= endDate)
  }

  function escapeCSVField(value: string): string {
    if (value === null || value === undefined) {
      return ''
    }

    const str = String(value)
    const dangerousPrefixes = /^[=+\-@\t\r]/
    const prefix = dangerousPrefixes.test(str) ? "'" : ''
    const prefixed = prefix + str
    const needsQuotes = prefixed.includes(',') || prefixed.includes('"') || prefixed.includes('\n') || prefixed.includes('\r')
    const escaped = prefixed.replace(/"/g, '""')

    if (needsQuotes) {
      return `"${escaped}"`
    }

    return escaped
  }

  function exportTasksToCSV(startDate: string, endDate: string): string {
    const rangeTasks = getTasksByDateRange(startDate, endDate)
    const headers = [
      'Data',
      'Tarefa',
      'Descrição',
      'Projeto',
      'Status',
      'Tempo (horas)',
      'Review',
      'Branch',
      'PR',
      'Issue',
      'Ambiente',
      'Estimativa (min)'
    ]
    const rows = rangeTasks.map(t => {
      const metadata = t.developerMetadata
      return [
        escapeCSVField(t.date),
        escapeCSVField(t.title),
        escapeCSVField(t.description),
        escapeCSVField(t.project),
        escapeCSVField(getStatusLabel(t.status)),
        escapeCSVField((getTaskTimeSpent(t.id) / 60).toFixed(2)),
        escapeCSVField(metadata?.reviewStatus || ''),
        escapeCSVField(metadata?.branchName || ''),
        escapeCSVField(metadata?.pullRequestUrl || ''),
        escapeCSVField(metadata?.issueUrl || ''),
        escapeCSVField(metadata?.environment || ''),
        escapeCSVField(
          typeof metadata?.estimateMinutes === 'number'
            ? String(metadata.estimateMinutes)
            : ''
        )
      ]
    })

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  function exportProjectsToCSV(): string {
    const headers = ['Nome', 'Cliente', 'Cor', 'Criado em']
    const rows = projects.value.map(p => {
      return [
        escapeCSVField(p.name),
        escapeCSVField(p.client || ''),
        escapeCSVField(p.color || ''),
        escapeCSVField(p.createdAt)
      ]
    })

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  function getMonthlyProjectReport(referenceMonth: string) {
    const referenceDate = getReferenceDateFromInput(referenceMonth)
    return buildMonthlyProjectReport({
      referenceDate,
      columns: columns.value,
      projects: projects.value,
      tasks: tasks.value,
      timeEntries: timeEntries.value
    })
  }

  function exportMonthlyProjectReportCSV(referenceMonth: string): string {
    const report = getMonthlyProjectReport(referenceMonth)
    return buildMonthlyProjectReportCSV(report)
  }

  function exportMeetingsToCSV(startDate?: string, endDate?: string): string {
    let meetingsList = meetings.value

    if (startDate && endDate) {
      meetingsList = meetingsList.filter(m => m.date >= startDate && m.date <= endDate)
    }

    const headers = ['Título', 'Data', 'Horário', 'Duração (min)', 'Projeto', 'Descrição', 'Participantes']
    const rows = meetingsList.map(m => {
      const project = projects.value.find(p => p.id === m.projectId)
      return [
        escapeCSVField(m.title),
        escapeCSVField(m.date),
        escapeCSVField(m.time || ''),
        escapeCSVField(m.duration?.toString() || ''),
        escapeCSVField(project?.name || ''),
        escapeCSVField(m.description || ''),
        escapeCSVField(m.attendees?.join(', ') || '')
      ]
    })

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  }

  async function downloadReport(
    type: 'tasks' | 'meetings' | 'projects' | 'monthly_projects',
    startDate?: string,
    endDate?: string
  ): Promise<void> {
    try {
      let csv = ''
      let filename = ''

      if (type === 'tasks') {
        if (!startDate || !endDate) {
          throw new Error('Período obrigatório para relatório de tarefas')
        }
        csv = exportTasksToCSV(startDate, endDate)
        filename = `tarefas_${startDate}_a_${endDate}.csv`
      } else if (type === 'meetings') {
        if (!startDate || !endDate) {
          throw new Error('Período obrigatório para relatório de reuniões')
        }
        csv = exportMeetingsToCSV(startDate, endDate)
        filename = `reunioes_${startDate}_a_${endDate}.csv`
      } else if (type === 'projects') {
        csv = exportProjectsToCSV()
        filename = 'projetos.csv'
      } else if (type === 'monthly_projects') {
        const monthReference = typeof startDate === 'string' && startDate.trim()
          ? startDate
          : new Date().toISOString().slice(0, 7)
        csv = exportMonthlyProjectReportCSV(monthReference)
        filename = `projetos_consolidado_${monthReference}.csv`
      }

      await storage.exportCSV(csv, filename)
    } catch (error) {
      console.error('Erro técnico ao exportar relatório:', {
        type,
        period: {
          startDate: startDate || null,
          endDate: endDate || null
        },
        environment: window.electronAPI ? 'electron' : 'browser',
        error
      })
      throw new Error('Falha ao exportar relatório')
    }
  }

  interface ValidationError {
    field: string
    message: string
  }

  function validateTaskImport(
    date: string,
    title: string,
    description: string,
    project: string,
    status: string,
    timeStr: string,
    lineNumber: number
  ): ValidationError[] {
    const errors: ValidationError[] = []
    
    const trimmedTitle = title?.trim() || ''
    if (!trimmedTitle) {
      errors.push({ field: 'title', message: `Linha ${lineNumber}: título é obrigatório` })
    } else if (trimmedTitle.length > 200) {
      errors.push({ field: 'title', message: `Linha ${lineNumber}: título excede 200 caracteres` })
    }
    
    if (description && description.length > 2000) {
      errors.push({ field: 'description', message: `Linha ${lineNumber}: descrição excede 2000 caracteres` })
    }
    
    if (project && project.length > 100) {
      errors.push({ field: 'project', message: `Linha ${lineNumber}: nome do projeto excede 100 caracteres` })
    }
    
    const trimmedDate = date?.trim() || ''
    if (trimmedDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(trimmedDate)) {
        errors.push({ field: 'date', message: `Linha ${lineNumber}: data inválida (formato esperado: YYYY-MM-DD)` })
      } else {
        const parsedDate = new Date(trimmedDate)
        if (isNaN(parsedDate.getTime())) {
          errors.push({ field: 'date', message: `Linha ${lineNumber}: data inválida` })
        }
      }
    }
    
    const trimmedStatus = status?.trim() || ''
    if (trimmedStatus) {
      const validStatuses = columns.value.length > 0
        ? columns.value.map(c => c.status)
        : ['backlog', 'waiting', 'in_progress', 'done', 'completed']
      if (!validStatuses.includes(trimmedStatus)) {
        errors.push({ field: 'status', message: `Linha ${lineNumber}: status "${trimmedStatus}" não existe (valores válidos: ${validStatuses.join(', ')})` })
      }
    }
    
    if (timeStr && timeStr.trim()) {
      const timeNum = parseFloat(timeStr)
      if (isNaN(timeNum)) {
        errors.push({ field: 'time', message: `Linha ${lineNumber}: tempo inválido` })
      } else if (timeNum < 0) {
        errors.push({ field: 'time', message: `Linha ${lineNumber}: tempo não pode ser negativo` })
      } else if (timeNum > 24 * 365) {
        errors.push({ field: 'time', message: `Linha ${lineNumber}: tempo excede limite máximo (8760 horas/ano)` })
      }
    }
    
    return errors
  }

  function importTasksFromCSV(csvContent: string): { success: number; errors: number; messages: string[] } {
    if (!csvContent || typeof csvContent !== 'string') {
      return { success: 0, errors: 1, messages: ['Conteúdo CSV inválido'] }
    }
    
    const normalizedContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    const lines = normalizedContent.split('\n').filter(l => l.trim())
    
    const messages: string[] = []
    
    if (lines.length < 2) {
      messages.push('Arquivo CSV inválido ou vazio')
      return { success: 0, errors: 0, messages }
    }
    
    let success = 0
    let errors = 0
    
    const header = parseCSVLine(lines[0])
    const expectedHeaders = ['Data', 'Tarefa', 'Descrição', 'Projeto', 'Status', 'Tempo']
    const hasValidHeader = header.length >= 4 && header.some(h => 
      expectedHeaders.some(eh => h.toLowerCase().includes(eh.toLowerCase()))
    )
    if (!hasValidHeader) {
      messages.push('Header não reconhecida. Esperado: Data, Tarefa, Descrição, Projeto, Status, Tempo')
    }
    
    for (let i = 1; i < lines.length; i++) {
      try {
        const line = lines[i]
        if (!line.trim()) continue
        
        const values = parseCSVLine(line)
        
        if (values.length < 2) {
          errors++
          messages.push(`Linha ${i + 1}: dados insuficientes (mínimo: Data, Tarefa)`)
          continue
        }
        
        const [date, title] = values
        
        const description = values[2]?.trim() || ''
        const project = values[3]?.trim() || ''
        const status = values[4]?.trim() || sortedColumns.value[0]?.status || 'backlog'
        const timeStr = values[5]?.trim() || '0'
        
        const validationErrors = validateTaskImport(date, title, description, project, status, timeStr, i + 1)
        
        if (validationErrors.length > 0) {
          errors++
          validationErrors.forEach(e => messages.push(e.message))
          continue
        }
        
        let validDate = date?.trim() || new Date().toISOString().split('T')[0]
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRegex.test(validDate)) {
          validDate = new Date().toISOString().split('T')[0]
        } else {
          const parsedDate = new Date(validDate)
          if (!isNaN(parsedDate.getTime())) {
            validDate = parsedDate.toISOString().split('T')[0]
          } else {
            validDate = new Date().toISOString().split('T')[0]
          }
        }
        
        const timeSpentMinutes = Math.round(parseFloat(timeStr || '0') * 60)
        const task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> = {
          title: title.trim(),
          description,
          status,
          date: validDate,
          project,
          timeSpent: timeSpentMinutes
        }

        addTask(task)

        success++
      } catch (e) {
        errors++
        messages.push(`Linha ${i + 1}: erro ao processar`)
      }
    }
    
    if (success > 0) {
      messages.push(`Importadas ${success} tarefas com sucesso`)
    }
    if (errors > 0) {
      messages.push(`${errors} linha(s) com erro`)
    }
    
    return { success, errors, messages }
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        // Verificar se é aspa escapada (duas aspas consecutivas)
        if (inQuotes && line[i + 1] === '"') {
          current += '"'
          i++ // Pular a próxima aspa
        } else {
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    result.push(current.trim())
    
    return result
  }

  // ============ Project Actions ============
  function addProject(project: Omit<Project, 'id' | 'createdAt'>) {
    const newProject: Project = {
      ...project,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    }
    projects.value.push(newProject)
    return queueSave()
  }

  function updateProject(id: string, updates: Partial<Project>) {
    const index = projects.value.findIndex(p => p.id === id)
    if (index !== -1) {
      projects.value[index] = { ...projects.value[index], ...updates }
      return queueSave()
    }
    return Promise.resolve()
  }

  function deleteProject(id: string) {
    const deletedProject = projects.value.find(p => p.id === id)
    const projectName = deletedProject?.name || ''
    
    // Marcar tarefas vinculadas como legado (projeto deletado)
    tasks.value = tasks.value.map(t => {
      if (t.projectId === id) {
        return { 
          ...t, 
          projectId: undefined, 
          project: t.project.startsWith('[') ? t.project : `[${projectName}] - ${t.project}`
        }
      }
      return t
    })
    
    projects.value = projects.value.filter(p => p.id !== id)
    return queueSave()
  }

  // ============ Meeting Actions ============
  function addMeeting(meeting: Omit<Meeting, 'id' | 'createdAt'>) {
    const newMeeting: Meeting = {
      ...meeting,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    }
    meetings.value.push(newMeeting)
    return queueSave()
  }

  function updateMeeting(id: string, updates: Partial<Meeting>) {
    const index = meetings.value.findIndex(m => m.id === id)
    if (index !== -1) {
      meetings.value[index] = { ...meetings.value[index], ...updates }
      return queueSave()
    }
    return Promise.resolve()
  }

  function deleteMeeting(id: string) {
    meetings.value = meetings.value.filter(m => m.id !== id)
    return queueSave()
  }

  // ============ Task Order Actions ============
  function reorderTasksInColumn(status: string, orderedIds: string[]) {
    taskOrder.value = {
      ...taskOrder.value,
      [status]: orderedIds
    }
    return queueSave()
  }

  // ============ Search & Filter Actions ============
  function setSearchQuery(query: string) {
    searchQuery.value = query
  }

  function setColumnFilter(status: string | null) {
    columnFilter.value = status
  }

  function setLabelFilter(labelId: string | null) {
    labelFilter.value = labelId
  }

  function setShowOnlyOverdueTasks(value: boolean) {
    showOnlyOverdueTasks.value = value
  }

  // ============ Appointment Actions ============
  function createTaskFromAppointment(
    appointment: Appointment,
    taskId: string,
    initialStatus: string = 'backlog',
  ): Task {
    const now = new Date().toISOString()
    return {
      id: taskId,
      type: 'appointment',
      appointmentId: appointment.id,
      title: appointment.title,
      description: appointment.description || '',
      status: initialStatus,
      date: appointment.startDate,
      dueAt: appointment.startDate,
      dueHasTime: false,
      completedWithDelay: null,
      timeSpent: 0,
      project: '',
      projectId: appointment.projectId,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }

  function addAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'taskId' | 'deletedAt'>,
  ) {
    const now = new Date().toISOString()
    const taskId = uuidv4()
    const appointmentId = uuidv4()

    const newAppointment: Appointment = {
      ...appointment,
      id: appointmentId,
      taskId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    appointments.value.push(newAppointment)

    const newTask = createTaskFromAppointment(newAppointment, taskId)
    tasks.value.push(newTask)

    if (newTask.timeSpent > 0) {
      const entry: TimeEntry = {
        id: uuidv4(),
        taskId: newTask.id,
        projectId: newTask.projectId,
        startedAt: now,
        endedAt: now,
        durationMinutes: Math.max(1, Math.round(newTask.timeSpent)),
        source: 'manual',
        createdAt: now,
        updatedAt: now,
      }
      timeEntries.value.push(entry)
    }

    return queueSave()
  }

  function addAppointmentTask(
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'type' | 'appointmentId'> & {
      startDate: string
      startTime: string
      duration: number
    },
  ) {
    const now = new Date().toISOString()
    const taskId = uuidv4()
    const appointmentId = uuidv4()

    const { startDate, startTime, duration, ...taskData } = data

    const newTask: Task = {
      ...taskData,
      ...normalizeDueFields(taskData),
      id: taskId,
      type: 'appointment',
      appointmentId,
      completedAt: null,
      completedWithDelay: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.push(newTask)

    const newAppointment: Appointment = {
      id: appointmentId,
      taskId,
      title: taskData.title,
      description: taskData.description || undefined,
      startDate,
      startTime,
      duration,
      projectId: taskData.projectId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    appointments.value.push(newAppointment)

    return queueSave()
  }

  function syncTaskFromAppointment(appointmentId: string, appointment: Appointment) {
    const taskIndex = tasks.value.findIndex(t => t.appointmentId === appointmentId)
    if (taskIndex === -1) return

    const task = tasks.value[taskIndex]
    tasks.value[taskIndex] = {
      ...task,
      title: appointment.title,
      description: appointment.description || task.description,
      projectId: appointment.projectId || task.projectId,
      date: appointment.startDate,
      dueAt: appointment.startDate,
      updatedAt: new Date().toISOString(),
    }
  }

  function syncAppointmentFromTask(taskId: string, task: Task) {
    if (task.type !== 'appointment' || !task.appointmentId) return

    const apptIndex = appointments.value.findIndex(a => a.taskId === taskId)
    if (apptIndex === -1) return

    const appointment = appointments.value[apptIndex]
    appointments.value[apptIndex] = {
      ...appointment,
      title: task.title,
      description: task.description || undefined,
      projectId: task.projectId || appointment.projectId,
      startDate: task.dueAt || appointment.startDate,
      updatedAt: new Date().toISOString(),
    }
  }

  function updateAppointment(id: string, updates: Partial<Appointment>) {
    const index = appointments.value.findIndex(a => a.id === id)
    if (index !== -1) {
      appointments.value[index] = { ...appointments.value[index], ...updates, updatedAt: new Date().toISOString() }
      syncTaskFromAppointment(id, appointments.value[index])
      return queueSave()
    }
    return Promise.resolve()
  }

  function deleteAppointment(id: string) {
    appointments.value = appointments.value.filter(a => a.id !== id)
    return queueSave()
  }

  function deleteLinked(id: string) {
    const now = new Date().toISOString()

    const task = tasks.value.find(t => t.id === id)
    const appointment = appointments.value.find(a => a.id === id)

    if (task && task.type === 'appointment' && task.appointmentId) {
      const taskIndex = tasks.value.findIndex(t => t.id === id)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: now, updatedAt: now }
      }
      const apptIndex = appointments.value.findIndex(a => a.id === task.appointmentId)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: now, updatedAt: now }
      }
    } else if (appointment && appointment.taskId) {
      const apptIndex = appointments.value.findIndex(a => a.id === id)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: now, updatedAt: now }
      }
      const taskIndex = tasks.value.findIndex(t => t.id === appointment.taskId)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: now, updatedAt: now }
      }
    }

    return queueSave()
  }

  function restoreLinked(id: string) {
    const task = tasks.value.find(t => t.id === id)
    const appointment = appointments.value.find(a => a.id === id)

    if (task && task.type === 'appointment' && task.appointmentId) {
      const taskIndex = tasks.value.findIndex(t => t.id === id)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
      const apptIndex = appointments.value.findIndex(a => a.id === task.appointmentId)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
    } else if (appointment && appointment.taskId) {
      const apptIndex = appointments.value.findIndex(a => a.id === id)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
      const taskIndex = tasks.value.findIndex(t => t.id === appointment.taskId)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
    }

    return queueSave()
  }

  function getAppointmentsByDate(date: string): Appointment[] {
    return appointments.value.filter(a => a.startDate === date)
  }

  function getAppointmentsByDateRange(startDate: string, endDate: string): Appointment[] {
    return appointments.value.filter(a => a.startDate >= startDate && a.startDate <= endDate)
  }

  // ============ Work Settings Actions ============
  function updateWorkSettings(updates: Partial<WorkSettings>) {
    workSettings.value = { ...workSettings.value, ...updates }
    return queueSave()
  }

  // ============ Conflict Detection ============
  function parseTimeToMinutes(time: string): number {
    if (!time || typeof time !== 'string') return 0

    const match = time.match(/^(\d{1,2}):(\d{2})$/)
    if (!match) return 0

    const hours = Number(match[1])
    const minutes = Number(match[2])

    if (isNaN(hours) || isNaN(minutes)) return 0
    if (hours < 0 || hours > 23) return 0
    if (minutes < 0 || minutes > 59) return 0

    return hours * 60 + minutes
  }

  function checkMeetingConflict(meeting: Partial<Meeting>, excludeId?: string): Meeting | null {
    if (!meeting.date || !meeting.time) return null
    
    const dayMeetings = meetings.value.filter(m => 
      m.date === meeting.date && m.id !== excludeId
    )
    
    const meetingStart = parseTimeToMinutes(meeting.time)
    const meetingEnd = meetingStart + (meeting.duration || 0)
    
    return dayMeetings.find(m => {
      const existingStart = parseTimeToMinutes(m.time || '00:00')
      const existingEnd = existingStart + (m.duration || 0)
      return (meetingStart < existingEnd && meetingEnd > existingStart)
    }) || null
  }

  function checkAppointmentConflict(appointment: Partial<Appointment>, excludeId?: string): Appointment | null {
    if (!appointment.startDate || !appointment.startTime) return null
    
    const dayAppointments = appointments.value.filter(a => 
      a.startDate === appointment.startDate && a.id !== excludeId
    )
    
    const apptStart = parseTimeToMinutes(appointment.startTime)
    const apptEnd = apptStart + (appointment.duration || 0)
    
    return dayAppointments.find(a => {
      const existingStart = parseTimeToMinutes(a.startTime || '00:00')
      const existingEnd = existingStart + (a.duration || 0)
      return (apptStart < existingEnd && apptEnd > existingStart)
    }) || null
  }

  return {
    // State
    tasks,
    columns,
    projects,
    meetings,
    appointments,
    taskOrder,
    searchQuery,
    columnFilter,
    labelFilter,
    showOnlyOverdueTasks,
    workSettings,
    timeEntries,
    loaded,
    // Computed
    sortedColumns,
    tasksByStatus,
    activeTasksByStatus,
    filteredTasks,
    sortedTasksByColumn,
    filteredSortedTasksByColumn,
    activeTimerEntry,
    timeEntriesByTaskId,
    finalizedTimeEntriesByTaskId,
    // Actions - Tasks
    getTasksByStatus,
    getColumnByStatus,
    getStatusLabel,
    getTaskTimeSpent,
    loadAppData,
    loadFromStorage,
    addTask,
    updateTask,
    deleteTask,
    permanentlyDeleteTask,
    restoreTask,
    trashedTasks,
    moveTask,
    startTimer,
    stopTimer,
    discardTimer,
    addManualTimeEntry,
    updateTimeEntry,
    deleteTimeEntry,
    isTaskOverdue,
    isTaskCompletedWithDelay,
    // Actions - Columns
    addColumn,
    updateColumn,
    deleteColumn,
    moveColumn,
    // Actions - Reports
    getTasksByDateRange,
    exportTasksToCSV,
    exportProjectsToCSV,
    exportMonthlyProjectReportCSV,
    getMonthlyProjectReport,
    exportMeetingsToCSV,
    downloadReport,
    importTasksFromCSV,
    // Actions - Projects
    addProject,
    updateProject,
    deleteProject,
    // Actions - Meetings
    addMeeting,
    updateMeeting,
    deleteMeeting,
    // Actions - Appointments
    addAppointment,
    addAppointmentTask,
    updateAppointment,
    deleteAppointment,
    deleteLinked,
    restoreLinked,
    getAppointmentsByDate,
    getAppointmentsByDateRange,
    // Actions - Task Order
    reorderTasksInColumn,
    // Actions - Search & Filter
    setSearchQuery,
    setColumnFilter,
    setLabelFilter,
    setShowOnlyOverdueTasks,
    // Actions - Work Settings
    updateWorkSettings,
    // Actions - Recurrence
    processRecurringTasks,
    // Actions - Conflict Detection
    checkMeetingConflict,
    checkAppointmentConflict,
    // Actions - Undo System
    actionHistory,
    undoLastAction,
    canUndo,
    clearHistory,
    queueSave
  }
})
