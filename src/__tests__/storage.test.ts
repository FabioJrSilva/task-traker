import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppData } from '@/shared/appData'

// Helpers para criar dados de teste mínimos
function createBaseAppData(): AppData {
  return {
    schemaVersion: 3,
    columns: [{ id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' }],
    tasks: [],
    projects: [],
    meetings: [],
    appointments: [],
    taskOrder: {},
    workSettings: {
      workStartTime: '08:00',
      workEndTime: '18:00',
      workDays: [1, 2, 3, 4, 5],
    },
    actionHistory: [],
    labelFilter: null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyWindow = any

function clearElectronAPI() {
  delete (window as AnyWindow).electronAPI
}

function setElectronAPI(mock: AnyWindow) {
  ;(window as AnyWindow).electronAPI = mock
}

describe('getStorage – modo browser (sem electronAPI)', () => {
  beforeEach(() => {
    clearElectronAPI()
    window.localStorage.clear()
  })

  afterEach(() => {
    clearElectronAPI()
  })

  it('retorna implementação browser quando window.electronAPI é undefined', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()

    // load() deve retornar dados padrão (IndexedDB vazio → fallback para defaults)
    const data = await storage.load()
    expect(data).toBeDefined()
    expect(Array.isArray(data.columns)).toBe(true)
    expect(data.columns.length).toBeGreaterThan(0)
    expect(Array.isArray(data.tasks)).toBe(true)
  })

  it('load() retorna dados com estrutura válida no modo browser', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()

    const data = await storage.load()

    expect(data).toHaveProperty('schemaVersion')
    expect(data).toHaveProperty('columns')
    expect(data).toHaveProperty('tasks')
    expect(data).toHaveProperty('workSettings')
    expect(data.schemaVersion).toBeGreaterThanOrEqual(3)
  })

  it('save() e exportCSV() não disparam erros no modo browser', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()
    const testData = createBaseAppData()

    await expect(storage.save(testData)).resolves.toBeUndefined()

    const result = await storage.exportCSV('col1,col2\nval1,val2', 'teste.csv')
    expect(result).toBe(true)
  })
})

describe('getStorage – modo Electron (com electronAPI)', () => {
  const mockElectronAPI = {
    loadAppData: vi.fn(async () => createBaseAppData()),
    saveAppData: vi.fn(async () => ({ ok: true, data: true })),
    exportCSV: vi.fn(async () => ({ ok: true, data: true })),
  }

  beforeEach(() => {
    setElectronAPI(mockElectronAPI)
    vi.clearAllMocks()
    vi.resetModules()
  })

  afterEach(() => {
    clearElectronAPI()
  })

  it('usa electronAPI.loadAppData() quando electronAPI está disponível', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()

    const data = await storage.load()

    expect(mockElectronAPI.loadAppData).toHaveBeenCalledTimes(1)
    expect(data.columns).toHaveLength(1)
    expect(data.columns[0].title).toBe('Backlog')
  })

  it('usa electronAPI.saveAppData() quando electronAPI está disponível', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()
    const testData = createBaseAppData()

    await storage.save(testData)

    expect(mockElectronAPI.saveAppData).toHaveBeenCalledTimes(1)
    // Verifica que o dado foi chamado com AppData contendo schemaVersion e columns
    expect(mockElectronAPI.saveAppData).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaVersion: expect.any(Number) as number,
        columns: expect.any(Array) as unknown[],
      })
    )
  })

  it('usa electronAPI.exportCSV() quando electronAPI está disponível', async () => {
    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()

    const result = await storage.exportCSV('a,b\n1,2', 'relatorio.csv')

    expect(mockElectronAPI.exportCSV).toHaveBeenCalledTimes(1)
    expect(mockElectronAPI.exportCSV).toHaveBeenCalledWith('a,b\n1,2', 'relatorio.csv')
    expect(result).toBe(true)
  })

  it('propaga erro do electronAPI.saveAppData() sem lançar', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    clearElectronAPI()
    setElectronAPI({
      ...mockElectronAPI,
      saveAppData: vi.fn(async () => ({
        ok: false,
        message: 'Erro ao salvar',
      })),
    })

    const { getStorage } = await import('@/utils/storage')
    const storage = getStorage()

    await expect(storage.save(createBaseAppData())).resolves.toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('getStorage – comportamento defensivo', () => {
  afterEach(() => {
    clearElectronAPI()
    vi.resetModules()
  })

  it('getStorage é importável e expõe load/save/exportCSV', async () => {
    const { getStorage } = await import('@/utils/storage')
    expect(getStorage).toBeDefined()
    expect(typeof getStorage).toBe('function')

    clearElectronAPI()
    const storage = getStorage()
    expect(storage).toHaveProperty('load')
    expect(storage).toHaveProperty('save')
    expect(storage).toHaveProperty('exportCSV')
    expect(typeof storage.load).toBe('function')
    expect(typeof storage.save).toBe('function')
    expect(typeof storage.exportCSV).toBe('function')
  })
})
