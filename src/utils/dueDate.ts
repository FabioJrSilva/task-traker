const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/

export interface DueDateFields {
  dueAt?: string | null
  dueHasTime?: boolean | null
}

export interface NormalizedDueDateFields {
  dueAt: string | null
  dueHasTime: boolean
}

export function parseDatePreservingLocal(value: string): Date | null {
  if (!value || typeof value !== 'string') {
    return null
  }

  if (DATE_ONLY_REGEX.test(value)) {
    const [yearString, monthString, dayString] = value.split('-')
    const year = Number(yearString)
    const month = Number(monthString)
    const day = Number(dayString)
    const parsed = new Date(year, month - 1, day)
    return isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? null : parsed
}

export function toLocalDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeDueFields(fields: DueDateFields): NormalizedDueDateFields {
  if (typeof fields.dueAt !== 'string' || !fields.dueAt.trim()) {
    return {
      dueAt: null,
      dueHasTime: false
    }
  }

  const inferredHasTime = typeof fields.dueHasTime === 'boolean'
    ? fields.dueHasTime
    : !DATE_ONLY_REGEX.test(fields.dueAt)

  if (!inferredHasTime) {
    if (DATE_ONLY_REGEX.test(fields.dueAt)) {
      return {
        dueAt: fields.dueAt,
        dueHasTime: false
      }
    }

    const parsedDate = parseDatePreservingLocal(fields.dueAt)
    return {
      dueAt: parsedDate ? toLocalDate(parsedDate) : null,
      dueHasTime: false
    }
  }

  const parsedDateTime = parseDatePreservingLocal(fields.dueAt)
  if (!parsedDateTime) {
    return {
      dueAt: null,
      dueHasTime: false
    }
  }

  return {
    dueAt: parsedDateTime.toISOString(),
    dueHasTime: true
  }
}

export function getTaskEffectiveDueDate(fields: DueDateFields): Date | null {
  if (!fields.dueAt) {
    return null
  }

  const hasTime = typeof fields.dueHasTime === 'boolean'
    ? fields.dueHasTime
    : !DATE_ONLY_REGEX.test(fields.dueAt)

  if (!hasTime) {
    const baseDate = parseDatePreservingLocal(fields.dueAt)
    if (!baseDate) {
      return null
    }

    return new Date(
      baseDate.getFullYear(),
      baseDate.getMonth(),
      baseDate.getDate(),
      23,
      59,
      59,
      999
    )
  }

  return parseDatePreservingLocal(fields.dueAt)
}

export function computeCompletedWithDelay(fields: DueDateFields, completedAtIso: string): boolean {
  const effectiveDueDate = getTaskEffectiveDueDate(fields)
  if (!effectiveDueDate) {
    return false
  }

  const completedAtDate = parseDatePreservingLocal(completedAtIso)
  if (!completedAtDate) {
    return false
  }

  return completedAtDate.getTime() > effectiveDueDate.getTime()
}
