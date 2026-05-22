import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useTaskStore } from '@/stores/taskStore'
import type { AppData } from '@/shared/appData'
import type { Task } from '@/types/Task'

function createBaseData(): AppData {
  return {
    schemaVersion: 3,
    columns: [],
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

function createRecurringCompletedTask(overrides?: Partial<Task>): Task {
  const nowIso = '2026-01-05T10:00:00.000Z'
  return {
    id: 'task-rec-1',
    title: 'Recorrente',
    description: '',
    status: 'done',
    date: '2026-01-05',
    timeSpent: 0,
    project: '',
    isRecurring: true,
    recurrence: { type: 'daily' },
    recurrenceState: {
      seriesId: 'task-rec-1',
      occurrenceNumber: 1,
      generatedAt: nowIso
    },
    completedAt: '2026-01-05T10:00:00.000Z',
    deletedAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
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

describe('TaskStore - recorrência temporal', () => {
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

  it('diária: só gera após meia-noite do dia seguinte', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Diária',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 45,
      project: 'Projeto Teste',
      isRecurring: true,
      recurrence: { type: 'daily' }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    expect(store.tasks).toHaveLength(1)

    vi.setSystemTime(new Date(2026, 0, 16, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.filter(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated).toHaveLength(1)
    expect(generated[0].date).toBe('2026-01-16')
  })

  it('semanal: usa fallback [1..5] quando workDays vazio/inválido', async () => {
    vi.setSystemTime(new Date(2026, 0, 5, 9, 0, 0)) // segunda
    const store = useTaskStore()
    await store.updateWorkSettings({ workDays: [] })

    await store.addTask({
      title: 'Semanal fallback',
      description: '',
      status: 'backlog',
      date: '2026-01-05',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'weekly' }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })
    expect(store.tasks).toHaveLength(1)

    vi.setSystemTime(new Date(2026, 0, 12, 0, 1, 0)) // segunda da semana seguinte
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-01-12')
  })

  it('semanal: usa workDays custom para 1º dia útil da próxima semana', async () => {
    vi.setSystemTime(new Date(2026, 0, 9, 10, 0, 0)) // sexta
    const store = useTaskStore()
    await store.updateWorkSettings({ workDays: [3, 4] }) // quarta/quinta

    await store.addTask({
      title: 'Semanal custom',
      description: '',
      status: 'backlog',
      date: '2026-01-09',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'weekly' }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })
    expect(store.tasks).toHaveLength(1)

    vi.setSystemTime(new Date(2026, 0, 14, 0, 1, 0)) // quarta da próxima semana
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-01-14')
  })

  it('mensal: gera no primeiro dia do mês seguinte', async () => {
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Mensal',
      description: '',
      status: 'backlog',
      date: '2026-01-31',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'monthly' }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })
    expect(store.tasks).toHaveLength(1)

    vi.setSystemTime(new Date(2026, 1, 1, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-01')
  })

  it('mensal fixed_day: gera no dia fixo do mês seguinte', async () => {
    vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Mensal dia 20',
      description: '',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: {
        type: 'monthly',
        monthlyMode: 'fixed_day',
        dayOfMonth: 20
      }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 20, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-20')
    expect(generated?.recurrenceState?.periodKey).toBe('2026-02')
  })

  it('mensal fixed_day: dia inexistente usa último dia do mês', async () => {
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Mensal dia 31',
      description: '',
      status: 'backlog',
      date: '2026-01-31',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: {
        type: 'monthly',
        monthlyMode: 'fixed_day',
        dayOfMonth: 31
      }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 28, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-28')
  })

  it('mensal last_day: gera no último dia do mês seguinte', async () => {
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Mensal último dia',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: {
        type: 'monthly',
        monthlyMode: 'last_day'
      }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 28, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-28')
  })

  it('mensal last_workday: respeita workDays com fallback seguro', async () => {
    vi.setSystemTime(new Date(2026, 0, 10, 12, 0, 0))
    const store = useTaskStore()
    await store.updateWorkSettings({ workDays: [1, 2, 3, 4, 5] })

    await store.addTask({
      title: 'Mensal último dia útil',
      description: '',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: {
        type: 'monthly',
        monthlyMode: 'last_workday'
      }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 27, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-27')
  })

  it('mensal copyChecklist copia subtarefas como não concluídas e preserva prazo com horário', async () => {
    vi.setSystemTime(new Date(2026, 0, 31, 12, 0, 0))
    const store = useTaskStore()
    const dueAt = new Date(2026, 0, 31, 16, 45, 0, 0).toISOString()

    await store.addTask({
      title: 'Checklist mensal',
      description: '',
      status: 'backlog',
      date: '2026-01-31',
      dueAt,
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      comments: [
        {
          id: 'c-1',
          text: 'Não copiar comentário',
          authorId: 'user',
          authorName: 'Usuário',
          createdAt: '2026-01-31T00:00:00.000Z'
        }
      ],
      subtasks: [
        { id: 's-1', title: 'Executar etapa A', completed: true },
        { id: 's-2', title: 'Executar etapa B', completed: false }
      ],
      isRecurring: true,
      recurrence: {
        type: 'monthly',
        monthlyMode: 'first_day',
        copyChecklist: true
      }
    })

    const originalTask = store.tasks[0]
    await store.updateTask(originalTask.id, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 1, 0, 1, 0))
    await store.updateTask(originalTask.id, { description: 'tick' })

    const generated = store.tasks.find(task => task.recurrenceState?.sourceTaskId === originalTask.id)
    expect(generated?.date).toBe('2026-02-01')
    expect(generated?.comments).toBeUndefined()
    expect(generated?.subtasks).toHaveLength(2)
    expect(generated?.subtasks?.every(subtask => subtask.completed === false)).toBe(true)
    expect(generated?.subtasks?.map(subtask => subtask.title)).toEqual([
      'Executar etapa A',
      'Executar etapa B'
    ])
    expect(generated?.subtasks?.map(subtask => subtask.id)).not.toEqual(['s-1', 's-2'])
    expect(generated?.dueHasTime).toBe(true)
    expect(generated?.dueAt).toBeTruthy()
    const generatedDueAt = new Date(generated!.dueAt!)
    expect(generatedDueAt.getHours()).toBe(16)
    expect(generatedDueAt.getMinutes()).toBe(45)
  })

  it('mensal: idempotência por seriesId + periodKey evita duplicação', async () => {
    const store = useTaskStore()
    const persisted = createBaseData()
    persisted.tasks = [
      {
        id: 'template-monthly',
        title: 'Template mensal',
        description: '',
        status: 'done',
        date: '2026-01-15',
        timeSpent: 0,
        project: '',
        isRecurring: true,
        recurrence: { type: 'monthly', monthlyMode: 'first_day' },
        recurrenceState: {
          seriesId: 'series-1',
          occurrenceNumber: 1,
          generatedAt: '2026-01-15T10:00:00.000Z'
        },
        completedAt: '2026-01-15T10:00:00.000Z',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      },
      {
        id: 'existing-period',
        title: 'Ocorrência já existente',
        description: '',
        status: 'backlog',
        date: '2026-02-01',
        timeSpent: 0,
        project: '',
        isRecurring: true,
        recurrence: { type: 'monthly', monthlyMode: 'first_day' },
        recurrenceState: {
          seriesId: 'series-1',
          occurrenceNumber: 99,
          periodKey: '2026-02',
          generatedAt: '2026-02-01T00:00:00.000Z'
        },
        createdAt: '2026-02-01T00:00:00.000Z',
        updatedAt: '2026-02-01T00:00:00.000Z'
      }
    ]
    await store.loadFromStorage(persisted)

    vi.setSystemTime(new Date(2026, 1, 1, 0, 1, 0))
    await store.processRecurringTasks()

    const seriesTasks = store.tasks.filter(task => task.recurrenceState?.seriesId === 'series-1')
    expect(seriesTasks).toHaveLength(2)
  })

  it('mantém idempotência ao reprocessar elegíveis', async () => {
    vi.setSystemTime(new Date(2026, 1, 1, 10, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Recorrente idempotente',
      description: '',
      status: 'backlog',
      date: '2026-02-01',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'daily' }
    })

    const taskId = store.tasks[0].id
    await store.updateTask(taskId, { status: 'done' })

    vi.setSystemTime(new Date(2026, 1, 2, 0, 1, 0))
    await store.updateTask(taskId, { description: 'tick-1' })
    await store.updateTask(taskId, { description: 'tick-2' })

    const generated = store.tasks.filter(task => task.recurrenceState?.sourceTaskId === taskId)
    expect(generated).toHaveLength(1)
  })

  it('recovery no load/startup: reprocessa recorrentes elegíveis pendentes', async () => {
    vi.setSystemTime(new Date(2026, 0, 16, 9, 0, 0))

    const data = createBaseData()
    data.tasks = [
      createRecurringCompletedTask({
        id: 'daily-pending-1',
        title: 'Daily pendente',
        recurrence: { type: 'daily' },
        recurrenceState: {
          seriesId: 'daily-pending-1',
          occurrenceNumber: 1,
          generatedAt: '2026-01-15T10:00:00.000Z'
        },
        completedAt: '2026-01-15T10:00:00.000Z',
        createdAt: '2026-01-15T10:00:00.000Z',
        updatedAt: '2026-01-15T10:00:00.000Z'
      })
    ]

    mockStorage.load.mockImplementation(async () => data)

    const store = useTaskStore()
    await store.loadAppData()

    const generated = store.tasks.filter(task => task.recurrenceState?.sourceTaskId === 'daily-pending-1')
    expect(generated).toHaveLength(1)
    expect(generated[0].date).toBe('2026-01-16')
  })
})

describe('TaskStore - prazo e atraso', () => {
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

  it('now === dueAt não marca atraso (regra estrita)', async () => {
    const exactDeadline = new Date(2026, 0, 20, 14, 30, 0, 0)
    vi.setSystemTime(exactDeadline)
    const store = useTaskStore()

    await store.addTask({
      title: 'Entrega exata',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: exactDeadline.toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    expect(store.isTaskOverdue(store.tasks[0], exactDeadline)).toBe(false)
  })

  it('now > dueAt marca atraso', async () => {
    const now = new Date(2026, 0, 20, 14, 31, 0, 0)
    vi.setSystemTime(now)
    const store = useTaskStore()

    await store.addTask({
      title: 'Entrega atrasada',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 30, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    expect(store.isTaskOverdue(store.tasks[0], now)).toBe(true)
  })

  it('prazo date-only considera fim do dia local', async () => {
    const store = useTaskStore()

    await store.addTask({
      title: 'Prazo sem horário',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: '2026-01-20',
      dueHasTime: false,
      timeSpent: 0,
      project: ''
    })

    const task = store.tasks[0]
    const endOfDay = new Date(2026, 0, 20, 23, 59, 59, 999)
    const afterEnd = new Date(2026, 0, 21, 0, 0, 0, 0)

    expect(store.isTaskOverdue(task, endOfDay)).toBe(false)
    expect(store.isTaskOverdue(task, afterEnd)).toBe(true)
  })

  it('prazo datetime respeita horário específico', async () => {
    const store = useTaskStore()
    const dueAt = new Date(2026, 0, 22, 18, 45, 0, 0)

    await store.addTask({
      title: 'Prazo com horário',
      description: '',
      status: 'backlog',
      date: '2026-01-22',
      dueAt: dueAt.toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    const task = store.tasks[0]
    expect(store.isTaskOverdue(task, new Date(2026, 0, 22, 18, 45, 0, 0))).toBe(false)
    expect(store.isTaskOverdue(task, new Date(2026, 0, 22, 18, 45, 0, 1))).toBe(true)
  })

  it('conclusão no prazo vs conclusão com atraso', async () => {
    const store = useTaskStore()

    const dueOnTime = new Date(2026, 0, 23, 17, 0, 0, 0)
    await store.addTask({
      title: 'Concluir no prazo',
      description: '',
      status: 'backlog',
      date: '2026-01-23',
      dueAt: dueOnTime.toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    vi.setSystemTime(new Date(2026, 0, 23, 16, 59, 0, 0))
    await store.updateTask(store.tasks[0].id, { status: 'done' })
    expect(store.tasks[0].completedWithDelay).toBe(false)

    const dueLate = new Date(2026, 0, 24, 10, 0, 0, 0)
    await store.addTask({
      title: 'Concluir com atraso',
      description: '',
      status: 'backlog',
      date: '2026-01-24',
      dueAt: dueLate.toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    vi.setSystemTime(new Date(2026, 0, 24, 10, 0, 0, 1))
    await store.updateTask(store.tasks[1].id, { status: 'done' })
    expect(store.tasks[1].completedWithDelay).toBe(true)
    expect(store.isTaskCompletedWithDelay(store.tasks[1])).toBe(true)
  })

  it('reabertura limpa histórico e nova conclusão recalcula atraso', async () => {
    const store = useTaskStore()
    const taskDue = new Date(2026, 0, 25, 10, 0, 0, 0)

    await store.addTask({
      title: 'Reabrir e concluir novamente',
      description: '',
      status: 'backlog',
      date: '2026-01-25',
      dueAt: taskDue.toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    const taskId = store.tasks[0].id

    vi.setSystemTime(new Date(2026, 0, 25, 10, 0, 0, 1))
    await store.updateTask(taskId, { status: 'done' })
    expect(store.tasks[0].completedWithDelay).toBe(true)

    await store.updateTask(taskId, {
      status: 'backlog',
      dueAt: new Date(2026, 0, 25, 12, 0, 0, 0).toISOString(),
      dueHasTime: true
    })
    expect(store.tasks[0].completedWithDelay).toBeNull()

    vi.setSystemTime(new Date(2026, 0, 25, 11, 0, 0, 0))
    await store.updateTask(taskId, { status: 'done' })
    expect(store.tasks[0].completedWithDelay).toBe(false)
  })

  it('compatibilidade: tarefa legada sem prazo continua válida', async () => {
    const store = useTaskStore()
    const legacyData = createBaseData()
    legacyData.schemaVersion = 2
    legacyData.tasks = [
      {
        id: 'legacy-1',
        title: 'Tarefa legada',
        description: '',
        status: 'backlog',
        date: '2026-01-01',
        timeSpent: 0,
        project: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    ]

    await store.loadFromStorage(legacyData)

    expect(store.tasks[0].dueAt).toBeNull()
    expect(store.tasks[0].dueHasTime).toBe(false)
    expect(store.isTaskOverdue(store.tasks[0], new Date(2026, 0, 2, 12, 0, 0, 0))).toBe(false)
  })

  it('preserva flag concluída com atraso após reload em status concluído custom', async () => {
    const store = useTaskStore()
    const persisted = createBaseData()
    persisted.schemaVersion = 3
    persisted.columns = [
      { id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' },
      { id: 'col-2', title: 'Concluído QA', status: 'qa_done', order: 1, color: '#89d185' }
    ]
    persisted.tasks = [
      {
        id: 'task-persisted-late',
        title: 'Tarefa persistida atrasada',
        description: '',
        status: 'qa_done',
        date: '2026-01-30',
        dueAt: '2026-01-30T10:00:00.000Z',
        dueHasTime: true,
        completedAt: '2026-01-30T10:10:00.000Z',
        completedWithDelay: true,
        timeSpent: 0,
        project: '',
        createdAt: '2026-01-30T00:00:00.000Z',
        updatedAt: '2026-01-30T00:00:00.000Z'
      }
    ]

    await store.loadFromStorage(persisted)

    expect(store.tasks[0].completedWithDelay).toBe(true)
    expect(store.isTaskCompletedWithDelay(store.tasks[0])).toBe(true)
  })
})

describe('TaskStore - busca e filtro', () => {
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

  it('encontra tarefa pelo nome da etiqueta (case-insensitive)', async () => {
    const store = useTaskStore()

    await store.addTask({
      title: 'Relatório mensal',
      description: 'Gerar relatório',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: 'Contabilidade',
      labels: [{ id: 'lbl-1', name: 'Financeiro', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Reunião de planejamento',
      description: 'Alinhar próximos passos',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: 'Geral',
      labels: [{ id: 'lbl-2', name: 'RH', color: '#00ff00' }]
    })

    store.setSearchQuery('financeiro')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Relatório mensal')
  })

  it('busca por etiqueta mantém busca por título/descricão/projeto', async () => {
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa alpha',
      description: 'Descrição beta',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: 'Projeto gamma',
      labels: [{ id: 'lbl-3', name: 'Delta', color: '#0000ff' }]
    })

    store.setSearchQuery('alpha')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('beta')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('gamma')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('delta')
    expect(store.filteredTasks).toHaveLength(1)
  })

  it('não inclui tarefas deletadas na busca por etiqueta', async () => {
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa deletada',
      description: '',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-4', name: 'Urgente', color: '#ff0000' }]
    })

    const taskId = store.tasks[0].id
    await store.deleteTask(taskId)

    store.setSearchQuery('urgente')

    expect(store.filteredTasks).toHaveLength(0)
  })
})

describe('TaskStore - filtro de tarefas atrasadas', () => {
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

  it('filtro ativo retorna apenas tarefas não deletadas e atrasadas', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa atrasada',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Tarefa no prazo',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Tarefa deletada atrasada',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 8, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.deleteTask(store.tasks[2].id)

    store.setShowOnlyOverdueTasks(true)

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Tarefa atrasada')
  })

  it('filtro desativado preserva tarefas ativas atrasadas e não atrasadas', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa atrasada',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: '2026-01-20T10:00:00.000Z',
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Tarefa no prazo',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: '2026-01-20T14:00:00.000Z',
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    store.setShowOnlyOverdueTasks(false)

    expect(store.filteredTasks).toHaveLength(2)
  })

  it('combina com busca textual', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Relatório atrasado',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Reunião atrasada',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Relatório no prazo',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    store.setShowOnlyOverdueTasks(true)
    store.setSearchQuery('relatório')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Relatório atrasado')
  })

  it('combina com filtro de coluna', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa atrasada backlog',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Tarefa atrasada doing',
      description: '',
      status: 'doing',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    store.setShowOnlyOverdueTasks(true)
    store.setColumnFilter('backlog')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Tarefa atrasada backlog')
  })

  it('combina com filtro de label', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa atrasada com label',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Tarefa atrasada sem label',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    await store.addTask({
      title: 'Tarefa no prazo com label',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    store.setShowOnlyOverdueTasks(true)
    store.setLabelFilter('Urgente')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Tarefa atrasada com label')
  })

  it('tarefas concluídas não aparecem como atrasadas', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Tarefa concluída com prazo passado',
      description: '',
      status: 'done',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: ''
    })

    store.setShowOnlyOverdueTasks(true)

    expect(store.filteredTasks).toHaveLength(0)
  })

  it('combina todos os filtros simultaneamente', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Relatório atrasado backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Reunião atrasada backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Relatório atrasado doing urgente',
      description: '',
      status: 'doing',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Relatório no prazo backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    store.setShowOnlyOverdueTasks(true)
    store.setSearchQuery('relatório')
    store.setColumnFilter('backlog')
    store.setLabelFilter('Urgente')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Relatório atrasado backlog urgente')
  })

  it('busca textual encontra branch, ambiente, URLs e motivo de bloqueio', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Refatorar tela',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      timeSpent: 0,
      project: '',
      developerMetadata: {
        branchName: 'feature/m4-dev-fields',
        environment: 'homologacao',
        pullRequestUrl: 'https://git.local/pr/42',
        issueUrl: 'https://jira.local/TASK-42',
        blockedReason: 'Aguardando revisão do backend'
      }
    })

    store.setSearchQuery('feature/m4-dev-fields')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('homologacao')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('git.local/pr/42')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('jira.local/TASK-42')
    expect(store.filteredTasks).toHaveLength(1)

    store.setSearchQuery('revisão do backend')
    expect(store.filteredTasks).toHaveLength(1)
  })
})

describe('TaskStore - exportação CSV', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
    mockStorage.exportCSV.mockReset()
    mockStorage.exportCSV.mockImplementation(async () => true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('exporta tarefas no período e exclui deletadas', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa ativa',
      description: 'Desc',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 60,
      project: 'Proj A'
    })
    await store.addTask({
      title: 'Tarefa deletada',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    await store.deleteTask(store.tasks[1].id)

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain('Tarefa ativa')
    expect(csv).not.toContain('Tarefa deletada')
  })

  it('inclui colunas técnicas na exportação detalhada de tarefas', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Ajustar endpoint de auth',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: 'API',
      developerMetadata: {
        reviewStatus: 'pending',
        branchName: 'feature/auth-m4',
        pullRequestUrl: 'https://git.local/pr/99',
        issueUrl: 'https://jira.local/AUTH-99',
        environment: 'dev',
        estimateMinutes: 120
      }
    })

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain('Review,Branch,PR,Issue,Ambiente,Estimativa (min)')
    expect(csv).toContain('pending')
    expect(csv).toContain('feature/auth-m4')
    expect(csv).toContain('https://git.local/pr/99')
    expect(csv).toContain('https://jira.local/AUTH-99')
    expect(csv).toContain('dev')
    expect(csv).toContain('120')
  })

  it('exporta reuniões no período', async () => {
    const store = useTaskStore()
    await store.addMeeting({
      title: 'Reunião A',
      date: '2026-01-15',
      time: '10:00',
      duration: 60,
      projectId: '',
      description: '',
      attendees: []
    })
    await store.addMeeting({
      title: 'Reunião B',
      date: '2026-02-01',
      time: '14:00',
      duration: 30,
      projectId: '',
      description: '',
      attendees: []
    })

    const csv = store.exportMeetingsToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain('Reunião A')
    expect(csv).not.toContain('Reunião B')
  })

  it('exporta projetos ignorando datas', async () => {
    const store = useTaskStore()
    await store.addProject({
      name: 'Projeto Alpha',
      client: 'Cliente A',
      color: '#ff0000'
    })

    const csv = store.exportProjectsToCSV()
    expect(csv).toContain('Projeto Alpha')
    expect(csv).toContain('Cliente A')
  })

  it('nome do arquivo reflete tipo e período', async () => {
    const store = useTaskStore()
    await store.downloadReport('tasks', '2026-01-01', '2026-01-31')
    expect(mockStorage.exportCSV).toHaveBeenCalledWith(
      expect.stringContaining('Tarefa'),
      'tarefas_2026-01-01_a_2026-01-31.csv'
    )

    await store.downloadReport('meetings', '2026-01-01', '2026-01-31')
    expect(mockStorage.exportCSV).toHaveBeenCalledWith(
      expect.any(String),
      'reunioes_2026-01-01_a_2026-01-31.csv'
    )

    await store.downloadReport('projects')
    expect(mockStorage.exportCSV).toHaveBeenCalledWith(
      expect.any(String),
      'projetos.csv'
    )

    await store.downloadReport('monthly_projects', '2026-01')
    expect(mockStorage.exportCSV).toHaveBeenCalledWith(
      expect.stringContaining('mês,projeto,cliente,total de horas'),
      'projetos_consolidado_2026-01.csv'
    )
  })

  it('campos CSV escapam aspas, vírgulas e quebras de linha', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa com "aspas"',
      description: 'Linha 1\nLinha 2',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: 'Proj, A'
    })

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain('"Tarefa com ""aspas"""')
    expect(csv).toContain('"Linha 1\nLinha 2"')
    expect(csv).toContain('"Proj, A"')
  })

  it('campos CSV mitigam injeção de fórmula com prefixos perigosos', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: '=SUM(A1:A10)',
      description: '+cmd',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: '-test'
    })
    await store.addTask({
      title: '@user',
      description: '\tsecret',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: '\rcmd'
    })

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).toContain("'=SUM(A1:A10)")
    expect(csv).toContain("'+cmd")
    expect(csv).toContain("'-test")
    expect(csv).toContain("'@user")
    expect(csv).toContain("'\tsecret")
    expect(csv).toContain("'\rcmd")
  })

  it('falha de exportação mostra erro seguro em português e loga contexto', async () => {
    const store = useTaskStore()
    mockStorage.exportCSV.mockRejectedValue(new Error('Disk full'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    await expect(store.downloadReport('tasks', '2026-01-01', '2026-01-31')).rejects.toThrow('Falha ao exportar relatório')
    expect(consoleSpy).toHaveBeenCalledWith(
      'Erro técnico ao exportar relatório:',
      expect.objectContaining({
        type: 'tasks',
        period: { startDate: '2026-01-01', endDate: '2026-01-31' },
        environment: expect.stringMatching(/^(electron|browser)$/),
        error: expect.objectContaining({ message: 'Disk full' })
      })
    )

    consoleSpy.mockRestore()
  })
})

