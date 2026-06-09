export type ElectronOperationErrorCode =
  | 'INVALID_PAYLOAD'
  | 'PAYLOAD_TOO_LARGE'
  | 'IO_ERROR'
  | 'VALIDATION_ERROR'

export type ElectronOperationResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; errorCode: ElectronOperationErrorCode; message: string }

export interface BackupInfo {
  name: string
  path: string
  mtime: string
}
