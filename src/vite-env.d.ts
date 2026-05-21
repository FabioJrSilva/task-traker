/// <reference types="vite/client" />
import type { AppData } from './shared/appData'

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

declare global {
  interface Window {
    electronAPI?: {
      loadAppData: () => Promise<AppData>
      saveAppData: (data: AppData) => Promise<boolean>
      exportCSV: (data: string, filename: string) => Promise<boolean>
      listBackups: () => Promise<Array<{ name: string; path: string; mtime: string }>>
      restoreBackup: (backupFilename: string) => Promise<boolean>
    }
  }
}

export {}
