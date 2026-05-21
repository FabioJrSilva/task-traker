import { describe, expect, it } from 'vitest'
import { migrateAppData } from '@/shared/appData'

describe('appData migration - prazo/atraso', () => {
  it('preserva completedAt/completedWithDelay em status concluído customizado', () => {
    const migrated = migrateAppData({
      schemaVersion: 3,
      columns: [
        { id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' },
        { id: 'col-2', title: 'Concluído QA', status: 'qa_done', order: 1, color: '#89d185' }
      ],
      tasks: [
        {
          id: 'task-1',
          title: 'Validar PR',
          description: '',
          status: 'qa_done',
          date: '2026-01-20',
          dueAt: '2026-01-20T10:00:00.000Z',
          dueHasTime: true,
          completedAt: '2026-01-20T10:30:00.000Z',
          completedWithDelay: true,
          timeSpent: 0,
          project: '',
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z'
        }
      ],
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
    })

    expect(migrated.tasks[0].completedAt).toBe('2026-01-20T10:30:00.000Z')
    expect(migrated.tasks[0].completedWithDelay).toBe(true)
  })

  it('legacy: infere dueHasTime=false quando dueAt é somente data', () => {
    const migrated = migrateAppData({
      schemaVersion: 2,
      columns: [{ id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' }],
      tasks: [
        {
          id: 'task-legacy-date',
          title: 'Prazo legado date-only',
          description: '',
          status: 'backlog',
          date: '2026-01-20',
          dueAt: '2026-01-25',
          timeSpent: 0,
          project: '',
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z'
        }
      ],
      projects: [],
      meetings: [],
      appointments: [],
      taskOrder: {},
      workSettings: {
        workStartTime: '08:00',
        workEndTime: '18:00',
        workDays: [1, 2, 3, 4, 5]
      }
    })

    expect(migrated.tasks[0].dueAt).toBe('2026-01-25')
    expect(migrated.tasks[0].dueHasTime).toBe(false)
  })

  it('legacy: infere dueHasTime=true quando dueAt é datetime sem flag explícita', () => {
    const migrated = migrateAppData({
      schemaVersion: 2,
      columns: [{ id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' }],
      tasks: [
        {
          id: 'task-legacy-datetime',
          title: 'Prazo legado datetime',
          description: '',
          status: 'backlog',
          date: '2026-01-20',
          dueAt: '2026-01-25T15:45:00.000Z',
          timeSpent: 0,
          project: '',
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z'
        }
      ],
      projects: [],
      meetings: [],
      appointments: [],
      taskOrder: {},
      workSettings: {
        workStartTime: '08:00',
        workEndTime: '18:00',
        workDays: [1, 2, 3, 4, 5]
      }
    })

    expect(migrated.tasks[0].dueHasTime).toBe(true)
    expect(migrated.tasks[0].dueAt).toBe('2026-01-25T15:45:00.000Z')
  })
})

describe('appData migration - configurações de trabalho', () => {
  it('normaliza workDays vazio para fallback padrão', () => {
    const migrated = migrateAppData({
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
        workDays: []
      },
      actionHistory: [],
      labelFilter: null
    })

    expect(migrated.workSettings.workDays).toEqual([1, 2, 3, 4, 5])
  })

  it('normaliza workDays com valores inválidos para fallback padrão', () => {
    const migrated = migrateAppData({
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
        workDays: [-1, 7, 8, 'abc', null]
      },
      actionHistory: [],
      labelFilter: null
    })

    expect(migrated.workSettings.workDays).toEqual([1, 2, 3, 4, 5])
  })

  it('preserva workDays válidos e remove duplicatas', () => {
    const migrated = migrateAppData({
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
        workDays: [1, 1, 3, 5, 5]
      },
      actionHistory: [],
      labelFilter: null
    })

    expect(migrated.workSettings.workDays).toEqual([1, 3, 5])
  })

  it('usa fallback quando workSettings é nulo ou inválido', () => {
    const migrated = migrateAppData({
      schemaVersion: 3,
      columns: [],
      tasks: [],
      projects: [],
      meetings: [],
      appointments: [],
      taskOrder: {},
      workSettings: null,
      actionHistory: [],
      labelFilter: null
    })

    expect(migrated.workSettings.workStartTime).toBe('08:00')
    expect(migrated.workSettings.workEndTime).toBe('18:00')
    expect(migrated.workSettings.workDays).toEqual([1, 2, 3, 4, 5])
  })
})

describe('appData migration - metadados de desenvolvimento', () => {
  it('preserva campos dev válidos e normaliza reviewStatus inválido', () => {
    const migrated = migrateAppData({
      schemaVersion: 4,
      columns: [],
      tasks: [
        {
          id: 'task-dev-1',
          title: 'Implementar endpoint',
          description: '',
          status: 'backlog',
          date: '2026-01-20',
          timeSpent: 0,
          project: '',
          developerMetadata: {
            repositoryUrl: 'https://repo.local/app',
            branchName: ' feature/m4 ',
            pullRequestUrl: 'https://repo.local/pr/10',
            issueUrl: 'https://jira.local/TASK-20',
            environment: 'homologação',
            reviewStatus: 'unknown',
            blockedReason: ' Dependência externa ',
            estimateMinutes: 80
          },
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z'
        }
      ],
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
    })

    expect(migrated.tasks[0].developerMetadata).toEqual({
      repositoryUrl: 'https://repo.local/app',
      branchName: 'feature/m4',
      pullRequestUrl: 'https://repo.local/pr/10',
      issueUrl: 'https://jira.local/TASK-20',
      environment: 'homologação',
      reviewStatus: 'not_required',
      blockedReason: 'Dependência externa',
      estimateMinutes: 80
    })
  })

  it('descarta campos dev inválidos e mantém tarefa funcional', () => {
    const migrated = migrateAppData({
      schemaVersion: 4,
      columns: [],
      tasks: [
        {
          id: 'task-dev-2',
          title: 'Auditar logs',
          description: '',
          status: 'backlog',
          date: '2026-01-20',
          timeSpent: 0,
          project: '',
          developerMetadata: {
            branchName: 123,
            estimateMinutes: -10,
            blockedReason: null
          },
          createdAt: '2026-01-20T00:00:00.000Z',
          updatedAt: '2026-01-20T00:00:00.000Z'
        }
      ],
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
    })

    expect(migrated.tasks[0].developerMetadata).toBeUndefined()
  })
})

describe('appData migration - recorrência mensal v2', () => {
  it('migra recorrência mensal legada para monthlyMode first_day', () => {
    const migrated = migrateAppData({
      schemaVersion: 4,
      columns: [],
      tasks: [
        {
          id: 'task-monthly-legacy',
          title: 'Fechamento mensal',
          description: '',
          status: 'done',
          date: '2026-01-31',
          timeSpent: 0,
          project: '',
          isRecurring: true,
          recurrence: { type: 'monthly' },
          recurrenceState: {
            seriesId: 'task-monthly-legacy',
            occurrenceNumber: 1,
            generatedAt: '2026-01-31T10:00:00.000Z'
          },
          completedAt: '2026-01-31T10:00:00.000Z',
          createdAt: '2026-01-31T10:00:00.000Z',
          updatedAt: '2026-01-31T10:00:00.000Z'
        }
      ],
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
    })

    expect(migrated.schemaVersion).toBe(5)
    expect(migrated.tasks[0].recurrence?.type).toBe('monthly')
    expect(migrated.tasks[0].recurrence?.monthlyMode).toBe('first_day')
  })

  it('normaliza periodKey mensal no recurrenceState quando ausente', () => {
    const migrated = migrateAppData({
      schemaVersion: 4,
      columns: [],
      tasks: [
        {
          id: 'task-monthly-state',
          title: 'Checklist mensal',
          description: '',
          status: 'backlog',
          date: '2026-02-20',
          timeSpent: 0,
          project: '',
          isRecurring: true,
          recurrence: {
            type: 'monthly',
            monthlyMode: 'fixed_day',
            dayOfMonth: 20
          },
          recurrenceState: {
            seriesId: 'series-monthly',
            occurrenceNumber: 2,
            generatedAt: '2026-02-20T00:00:00.000Z'
          },
          createdAt: '2026-02-20T00:00:00.000Z',
          updatedAt: '2026-02-20T00:00:00.000Z'
        }
      ],
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
    })

    expect(migrated.tasks[0].recurrenceState?.periodKey).toBe('2026-02')
  })
})
