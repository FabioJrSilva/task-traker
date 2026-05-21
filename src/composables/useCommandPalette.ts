import { ref } from 'vue'
import type { Project } from '@/types/Project'
import type { Task } from '@/types/Task'

export type CommandGroup = 'actions' | 'pomodoro' | 'tasks'

export interface PaletteCommand {
  id: string
  label: string
  group: CommandGroup
  icon: string
  disabled?: boolean
  action: () => void
}

export interface PaletteTaskResult {
  id: string
  title: string
  projectName: string
  status: string
  task: Task
}

export interface FilteredPalette {
  actionItems: PaletteCommand[]
  pomodoroItems: PaletteCommand[]
  taskItems: PaletteTaskResult[]
  totalCount: number
}

const MAX_TASKS_NO_QUERY = 8

export function filterPalette(
  commands: PaletteCommand[],
  tasks: Task[],
  projects: Project[],
  query: string,
): FilteredPalette {
  const normalizedQuery = query.toLowerCase().trim()
  const projectsById = new Map(projects.map(project => [project.id, project]))

  const matchesCommand = (command: PaletteCommand): boolean =>
    !normalizedQuery || command.label.toLowerCase().includes(normalizedQuery)

  const actionItems = commands.filter(
    command => command.group === 'actions' && matchesCommand(command),
  )
  const pomodoroItems = commands.filter(
    command => command.group === 'pomodoro' && matchesCommand(command),
  )

  const activeTasks = tasks
    .filter(task => !task.deletedAt)
    .sort(
      (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    )

  const matchedTasks = normalizedQuery
    ? activeTasks.filter(task => task.title.toLowerCase().includes(normalizedQuery))
    : activeTasks.slice(0, MAX_TASKS_NO_QUERY)

  const taskItems: PaletteTaskResult[] = matchedTasks.map(task => ({
    id: task.id,
    title: task.title,
    projectName: task.projectId
      ? (projectsById.get(task.projectId)?.name ?? 'Sem projeto')
      : 'Sem projeto',
    status: task.status,
    task,
  }))

  return {
    actionItems,
    pomodoroItems,
    taskItems,
    totalCount: actionItems.length + pomodoroItems.length + taskItems.length,
  }
}

const isOpen = ref(false)
const query = ref('')
const activeIndex = ref(0)

export function useCommandPalette(): {
  isOpen: typeof isOpen
  query: typeof query
  activeIndex: typeof activeIndex
  open: () => void
  close: () => void
  moveUp: (totalItems: number) => void
  moveDown: (totalItems: number) => void
  resetIndex: () => void
} {
  function open(): void {
    isOpen.value = true
    query.value = ''
    activeIndex.value = 0
  }

  function close(): void {
    isOpen.value = false
  }

  function moveUp(totalItems: number): void {
    if (totalItems === 0) {
      return
    }

    activeIndex.value = (activeIndex.value - 1 + totalItems) % totalItems
  }

  function moveDown(totalItems: number): void {
    if (totalItems === 0) {
      return
    }

    activeIndex.value = (activeIndex.value + 1) % totalItems
  }

  function resetIndex(): void {
    activeIndex.value = 0
  }

  return {
    isOpen,
    query,
    activeIndex,
    open,
    close,
    moveUp,
    moveDown,
    resetIndex,
  }
}
