import { ref } from 'vue'
import type { Task } from '@/types/Task'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'
import type { Project } from '@/types/Project'

export type GlobalSearchItemType = 'task' | 'meeting' | 'appointment' | 'project'

export interface GlobalSearchTaskResult {
  type: 'task'
  id: string
  title: string
  meta: string
  task: Task
}

export interface GlobalSearchMeetingResult {
  type: 'meeting'
  id: string
  title: string
  meta: string
  meeting: Meeting
}

export interface GlobalSearchAppointmentResult {
  type: 'appointment'
  id: string
  title: string
  meta: string
  appointment: Appointment
}

export interface GlobalSearchProjectResult {
  type: 'project'
  id: string
  title: string
  meta: string
  project: Project
}

export interface GlobalSearchResults {
  hasQuery: boolean
  tasks: GlobalSearchTaskResult[]
  meetings: GlobalSearchMeetingResult[]
  appointments: GlobalSearchAppointmentResult[]
  projects: GlobalSearchProjectResult[]
  totalCount: number
}

export function buildGlobalSearchResults(input: {
  query: string
  tasks: Task[]
  meetings: Meeting[]
  appointments: Appointment[]
  projects: Project[]
}): GlobalSearchResults {
  const query = input.query.trim().toLowerCase()
  if (!query) {
    return {
      hasQuery: false,
      tasks: [],
      meetings: [],
      appointments: [],
      projects: [],
      totalCount: 0,
    }
  }

  const projectNameById = new Map(input.projects.map(project => [project.id, project.name]))

  const tasks = input.tasks
    .filter(task => !task.deletedAt)
    .filter(task =>
      task.title.toLowerCase().includes(query)
      || task.description.toLowerCase().includes(query)
      || task.project.toLowerCase().includes(query),
    )
    .map(task => ({
      type: 'task' as const,
      id: task.id,
      title: task.title,
      meta: `${task.status} · ${projectNameById.get(task.projectId ?? '') ?? (task.project || 'Sem projeto')}`,
      task,
    }))

  const meetings = input.meetings
    .filter(meeting =>
      meeting.title.toLowerCase().includes(query)
      || (meeting.description ?? '').toLowerCase().includes(query),
    )
    .map(meeting => ({
      type: 'meeting' as const,
      id: meeting.id,
      title: meeting.title,
      meta: `${meeting.date}${meeting.time ? ` · ${meeting.time}` : ''}`,
      meeting,
    }))

  const appointments = input.appointments
    .filter(appointment =>
      appointment.title.toLowerCase().includes(query)
      || (appointment.description ?? '').toLowerCase().includes(query),
    )
    .map(appointment => ({
      type: 'appointment' as const,
      id: appointment.id,
      title: appointment.title,
      meta: `${appointment.startDate} · ${appointment.startTime}`,
      appointment,
    }))

  const projects = input.projects
    .filter(project =>
      project.name.toLowerCase().includes(query)
      || (project.client ?? '').toLowerCase().includes(query),
    )
    .map(project => ({
      type: 'project' as const,
      id: project.id,
      title: project.name,
      meta: project.client ? `Cliente: ${project.client}` : 'Projeto',
      project,
    }))

  return {
    hasQuery: true,
    tasks,
    meetings,
    appointments,
    projects,
    totalCount: tasks.length + meetings.length + appointments.length + projects.length,
  }
}

export function flattenGlobalSearchResults(results: GlobalSearchResults) {
  return [
    ...results.tasks,
    ...results.meetings,
    ...results.appointments,
    ...results.projects,
  ]
}

export function useGlobalSearch() {
  const query = ref('')
  const isOpen = ref(false)
  const activeIndex = ref(0)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    query.value = ''
    activeIndex.value = 0
  }

  function resetIndex() {
    activeIndex.value = 0
  }

  function moveDown(total: number) {
    if (total <= 0) return
    activeIndex.value = (activeIndex.value + 1) % total
  }

  function moveUp(total: number) {
    if (total <= 0) return
    activeIndex.value = (activeIndex.value - 1 + total) % total
  }

  return {
    query,
    isOpen,
    activeIndex,
    open,
    close,
    resetIndex,
    moveDown,
    moveUp,
  }
}
