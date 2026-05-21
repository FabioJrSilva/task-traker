import { contextBridge, ipcRenderer } from 'electron'
import type { AppData } from '../src/shared/appData'

contextBridge.exposeInMainWorld('electronAPI', {
  loadAppData: () => ipcRenderer.invoke('load-app-data'),
  saveAppData: (data: AppData) => ipcRenderer.invoke('save-app-data', data),
  exportCSV: (data: string, filename: string) => ipcRenderer.invoke('export-csv', data, filename),
  listBackups: () => ipcRenderer.invoke('list-backups'),
  restoreBackup: (backupFilename: string) => ipcRenderer.invoke('restore-backup', backupFilename)
})
