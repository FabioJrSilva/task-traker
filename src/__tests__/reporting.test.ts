import { describe, expect, it } from 'vitest'
import type { KanbanColumn } from '@/types/Kanban'
import type { Project } from '@/types/Project'
import type { Task } from '@/types/Task'
import type { TimeEntry } from '@/types/TimeEntry'
import {
  buildDashboardModel,
  buildMonthlyProjectReport,
  buildMonthlyProjectReportCSV,
  getLocalPeriodRange
} from '@/utils/reporting'

const columns: KanbanColumn[] = [
  { id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' },
  { id: 'col-2', title: 'Concluído', status: 'done', order: 1, color: '#89d185' }
]

const projects: Project[] = [
  { id: 'proj-1', name: 'Projeto A', client: 'Cliente A', color: '#111111', createdAt: '2026-01-01T00:00:00.000Z' }
]

function createTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Tarefa',
    description: '',
    status: 'backlog',
    date: '2026-01-15',
    timeSpent: 0,
    project: '',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    deletedAt: null,
    ...overrides
  }
}

function createEntry(overrides: Partial<TimeEntry>): TimeEntry {
  return {
    id: 'entry-1',
    taskId: 'task-1',
    startedAt: '2026-01-15T10:00:00.000Z',
    endedAt: '2026-01-15T11:00:00.000Z',
    durationMinutes: 60,
    source: 'manual',
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T11:00:00.000Z',
    ...overrides
  }
}

describe('reporting - period ranges', () => {
  it('uses monday as week start in local period', () => {
    const reference = new Date('2026-01-14T12:00:00.000Z') // Wednesday
    const range = getLocalPeriodRange(reference, 'week')

    expect(range.start.getDay()).toBe(1)
    expect(range.end.getDay()).toBe(0)
    expect(range.end.getTime()).toBeGreaterThan(range.start.getTime())
  })
})

describe('reporting - monthly consolidated by project', () => {
  it('groups by project and includes sem projeto', () => {
    const tasks: Task[] = [
      createTask({
        id: 'task-1',
        title: 'Task A',
        status: 'done',
        projectId: 'proj-1',
        completedAt: '2026-01-20T10:00:00.000Z',
        completedWithDelay: true
      }),
      createTask({
        id: 'task-2',
        title: 'Task B',
        projectId: undefined,
        dueAt: '2026-01-10',
        dueHasTime: false
      })
    ]

    const entries: TimeEntry[] = [
      createEntry({ id: 'e-1', taskId: 'task-1', projectId: 'proj-1', durationMinutes: 120 }),
      createEntry({ id: 'e-2', taskId: 'task-2', projectId: undefined, durationMinutes: 30 })
    ]

    const report = buildMonthlyProjectReport({
      referenceDate: new Date('2026-01-25T12:00:00.000Z'),
      columns,
      projects,
      tasks,
      timeEntries: entries
    })

    expect(report.projects).toHaveLength(2)
    const projectA = report.projects.find(item => item.projectName === 'Projeto A')
    const semProjeto = report.projects.find(item => item.projectName === 'Sem projeto')
    expect(projectA?.totalMinutes).toBe(120)
    expect(projectA?.completedWithDelay).toBe(1)
    expect(semProjeto?.totalMinutes).toBe(30)
  })

  it('excludes entries from trashed tasks and keeps orphan entries stable', () => {
    const tasks: Task[] = [
      createTask({ id: 'task-1', deletedAt: '2026-01-25T10:00:00.000Z' })
    ]
    const entries: TimeEntry[] = [
      createEntry({ id: 'e-trash', taskId: 'task-1', durationMinutes: 50 }),
      createEntry({ id: 'e-orphan', taskId: 'task-removed', projectId: undefined, durationMinutes: 20 })
    ]

    const report = buildMonthlyProjectReport({
      referenceDate: new Date('2026-01-25T12:00:00.000Z'),
      columns,
      projects,
      tasks,
      timeEntries: entries
    })

    expect(report.summary.totalMinutes).toBe(20)
    expect(report.projects[0].tasks[0].title).toBe('Tarefa removida')
  })

  it('builds csv with stable columns and formula mitigation', () => {
    const tasks: Task[] = [
      createTask({ id: 'task-1', title: '=Task', projectId: 'proj-1' })
    ]
    const entries: TimeEntry[] = [
      createEntry({ id: 'e-1', taskId: 'task-1', projectId: 'proj-1', durationMinutes: 60 })
    ]

    const report = buildMonthlyProjectReport({
      referenceDate: new Date('2026-01-25T12:00:00.000Z'),
      columns,
      projects: [{ ...projects[0], name: '=Projeto' }],
      tasks,
      timeEntries: entries
    })

    const csv = buildMonthlyProjectReportCSV(report)
    expect(csv).toContain('mês,projeto,cliente,total de horas,tarefas com tempo,tarefas concluídas,concluídas com atraso,atrasadas ativas')
    expect(csv).toContain("'=Projeto")
  })
})

describe('reporting - dashboard model', () => {
  it('builds today dashboard cards from time entries and agenda', () => {
    const tasks: Task[] = [
      createTask({ id: 'task-1', title: 'Hoje', date: '2026-01-15', projectId: 'proj-1' }),
      createTask({ id: 'task-2', title: 'Concluída', status: 'done', date: '2026-01-15', completedAt: '2026-01-15T12:00:00.000Z' })
    ]
    const meetings = [{ id: 'm-1', title: 'Daily', date: '2026-01-15', createdAt: '2026-01-15T09:00:00.000Z' }]
    const appointments = [{ id: 'a-1', title: 'Call', startDate: '2026-01-15', startTime: '10:00', duration: 30, createdAt: '2026-01-15T09:00:00.000Z', updatedAt: '2026-01-15T09:00:00.000Z' }]
    const entries: TimeEntry[] = [
      createEntry({ id: 'e-1', taskId: 'task-1', projectId: 'proj-1', durationMinutes: 90 })
    ]

    const model = buildDashboardModel({
      period: 'today',
      referenceDate: new Date('2026-01-15T14:00:00.000Z'),
      columns,
      projects,
      tasks,
      meetings,
      appointments,
      timeEntries: entries
    })

    expect(model.cards.tasksInPeriod).toBe(2)
    expect(model.cards.completedInPeriod).toBe(1)
    expect(model.cards.timeMinutes).toBe(90)
    expect(model.cards.agendaItems).toBe(2)
  })
})
