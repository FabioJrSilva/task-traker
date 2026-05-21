import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import * as fs from 'fs'
import {
  isValidBackupFilename,
  isPathContained,
  isValidAppDataStructure,
  atomicWriteRestore,
  performRestoreBackup
} from '../restoreValidation'

describe('isValidBackupFilename', () => {
  it('returns true for valid generated name', () => {
    expect(isValidBackupFilename('app-data-2026-01-01T00-00-00-000Z.json')).toBe(true)
  })

  it('returns false for ../app-data.json', () => {
    expect(isValidBackupFilename('../app-data.json')).toBe(false)
  })

  it('returns false for absolute path', () => {
    expect(isValidBackupFilename('/absolute/path.json')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidBackupFilename('')).toBe(false)
  })

  it('returns false for wrong timestamp format', () => {
    expect(isValidBackupFilename('app-data-foo.json')).toBe(false)
  })

  it('returns true for valid timestamp', () => {
    expect(isValidBackupFilename('app-data-2026-01-01T00-00-00-000Z.json')).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidBackupFilename(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isValidBackupFilename(undefined)).toBe(false)
  })

  it('returns false for names with spaces', () => {
    expect(isValidBackupFilename('app-data-2026-01-01T00-00-00-000Z backup.json')).toBe(false)
  })
})

describe('isPathContained', () => {
  it('returns true for legal filename inside baseDir', () => {
    const baseDir = join(tmpdir(), 'backups')
    expect(isPathContained(baseDir, 'app-data-2026-01-01T00-00-00-000Z.json')).toBe(true)
  })

  it('returns false for ../escape.json', () => {
    const baseDir = join(tmpdir(), 'backups')
    expect(isPathContained(baseDir, '../escape.json')).toBe(false)
  })

  it('returns false for absolute path', () => {
    const baseDir = join(tmpdir(), 'backups')
    expect(isPathContained(baseDir, '/etc/passwd')).toBe(false)
  })

  it('returns false for empty string', () => {
    const baseDir = join(tmpdir(), 'backups')
    expect(isPathContained(baseDir, '')).toBe(false)
  })
})