describe('TaskStore - filtro por label', () => {
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

  it('label padrão encontra tarefa pela nome da label (case-insensitive)', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    store.setLabelFilter('Urgente')
    expect(store.filteredTasks).toHaveLength(1)

    store.setLabelFilter('urgente')
    expect(store.filteredTasks).toHaveLength(1)
  })

  it('label customizada funciona por nome', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa custom',
      description: '',
      status: 'backlog',
      date: '2026-01-10',
      timeSpent: 0,
      project: '',
      labels: [{ id: 'custom-1', name: 'CustomLabel', color: '#00ff00' }]
    })

    store.setLabelFilter('CustomLabel')
    expect(store.filteredTasks).toHaveLength(1)
  })

  it('label filter intersecta com busca, coluna e atrasadas', async () => {
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Relatório atrasado backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Reunião atrasada backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Relatório atrasado doing urgente',
      description: '',
      status: 'doing',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 10, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    await store.addTask({
      title: 'Relatório no prazo backlog urgente',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      dueAt: new Date(2026, 0, 20, 14, 0, 0, 0).toISOString(),
      dueHasTime: true,
      timeSpent: 0,
      project: '',
      labels: [{ id: 'lbl-1', name: 'Urgente', color: '#ff0000' }]
    })

    store.setShowOnlyOverdueTasks(true)
    store.setSearchQuery('relatório')
    store.setColumnFilter('backlog')
    store.setLabelFilter('Urgente')

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.filteredTasks[0].title).toBe('Relatório atrasado backlog urgente')
  })
})

