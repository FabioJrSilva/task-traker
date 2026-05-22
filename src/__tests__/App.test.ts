import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'
import { shallowMount, type VueWrapper } from '@vue/test-utils'
import App from '@/App.vue'
import type { Task } from '@/types/Task'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'
import type { Project } from '@/types/Project'

const mockStore = vi.hoisted(() => ({
  loadAppData: vi.fn(),
  processRecurringTasks: vi.fn(),
  canUndo: vi.fn(),
  setSearchQuery: vi.fn(),
  setColumnFilter: vi.fn(),
  setLabelFilter: vi.fn(),
  updateTask: vi.fn(),
  addTask: vi.fn(),
  deleteTask: vi.fn(),
  updateColumn: vi.fn(),
  addColumn: vi.fn(),
  updateProject: vi.fn(),
  addProject: vi.fn(),
  checkAppointmentConflict: vi.fn(),
  updateAppointment: vi.fn(),
  addAppointment: vi.fn(),
  deleteAppointment: vi.fn(),
  updateMeeting: vi.fn(),
  addMeeting: vi.fn(),
  deleteMeeting: vi.fn(),
  undoLastAction: vi.fn(),
  updateWorkSettings: vi.fn(),
  setShowOnlyOverdueTasks: vi.fn(),
  actionHistory: [],
  trashedTasks: [],
  sortedColumns: [],
  searchQuery: '',
  columnFilter: null,
  labelFilter: null,
  showOnlyOverdueTasks: false,
  tasks: [] as Task[],
  meetings: [] as Meeting[],
  appointments: [] as Appointment[],
  projects: [] as Project[],
}))

const commandPaletteState = vi.hoisted(() => ({
  isOpen: { value: false },
  query: { value: '' },
  activeIndex: { value: 0 },
  open: vi.fn(() => {
    commandPaletteState.isOpen.value = true
    commandPaletteState.query.value = ''
    commandPaletteState.activeIndex.value = 0
  }),
  close: vi.fn(() => {
    commandPaletteState.isOpen.value = false
  }),
  moveUp: vi.fn(),
  moveDown: vi.fn(),
  resetIndex: vi.fn(() => {
    commandPaletteState.activeIndex.value = 0
  }),
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => mockStore
}))

vi.mock('@/stores/pomodoroStore', () => ({
  usePomodoroStore: () => ({
    start: vi.fn(),
    togglePause: vi.fn(),
    stop: vi.fn()
  })
}))

vi.mock('@/utils/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
  })
}))

vi.mock('@/composables/useCommandPalette', () => ({
  useCommandPalette: () => commandPaletteState
}))

vi.mock('@/components/CommandPalette.vue', () => ({
  default: defineComponent({
    name: 'CommandPalette',
    setup() {
      return { palette: commandPaletteState }
    },
    template: `
      <div
        data-testid="command-palette"
        :data-open="palette.isOpen.value ? 'true' : 'false'"
      />
    `
  })
}))

vi.mock('lucide-vue-next', () => ({
  Plus: { template: '<span />' },
  FileText: { template: '<span />' },
  Calendar: { template: '<span />' },
  Pencil: { template: '<span />' },
  Search: { template: '<span />' },
  FolderPlus: { template: '<span />' },
  Grid3x3: { template: '<span />' },
  Columns3: { template: '<span />' },
  RotateCcw: { template: '<span />' },
  Trash2: { template: '<span />' },
  Database: { template: '<span />' },
  Moon: { template: '<span />' },
  Sun: { template: '<span />' },
  BarChart2: { template: '<span />' },
  Settings: { template: '<span />' },
  MoreHorizontal: { template: '<span />' },
  Bell: { template: '<span />' },
  Timer: { template: '<span />' },
  SlidersHorizontal: { template: '<span />' },
  X: { template: '<span />' },
  ChevronLeft: { template: '<span />' },
  ChevronRight: { template: '<span />' },
  Download: { template: '<span />' },
}))

async function mountApp() {
  const wrapper = shallowMount(App, {
    global: {
      stubs: {
        CommandPalette: false,
      },
    },
  })
  await Promise.resolve()
  await nextTick()
  mountedWrappers.push(wrapper)
  return wrapper
}

const mountedWrappers: VueWrapper[] = []

function createDeferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined
  const promise = new Promise<T>((resolver) => {
    resolve = resolver
  })

  return {
    promise,
    resolve
  }
}

