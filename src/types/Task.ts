export interface TaskLabel {
  id: string
  name: string
  color: string
}

export interface TaskComment {
  id: string
  text: string
  authorId: string
  authorName: string
  createdAt: string
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export type RecurrenceType = 'daily' | 'weekly' | 'monthly'

export type MonthlyRecurrenceMode =
  | 'first_day'
  | 'fixed_day'
  | 'last_day'
  | 'last_workday'
  | 'nth_weekday'

export type BusinessDayAdjustment =
  | 'none'
  | 'previous_workday'
  | 'next_workday'

export interface RecurrenceConfig {
  type: RecurrenceType
  monthlyMode?: MonthlyRecurrenceMode
  dayOfMonth?: number
  weekOfMonth?: number
  dayOfWeek?: number
  businessDayAdjustment?: BusinessDayAdjustment
  copyChecklist?: boolean
}

export interface RecurrenceState {
  seriesId: string
  occurrenceNumber: number
  periodKey?: string
  sourceTaskId?: string
  generatedAt: string
}

export type DeveloperReviewStatus =
  | 'not_required'
  | 'pending'
  | 'in_review'
  | 'changes_requested'
  | 'approved'

export interface DeveloperMetadata {
  repositoryUrl?: string
  branchName?: string
  pullRequestUrl?: string
  issueUrl?: string
  environment?: string
  reviewStatus?: DeveloperReviewStatus
  blockedReason?: string
  estimateMinutes?: number
}

export interface Task {
  id: string
  title: string
  description: string
  status: string
  date: string
  dueAt?: string | null
  dueHasTime?: boolean
  completedWithDelay?: boolean | null
  timeSpent: number
  project: string        // KEEP - existing field (project name)
  projectId?: string     // NEW - link to Project
  order?: number        // NEW - position in column
  labels?: TaskLabel[]  // NEW - labels/tags
  comments?: TaskComment[]
  subtasks?: Subtask[]
  isRecurring?: boolean
  recurrence?: RecurrenceConfig
  recurrenceState?: RecurrenceState
  developerMetadata?: DeveloperMetadata
  completedAt?: string | null
  parentId?: string     // NEW - link to parent task
  deletedAt?: string | null  // Soft delete timestamp
  createdAt: string
  updatedAt: string
}
