/// <reference types="vite/client" />
import type { AppData } from './shared/appData'
import type { BackupInfo, ElectronOperationResult } from './types/ElectronApi'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface Window {
    electronAPI?: {
      loadAppData: () => Promise<AppData>
      saveAppData: (data: AppData) => Promise<ElectronOperationResult<boolean>>
      exportCSV: (data: string, filename: string) => Promise<ElectronOperationResult<boolean>>
      listBackups: () => Promise<BackupInfo[]>
      restoreBackup: (backupFilename: string) => Promise<ElectronOperationResult<boolean>>
    }
  }
}

export {}
