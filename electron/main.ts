import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import * as fs from 'fs'
import type { AppData } from '../src/shared/appData'
import { createDefaultAppData, migrateAppData } from '../src/shared/appData'
import { performRestoreBackup } from './restoreValidation'

const DATA_FILE = join(app.getPath('userData'), 'app-data.json')
const BACKUP_DIR = join(app.getPath('userData'), 'backups')
const MAX_BACKUPS = 10

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

function loadAppData(): AppData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')) as unknown
      return migrateAppData(data)
    }
  } catch (e) {
    console.error('Error loading app data:', e)
  }
  return createDefaultAppData()
}

function saveAppData(data: AppData) {
  createBackup()
  const normalized = migrateAppData(data)
  fs.writeFileSync(DATA_FILE, JSON.stringify(normalized, null, 2))
}

function getBackupFilename(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  return `app-data-${timestamp}.json`
}

function createBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true })
    }

    if (fs.existsSync(DATA_FILE)) {
      const backupPath = join(BACKUP_DIR, getBackupFilename())
      fs.copyFileSync(DATA_FILE, backupPath)
      cleanOldBackups()
    }
  } catch (e) {
    console.error('Error creating backup:', e)
  }
}

function cleanOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('app-data-') && f.endsWith('.json'))
      .map(f => ({ name: f, path: join(BACKUP_DIR, f), mtime: fs.statSync(join(BACKUP_DIR, f)).mtime }))
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())

    if (files.length > MAX_BACKUPS) {
      files.slice(MAX_BACKUPS).forEach(f => {
        fs.unlinkSync(f.path)
      })
    }
  } catch (e) {
    console.error('Error cleaning old backups:', e)
  }
}

ipcMain.handle('load-app-data', () => loadAppData())

ipcMain.handle('save-app-data', (_, data: AppData) => {
  saveAppData(data)
  return true
})

ipcMain.handle('export-csv', async (_, data: string, defaultFilename: string) => {
  const result = await dialog.showSaveDialog({
    defaultPath: defaultFilename,
    filters: [{ name: 'CSV', extensions: ['csv'] }]
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data)
    return true
  }
  return false
})

ipcMain.handle('list-backups', () => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) {
      return []
    }
    return fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('app-data-') && f.endsWith('.json'))
      .map(f => ({ name: f, path: join(BACKUP_DIR, f), mtime: fs.statSync(join(BACKUP_DIR, f)).mtime.toISOString() }))
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime())
  } catch (e) {
    console.error('Error listing backups:', e)
    return []
  }
})

ipcMain.handle('restore-backup', (_, backupFilename: string) => {
  try {
    return performRestoreBackup(backupFilename, BACKUP_DIR, DATA_FILE)
  } catch (e) {
    console.error('Unexpected error restoring backup:', e)
    return false
  }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