describe('isValidAppDataStructure', () => {
  const validAppData = {
    schemaVersion: 3,
    columns: [],
    tasks: [],
    projects: [],
    meetings: [],
    appointments: [],
    taskOrder: {},
    workSettings: { workStartTime: '08:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
    actionHistory: [],
    labelFilter: null
  }

  it('returns true for valid AppData-like object', () => {
    expect(isValidAppDataStructure(validAppData).valid).toBe(true)
  })

  it('returns false for null', () => {
    expect(isValidAppDataStructure(null).valid).toBe(false)
  })

  it('returns false for array', () => {
    expect(isValidAppDataStructure([]).valid).toBe(false)
  })

  it('returns false for string', () => {
    expect(isValidAppDataStructure('string').valid).toBe(false)
  })

  it('returns false when missing tasks', () => {
    const { tasks: _, ...rest } = validAppData
    expect(isValidAppDataStructure(rest).valid).toBe(false)
  })

  it('returns false when missing columns', () => {
    const { columns: _, ...rest } = validAppData
    expect(isValidAppDataStructure(rest).valid).toBe(false)
  })

  it('returns true for object with all required keys', () => {
    expect(isValidAppDataStructure(validAppData).valid).toBe(true)
  })

  it('returns true without actionHistory and labelFilter (v1 compat)', () => {
    const { actionHistory: _, labelFilter: __, ...rest } = validAppData as Record<string, unknown>
    expect(isValidAppDataStructure(rest).valid).toBe(true)
  })

  it('returns true with extra unknown keys', () => {
    expect(isValidAppDataStructure({ ...validAppData, extraKey: 'value' }).valid).toBe(true)
  })

  it('returns true with wrong types for keys (structure only checks presence)', () => {
    expect(isValidAppDataStructure({ ...validAppData, columns: 'not_array' }).valid).toBe(true)
  })
})

describe('atomicWriteRestore', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `atomic-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    fs.mkdirSync(tempDir, { recursive: true })
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  it('writes data atomically and cleans up temp file', () => {
    const targetPath = join(tempDir, 'data.json')
    atomicWriteRestore(targetPath, { test: true })
    expect(fs.existsSync(targetPath)).toBe(true)
    expect(fs.existsSync(targetPath + '.restore-tmp')).toBe(false)
    const content = JSON.parse(fs.readFileSync(targetPath, 'utf-8'))
    expect(content.test).toBe(true)
  })

  it('cleans up temp file when rename fails', () => {
    const targetPath = join(tempDir, 'target-dir')
    fs.mkdirSync(targetPath) // make it a directory so rename fails
    expect(() => atomicWriteRestore(targetPath, { test: true })).toThrow()
    expect(fs.existsSync(targetPath + '.restore-tmp')).toBe(false)
  })
})

describe('performRestoreBackup (integration)', () => {
  let tempDir: string
  let backupDir: string
  let dataFile: string

  beforeEach(() => {
    tempDir = join(tmpdir(), `restore-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    backupDir = join(tempDir, 'backups')
    dataFile = join(tempDir, 'app-data.json')
    fs.mkdirSync(backupDir, { recursive: true })
    fs.writeFileSync(dataFile, JSON.stringify({ original: true }))
  })

  afterEach(() => {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch {
      // ignore cleanup errors
    }
  })

  const createValidBackup = (): string => {
    const backup = {
      schemaVersion: 3,
      columns: [{ id: 'col-1', title: 'Backlog', status: 'backlog', order: 0, color: '#7ea4ff' }],
      tasks: [],
      projects: [],
      meetings: [],
      appointments: [],
      taskOrder: {},
      workSettings: { workStartTime: '08:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] }
    }
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'
    fs.writeFileSync(join(backupDir, filename), JSON.stringify(backup))
    return filename
  }

  it('restores valid backup and updates DATA_FILE', () => {
    const filename = createValidBackup()
    const result = performRestoreBackup(filename, backupDir, dataFile)
    expect(result).toBe(true)
    const restored = JSON.parse(fs.readFileSync(dataFile, 'utf-8'))
    expect(restored.schemaVersion).toBe(3)
    expect(restored.columns).toHaveLength(1)
    expect(fs.existsSync(dataFile + '.restore-tmp')).toBe(false)
  })

  it('rejects path traversal filename and preserves DATA_FILE', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup('../app-data.json', backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Restore rejected: filename')
    )
    warnSpy.mockRestore()
  })

  it('rejects absolute path and preserves DATA_FILE', () => {
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup('/etc/passwd', backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
  })

  it('rejects invalid JSON and preserves DATA_FILE', () => {
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'
    fs.writeFileSync(join(backupDir, filename), '{"truncated": ')
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup(filename, backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
    expect(fs.existsSync(dataFile + '.restore-tmp')).toBe(false)
  })

  it('rejects null content and preserves DATA_FILE', () => {
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'
    fs.writeFileSync(join(backupDir, filename), 'null')
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup(filename, backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
  })

  it('rejects array content and preserves DATA_FILE', () => {
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'
    fs.writeFileSync(join(backupDir, filename), '[]')
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup(filename, backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
  })

  it('rejects missing required keys and preserves DATA_FILE', () => {
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'
    const incomplete = { schemaVersion: 3, columns: [] }
    fs.writeFileSync(join(backupDir, filename), JSON.stringify(incomplete))
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup(filename, backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
  })

  it('returns false for nonexistent valid-pattern file', () => {
    const originalContent = fs.readFileSync(dataFile, 'utf-8')
    const result = performRestoreBackup('app-data-2026-01-01T00-00-00-000Z.json', backupDir, dataFile)
    expect(result).toBe(false)
    expect(fs.readFileSync(dataFile, 'utf-8')).toBe(originalContent)
  })
})
