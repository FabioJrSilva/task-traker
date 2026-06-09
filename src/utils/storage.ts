import type { AppData } from '@/shared/appData'
import { createDefaultAppData, migrateAppData, deepClone } from '@/shared/appData'
import { devLog } from '@/utils/devLog'

// Isola a persistência por ambiente: testes E2E sobem o Vite com VITE_E2E=true
// e gravam em um banco/chave separados, sem nunca tocar os dados reais.
const ENV_SUFFIX = import.meta.env.VITE_E2E === 'true' ? '_e2e' : ''
const DB_NAME = `TaskTrackerDB${ENV_SUFFIX}`
const STORE_NAME = 'appData'
const DB_VERSION = 1
const LOCAL_STORAGE_KEY = `task-tracker-app-data${ENV_SUFFIX}`

let db: IDBDatabase | null = null

function getDefaultAppData(): AppData {
  return createDefaultAppData()
}

function readLocalBackup(): AppData | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as unknown
    const migrated = migrateAppData(parsed)
    if (!migrated || !Array.isArray(migrated.columns) || !Array.isArray(migrated.tasks)) {
      return null
    }

    return deepClone(migrated)
  } catch (error) {
    console.error('Error loading localStorage backup:', error)
    return null
  }
}

function writeLocalBackup(data: AppData) {
  try {
    window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving localStorage backup:', error)
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db)
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function getData(): Promise<AppData> {
  const database = await openDB()
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.get('appData')

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      if (request.result && request.result.data) {
        const parsed = deepClone(request.result.data)
        resolve(parsed)
      } else {
        resolve(getDefaultAppData())
      }
    }
  })
}

async function saveData(data: AppData): Promise<void> {
  const database = await openDB()
  
  const dataToSave = deepClone(data)
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite')
    const store = transaction.objectStore(STORE_NAME)
    const request = store.put({ id: 'appData', data: dataToSave })

    request.onerror = () => {
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve()
    }
  })
}

export function getStorage(): {
  load: () => Promise<AppData>
  save: (data: AppData) => Promise<void>
  exportCSV: (data: string, filename: string) => Promise<boolean>
} {
  const isElectron = typeof window !== 'undefined' && !!window.electronAPI

  if (isElectron) {
    return {
      load: async () => {
        return migrateAppData(await window.electronAPI!.loadAppData())
      },
      save: async (data: AppData) => {
        try {
          const result = await window.electronAPI!.saveAppData(migrateAppData(data))
          if (!result.ok) {
            console.error('Error saving app data:', result.message)
          }
        } catch (e) {
          console.error('Error saving app data:', e)
        }
      },
      exportCSV: async (data: string, filename: string) => {
        const result = await window.electronAPI!.exportCSV(data, filename)
        if (!result.ok) {
          throw new Error(result.message)
        }
        return result.data
      }
    }
  }

  return {
    load: async () => {
      try {
        const data = migrateAppData(await getData())
        if (!data || !data.columns || !Array.isArray(data.columns) || data.columns.length === 0) {
          const backup = readLocalBackup()
          if (backup) {
            devLog('IndexedDB vazio, carregando backup do localStorage')
            await saveData(migrateAppData(backup))
            return backup
          }

          devLog('IndexedDB vazio ou dados inválidos, carregando defaults')
          return getDefaultAppData()
        }

        writeLocalBackup(data)
        devLog('Carregando do IndexedDB:', data.columns.length, 'colunas,', data.tasks.length, 'tarefas')
        return data
      } catch (e) {
        console.error('Error loading from IndexedDB:', e)
        const backup = readLocalBackup()
        if (backup) {
          devLog('Carregando backup do localStorage após falha no IndexedDB')
          return backup
        }
        return getDefaultAppData()
      }
    },
    save: async (data: AppData) => {
      try {
        const normalized = migrateAppData(data)
        writeLocalBackup(normalized)
        devLog('Salvando no IndexedDB:', data.columns.length, 'colunas,', data.tasks.length, 'tarefas')
        await saveData(normalized)
      } catch (e) {
        console.error('Error saving to IndexedDB:', e)
      }
    },
    exportCSV: async (data: string, filename: string) => {
      const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)
      return true
    }
  }
}
