import { describe, expect, it } from 'vitest'
import {
  buildGlobalSearchResults,
  flattenGlobalSearchResults,
} from '@/composables/useGlobalSearch'
import type { Task } from '@/types/Task'
import type { Project } from '@/types/Project'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Planejar release',
    description: '',
    status: 'Backlog',
    date: '2026-05-22',
    timeSpent: 0,
    project: 'Apollo',
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

const projects: Project[] = [
  { id: 'proj-1', name: 'Apollo', createdAt: '2026-05-22T10:00:00.000Z' },
]

const meetings: Meeting[] = [
  { id: 'meet-1', title: 'Weekly Apollo', date: '2026-05-23', time: '10:00', createdAt: '2026-05-22T10:00:00.000Z' },
]

const appointments: Appointment[] = [
  {
    id: 'appt-1',
    title: 'Consulta Apollo',
    startDate: '2026-05-24',
    startTime: '14:00',
    duration: 60,
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:00:00.000Z',
  },
]

describe('buildGlobalSearchResults', () => {
  it('returns empty groups for blank query', () => {
    const result = buildGlobalSearchResults({
      query: '',
      tasks: [makeTask({})],
      projects,
      meetings,
      appointments,
    })

    expect(result.hasQuery).toBe(false)
    expect(result.totalCount).toBe(0)
    expect(result.tasks).toHaveLength(0)
    expect(result.meetings).toHaveLength(0)
    expect(result.appointments).toHaveLength(0)
    expect(result.projects).toHaveLength(0)
  })

  it('finds tasks, meetings, appointments, and projects by case-insensitive substring', () => {
    const result = buildGlobalSearchResults({
      query: 'apollo',
      tasks: [makeTask({ projectId: 'proj-1' })],
      projects,
      meetings,
      appointments,
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.meetings).toHaveLength(1)
    expect(result.appointments).toHaveLength(1)
    expect(result.projects).toHaveLength(1)
  })

  it('excludes soft-deleted tasks from results', () => {
    const result = buildGlobalSearchResults({
      query: 'planejar',
      tasks: [makeTask({ deletedAt: '2026-05-22T11:00:00.000Z' })],
      projects,
      meetings: [],
      appointments: [],
    })

    expect(result.tasks).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })

  it('flattens groups in visual order for keyboard navigation', () => {
    const result = buildGlobalSearchResults({
      query: 'apollo',
      tasks: [makeTask({ projectId: 'proj-1' })],
      projects,
      meetings,
      appointments,
    })

    expect(flattenGlobalSearchResults(result).map(item => item.type)).toEqual([
      'task',
      'meeting',
      'appointment',
      'project',
    ])
  })
})
