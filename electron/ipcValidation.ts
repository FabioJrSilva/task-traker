import type { AppData } from '../src/shared/appData'
import type { ElectronOperationErrorCode, ElectronOperationResult } from '../src/types/ElectronApi'
import { isValidBackupFilename } from './restoreValidation'

const MAX_APP_DATA_BYTES = 10 * 1024 * 1024
const MAX_CSV_BYTES = 5 * 1024 * 1024
const MAX_CSV_FILENAME_LENGTH = 160

interface CsvExportPayload {
  data: string
  filename: string
}

function success<T>(data: T): ElectronOperationResult<T> {
  return { ok: true, data }
}

function failure<T = never>(
  errorCode: ElectronOperationErrorCode,
  message: string,
): ElectronOperationResult<T> {
  return { ok: false, errorCode, message }
}

function getUtf8ByteLength(value: string): number {
  return Buffer.byteLength(value, 'utf-8')
}

function getSerializedByteLength(value: unknown): number | null {
  try {
    return getUtf8ByteLength(JSON.stringify(value))
  } catch {
    return null
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isSafeCsvFilename(filename: string): boolean {
  if (!filename.trim()) {
    return false
  }
  if (filename.length > MAX_CSV_FILENAME_LENGTH) {
    return false
  }
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false
  }
  return filename.toLowerCase().endsWith('.csv')
}

export function validateAppDataPayload(payload: unknown): ElectronOperationResult<AppData> {
  if (!isPlainObject(payload)) {
    return failure('INVALID_PAYLOAD', 'Não foi possível salvar os dados do aplicativo.')
  }

  const byteLength = getSerializedByteLength(payload)
  if (byteLength === null) {
    return failure('INVALID_PAYLOAD', 'Não foi possível salvar os dados do aplicativo.')
  }
  if (byteLength > MAX_APP_DATA_BYTES) {
    return failure(
      'PAYLOAD_TOO_LARGE',
      'Os dados do aplicativo são grandes demais para salvar com segurança.',
    )
  }

  return success(payload as AppData)
}

export function validateCsvExportPayload(
  data: unknown,
  filename: unknown,
): ElectronOperationResult<CsvExportPayload> {
  if (typeof data !== 'string') {
    return failure('INVALID_PAYLOAD', 'Não foi possível exportar o CSV.')
  }
  if (typeof filename !== 'string' || !isSafeCsvFilename(filename)) {
    return failure('INVALID_PAYLOAD', 'Nome de arquivo CSV inválido.')
  }
  if (getUtf8ByteLength(data) > MAX_CSV_BYTES) {
    return failure('PAYLOAD_TOO_LARGE', 'O CSV é grande demais para exportar com segurança.')
  }

  return success({ data, filename })
}

export function validateRestoreBackupPayload(payload: unknown): ElectronOperationResult<string> {
  if (!isValidBackupFilename(payload)) {
    return failure('INVALID_PAYLOAD', 'Backup inválido para restauração.')
  }

  return success(payload)
}

export function createIpcFailure<T = never>(
  errorCode: 'IO_ERROR' | 'VALIDATION_ERROR',
  message: string,
): ElectronOperationResult<T> {
  return failure(errorCode, message)
}

export function createIpcSuccess<T>(data: T): ElectronOperationResult<T> {
  return success(data)
}