describe('App scheduler de recorrência', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    commandPaletteState.isOpen.value = false
    commandPaletteState.query.value = ''
    commandPaletteState.activeIndex.value = 0

    mockStore.tasks = []
    mockStore.meetings = []
    mockStore.appointments = []
    mockStore.projects = []

    mockStore.loadAppData.mockResolvedValue(undefined)
    mockStore.processRecurringTasks.mockResolvedValue(undefined)
    mockStore.canUndo.mockReturnValue(false)
    mockStore.checkAppointmentConflict.mockReturnValue(null)

    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({
      matches: false,
      media: '(prefers-color-scheme: dark)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  afterEach(() => {
    while (mountedWrappers.length > 0) {
      mountedWrappers.pop()?.unmount()
    }
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('chama processRecurringTasks a cada 1 minuto', async () => {
    await mountApp()

    expect(mockStore.processRecurringTasks).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(2)
  })

  it('remove o intervalo no unmount', async () => {
    const wrapper = await mountApp()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(1)

    wrapper.unmount()

    await vi.advanceTimersByTimeAsync(120_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(1)
  })

  it('evita sobreposição quando processRecurringTasks está em andamento', async () => {
    const firstRun = createDeferred<void>()

    mockStore.processRecurringTasks
      .mockReset()
      .mockReturnValueOnce(firstRun.promise)
      .mockResolvedValue(undefined)

    await mountApp()

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(1)

    firstRun.resolve(undefined)
    await firstRun.promise

    await vi.advanceTimersByTimeAsync(60_000)
    expect(mockStore.processRecurringTasks).toHaveBeenCalledTimes(2)
  })

  it('persiste configurações de trabalho ao salvar no WorkSettingsModal', async () => {
    mockStore.updateWorkSettings.mockResolvedValue(undefined)

    const wrapper = await mountApp()

    // Open the modal by setting the reactive ref directly
    ;(wrapper.vm as unknown as { showWorkSettingsModal: boolean }).showWorkSettingsModal = true
    await nextTick()

    const workSettingsModal = wrapper.findComponent({ name: 'WorkSettingsModal' })
    expect(workSettingsModal.exists()).toBe(true)

    const settings = {
      workStartTime: '09:00',
      workEndTime: '17:00',
      workDays: [1, 2, 3, 4, 5]
    }

    await workSettingsModal.vm.$emit('save', settings)
    await nextTick()

    expect(mockStore.updateWorkSettings).toHaveBeenCalledWith(settings)
    expect(workSettingsModal.exists()).toBe(false)
  })

  it('não abre resultados quando o campo de busca recebe foco com query vazia', async () => {
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="global-search-input"]').trigger('focus')
    await nextTick()

    expect(wrapper.find('[data-testid="global-search-dropdown"]').exists()).toBe(false)
  })

  it('exibe resultados de busca global agrupados ao digitar no campo do header', async () => {
    mockStore.tasks = [
      {
        id: 'task-1',
        title: 'Planejar Apollo',
        description: '',
        status: 'Backlog',
        date: '2026-05-22',
        timeSpent: 0,
        project: 'Apollo',
        createdAt: '2026-05-22T10:00:00.000Z',
        updatedAt: '2026-05-22T10:00:00.000Z',
        deletedAt: null,
      },
    ]
    mockStore.projects = [{ id: 'proj-1', name: 'Apollo', createdAt: '2026-05-22T10:00:00.000Z' }]

    const wrapper = await mountApp()
    const input = wrapper.get('[data-testid="global-search-input"]')
    await input.trigger('focus')
    await input.setValue('apollo')
    await nextTick()

    expect(wrapper.get('[data-testid="global-search-dropdown"]').text()).toContain('Tarefas')
    expect(wrapper.get('[data-testid="global-search-dropdown"]').text()).toContain('Projetos')
  })

  it('clicar no campo de busca não abre a command palette', async () => {
    const wrapper = await mountApp()

    await wrapper.get('[data-testid="global-search-input"]').trigger('focus')
    await wrapper.get('[data-testid="global-search-input"]').setValue('apollo')
    await nextTick()

    expect(commandPaletteState.isOpen.value).toBe(false)
    expect(wrapper.get('[data-testid="command-palette"]').attributes('data-open')).toBe('false')
  })

  it('não renderiza botão global de Nova Tarefa no header', async () => {
    const wrapper = await mountApp()
    const headerButtons = wrapper.find('header').findAll('button')
    const headerButtonNames = headerButtons.map((button) => {
      const text = button.text().trim()
      const ariaLabel = button.attributes('aria-label') ?? ''
      const title = button.attributes('title') ?? ''

      return [text, ariaLabel, title]
        .map(value => value.trim().toLowerCase())
        .filter(Boolean)
        .join(' ')
    })
    const hasGlobalNewTaskButton = headerButtonNames.some(name => name.includes('nova tarefa'))

    expect(hasGlobalNewTaskButton).toBe(false)
  })

  it('renderiza KanbanToolbar apenas na view kanban', async () => {
    const wrapper = await mountApp()

    expect(wrapper.findComponent({ name: 'KanbanToolbar' }).exists()).toBe(true)

    await wrapper.get('[data-testid="view-calendar"]').trigger('click')
    await nextTick()

    expect(wrapper.findComponent({ name: 'KanbanToolbar' }).exists()).toBe(false)
  })

  it('reseta currentDate para hoje ao abrir nova tarefa sem data explícita', async () => {
    const wrapper = await mountApp()
    const vm = wrapper.vm as unknown as {
      currentDate: string
      handleOpenNewTask: () => void
    }

    vm.currentDate = '2026-01-01'
    vm.handleOpenNewTask()
    await nextTick()

    expect(vm.currentDate).toBe(new Date().toISOString().split('T')[0])
  })
})