describe('TaskStore - lixeira, restore e undo', () => {
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

  it('tarefas deletadas não aparecem em views ativas nem relatórios', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa ativa',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    await store.addTask({
      title: 'Tarefa deletada',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    await store.deleteTask(store.tasks[1].id)

    expect(store.filteredTasks).toHaveLength(1)
    expect(store.activeTasksByStatus['backlog']).toHaveLength(1)
    expect(store.trashedTasks).toHaveLength(1)

    const csv = store.exportTasksToCSV('2026-01-01', '2026-01-31')
    expect(csv).not.toContain('Tarefa deletada')
  })

  it('restore reativa tarefa sem duplicar posição no quadro', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    const taskId = store.tasks[0].id
    store.reorderTasksInColumn('backlog', [taskId])

    await store.deleteTask(taskId)
    expect(store.taskOrder['backlog']).toHaveLength(0)

    await store.restoreTask(taskId)
    expect(store.tasks.find(t => t.id === taskId)?.deletedAt).toBeNull()
    expect(store.taskOrder['backlog']).toHaveLength(1)
    expect(store.taskOrder['backlog']).toEqual([taskId])

    // Restore again should not duplicate
    await store.restoreTask(taskId)
    expect(store.taskOrder['backlog']).toHaveLength(1)
  })

  it('undo delete restaura tarefa sem criar histórico incoerente', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa para undo',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    const taskId = store.tasks[0].id
    const historyBeforeDelete = store.actionHistory.length

    await store.deleteTask(taskId)
    expect(store.actionHistory.length).toBe(historyBeforeDelete + 1)
    expect(store.actionHistory[0].type).toBe('delete')

    await store.undoLastAction()
    expect(store.tasks.find(t => t.id === taskId)?.deletedAt).toBeNull()
    // Undo should consume the history entry, not add a restore entry
    expect(store.actionHistory.length).toBe(historyBeforeDelete)
  })

  it('undo restore reenvia para lixeira sem duplicar task order', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa para undo restore',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    const taskId = store.tasks[0].id
    store.reorderTasksInColumn('backlog', [taskId])

    await store.deleteTask(taskId)
    await store.restoreTask(taskId)
    expect(store.taskOrder['backlog']).toHaveLength(1)

    await store.undoLastAction()
    expect(store.tasks.find(t => t.id === taskId)?.deletedAt).not.toBeNull()
    expect(store.taskOrder['backlog']).toHaveLength(0)
  })

  it('histórico respeita limite MAX_HISTORY', async () => {
    const store = useTaskStore()
    for (let i = 0; i < 15; i++) {
      await store.addTask({
        title: `Tarefa ${i}`,
        description: '',
        status: 'backlog',
        date: '2026-01-15',
        timeSpent: 0,
        project: ''
      })
      await store.deleteTask(store.tasks[store.tasks.length - 1].id)
    }
    expect(store.actionHistory.length).toBe(10)
  })

  it('permanent delete não cria entrada no histórico de undo', async () => {
    const store = useTaskStore()
    await store.addTask({
      title: 'Tarefa para exclusão permanente',
      description: '',
      status: 'backlog',
      date: '2026-01-15',
      timeSpent: 0,
      project: ''
    })
    const taskId = store.tasks[0].id
    const historyBefore = store.actionHistory.length

    await store.permanentlyDeleteTask(taskId)
    expect(store.tasks.find(t => t.id === taskId)).toBeUndefined()
    expect(store.actionHistory.length).toBe(historyBefore)
  })
})

