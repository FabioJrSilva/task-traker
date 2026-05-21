import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '@/stores/taskStore'
import type { AppData } from '@/shared/appData'
import type { Task } from '@/types/Task'
import type { TimeEntry } from '@/types/TimeEntry'
import { migrateAppData, CURRENT_SCHEMA_VERSION } from '@/shared/appData'

function createBaseData(): AppData {
  return {
    schemaVersion: 3,
    columns: [
      { id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' },
      { id: 'col-2', title: 'Em Andamento', status: 'in_progress', order: 1, color: '#dcdcaa' },
      { id: 'col-3', title: 'Concluído', status: 'done', order: 2, color: '#89d185' }
    ],
    tasks: [],
    projects: [],
    meetings: [],
    appointments: [],
    taskOrder: {},
    workSettings: {
      workStartTime: '08:00',
      workEndTime: '18:00',
      workDays: [1, 2, 3, 4, 5]
    },
    actionHistory: [],
    labelFilter: null
  }
}

function createTask(overrides?: Partial<Task>): Task {
  const now = new Date().toISOString()
  return {
    id: 'task-1',
    title: 'Tarefa Teste',
    description: '',
    status: 'backlog',
    date: '2026-01-15',
    timeSpent: 0,
    project: 'Projeto A',
    projectId: 'proj-1',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides
  }
}

const mockStorage = vi.hoisted(() => ({
  load: vi.fn(async () => createBaseData()),
  save: vi.fn(async () => undefined),
  exportCSV: vi.fn(async () => true)
}))

vi.mock('@/utils/storage', () => ({
  getStorage: () => mockStorage
}))

describe('TimeEntry - AppData migration', () => {
  beforeEach(() => {
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  it('migrates v3 to schema atual com timeEntries array', () => {
    const data = createBaseData()
    data.tasks = [createTask({ timeSpent: 120 })]

    const migrated = migrateAppData(data)

    expect(migrated.schemaVersion).toBe(CURRENT_SCHEMA_VERSION)
    expect(migrated.timeEntries).toBeDefined()
    expect(Array.isArray(migrated.timeEntries)).toBe(true)
  })

  it('creates synthetic migration entry for tasks with timeSpent > 0', () => {
    const data = createBaseData()
    data.tasks = [
      createTask({ id: 'task-1', timeSpent: 120, completedAt: '2026-01-15T10:00:00.000Z' })
    ]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries).toHaveLength(1)
    const entry = migrated.timeEntries![0]
    expect(entry.taskId).toBe('task-1')
    expect(entry.durationMinutes).toBe(120)
    expect(entry.source).toBe('migration')
    expect(entry.id).toBe('migration-task-1')
  })

  it('uses completedAt as startedAt for migration when available', () => {
    const data = createBaseData()
    data.tasks = [
      createTask({
        id: 'task-1',
        timeSpent: 60,
        completedAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T12:00:00.000Z',
        createdAt: '2026-01-15T08:00:00.000Z'
      })
    ]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries![0].startedAt).toBe('2026-01-15T10:00:00.000Z')
  })

  it('falls back to updatedAt then createdAt for migration startedAt', () => {
    const data = createBaseData()
    data.tasks = [
      createTask({
        id: 'task-1',
        timeSpent: 60,
        completedAt: null,
        updatedAt: '2026-01-15T12:00:00.000Z',
        createdAt: '2026-01-15T08:00:00.000Z'
      })
    ]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries![0].startedAt).toBe('2026-01-15T12:00:00.000Z')
  })

  it('does not create migration entry for tasks with timeSpent = 0', () => {
    const data = createBaseData()
    data.tasks = [createTask({ timeSpent: 0 })]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries).toHaveLength(0)
  })

  it('migration is idempotent - does not duplicate entries', () => {
    const data = createBaseData()
    data.tasks = [createTask({ id: 'task-1', timeSpent: 60 })]

    const first = migrateAppData(data)
    first.schemaVersion = 3 // simulate loading again

    const second = migrateAppData(first)

    expect(second.timeEntries).toHaveLength(1)
    expect(second.timeEntries![0].durationMinutes).toBe(60)
  })

  it('normalizes invalid timeEntries from restored data', () => {
    const data = createBaseData()
    data.schemaVersion = 4
    ;(data as any).timeEntries = [
      {
        id: 'valid-entry',
        taskId: 'task-1',
        startedAt: '2026-01-15T10:00:00.000Z',
        endedAt: '2026-01-15T11:00:00.000Z',
        durationMinutes: 60,
        source: 'manual',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      },
      {
        id: 'invalid-entry',
        taskId: 'task-1',
        startedAt: 'invalid-date',
        source: 'manual'
      },
      {
        id: 'missing-taskId',
        startedAt: '2026-01-15T10:00:00.000Z',
        source: 'manual'
      },
      'not-an-object',
      null
    ]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries).toHaveLength(1)
    expect(migrated.timeEntries![0].id).toBe('valid-entry')
  })

  it('preserves a single open timer entry from restored data', () => {
    const data = createBaseData()
    data.schemaVersion = 4
    ;(data as any).timeEntries = [
      {
        id: 'open-timer',
        taskId: 'task-1',
        startedAt: '2026-01-15T10:00:00.000Z',
        endedAt: null,
        source: 'timer',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      }
    ]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries).toHaveLength(1)
    expect(migrated.timeEntries![0].id).toBe('open-timer')
    expect(migrated.timeEntries![0].endedAt).toBeNull()
    expect(migrated.timeEntries![0].durationMinutes).toBeUndefined()
  })

  it('preserves existing finalized timeEntries during migration', () => {
    const data = createBaseData()
    data.schemaVersion = 4
    ;(data as any).timeEntries = [
      {
        id: 'existing-entry',
        taskId: 'task-1',
        startedAt: '2026-01-15T10:00:00.000Z',
        endedAt: '2026-01-15T11:00:00.000Z',
        durationMinutes: 60,
        source: 'manual',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      }
    ]
    data.tasks = [createTask({ id: 'task-1', timeSpent: 30 })]

    const migrated = migrateAppData(data)

    expect(migrated.timeEntries).toHaveLength(2)
    const existing = migrated.timeEntries!.find(e => e.id === 'existing-entry')
    expect(existing).toBeDefined()
    const synthetic = migrated.timeEntries!.find(e => e.source === 'migration')
    expect(synthetic).toBeDefined()
  })
})

