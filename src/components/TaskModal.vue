<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X, MessageCircle, Send, User, ChevronRight, ChevronDown, Plus, XCircle } from 'lucide-vue-next'
import { v4 as uuidv4 } from 'uuid'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type {
  BusinessDayAdjustment,
  DeveloperReviewStatus,
  MonthlyRecurrenceMode,
  Task,
  TaskLabel,
  TaskComment,
  Subtask,
  RecurrenceType,
  TaskType,
} from '@/types/Task'

const props = defineProps<{
  task: Task | null
  currentDate: string
  initialStatus?: string
}>()

const emit = defineEmits<{
  save: [task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>]
  delete: [id: string]
  close: []
}>()

const store = useTaskStore()
const toast = useToast()
const title = ref('')
const description = ref('')
const status = ref('')
const date = ref(props.currentDate)
const timeSpent = ref(0)
const project = ref('')
const projectId = ref('')
const labels = ref<TaskLabel[]>([])
const showLabelModal = ref(false)
const newLabelName = ref('')
const newLabelColor = ref('#6366f1')
const showConfirmClose = ref(false)
const showConfirmDelete = ref(false)
const comments = ref<TaskComment[]>([])
const newComment = ref('')
const showComments = ref(false)
const subtasks = ref<Subtask[]>([])
const newSubtaskTitle = ref('')
const showSubtasks = ref(false)
const isRecurring = ref(false)
const recurrenceType = ref<RecurrenceType>('daily')
const monthlyMode = ref<MonthlyRecurrenceMode>('first_day')
const dayOfMonth = ref('1')
const businessDayAdjustment = ref<BusinessDayAdjustment>('none')
const copyChecklist = ref(false)
const hasDueDate = ref(false)
const dueHasTime = ref(false)
const dueDate = ref('')
const dueTime = ref('')
const showDeveloperFields = ref(false)
const repositoryUrl = ref('')
const branchName = ref('')
const pullRequestUrl = ref('')
const issueUrl = ref('')
const environment = ref('')
const reviewStatus = ref<DeveloperReviewStatus | ''>('')
const blockedReason = ref('')
const estimateMinutes = ref<string | number>('')

const taskType = ref<TaskType>('task')
const apptStartDate = ref('')
const apptStartTime = ref('09:00')
const apptDuration = ref(60)

const availableLabels: ReadonlyArray<TaskLabel> = [
  { id: 'urgent', name: 'Urgente', color: '#ef4444' },
  { id: 'important', name: 'Importante', color: '#f59e0b' },
  { id: 'bug', name: 'Bug', color: '#dc2626' },
  { id: 'feature', name: 'Feature', color: '#10b981' },
  { id: 'improvement', name: 'Melhoria', color: '#3b82f6' },
  { id: 'documentation', name: 'Documentação', color: '#8b5cf6' },
  { id: 'design', name: 'Design', color: '#ec4899' },
  { id: 'backend', name: 'Backend', color: '#14b8a6' },
  { id: 'frontend', name: 'Frontend', color: '#f97316' },
  { id: 'testing', name: 'Teste', color: '#6366f1' }
]

function cloneLabels(source?: TaskLabel[]): TaskLabel[] {
  return source?.map(label => ({ ...label })) || []
}

function cloneComments(source?: TaskComment[]): TaskComment[] {
  return source?.map(comment => ({ ...comment })) || []
}

function cloneSubtasks(source?: Subtask[]): Subtask[] {
  return source?.map(subtask => ({ ...subtask })) || []
}

function toLocalDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toLocalTime(value: Date): string {
  const hours = String(value.getHours()).padStart(2, '0')
  const minutes = String(value.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

function normalizeDueFields(task: Task | null) {
  if (!task?.dueAt) {
    hasDueDate.value = false
    dueHasTime.value = false
    dueDate.value = ''
    dueTime.value = ''
    return
  }

  hasDueDate.value = true
  const hasTime = typeof task.dueHasTime === 'boolean'
    ? task.dueHasTime
    : task.dueAt.includes('T')
  dueHasTime.value = hasTime

  if (!hasTime) {
    dueDate.value = task.dueAt
    dueTime.value = ''
    return
  }

  const parsed = new Date(task.dueAt)
  if (isNaN(parsed.getTime())) {
    hasDueDate.value = false
    dueHasTime.value = false
    dueDate.value = ''
    dueTime.value = ''
    return
  }

  dueDate.value = toLocalDate(parsed)
  dueTime.value = toLocalTime(parsed)
}

function normalizeDeveloperFields(task: Task | null) {
  showDeveloperFields.value = false
  repositoryUrl.value = task?.developerMetadata?.repositoryUrl || ''
  branchName.value = task?.developerMetadata?.branchName || ''
  pullRequestUrl.value = task?.developerMetadata?.pullRequestUrl || ''
  issueUrl.value = task?.developerMetadata?.issueUrl || ''
  environment.value = task?.developerMetadata?.environment || ''
  reviewStatus.value = task?.developerMetadata?.reviewStatus || ''
  blockedReason.value = task?.developerMetadata?.blockedReason || ''
  estimateMinutes.value = typeof task?.developerMetadata?.estimateMinutes === 'number'
    ? String(task.developerMetadata.estimateMinutes)
    : ''
}

function normalizeMonthlyRecurrenceFields(task: Task | null) {
  const recurrence = task?.recurrence
  const mode = recurrence?.type === 'monthly'
    ? (recurrence.monthlyMode || 'first_day')
    : 'first_day'

  monthlyMode.value = mode
  dayOfMonth.value = recurrence?.type === 'monthly' && typeof recurrence.dayOfMonth === 'number'
    ? String(recurrence.dayOfMonth)
    : '1'
  businessDayAdjustment.value = recurrence?.type === 'monthly'
    ? (recurrence.businessDayAdjustment || 'none')
    : 'none'
  copyChecklist.value = Boolean(recurrence?.copyChecklist)
}

function toggleLabel(label: TaskLabel) {
  const idx = labels.value.findIndex(l => l.id === label.id)
  if (idx >= 0) {
    labels.value.splice(idx, 1)
  } else {
    labels.value.push(label)
  }
}

function isLabelSelected(label: TaskLabel): boolean {
  return labels.value.some(l => l.id === label.id)
}

function addCustomLabel() {
  if (!newLabelName.value.trim()) return
  const label: TaskLabel = {
    id: uuidv4(),
    name: newLabelName.value.trim(),
    color: newLabelColor.value
  }
  labels.value.push(label)
  newLabelName.value = ''
  showLabelModal.value = false
}

const projectOptions = computed(() => {
  return store.projects.map(p => ({
    value: p.id,
    label: p.name,
    color: p.color
  }))
})

const statusOptions = computed(() => {
  if (!store.sortedColumns || store.sortedColumns.length === 0) return []
  return store.sortedColumns.map(col => ({
    value: col.status,
    label: col.title
  }))
})

watch(() => props.task, (t) => {
  if (t) {
    title.value = t.title
    description.value = t.description
    status.value = t.status
    date.value = t.date
    timeSpent.value = t.timeSpent
    project.value = t.project
    projectId.value = t.projectId || ''
    labels.value = cloneLabels(t.labels)
    comments.value = cloneComments(t.comments)
    subtasks.value = cloneSubtasks(t.subtasks)
    isRecurring.value = Boolean(t.isRecurring && t.recurrence)
    recurrenceType.value = t.recurrence?.type || 'daily'
    normalizeMonthlyRecurrenceFields(t)
    normalizeDueFields(t)
    normalizeDeveloperFields(t)
    taskType.value = t.type || 'task'
    if (t.type === 'appointment' && t.appointmentId) {
      const linkedAppt = store.appointments.find(apt => apt.id === t.appointmentId)
      if (linkedAppt) {
        apptStartDate.value = linkedAppt.startDate
        apptStartTime.value = linkedAppt.startTime
        apptDuration.value = linkedAppt.duration
      }
    }
  } else {
    title.value = ''
    description.value = ''
    date.value = props.currentDate
    timeSpent.value = 0
    project.value = ''
    projectId.value = ''
    labels.value = []
    comments.value = []
    subtasks.value = []
    isRecurring.value = false
    recurrenceType.value = 'daily'
    normalizeMonthlyRecurrenceFields(null)
    hasDueDate.value = false
    dueHasTime.value = false
    dueDate.value = ''
    dueTime.value = ''
    taskType.value = 'task'
    apptStartDate.value = ''
    apptStartTime.value = '09:00'
    apptDuration.value = 60
    normalizeDeveloperFields(null)
    status.value = props.initialStatus || (store.sortedColumns[0]?.status || '')
  }
}, { immediate: true })

watch(() => props.initialStatus, (newStatus) => {
  if (newStatus && !props.task) {
    status.value = newStatus
  }
})

function handleSubmit() {
  if (!title.value.trim()) return

  // Handle appointment type task: update existing or create new
  if (taskType.value === 'appointment') {
    const selectedProject = store.projects.find(p => p.id === projectId.value)
    if (props.task) {
      // Update existing task via save emit (store sync propagates title/desc/project/dueAt)
      emit('save', {
        title: title.value,
        description: description.value,
        status: status.value,
        date: apptStartDate.value || date.value,
        timeSpent: timeSpent.value,
        project: selectedProject?.name || project.value,
        projectId: projectId.value || undefined,
        labels: labels.value.length > 0 ? [...labels.value] : undefined,
        comments: comments.value.length > 0 ? [...comments.value] : undefined,
        subtasks: subtasks.value.length > 0 ? [...subtasks.value] : undefined,
        isRecurring: isRecurring.value,
        dueAt: apptStartDate.value || date.value,
        dueHasTime: false,
      } as any)
      // Also update appointment-specific fields not covered by sync
      if (props.task.appointmentId) {
        store.updateAppointment(props.task.appointmentId, {
          startTime: apptStartTime.value,
          duration: apptDuration.value,
        })
      }
      return
    }
    // Create new appointment task
    store.addAppointmentTask({
      title: title.value,
      description: description.value,
      status: status.value,
      date: apptStartDate.value || date.value,
      timeSpent: timeSpent.value,
      project: selectedProject?.name || project.value,
      projectId: projectId.value || undefined,
      labels: labels.value.length > 0 ? [...labels.value] : undefined,
      comments: comments.value.length > 0 ? [...comments.value] : undefined,
      subtasks: subtasks.value.length > 0 ? [...subtasks.value] : undefined,
      isRecurring: isRecurring.value,
      startDate: apptStartDate.value || date.value,
      startTime: apptStartTime.value,
      duration: apptDuration.value,
    } as any)
    emit('close')
    return
  }

  let dueAt: string | null = null
  let normalizedDueHasTime = false

  if (hasDueDate.value && dueDate.value) {
    if (dueHasTime.value && dueTime.value) {
      const [year, month, day] = dueDate.value.split('-').map(Number)
      const [hours, minutes] = dueTime.value.split(':').map(Number)
      const localDateTime = new Date(year, month - 1, day, hours, minutes, 0, 0)

      if (!isNaN(localDateTime.getTime())) {
        dueAt = localDateTime.toISOString()
        normalizedDueHasTime = true
      }
    } else {
      dueAt = dueDate.value
      normalizedDueHasTime = false
    }
  }

  const normalizedEstimateText = String(estimateMinutes.value ?? '').trim()
  const parsedEstimate = normalizedEstimateText
    ? Number(normalizedEstimateText)
    : null

  const developerMetadata = {
    ...(repositoryUrl.value.trim() ? { repositoryUrl: repositoryUrl.value.trim() } : {}),
    ...(branchName.value.trim() ? { branchName: branchName.value.trim() } : {}),
    ...(pullRequestUrl.value.trim() ? { pullRequestUrl: pullRequestUrl.value.trim() } : {}),
    ...(issueUrl.value.trim() ? { issueUrl: issueUrl.value.trim() } : {}),
    ...(environment.value.trim() ? { environment: environment.value.trim() } : {}),
    ...(reviewStatus.value ? { reviewStatus: reviewStatus.value } : {}),
    ...(blockedReason.value.trim() ? { blockedReason: blockedReason.value.trim() } : {}),
    ...(
      parsedEstimate !== null
      && Number.isFinite(parsedEstimate)
      && parsedEstimate >= 0
        ? { estimateMinutes: Math.round(parsedEstimate) }
        : {}
    )
  }
  
  // Get project name from selected projectId
  const selectedProject = store.projects.find(p => p.id === projectId.value)
  const parsedDayOfMonth = Number(dayOfMonth.value)
  const recurrence = isRecurring.value
    ? {
        type: recurrenceType.value,
        ...(recurrenceType.value === 'monthly'
          ? {
              monthlyMode: monthlyMode.value,
              ...(monthlyMode.value === 'fixed_day'
                ? { dayOfMonth: Number.isInteger(parsedDayOfMonth) && parsedDayOfMonth >= 1 && parsedDayOfMonth <= 31
                  ? parsedDayOfMonth
                  : 1 }
                : {}),
              ...(businessDayAdjustment.value !== 'none'
                ? { businessDayAdjustment: businessDayAdjustment.value }
                : {}),
              ...(copyChecklist.value ? { copyChecklist: true } : {})
            }
          : {
              ...(copyChecklist.value ? { copyChecklist: true } : {})
            })
      }
    : undefined
  
  emit('save', {
    title: title.value,
    description: description.value,
    status: status.value,
    date: date.value,
    timeSpent: timeSpent.value,
    project: selectedProject?.name || project.value,
    projectId: projectId.value || undefined,
    labels: labels.value.length > 0 ? labels.value : undefined,
    comments: comments.value.length > 0 ? comments.value : undefined,
    subtasks: subtasks.value.length > 0 ? subtasks.value : undefined,
    isRecurring: isRecurring.value,
    recurrence,
    recurrenceState: isRecurring.value ? props.task?.recurrenceState : undefined,
    dueAt,
    dueHasTime: normalizedDueHasTime,
    developerMetadata: Object.keys(developerMetadata).length > 0
      ? developerMetadata
      : undefined
  })
}

function clearDueDate() {
  hasDueDate.value = false
  dueHasTime.value = false
  dueDate.value = ''
  dueTime.value = ''
}

function handleClose() {
  const hasDeveloperData = repositoryUrl.value.trim()
    || branchName.value.trim()
    || pullRequestUrl.value.trim()
    || issueUrl.value.trim()
    || environment.value.trim()
    || reviewStatus.value
    || blockedReason.value.trim()
    || String(estimateMinutes.value ?? '').trim()
  const hasData = title.value
    || description.value
    || project.value
    || timeSpent.value > 0
    || isRecurring.value
    || hasDueDate.value
    || hasDeveloperData
  if (hasData) {
    showConfirmClose.value = true
  } else {
    emit('close')
  }
}

function handleConfirmClose() {
  showConfirmClose.value = false
  emit('close')
}

function handleCancelClose() {
  showConfirmClose.value = false
}

function handleDelete() {
  showConfirmDelete.value = true
}

function handleConfirmDelete() {
  if (props.task) {
    emit('delete', props.task.id)
    emit('close')
  }
  showConfirmDelete.value = false
}

function handleCancelDelete() {
  showConfirmDelete.value = false
}

function addComment() {
  if (!newComment.value.trim()) return
  const comment: TaskComment = {
    id: uuidv4(),
    text: newComment.value.trim(),
    authorId: 'user',
    authorName: 'Usuário',
    createdAt: new Date().toISOString()
  }
  comments.value.push(comment)
  newComment.value = ''
}

function addSubtask() {
  if (!newSubtaskTitle.value.trim()) return
  subtasks.value.push({
    id: uuidv4(),
    title: newSubtaskTitle.value.trim(),
    completed: false
  })
  newSubtaskTitle.value = ''
}

function toggleSubtask(subtask: Subtask) {
  subtask.completed = !subtask.completed
}

function removeSubtask(subtask: Subtask) {
  const idx = subtasks.value.findIndex(s => s.id === subtask.id)
  if (idx >= 0) {
    subtasks.value.splice(idx, 1)
  }
}

const subtaskProgress = computed(() => {
  const total = subtasks.value.length
  const completed = subtasks.value.filter(s => s.completed).length
  return { completed, total }
})
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ task ? 'Editar Tarefa' : 'Nova Tarefa' }}</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label>Tipo</label>
          <select v-model="taskType" data-testid="task-type-select">
            <option value="task">Tarefa</option>
            <option value="appointment">Agendamento</option>
          </select>
        </div>
        <div class="form-group">
          <label>Título</label>
          <input v-model="title" type="text" required placeholder="Título da tarefa" />
        </div>
        
        <div class="form-group">
          <label>Descrição</label>
          <textarea v-model="description" rows="3" placeholder="Descrição da tarefa"></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Data</label>
            <input v-model="date" type="date" required />
          </div>
          
          <div class="form-group">
            <label>Projeto</label>
            <select v-model="projectId">
              <option value="">Selecione um projeto...</option>
              <option v-for="opt in projectOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>

        <template v-if="taskType === 'task'">
        <div class="form-group recurrence-group">
          <label class="recurrence-toggle-label">
            <input
              v-model="isRecurring"
              data-testid="recurrence-checkbox"
              type="checkbox"
            />
            Tarefa recorrente
          </label>

          <select
            v-if="isRecurring"
            v-model="recurrenceType"
            data-testid="recurrence-type-select"
          >
            <option value="daily">Diária</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensal</option>
          </select>

          <div v-if="isRecurring && recurrenceType === 'monthly'" class="monthly-recurrence-config">
            <div class="form-group">
              <label>Padrão mensal</label>
              <select v-model="monthlyMode" data-testid="recurrence-monthly-mode-select">
                <option value="first_day">Primeiro dia do mês</option>
                <option value="fixed_day">Dia fixo do mês</option>
                <option value="last_day">Último dia do mês</option>
                <option value="last_workday">Último dia útil do mês</option>
              </select>
            </div>

            <div v-if="monthlyMode === 'fixed_day'" class="form-group">
              <label>Dia do mês</label>
              <input
                v-model="dayOfMonth"
                data-testid="recurrence-day-of-month-input"
                type="number"
                min="1"
                max="31"
              />
            </div>

            <div class="form-group">
              <label>Ajuste de dia útil</label>
              <select
                v-model="businessDayAdjustment"
                data-testid="recurrence-business-day-adjustment-select"
              >
                <option value="none">Sem ajuste</option>
                <option value="previous_workday">Dia útil anterior</option>
                <option value="next_workday">Próximo dia útil</option>
              </select>
            </div>
          </div>

          <label v-if="isRecurring" class="recurrence-toggle-label">
            <input
              v-model="copyChecklist"
              data-testid="recurrence-copy-checklist-checkbox"
              type="checkbox"
            />
            Copiar checklist (subtarefas) para a próxima ocorrência
          </label>
        </div>

        <div class="form-group due-date-group">
          <div class="due-header">
            <label class="recurrence-toggle-label">
              <input
                v-model="hasDueDate"
                data-testid="due-enabled-checkbox"
                type="checkbox"
              />
              Definir prazo
            </label>
            <button
              v-if="hasDueDate"
              type="button"
              class="btn-clear-due"
              @click="clearDueDate"
            >
              Remover
            </button>
          </div>

          <div v-if="hasDueDate" class="due-inputs">
            <div class="form-group">
              <label>Data limite</label>
              <input
                v-model="dueDate"
                data-testid="due-date-input"
                type="date"
                required
              />
            </div>

            <label class="recurrence-toggle-label">
              <input
                v-model="dueHasTime"
                data-testid="due-has-time-checkbox"
                type="checkbox"
              />
              Incluir horário
            </label>

            <div v-if="dueHasTime" class="form-group">
              <label>Horário limite</label>
              <input
                v-model="dueTime"
                data-testid="due-time-input"
                type="time"
              />
            </div>
          </div>
        </div>
        </template>

        <template v-if="taskType === 'appointment'">
          <div class="form-row">
            <div class="form-group">
              <label>Data</label>
              <input v-model="apptStartDate" type="date" required data-testid="appt-start-date" />
            </div>
            <div class="form-group">
              <label>Hora de Início</label>
              <input v-model="apptStartTime" type="time" required data-testid="appt-start-time" />
            </div>
          </div>
          <div class="form-group">
            <label>Duração</label>
            <select v-model="apptDuration" data-testid="appt-duration">
              <option :value="15">15 minutos</option>
              <option :value="30">30 minutos</option>
              <option :value="60">1 hora</option>
              <option :value="90">1h30</option>
              <option :value="120">2 horas</option>
            </select>
          </div>
        </template>
        
        <div class="form-row">
          <div class="form-group">
            <label>Status</label>
            <select v-model="status" required>
              <option v-for="opt in statusOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Tempo (minutos)</label>
            <input v-model.number="timeSpent" type="number" min="0" placeholder="0" />
          </div>
        </div>
        
        <div class="form-group">
          <label>Labels</label>
          <div class="labels-container">
            <button 
              v-for="label in availableLabels" 
              :key="label.id"
              type="button"
              class="label-chip"
              :class="{ selected: isLabelSelected(label) }"
              :style="{ '--label-color': label.color }"
              @click="toggleLabel(label)"
            >
              <span class="label-dot"></span>
              {{ label.name }}
            </button>
          </div>
        </div>

        <div class="form-group">
          <button
            type="button"
            class="comments-toggle"
            data-testid="developer-fields-toggle"
            @click="showDeveloperFields = !showDeveloperFields"
          >
            <ChevronRight v-if="!showDeveloperFields" :size="16" />
            <ChevronDown v-else :size="16" />
            <span>Campos de desenvolvimento</span>
          </button>

          <div v-if="showDeveloperFields" class="comments-section dev-fields-section">
            <div class="dev-fields-grid">
              <div class="form-group">
                <label>Repositório (URL)</label>
                <input
                  v-model="repositoryUrl"
                  data-testid="developer-repository-url"
                  type="text"
                  placeholder="https://..."
                />
              </div>

              <div class="form-group">
                <label>Branch</label>
                <input
                  v-model="branchName"
                  data-testid="developer-branch-name"
                  type="text"
                  placeholder="feature/..."
                />
              </div>

              <div class="form-group">
                <label>Pull Request (URL)</label>
                <input
                  v-model="pullRequestUrl"
                  data-testid="developer-pr-url"
                  type="text"
                  placeholder="https://..."
                />
              </div>

              <div class="form-group">
                <label>Issue (URL)</label>
                <input
                  v-model="issueUrl"
                  data-testid="developer-issue-url"
                  type="text"
                  placeholder="https://..."
                />
              </div>

              <div class="form-group">
                <label>Ambiente</label>
                <input
                  v-model="environment"
                  data-testid="developer-environment"
                  type="text"
                  placeholder="local, dev, homologação..."
                />
              </div>

              <div class="form-group">
                <label>Status de revisão</label>
                <select v-model="reviewStatus" data-testid="developer-review-status">
                  <option value="">Sem status</option>
                  <option value="not_required">Não necessário</option>
                  <option value="pending">Pendente</option>
                  <option value="in_review">Em revisão</option>
                  <option value="changes_requested">Mudanças solicitadas</option>
                  <option value="approved">Aprovado</option>
                </select>
              </div>

              <div class="form-group">
                <label>Estimativa (min)</label>
                <input
                  v-model="estimateMinutes"
                  data-testid="developer-estimate-minutes"
                  type="number"
                  min="0"
                  placeholder="0"
                />
              </div>
            </div>

            <div class="form-group dev-fields-blocked-reason">
              <label>Motivo de bloqueio</label>
              <textarea
                v-model="blockedReason"
                data-testid="developer-blocked-reason"
                rows="2"
                placeholder="Detalhe técnico do bloqueio"
              />
            </div>
          </div>
        </div>
        
        <div v-if="task" class="form-group">
          <button type="button" class="comments-toggle" @click="showComments = !showComments">
            <MessageCircle :size="16" />
            <span>Comentários ({{ comments.length }})</span>
          </button>
          
          <div v-if="showComments" class="comments-section">
            <div class="comments-list">
              <div v-for="comment in comments" :key="comment.id" class="comment-item">
                <div class="comment-header">
                  <User :size="14" />
                  <span class="comment-author">{{ comment.authorName }}</span>
                  <span class="comment-date">{{ new Date(comment.createdAt).toLocaleString() }}</span>
                </div>
                <div class="comment-text">{{ comment.text }}</div>
              </div>
              <div v-if="comments.length === 0" class="no-comments">Nenhum comentário ainda</div>
            </div>
            
            <div class="add-comment">
              <input 
                v-model="newComment" 
                type="text" 
                placeholder="Adicionar comentário..."
                @keyup.enter="addComment"
              />
              <button type="button" class="btn-add-comment" @click="addComment" :disabled="!newComment.trim()">
                <Send :size="16" />
              </button>
            </div>
          </div>
        </div>
        
        <div v-if="task" class="form-group">
          <button type="button" class="comments-toggle" @click="showSubtasks = !showSubtasks">
            <ChevronRight v-if="!showSubtasks" :size="16" />
            <ChevronDown v-else :size="16" />
            <span>Subtarefas ({{ subtaskProgress.completed }}/{{ subtaskProgress.total }})</span>
          </button>
          
          <div v-if="showSubtasks" class="comments-section">
            <div class="subtasks-list">
              <div v-for="subtask in subtasks" :key="subtask.id" class="subtask-item">
                <input 
                  type="checkbox" 
                  :checked="subtask.completed" 
                  @change="toggleSubtask(subtask)"
                />
                <span :class="{ completed: subtask.completed }">{{ subtask.title }}</span>
                <button type="button" class="btn-remove-subtask" @click="removeSubtask(subtask)">
                  <XCircle :size="16" />
                </button>
              </div>
              <div v-if="subtasks.length === 0" class="no-comments">Nenhuma subtarefa ainda</div>
            </div>
            
            <div class="add-comment">
              <input 
                v-model="newSubtaskTitle" 
                type="text" 
                placeholder="Adicionar subtarefa..."
                @keyup.enter="addSubtask"
              />
              <button type="button" class="btn-add-comment" @click="addSubtask" :disabled="!newSubtaskTitle.trim()">
                <Plus :size="16" />
              </button>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="task" type="button" class="btn btn-danger" @click="handleDelete">Excluir</button>
          <div class="footer-right">
            <button type="button" class="btn btn-secondary" @click="handleClose">Fechar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        v-if="showConfirmClose"
        title="Descartar Alterações"
        message="Descartar alterações não salvas?"
        confirm-text="Descartar"
        cancel-text="Manter"
        type="warning"
        @confirm="handleConfirmClose"
        @cancel="handleCancelClose"
      />

      <ConfirmDialog
        v-if="showConfirmDelete && task"
        title="Excluir Tarefa"
        :message="`Excluir tarefa &quot;${task.title}&quot;?`"
        confirm-text="Excluir"
        cancel-text="Cancelar"
        type="danger"
        @confirm="handleConfirmDelete"
        @cancel="handleCancelDelete"
      />
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  width: 480px;
  max-width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.modal-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-group input,
