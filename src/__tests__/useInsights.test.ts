import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { ref } from 'vue'
import { countWorkingDays, useInsights } from '@/composables/useInsights'
import { useTaskStore } from '@/stores/taskStore'
import type { TimeEntry } from '@/types/TimeEntry'
import type { Task } from '@/types/Task'
import type { Project } from '@/types/Project'
import type { KanbanColumn } from '@/types/Kanban'

const COLUMNS: KanbanColumn[] = [
  { id: 'col-todo', title: 'A Fazer', status: 'todo', order: 0 },
  { id: 'col-done', title: 'Concluído', status: 'done', order: 1 },
]

const PROJECTS: Project[] = [
  { id: 'proj-a', name: 'Cliente A', client: 'Cliente A', color: '#111', createdAt: '2026-01-01T00:00:00.000Z' },
  { id: 'proj-b', name: 'Cliente B', client: 'Cliente B', color: '#222', createdAt: '2026-01-01T00:00:00.000Z' },
]

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1', title: 'Tarefa', description: '', status: 'todo',
    date: '2026-05-10', timeSpent: 0, project: '',
    createdAt: '2026-05-10T00:00:00.000Z', updatedAt: '2026-05-10T00:00:00.000Z',
    deletedAt: null, ...overrides,
  }
}

function makeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'entry-1', taskId: 'task-1',
    startedAt: '2026-05-10T10:00:00.000Z',
    endedAt: '2026-05-10T11:00:00.000Z',
    durationMinutes: 60, source: 'manual',
    createdAt: '2026-05-10T10:00:00.000Z',
    updatedAt: '2026-05-10T11:00:00.000Z',
    ...overrides,
  }
}

describe('countWorkingDays', () => {
  it('conta dias úteis de maio de 2026 (21 dias)', () => {
    expect(countWorkingDays(2026, 5)).toBe(21)
  })

  it('conta dias úteis de fevereiro de 2026 (20 dias)', () => {
    expect(countWorkingDays(2026, 2)).toBe(20)
  })

  it('não conta sábados nem domingos', () => {
    // Janeiro 2026: começa quinta, 31 dias → 22 dias úteis
    expect(countWorkingDays(2026, 1)).toBe(22)
  })
})

describe('useInsights — kpis', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('retorna totalMinutes somando entradas do mês', () => {
    const store = useTaskStore()
    store.tasks = [makeTask({ id: 'task-1', projectId: 'proj-a' })]
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = [
      makeEntry({ id: 'e1', taskId: 'task-1', projectId: 'proj-a', durationMinutes: 90 }),
      makeEntry({ id: 'e2', taskId: 'task-1', projectId: 'proj-a',
        startedAt: '2026-05-15T14:00:00.000Z', endedAt: '2026-05-15T15:00:00.000Z',
        durationMinutes: 60 }),
    ]
    const { kpis } = useInsights(ref(5), ref(2026))
    expect(kpis.value.totalMinutes).toBe(150)
  })

  it('ignora entradas sem endedAt (timer em andamento)', () => {
    const store = useTaskStore()
    store.tasks = [makeTask({ id: 'task-1', projectId: 'proj-a' })]
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = [
      makeEntry({ id: 'e1', durationMinutes: 60 }),
      makeEntry({ id: 'e2', endedAt: null, durationMinutes: undefined }),
    ]
    const { kpis } = useInsights(ref(5), ref(2026))
    expect(kpis.value.totalMinutes).toBe(60)
  })

  it('retorna vsLastMonthPercent null quando mês anterior tem 0 minutos', () => {
    const store = useTaskStore()
    store.tasks = [makeTask({ id: 'task-1', projectId: 'proj-a' })]
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = [makeEntry({ id: 'e1', durationMinutes: 60 })]
    const { kpis } = useInsights(ref(5), ref(2026))
    expect(kpis.value.vsLastMonthPercent).toBeNull()
  })

  it('calcula vsLastMonthPercent quando há dados do mês anterior', () => {
    const store = useTaskStore()
    store.tasks = [makeTask({ id: 'task-1', projectId: 'proj-a' })]
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = [
      // mês atual: maio 2026 — 120 min
      makeEntry({ id: 'e1', startedAt: '2026-05-10T10:00:00.000Z',
        endedAt: '2026-05-10T12:00:00.000Z', durationMinutes: 120 }),
      // mês anterior: abril 2026 — 100 min
      makeEntry({ id: 'e2', startedAt: '2026-04-10T10:00:00.000Z',
        endedAt: '2026-04-10T11:40:00.000Z', durationMinutes: 100 }),
    ]
    const { kpis } = useInsights(ref(5), ref(2026))
    expect(kpis.value.vsLastMonthPercent).toBe(20) // +20%
  })
})

describe('useInsights — projectBars', () => {
  beforeEach(() => { setActivePinia(createPinia()) })

  it('ordena projetos por horas decrescente com percentage relativo ao maior', () => {
    const store = useTaskStore()
    store.tasks = [
      makeTask({ id: 'task-1', projectId: 'proj-a' }),
      makeTask({ id: 'task-2', projectId: 'proj-b' }),
    ]
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = [
      makeEntry({ id: 'e1', taskId: 'task-1', projectId: 'proj-a', durationMinutes: 200 }),
      makeEntry({ id: 'e2', taskId: 'task-2', projectId: 'proj-b', durationMinutes: 100 }),
    ]
    const { projectBars } = useInsights(ref(5), ref(2026))
    expect(projectBars.value[0].name).toBe('Cliente A')
    expect(projectBars.value[0].percentage).toBe(100)
    expect(projectBars.value[1].percentage).toBe(50)
  })

  it('retorna array vazio quando não há horas no mês', () => {
    const store = useTaskStore()
    store.tasks = []
    store.projects = PROJECTS
    store.columns = COLUMNS
    store.timeEntries = []
    const { projectBars } = useInsights(ref(5), ref(2026))
    expect(projectBars.value).toHaveLength(0)
  })
})
