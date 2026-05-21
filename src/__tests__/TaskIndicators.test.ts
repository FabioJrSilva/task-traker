import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import KanbanColumn from '@/components/KanbanColumn.vue'
import CalendarContainer from '@/components/CalendarContainer.vue'

const mockStore = vi.hoisted(() => ({
  reorderTasksInColumn: vi.fn(),
  isTaskOverdue: vi.fn((task: { id: string }) => task.id === 'task-overdue'),
  isTaskCompletedWithDelay: vi.fn((task: { id: string }) => task.id === 'task-completed-late'),
  tasks: [] as Array<Record<string, unknown>>,
  meetings: [] as Array<Record<string, unknown>>,
  appointments: [] as Array<Record<string, unknown>>,
  getAppointmentsByDate: vi.fn(() => []),
  getStatusLabel: vi.fn((status: string) => status),
  workSettings: {
    workStartTime: '08:00',
    workEndTime: '18:00',
    workDays: [1, 2, 3, 4, 5]
  }
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => mockStore
}))

describe('Indicadores visuais de atraso', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockStore.getAppointmentsByDate.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('KanbanColumn exibe badge + destaque para atrasada e concluída com atraso', () => {
    const wrapper = mount(KanbanColumn, {
      props: {
        column: {
          id: 'col-1',
          title: 'Backlog',
          status: 'backlog',
          order: 0,
          color: '#7ea4ff'
        },
        tasks: [
          {
            id: 'task-overdue',
            title: 'Atrasada aberta',
            description: '',
            status: 'backlog',
            date: '2026-01-20',
            timeSpent: 0,
            project: '',
            createdAt: '2026-01-20T00:00:00.000Z',
            updatedAt: '2026-01-20T00:00:00.000Z'
          },
          {
            id: 'task-completed-late',
            title: 'Concluída em atraso',
            description: '',
            status: 'done',
            date: '2026-01-20',
            timeSpent: 0,
            project: '',
            developerMetadata: {
              branchName: 'feature/review-flow',
              pullRequestUrl: 'https://git.local/pr/7',
              environment: 'dev',
              reviewStatus: 'in_review'
            },
            completedWithDelay: true,
            createdAt: '2026-01-20T00:00:00.000Z',
            updatedAt: '2026-01-20T00:00:00.000Z'
          }
        ],
        editMode: false,
        timeTick: Date.now()
      }
    })

    expect(wrapper.text()).toContain('Atrasada')
    expect(wrapper.text()).toContain('Concluída com atraso')
    expect(wrapper.text()).toContain('PR')
    expect(wrapper.text()).toContain('Branch: feature/review-...')
    expect(wrapper.text()).toContain('Amb: dev')
    expect(wrapper.text()).toContain('REV em análise')

    const cards = wrapper.findAll('.task-card')
    expect(cards[0].classes()).toContain('task-overdue')
    expect(cards[1].classes()).toContain('task-completed-late')
  })

  it('CalendarContainer exibe indicadores equivalentes no painel diário', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 20, 12, 0, 0))

    mockStore.tasks = [
      {
        id: 'task-overdue',
        title: 'Atrasada aberta',
        description: '',
        status: 'backlog',
        date: '2026-01-20',
        timeSpent: 0,
        project: '',
        createdAt: '2026-01-20T00:00:00.000Z',
        updatedAt: '2026-01-20T00:00:00.000Z'
      },
      {
        id: 'task-completed-late',
        title: 'Concluída em atraso',
        description: '',
        status: 'done',
        date: '2026-01-20',
        timeSpent: 0,
        project: '',
        completedWithDelay: true,
        createdAt: '2026-01-20T00:00:00.000Z',
        updatedAt: '2026-01-20T00:00:00.000Z'
      }
    ]

    const wrapper = mount(CalendarContainer, {
      props: {
        timeTick: Date.now()
      }
    })

    const dayTab = wrapper.findAll('.tab-btn')[0]
    await dayTab.trigger('click')

    expect(wrapper.text()).toContain('Atrasada')
    expect(wrapper.text()).toContain('Concluída com atraso')

    const taskCards = wrapper.findAll('.day-panel .item-card')
    expect(taskCards[0].classes()).toContain('task-overdue')
    expect(taskCards[1].classes()).toContain('task-completed-late')

  })
})