.form-group textarea,
.form-group select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted);
}

.recurrence-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.monthly-recurrence-config {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.due-date-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.due-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.due-inputs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-clear-due {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
}

.btn-clear-due:hover {
  color: var(--danger, #e74c3c);
}

.recurrence-toggle-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-primary);
  text-transform: none;
  letter-spacing: 0;
}

.recurrence-toggle-label input {
  width: auto;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.footer-right {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 18px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-danger {
  background: var(--danger, #e74c3c);
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 500;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.labels-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.label-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.label-chip:hover {
  border-color: var(--label-color);
  background: color-mix(in srgb, var(--label-color) 10%, var(--bg-tertiary));
}

.label-chip.selected {
  border-color: var(--label-color);
  background: color-mix(in srgb, var(--label-color) 20%, var(--bg-tertiary));
  color: var(--label-color);
}

.label-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--label-color);
}

.comments-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  width: 100%;
}

.comments-toggle:hover {
  background: var(--bg-hover);
}

.comments-section {
  margin-top: 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
}

.comments-list {
  max-height: 200px;
  overflow-y: auto;
}

.comment-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.comment-item:last-child {
  border-bottom: none;
}

.comment-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  color: var(--text-muted);
  font-size: 11px;
}

.comment-author {
  font-weight: 500;
  color: var(--text-secondary);
}

