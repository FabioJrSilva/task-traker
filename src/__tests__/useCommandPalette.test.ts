import { describe, expect, it } from 'vitest'
import { filterPalette } from '@/composables/useCommandPalette'
import type { PaletteCommand } from '@/composables/useCommandPalette'
import type { Project } from '@/types/Project'
import type { Task } from '@/types/Task'

const PROJECTS: Project[] = [
  {
    id: 'proj-1',
    name: 'Cliente A',
    client: 'Cliente A',
    color: '#111',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

function makeCmd(overrides: Partial<PaletteCommand>): PaletteCommand {
  return {
    id: 'cmd-1',
    label: 'Nova Tarefa',
    group: 'actions',
    icon: 'plus',
    action: () => undefined,
    ...overrides,
  }
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Implementar autenticacao',
    description: '',
    status: 'todo',
    date: '2026-05-21',
    timeSpent: 0,
    project: '',
    projectId: 'proj-1',
    createdAt: '2026-05-21T00:00:00.000Z',
    updatedAt: '2026-05-21T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

const COMMANDS: PaletteCommand[] = [
  makeCmd({ id: 'new-task', label: 'Nova Tarefa', group: 'actions' }),
  makeCmd({ id: 'open-insights', label: 'Abrir Insights', group: 'actions' }),
  makeCmd({
    id: 'pomodoro-start',
    label: 'Iniciar Pomodoro',
    group: 'pomodoro',
    disabled: true,
  }),
]

const TASKS: Task[] = [
  makeTask({
    id: 'task-1',
    title: 'Implementar autenticacao',
    updatedAt: '2026-05-21T12:00:00.000Z',
  }),
  makeTask({
    id: 'task-2',
    title: 'Revisar API de pagamentos',
    updatedAt: '2026-05-21T11:00:00.000Z',
  }),
]

describe('filterPalette - query vazia', () => {
  it('retorna todos os comandos', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, '')
    expect(result.actionItems).toHaveLength(2)
    expect(result.pomodoroItems).toHaveLength(1)
  })

  it('retorna ate 8 tarefas ordenadas por updatedAt desc', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, '')
    expect(result.taskItems).toHaveLength(2)
    expect(result.taskItems[0].id).toBe('task-1')
  })
})

describe('filterPalette - com query', () => {
  it('filtra comandos por substring case-insensitive', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, 'nova')
    expect(result.actionItems).toHaveLength(1)
    expect(result.actionItems[0].id).toBe('new-task')
  })

  it('filtra tarefas por substring no titulo', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, 'api')
    expect(result.taskItems).toHaveLength(1)
    expect(result.taskItems[0].id).toBe('task-2')
  })

  it('retorna grupos vazios quando nada corresponde', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, 'xyzabc')
    expect(result.actionItems).toHaveLength(0)
    expect(result.taskItems).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })
})

describe('filterPalette - regras especiais', () => {
  it('comandos disabled aparecem nos resultados mas com disabled=true', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, 'pomodoro')
    expect(result.pomodoroItems).toHaveLength(1)
    expect(result.pomodoroItems[0].disabled).toBe(true)
  })

  it('tarefas com deletedAt nao aparecem', () => {
    const deletedTask = makeTask({
      id: 'task-3',
      title: 'Tarefa deletada',
      deletedAt: '2026-05-21T10:00:00.000Z',
    })
    const result = filterPalette(COMMANDS, [...TASKS, deletedTask], PROJECTS, '')
    expect(result.taskItems.find(task => task.id === 'task-3')).toBeUndefined()
  })

  it('resolve projectName via projects array', () => {
    const result = filterPalette(COMMANDS, TASKS, PROJECTS, '')
    expect(result.taskItems[0].projectName).toBe('Cliente A')
  })
})
