import { beforeEach, describe, expect, it, vi } from 'vitest'
import { shallowMount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import TaskModal from '@/components/TaskModal.vue'
import type { Task } from '@/types/Task'

vi.mock('@/utils/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => ({
    get sortedColumns() {
      return [
        { id: '1', title: 'Backlog', status: 'backlog', color: '#888' },
        { id: '2', title: 'In Progress', status: 'in_progress', color: '#f0ad4e' },
        { id: '3', title: 'Done', status: 'done', color: '#5cb85c' }
      ]
    },
    get projects() {
      return []
    }
  })
}))

describe('TaskModal', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renderiza em modo criação quando task é null', () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    expect(wrapper.find('h2').text()).toBe('Nova Tarefa')
  })

  it('renderiza em modo edição quando task é passada', () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: {
          id: '1',
          title: 'Tarefa Teste',
          description: 'Descrição',
          status: 'backlog',
          date: '2024-01-01',
          timeSpent: 60,
          project: 'Projeto',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        currentDate: '2024-01-01'
      }
    })

    expect(wrapper.find('h2').text()).toBe('Editar Tarefa')
  })

  it('emite evento close ao clicar no botão fechar', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('.close-btn').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('salva campos de recorrência no submit', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Nova tarefa recorrente')
    await wrapper.find('[data-testid="recurrence-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="recurrence-type-select"]').setValue('weekly')
    await wrapper.find('form').trigger('submit.prevent')

    const saveEvents = wrapper.emitted('save')
    expect(saveEvents).toBeTruthy()

    const payload = saveEvents?.[0]?.[0] as Record<string, unknown>
    expect(payload.isRecurring).toBe(true)
    expect(payload.recurrence).toEqual({ type: 'weekly' })
  })

  it('salva configuração mensal avançada no submit', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Rotina mensal')
    await wrapper.find('[data-testid="recurrence-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="recurrence-type-select"]').setValue('monthly')
    await wrapper.find('[data-testid="recurrence-monthly-mode-select"]').setValue('fixed_day')
    await wrapper.find('[data-testid="recurrence-day-of-month-input"]').setValue('20')
    await wrapper.find('[data-testid="recurrence-business-day-adjustment-select"]').setValue('previous_workday')
    await wrapper.find('[data-testid="recurrence-copy-checklist-checkbox"]').setValue(true)
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(payload.recurrence).toEqual({
      type: 'monthly',
      monthlyMode: 'fixed_day',
      dayOfMonth: 20,
      businessDayAdjustment: 'previous_workday',
      copyChecklist: true
    })
  })

  it('seção de campos de desenvolvimento inicia recolhida e salva metadados opcionais', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    expect(wrapper.find('[data-testid="developer-branch-name"]').exists()).toBe(false)

    await wrapper.find('[data-testid="developer-fields-toggle"]').trigger('click')
    await wrapper.find('input[type="text"]').setValue('Nova tarefa técnica')
    await wrapper.find('[data-testid="developer-branch-name"]').setValue('feature/m4-dev-fields')
    await wrapper.find('[data-testid="developer-pr-url"]').setValue('https://example.com/pr/10')
    await wrapper.find('[data-testid="developer-review-status"]').setValue('in_review')
    await wrapper.find('[data-testid="developer-estimate-minutes"]').setValue('90')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    const metadata = payload.developerMetadata as Record<string, unknown>

    expect(metadata.branchName).toBe('feature/m4-dev-fields')
    expect(metadata.pullRequestUrl).toBe('https://example.com/pr/10')
    expect(metadata.reviewStatus).toBe('in_review')
    expect(metadata.estimateMinutes).toBe(90)
  })

  it('salva prazo somente data (fim do dia implícito no domínio)', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Tarefa com prazo por data')
    await wrapper.find('[data-testid="due-enabled-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="due-date-input"]').setValue('2024-02-10')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(payload.dueAt).toBe('2024-02-10')
    expect(payload.dueHasTime).toBe(false)
  })

  it('salva prazo com data e horário', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: null,
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('input[type="text"]').setValue('Tarefa com prazo e horário')
    await wrapper.find('[data-testid="due-enabled-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="due-date-input"]').setValue('2024-02-10')
    await wrapper.find('[data-testid="due-has-time-checkbox"]').setValue(true)
    await wrapper.find('[data-testid="due-time-input"]').setValue('09:30')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(payload.dueHasTime).toBe(true)
    expect(typeof payload.dueAt).toBe('string')
    expect((payload.dueAt as string).includes('T')).toBe(true)
  })

  it('permite remover prazo no modal de edição', async () => {
    const wrapper = shallowMount(TaskModal, {
      props: {
        task: {
          id: 'task-due-1',
          title: 'Tarefa com prazo',
          description: '',
          status: 'backlog',
          date: '2024-02-10',
          dueAt: '2024-02-10',
          dueHasTime: false,
          timeSpent: 0,
          project: '',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z'
        },
        currentDate: '2024-01-01'
      }
    })

    await wrapper.find('.btn-clear-due').trigger('click')
    await wrapper.find('form').trigger('submit.prevent')

    const payload = wrapper.emitted('save')?.[0]?.[0] as Record<string, unknown>
    expect(payload.dueAt).toBeNull()
    expect(payload.dueHasTime).toBe(false)
  })

  it('usa cópia defensiva ao editar labels, comentários e subtarefas', async () => {
    const task: Task = {
      id: 'task-1',
      title: 'Tarefa com dados',
      description: 'Descrição',
      status: 'backlog',
      date: '2024-01-01',
      timeSpent: 30,
      project: 'Projeto',
      labels: [{ id: 'urgent', name: 'Urgente', color: '#ef4444' }],
      comments: [
        {
          id: 'comment-1',
          text: 'Comentário inicial',
          authorId: 'user',
          authorName: 'Usuário',
          createdAt: '2024-01-01T00:00:00.000Z'
        }
      ],
      subtasks: [{ id: 'subtask-1', title: 'Subtarefa', completed: false }],
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }

    const wrapper = shallowMount(TaskModal, {
      props: {
        task,
        currentDate: '2024-01-01'
      }
    })

    const labelButtons = wrapper.findAll('.label-chip')
    await labelButtons[0].trigger('click')

    const toggles = wrapper.findAll('.comments-toggle')
    await toggles[1].trigger('click')
    await wrapper.find('.add-comment input').setValue('Novo comentário')
    await wrapper.find('.btn-add-comment').trigger('click')

    await toggles[2].trigger('click')
    await wrapper.find('.subtask-item input[type="checkbox"]').setValue(true)

    expect(task.labels).toEqual([{ id: 'urgent', name: 'Urgente', color: '#ef4444' }])
    expect(task.comments).toHaveLength(1)
    expect(task.comments?.[0].text).toBe('Comentário inicial')
    expect(task.subtasks?.[0].completed).toBe(false)
  })
})
