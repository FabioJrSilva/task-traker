import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { shallowMount } from '@vue/test-utils'
import App from '@/App.vue'

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
  actionHistory: [],
  trashedTasks: [],
  sortedColumns: [],
  searchQuery: '',
  columnFilter: null,
  labelFilter: null
}))

vi.mock('@/stores/taskStore', () => ({
  useTaskStore: () => mockStore
}))

vi.mock('@/utils/toast', () => ({
  useToast: () => ({
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn()
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
  RotateCcw: { template: '<span />' },
  Trash2: { template: '<span />' },
  Database: { template: '<span />' },
  Moon: { template: '<span />' },
  Sun: { template: '<span />' },
  BarChart2: { template: '<span />' },
  ChevronLeft: { template: '<span />' },
  ChevronRight: { template: '<span />' },
  Download: { template: '<span />' },
}))

async function mountApp() {
  const wrapper = shallowMount(App)
  await Promise.resolve()
  await nextTick()
  return wrapper
}

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
})
