import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import KanbanToolbar from '@/components/KanbanToolbar.vue'

const mockStore = vi.hoisted(() => ({
  searchQuery: '',
  columnFilter: null as string | null,
  labelFilter: null as string | null,
  showOnlyOverdueTasks: false,
  sortedColumns: [
    { id: 'col-1', title: 'Backlog', status: 'backlog', color: '#7ea4ff', order: 0 },
    { id: 'col-2', title: 'Em Progresso', status: 'in-progress', color: '#89d185', order: 1 },
  ],
  setSearchQuery: vi.fn(),
  setColumnFilter: vi.fn(),
  setLabelFilter: vi.fn(),
  setShowOnlyOverdueTasks: vi.fn(),
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => mockStore,
}))

vi.mock('lucide-vue-next', () => ({
  Search: { template: '<span data-icon="search" />' },
  SlidersHorizontal: { template: '<span data-icon="filters" />' },
  Pencil: { template: '<span data-icon="pencil" />' },
  X: { template: '<span data-icon="x" />' },
}))

describe('KanbanToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockStore.searchQuery = ''
    mockStore.columnFilter = null
    mockStore.labelFilter = null
    mockStore.showOnlyOverdueTasks = false
  })

  it('atualiza a busca de tarefas do quadro', async () => {
    const wrapper = mount(KanbanToolbar, {
      props: {
        editMode: false,
      },
    })

    await wrapper.find('[data-testid="kanban-search-input"]').setValue('relatório')

    expect(mockStore.setSearchQuery).toHaveBeenCalledWith('relatório')
    expect(wrapper.find('[data-testid="kanban-search-input"]').attributes('aria-label'))
      .toBe('Buscar tarefas do quadro')
  })

  it('abre filtros e atualiza coluna, label e atrasadas', async () => {
    const wrapper = mount(KanbanToolbar, {
      props: {
        editMode: false,
      },
    })

    await wrapper.find('[data-testid="kanban-filter-button"]').trigger('click')
    await wrapper.find('[data-testid="column-filter-select"]').setValue('backlog')
    await wrapper.find('[data-testid="label-filter-select"]').setValue('Bug')
    await wrapper.find('[data-testid="overdue-filter-checkbox"]').setValue(true)

    expect(mockStore.setColumnFilter).toHaveBeenCalledWith('backlog')
    expect(mockStore.setLabelFilter).toHaveBeenCalledWith('Bug')
    expect(mockStore.setShowOnlyOverdueTasks).toHaveBeenCalledWith(true)
  })

  it('limpa todos os filtros do quadro', async () => {
    mockStore.columnFilter = 'backlog'
    mockStore.labelFilter = 'Bug'
    mockStore.showOnlyOverdueTasks = true

    const wrapper = mount(KanbanToolbar, {
      props: {
        editMode: false,
      },
    })

    await wrapper.find('[data-testid="kanban-filter-button"]').trigger('click')
    await wrapper.find('[data-testid="clear-kanban-filters"]').trigger('click')

    expect(mockStore.setColumnFilter).toHaveBeenCalledWith(null)
    expect(mockStore.setLabelFilter).toHaveBeenCalledWith(null)
    expect(mockStore.setShowOnlyOverdueTasks).toHaveBeenCalledWith(false)
  })

  it('emite toggle-edit-mode ao clicar em editar quadro', async () => {
    const wrapper = mount(KanbanToolbar, {
      props: {
        editMode: false,
      },
    })

    await wrapper.find('[data-testid="toggle-board-edit"]').trigger('click')

    expect(wrapper.emitted('toggle-edit-mode')).toHaveLength(1)
  })

  it('fecha o popover de filtros com Escape e clique fora', async () => {
    const wrapper = mount(KanbanToolbar, {
      attachTo: document.body,
      props: {
        editMode: false,
      },
    })

    await wrapper.find('[data-testid="kanban-filter-button"]').trigger('click')
    expect(wrapper.find('[data-testid="column-filter-select"]').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="column-filter-select"]').exists()).toBe(false)

    await wrapper.find('[data-testid="kanban-filter-button"]').trigger('click')
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="column-filter-select"]').exists()).toBe(false)

    wrapper.unmount()
  })
})