describe('TimeEntry - store actions', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts timer and creates open entry', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    const entry = store.startTimer(taskId)

    expect(entry).toBeDefined()
    expect(entry.source).toBe('timer')
    expect(entry.endedAt).toBeNull()
    expect(entry.durationMinutes).toBeUndefined()
    expect(store.activeTimerEntry).toBeDefined()
    expect(store.activeTimerEntry?.taskId).toBe(taskId)
  })

  it('blocks starting timer on another task while active', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1' }))
    await store.addTask(createTask({ id: 'task-2', title: 'Outra' }))

    store.startTimer('task-1')

    expect(() => store.startTimer('task-2')).toThrow('Já existe um timer ativo')
  })

  it('blocks starting timer on trashed task', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1', deletedAt: '2026-01-15T10:00:00.000Z' }))

    expect(() => store.startTimer('task-1')).toThrow('Tarefa na lixeira')
  })

  it('stops timer and finalizes entry with duration', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    store.startTimer(taskId)

    vi.setSystemTime(new Date(2026, 0, 15, 10, 5, 0))
    const stopped = store.stopTimer()

    expect(stopped).toBeDefined()
    expect(stopped.endedAt).toBeDefined()
    expect(stopped.durationMinutes).toBe(5)
    expect(store.activeTimerEntry).toBeNull()
  })

  it('rounds stopped timer to at least 1 minute', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    store.startTimer(taskId)

    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 30))
    const stopped = store.stopTimer()

    expect(stopped.durationMinutes).toBe(1)
  })

  it('discards active timer', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    store.startTimer(taskId)
    expect(store.activeTimerEntry).toBeDefined()

    store.discardTimer()

    expect(store.activeTimerEntry).toBeNull()
    expect(store.timeEntries).toHaveLength(0)
  })

  it('adds manual time entry', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    const entry = store.addManualTimeEntry(taskId, {
      durationMinutes: 45,
      startedAt: '2026-01-15T10:00:00.000Z',
      note: 'Trabalho da manhã'
    })

    expect(entry).toBeDefined()
    expect(entry.source).toBe('manual')
    expect(entry.durationMinutes).toBe(45)
    expect(entry.note).toBe('Trabalho da manhã')
    expect(store.timeEntries).toHaveLength(1)
  })

  it('updates time entry preserving source', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    const entry = store.addManualTimeEntry(taskId, { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    const updated = store.updateTimeEntry(entry.id, { durationMinutes: 60, note: 'Ajuste' })

    expect(updated.durationMinutes).toBe(60)
    expect(updated.note).toBe('Ajuste')
    expect(updated.source).toBe('manual')
  })

  it('deletes time entry', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    const entry = store.addManualTimeEntry(taskId, { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    store.deleteTimeEntry(entry.id)

    expect(store.timeEntries).toHaveLength(0)
  })

  it('derives task total from finalized entries', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1' }))
    await store.addTask(createTask({ id: 'task-2', title: 'Outra' }))

    store.addManualTimeEntry('task-1', { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    store.addManualTimeEntry('task-1', { durationMinutes: 45, startedAt: '2026-01-15T11:00:00.000Z' })
    store.addManualTimeEntry('task-2', { durationMinutes: 60, startedAt: '2026-01-15T10:00:00.000Z' })

    expect(store.getTaskTimeSpent('task-1')).toBe(75)
    expect(store.getTaskTimeSpent('task-2')).toBe(60)
  })

  it('syncs legacy timeSpent from entries after mutation', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1', timeSpent: 0 }))

    store.addManualTimeEntry('task-1', { durationMinutes: 90, startedAt: '2026-01-15T10:00:00.000Z' })

    const task = store.tasks.find(t => t.id === 'task-1')
    expect(task?.timeSpent).toBe(90)
  })

  it('active timer entry is not included in task total', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    store.addManualTimeEntry(taskId, { durationMinutes: 30, startedAt: '2026-01-15T09:00:00.000Z' })
    store.startTimer(taskId)

    vi.setSystemTime(new Date(2026, 0, 15, 10, 15, 0))

    expect(store.getTaskTimeSpent(taskId)).toBe(30)
  })

  it('persists timeEntries in queueSave', async () => {
    const store = useTaskStore()
    await store.addTask(createTask())
    const taskId = store.tasks[0].id

    store.addManualTimeEntry(taskId, { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    await store.queueSave()

    const saveCalls = mockStorage.save.mock.calls as unknown[][]
    const lastSave = saveCalls[saveCalls.length - 1]?.[0] as AppData | undefined
    if (!lastSave) {
      throw new Error('Nenhum snapshot salvo encontrado')
    }
    expect(lastSave.timeEntries).toBeDefined()
    expect(lastSave.timeEntries).toHaveLength(1)
  })
})

describe('TimeEntry - CSV import', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates time entry from CSV import with time', async () => {
    const store = useTaskStore()
    const csv = `Data,Tarefa,Descrição,Projeto,Status,Tempo
2026-01-15,Tarefa Importada,Desc,Proj A,backlog,1.5`

    store.importTasksFromCSV(csv)

    const task = store.tasks.find(t => t.title === 'Tarefa Importada')
    expect(task).toBeDefined()
    expect(task?.timeSpent).toBe(90)

    const entries = store.timeEntries.filter(e => e.taskId === task?.id)
    expect(entries).toHaveLength(1)
    expect(entries[0].durationMinutes).toBe(90)
    expect(entries[0].source).toBe('manual')
  })

  it('CSV import without time does not create time entry', async () => {
    const store = useTaskStore()
    const csv = `Data,Tarefa,Descrição,Projeto,Status,Tempo
2026-01-15,Tarefa Sem Tempo,Desc,Proj A,backlog,0`

    store.importTasksFromCSV(csv)

    const task = store.tasks.find(t => t.title === 'Tarefa Sem Tempo')
    expect(task).toBeDefined()
    expect(store.timeEntries).toHaveLength(0)
  })
})