.comment-date {
  margin-left: auto;
}

.comment-text {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.4;
}

.no-comments {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.add-comment {
  display: flex;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}

.add-comment input {
  flex: 1;
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-size: 13px;
}

.add-comment input:focus {
  outline: none;
  border-color: var(--accent);
}

.btn-add-comment {
  padding: 8px;
  background: var(--accent);
  border: none;
  border-radius: 4px;
  color: var(--bg-primary);
  cursor: pointer;
}

.btn-add-comment:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-add-comment:hover:not(:disabled) {
  background: var(--accent-hover);
}

.subtasks-list {
  max-height: 200px;
  overflow-y: auto;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border);
}

.subtask-item:last-child {
  border-bottom: none;
}

.subtask-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--accent);
}

.subtask-item span {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
}

.subtask-item span.completed {
  text-decoration: line-through;
  color: var(--text-muted);
}

.btn-remove-subtask {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
}

.btn-remove-subtask:hover {
  color: var(--danger);
}

.dev-fields-section {
  padding: 12px;
}

.dev-fields-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dev-fields-blocked-reason {
  margin-top: 10px;
  margin-bottom: 0;
}

@media (max-width: 680px) {
  .monthly-recurrence-config {
    grid-template-columns: 1fr;
  }

  .dev-fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
