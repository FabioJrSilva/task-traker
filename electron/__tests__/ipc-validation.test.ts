import { describe, expect, it } from 'vitest'
import {
  validateAppDataPayload,
  validateCsvExportPayload,
  validateRestoreBackupPayload,
} from '../ipcValidation'

describe('IPC payload validation', () => {
  it('rejects non-object app data payloads', () => {
    const result = validateAppDataPayload('not-app-data')

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Não foi possível salvar os dados do aplicativo.',
    })
  })

  it('rejects oversized app data payloads before migration', () => {
    const result = validateAppDataPayload({ tasks: 'x'.repeat(10 * 1024 * 1024 + 1) })

    expect(result).toEqual({
      ok: false,
      errorCode: 'PAYLOAD_TOO_LARGE',
      message: 'Os dados do aplicativo são grandes demais para salvar com segurança.',
    })
  })

  it('accepts object app data payloads within the size limit', () => {
    const payload = { tasks: [], columns: [] }
    const result = validateAppDataPayload(payload)

    expect(result).toEqual({ ok: true, data: payload })
  })

  it('rejects CSV export payloads with invalid data type', () => {
    const result = validateCsvExportPayload(123, 'relatorio.csv')

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Não foi possível exportar o CSV.',
    })
  })

  it('rejects CSV export payloads with unsafe filenames', () => {
    const result = validateCsvExportPayload('a,b', '../relatorio.csv')

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Nome de arquivo CSV inválido.',
    })
  })

  it('rejects oversized CSV export payloads', () => {
    const result = validateCsvExportPayload('x'.repeat(5 * 1024 * 1024 + 1), 'relatorio.csv')

    expect(result).toEqual({
      ok: false,
      errorCode: 'PAYLOAD_TOO_LARGE',
      message: 'O CSV é grande demais para exportar com segurança.',
    })
  })

  it('accepts valid CSV export payloads', () => {
    expect(validateCsvExportPayload('coluna\nvalor', 'relatorio.csv')).toEqual({
      ok: true,
      data: { data: 'coluna\nvalor', filename: 'relatorio.csv' },
    })
  })

  it('rejects invalid restore backup identifiers', () => {
    const result = validateRestoreBackupPayload('../app-data.json')

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_PAYLOAD',
      message: 'Backup inválido para restauração.',
    })
  })

  it('accepts valid restore backup identifiers', () => {
    const filename = 'app-data-2026-01-01T00-00-00-000Z.json'

    expect(validateRestoreBackupPayload(filename)).toEqual({ ok: true, data: filename })
  })
})
