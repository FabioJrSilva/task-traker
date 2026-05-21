import { resolve, sep, join } from 'path'
import * as fs from 'fs'
import { migrateAppData } from '../src/shared/appData'

const BACKUP_FILENAME_REGEX = /^app-data-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.json$/

export function isValidBackupFilename(filename: unknown): boolean {
  if (typeof filename !== 'string') {
    return false
  }
  if (filename.length === 0) {
    return false
  }
  // Defense-in-depth: reject path separators even though the regex would already
  // reject them. This guards against unexpected filename formats or future regex changes.
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false
  }
  return BACKUP_FILENAME_REGEX.test(filename)
}

export function isPathContained(baseDir: string, filename: string): boolean {
  const resolvedBase = resolve(baseDir)
  const resolvedCandidate = resolve(baseDir, filename)
  return resolvedCandidate.startsWith(resolvedBase + sep)
}

const REQUIRED_KEYS = [
  'schemaVersion',
  'columns',
  'tasks',
  'projects',
  'meetings',
  'appointments',
  'taskOrder',
  'workSettings'
]

export interface AppDataValidationResult {
  valid: boolean
  missingKeys?: string[]
}

export function isValidAppDataStructure(raw: unknown): AppDataValidationResult {
  if (raw === null || typeof raw !== 'object') {
    return { valid: false }
  }
  if (Array.isArray(raw)) {
    return { valid: false }
  }
  const obj = raw as Record<string, unknown>
  const missingKeys = REQUIRED_KEYS.filter(key => !(key in obj))
  if (missingKeys.length > 0) {
    return { valid: false, missingKeys }
  }
  return { valid: true }
}

export function atomicWriteRestore(targetPath: string, data: object): void {
  const tmpPath = targetPath + '.restore-tmp'
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), { encoding: 'utf-8', mode: 0o600 })
    fs.renameSync(tmpPath, targetPath)
  } finally {
    try {
      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath)
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

export function performRestoreBackup(
  backupFilename: unknown,
  backupDir: string,
  dataFilePath: string
): boolean {
  if (!isValidBackupFilename(backupFilename)) {
    console.warn(`Restore rejected: filename "${backupFilename}" does not match backup pattern`)
    return false
  }

  const resolvedCandidate = resolve(backupDir, backupFilename as string)
  if (!isPathContained(backupDir, backupFilename as string)) {
    console.warn(`Restore rejected: resolved path "${resolvedCandidate}" is outside backup directory`)
    return false
  }

  const backupPath = join(backupDir, backupFilename as string)

  if (!fs.existsSync(backupPath)) {
    console.warn(`Restore rejected: backup file not found: ${backupPath}`)
    return false
  }

  // Read file first — read errors bubble up to the outer catch
  const fileContent = fs.readFileSync(backupPath, 'utf-8')

  // Parse JSON separately so parse errors get a specific warning
  let rawBackup: unknown
  try {
    rawBackup = JSON.parse(fileContent) as unknown
  } catch {
    console.warn('Restore rejected: backup content is not a JSON object')
    return false
  }

  const validation = isValidAppDataStructure(rawBackup)
  if (!validation.valid) {
    if (validation.missingKeys) {
      console.warn(`Restore rejected: backup missing required keys: ${validation.missingKeys.join(', ')}`)
    } else {
      console.warn('Restore rejected: backup content is not a JSON object')
    }
    return false
  }

  const migrated = migrateAppData(rawBackup)

  try {
    atomicWriteRestore(dataFilePath, migrated)
  } catch (e) {
    console.error('Failed to write restored data:', e)
    return false
  }

  return true
}