describe('TaskStore - recorrência e lixeira', () => {
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

  it('tarefa recorrente deletada não gera próxima ocorrência', async () => {
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Recorrente diária',
      description: '',
      status: 'backlog',
      date: '2026-01-05',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'daily' }
    })

    const taskId = store.tasks[0].id
    await store.updateTask(taskId, { status: 'done' })
    expect(store.tasks).toHaveLength(1)

    await store.deleteTask(taskId)
    vi.setSystemTime(new Date(2026, 0, 6, 0, 1, 0))
    await store.processRecurringTasks()

    expect(store.tasks).toHaveLength(1)
  })

  it('após restore e undo, tarefa deletada continua excluída da recorrência', async () => {
    vi.setSystemTime(new Date(2026, 0, 5, 10, 0, 0))
    const store = useTaskStore()

    await store.addTask({
      title: 'Recorrente semanal',
      description: '',
      status: 'backlog',
      date: '2026-01-05',
      timeSpent: 0,
      project: '',
      isRecurring: true,
      recurrence: { type: 'weekly' }
    })

    const taskId = store.tasks[0].id
    await store.updateTask(taskId, { status: 'done' })
    await store.deleteTask(taskId)

    // Restore
    await store.restoreTask(taskId)
    expect(store.tasks.find(t => t.id === taskId)?.deletedAt).toBeNull()

    // Undo restore (should re-delete)
    await store.undoLastAction()
    expect(store.tasks.find(t => t.id === taskId)?.deletedAt).not.toBeNull()

    // Try to generate recurrence
    vi.setSystemTime(new Date(2026, 0, 12, 0, 1, 0))
    await store.processRecurringTasks()

    expect(store.tasks).toHaveLength(1)
  })
})

