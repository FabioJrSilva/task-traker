import { contextBridge, ipcRenderer } from 'electron'
import type { AppData } from '../src/shared/appData'
import type { ElectronOperationResult } from '../src/types/ElectronApi'

type ElectronApi = {
  loadAppData: () => Promise<AppData>
  saveAppData: (data: AppData) => Promise<ElectronOperationResult<boolean>>
  exportCSV: (data: string, filename: string) => Promise<ElectronOperationResult<boolean>>
  listBackups: () => Promise<Array<{ name: string; path: string; mtime: string }>>
  restoreBackup: (backupFilename: string) => Promise<ElectronOperationResult<boolean>>
}

const electronApi: ElectronApi = {
  loadAppData: () => ipcRenderer.invoke('load-app-data'),
  saveAppData: (data: AppData) => ipcRenderer.invoke('save-app-data', data),
  exportCSV: (data: string, filename: string) => ipcRenderer.invoke('export-csv', data, filename),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (backupFilename: string) => ipcRenderer.invoke('restore-backup', backupFilename)
}

contextBridge.exposeInMainWorld('electronAPI', electronApi)
