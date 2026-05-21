import { describe, expect, it } from 'vitest'
import { buildTriggeredKeys } from '@/composables/useNotifications'
import type { KanbanColumn } from '@/types/Kanban'
import type { Task } from '@/types/Task'
import type { TimeEntry } from '@/types/TimeEntry'

const COLUMNS: KanbanColumn[] = [
  { id: 'col-todo', title: 'A Fazer', status: 'todo', order: 0 },
  { id: 'col-done', title: 'Concluído', status: 'done', order: 1 },
]

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    description: '',
    status: 'todo',
    date: '2026-05-21',
    timeSpent: 0,
    project: '',
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

function makeEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'e1',
    taskId: 'task-1',
    startedAt: '2026-05-21T10:00:00.000Z',
    endedAt: '2026-05-21T11:00:00.000Z',
    durationMinutes: 60,
    source: 'manual',
    createdAt: '2026-05-21T10:00:00.000Z',
    updatedAt: '2026-05-21T11:00:00.000Z',
    ...overrides,
  }
}

const NOW = new Date('2026-05-21T14:00:00.000Z')

describe('buildTriggeredKeys - due-soon', () => {
  it('inclui due-soon quando dueAt esta em 10 minutos', () => {
    const task = makeTask({ dueAt: '2026-05-21T14:10:00.000Z' })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).toContain('task-1-due-soon')
  })

  it('nao inclui due-soon quando dueAt esta em 20 minutos', () => {
    const task = makeTask({ dueAt: '2026-05-21T14:20:00.000Z' })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).not.toContain('task-1-due-soon')
  })

  it('nao inclui due-soon para tarefa concluida', () => {
    const task = makeTask({ dueAt: '2026-05-21T14:05:00.000Z', status: 'done' })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).not.toContain('task-1-due-soon')
  })

  it('nao inclui due-soon sem dueAt', () => {
    const task = makeTask({})
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).not.toContain('task-1-due-soon')
  })
})

describe('buildTriggeredKeys - overdue', () => {
  it('inclui overdue quando dueAt esta no passado e tarefa nao concluida', () => {
    const task = makeTask({ dueAt: '2026-05-21T13:00:00.000Z' })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).toContain('task-1-overdue')
  })

  it('nao inclui overdue para tarefa concluida', () => {
    const task = makeTask({ dueAt: '2026-05-21T13:00:00.000Z', status: 'done' })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).not.toContain('task-1-overdue')
  })
})

describe('buildTriggeredKeys - over-time', () => {
  it('inclui over-time quando tempo gasto >= estimativa', () => {
    const task = makeTask({ developerMetadata: { estimateMinutes: 60 } })
    const entries = [makeEntry({ durationMinutes: 70 })]
    const keys = buildTriggeredKeys([task], COLUMNS, entries, NOW)
    expect(keys).toContain('task-1-over-time')
  })

  it('inclui over-time somando entrada ativa sem endedAt', () => {
    const task = makeTask({ developerMetadata: { estimateMinutes: 60 } })
    const activeStart = new Date(NOW.getTime() - 25 * 60 * 1000).toISOString()
    const entries = [
      makeEntry({ id: 'e1', durationMinutes: 40 }),
      makeEntry({ id: 'e2', startedAt: activeStart, endedAt: null, durationMinutes: undefined }),
    ]
    const keys = buildTriggeredKeys([task], COLUMNS, entries, NOW)
    expect(keys).toContain('task-1-over-time')
  })

  it('nao inclui over-time sem estimateMinutes', () => {
    const task = makeTask({})
    const entries = [makeEntry({ durationMinutes: 120 })]
    const keys = buildTriggeredKeys([task], COLUMNS, entries, NOW)
    expect(keys).not.toContain('task-1-over-time')
  })

  it('nao inclui over-time quando tempo gasto < estimativa', () => {
    const task = makeTask({ developerMetadata: { estimateMinutes: 120 } })
    const entries = [makeEntry({ durationMinutes: 60 })]
    const keys = buildTriggeredKeys([task], COLUMNS, entries, NOW)
    expect(keys).not.toContain('task-1-over-time')
  })
})

describe('buildTriggeredKeys - soft delete', () => {
  it('ignora tarefas com deletedAt', () => {
    const task = makeTask({
      dueAt: '2026-05-21T13:00:00.000Z',
      deletedAt: '2026-05-21T12:00:00.000Z',
    })
    const keys = buildTriggeredKeys([task], COLUMNS, [], NOW)
    expect(keys).toHaveLength(0)
  })
})