describe('TaskStore - appointment task linking', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addAppointment cria appointment e task vinculada', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointment({
      title: 'Consulta médica',
      description: 'Checkup anual',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
      projectId: undefined,
    })

    expect(store.appointments).toHaveLength(1)
    const appt = store.appointments[0]
    expect(appt.title).toBe('Consulta médica')
    expect(appt.startDate).toBe('2026-01-20')
    expect(appt.duration).toBe(60)

    // Verificar task vinculada
    expect(store.tasks).toHaveLength(1)
    const task = store.tasks[0]
    expect(task.type).toBe('appointment')
    expect(task.appointmentId).toBe(appt.id)
    expect(task.title).toBe('Consulta médica')
    expect(task.description).toBe('Checkup anual')
    expect(task.dueAt).toBe('2026-01-20')
    expect(task.status).toBe('backlog')

    // Verificar link bidirecional
    expect(appt.taskId).toBe(task.id)
  })

  it('addAppointmentTask cria task tipo appointment e appointment vinculado', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointmentTask({
      title: 'Reunião projeto',
      description: 'Alinhamento semanal',
      status: 'backlog',
      date: '2026-01-22',
      timeSpent: 0,
      project: '',
      startDate: '2026-01-22',
      startTime: '10:00',
      duration: 30,
    })

    expect(store.tasks).toHaveLength(1)
    const task = store.tasks[0]
    expect(task.type).toBe('appointment')
    expect(task.title).toBe('Reunião projeto')
    expect(task.date).toBe('2026-01-22')

    expect(store.appointments).toHaveLength(1)
    const appt = store.appointments[0]
    expect(appt.taskId).toBe(task.id)
    expect(appt.title).toBe('Reunião projeto')
    expect(appt.startDate).toBe('2026-01-22')
    expect(appt.duration).toBe(30)
  })

  it('updateAppointment propaga title e description para task vinculada', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointment({
      title: 'Original',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.updateAppointment(apptId, {
      title: 'Alterado',
      description: 'Nova descrição',
    })

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.title).toBe('Alterado')
    expect(task?.description).toBe('Nova descrição')
  })

  it('updateAppointment propaga startDate para dueAt da task', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointment({
      title: 'Data',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.updateAppointment(apptId, {
      startDate: '2026-02-15',
      startTime: '16:30',
    })

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.dueAt).toBe('2026-02-15')
  })

  it('updateTask tipo appointment propaga title para appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointment({
      title: 'Original',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const task = store.tasks[0]
    await store.updateTask(task.id, { title: 'Task alterada' })

    const appt = store.appointments.find(a => a.taskId === task.id)
    expect(appt?.title).toBe('Task alterada')
  })

  it('updateTask tipo appointment propaga dueAt para startDate do appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addAppointment({
      title: 'Data',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const task = store.tasks[0]
    await store.updateTask(task.id, { dueAt: '2026-03-10' })

    const appt = store.appointments.find(a => a.taskId === task.id)
    expect(appt?.startDate).toBe('2026-03-10')
  })

  it('updateTask NÃO propaga para appointment se task.type !== appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage(createBaseData())

    await store.addTask({
      title: 'Task normal',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      timeSpent: 0,
      project: '',
    })
    store.appointments.push({
      id: 'a-standalone',
      title: 'Standalone',
      startDate: '2026-01-20',
      startTime: '10:00',
      duration: 30,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    await store.updateTask(store.tasks[0].id, { title: 'Mudou' })

    const appt = store.appointments.find(a => a.id === 'a-standalone')
    expect(appt?.title).toBe('Standalone')
  })
})