describe('TimeEntry - permanent delete', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('removes associated time entries on permanent delete', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1' }))

    store.addManualTimeEntry('task-1', { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    store.addManualTimeEntry('task-1', { durationMinutes: 45, startedAt: '2026-01-15T11:00:00.000Z' })
    expect(store.timeEntries).toHaveLength(2)

    await store.permanentlyDeleteTask('task-1')

    expect(store.timeEntries).toHaveLength(0)
    expect(store.tasks.find(t => t.id === 'task-1')).toBeUndefined()
  })

  it('does not remove time entries on soft delete', async () => {
    const store = useTaskStore()
    await store.addTask(createTask({ id: 'task-1' }))

    store.addManualTimeEntry('task-1', { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })
    expect(store.timeEntries).toHaveLength(1)

    await store.deleteTask('task-1')

    expect(store.timeEntries).toHaveLength(1)
  })
})

describe('TimeEntry - timer reload recovery', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('recovers active timer from persisted state', async () => {
    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
    const data = createBaseData()
    ;(data as any).timeEntries = [
      {
        id: 'timer-1',
        taskId: 'task-1',
        startedAt: '2026-01-15T09:30:00.000Z',
        endedAt: null,
        source: 'timer',
        createdAt: '2026-01-15T09:30:00.000Z',
        updatedAt: '2026-01-15T09:30:00.000Z'
      }
    ]
    data.tasks = [createTask({ id: 'task-1' })]
    mockStorage.load.mockImplementation(async () => data)

    const store = useTaskStore()
    await store.loadAppData()

    expect(store.activeTimerEntry).toBeDefined()
    expect(store.activeTimerEntry?.id).toBe('timer-1')

    vi.setSystemTime(new Date('2026-01-15T10:00:00.000Z'))
    const stopped = store.stopTimer()
    expect(stopped.durationMinutes).toBe(30)
  })
})

describe('TimeEntry - report and export', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('CSV export uses derived time from entries', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa Export',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: 'Proj A'
    })
    const taskId = store.tasks[0].id

    store.addManualTimeEntry(taskId, { durationMinutes: 120, startedAt: '2026-01-15T10:00:00.000Z' })

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain('2.00')
  })

  it('report excludes trashed task time entries', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa Ativa',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: 'Proj A'
    })
    await store.addTask({
      title: 'Tarefa Lixeira',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: 'Proj A'
    })

    const activeId = store.tasks[0].id
    const trashId = store.tasks[1].id

    store.addManualTimeEntry(activeId, { durationMinutes: 60, startedAt: '2026-01-15T10:00:00.000Z' })
    store.addManualTimeEntry(trashId, { durationMinutes: 30, startedAt: '2026-01-15T10:00:00.000Z' })

    await store.deleteTask(trashId)

    const rangeTasks = store.getTasksByDateRange('2026-01-01', '2026-01-31')
    expect(rangeTasks).toHaveLength(1)
    expect(rangeTasks[0].title).toBe('Tarefa Ativa')
  })
})
