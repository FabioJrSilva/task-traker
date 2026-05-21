<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import TaskModal from '@/components/TaskModal.vue'
import ReportModal from '@/components/ReportModal.vue'
import HistorySidebar from '@/components/HistorySidebar.vue'
import HistoryTableModal from '@/components/HistoryTableModal.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import ColumnModal from '@/components/ColumnModal.vue'
import CalendarContainer from '@/components/CalendarContainer.vue'
import AppointmentModal from '@/components/AppointmentModal.vue'
import WorkSettingsModal from '@/components/WorkSettingsModal.vue'
import BackupModal from '@/components/BackupModal.vue'
import MeetingModal from '@/components/MeetingModal.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import NotificationBell from '@/components/NotificationBell.vue'
import PomodoroWidget from '@/components/PomodoroWidget.vue'
import ToastContainer from '@/components/ToastContainer.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { Plus, FileText, Calendar, Pencil, Search, FolderPlus, Grid3x3, RotateCcw, Trash2, Database, Moon, Sun, BarChart2 } from 'lucide-vue-next'
import { type PaletteCommand, useCommandPalette } from '@/composables/useCommandPalette'
import { useNotifications } from '@/composables/useNotifications'
import { usePomodoroStore } from '@/stores/pomodoroStore'
import ProjectModal from '@/components/ProjectModal.vue'
import InsightsDashboardView from '@/views/InsightsDashboardView.vue'
import type { Task } from '@/types/Task'
import type { Project } from '@/types/Project'
import type { KanbanColumn } from '@/types/Kanban'
import type { ColumnDraft, WorkSettings } from '@/shared/appData'
import type { Appointment } from '@/types/Appointment'
import type { Meeting } from '@/types/Meeting'

const toast = useToast()
const commandPalette = useCommandPalette()
const pomodoroStore = usePomodoroStore()
const { checkNotifications } = useNotifications()
const store = useTaskStore()
const showTaskModal = ref(false)
const showReportModal = ref(false)
const showHistoryTable = ref(false)
const showColumnModal = ref(false)
const showProjectModal = ref(false)
const editMode = ref(false)
const editingTask = ref<Task | null>(null)
const editingColumn = ref<KanbanColumn | null>(null)
const editingProject = ref<Project | null>(null)
const showSearch = ref(false)
const currentDate = ref(new Date().toISOString().split('T')[0])
const timeTick = ref(Date.now())
const initialTaskStatus = ref<string>('')
const isLoading = ref(true)

// Calendar view state
const currentView = ref<'kanban' | 'calendar' | 'insights'>('kanban')
const showAppointmentModal = ref(false)
const showWorkSettingsModal = ref(false)
const showBackupModal = ref(false)
const showMeetingModal = ref(false)
const editingAppointment = ref<Appointment | null>(null)
const editingMeeting = ref<Meeting | null>(null)
const appointmentInitialDate = ref('')
const appointmentInitialTime = ref('')
const theme = ref<'dark' | 'light'>('dark')
let recurringSchedulerId: ReturnType<typeof setInterval> | null = null
let isProcessingRecurring = false

const paletteCommands = computed<PaletteCommand[]>(() => [
  {
    id: 'new-task',
    label: 'Nova Tarefa',
    group: 'actions',
    icon: '➕',
    action: () => {
      handleOpenNewTask()
    },
  },
  {
    id: 'open-insights',
    label: 'Abrir Insights',
    group: 'actions',
    icon: '📊',
    action: () => {
      currentView.value = 'insights'
    },
  },
  {
    id: 'open-calendar',
    label: 'Abrir Calendário',
    group: 'actions',
    icon: '📅',
    action: () => {
      currentView.value = 'calendar'
    },
  },
  {
    id: 'open-kanban',
    label: 'Abrir Kanban',
    group: 'actions',
    icon: '🗂',
    action: () => {
      currentView.value = 'kanban'
    },
  },
  {
    id: 'export-csv',
    label: 'Exportar CSV (relatório mensal)',
    group: 'actions',
    icon: '⬇',
    action: () => {
      showReportModal.value = true
    },
  },
  {
    id: 'toggle-theme',
    label: 'Alternar Tema',
    group: 'actions',
    icon: '🌙',
    action: () => {
      toggleTheme()
    },
  },
  {
    id: 'open-backup',
    label: 'Backup e Restauração',
    group: 'actions',
    icon: '🗄',
    action: () => {
      showBackupModal.value = true
    },
  },
  {
    id: 'pomodoro-start',
    label: 'Iniciar Pomodoro',
    group: 'pomodoro',
    icon: '▶',
    action: () => pomodoroStore.start(),
  },
  {
    id: 'pomodoro-pause',
    label: 'Pausar / Continuar Pomodoro',
    group: 'pomodoro',
    icon: '⏸',
    action: () => pomodoroStore.togglePause(),
  },
  {
    id: 'pomodoro-stop',
    label: 'Finalizar Pomodoro',
    group: 'pomodoro',
    icon: '⏹',
    action: () => pomodoroStore.stop(),
  },
])

async function runRecurringSchedulerTick() {
  if (isProcessingRecurring) {
    return
  }

  isProcessingRecurring = true
  try {
    await store.processRecurringTasks()
    checkNotifications(store.tasks, store.columns, store.timeEntries, store.projects)
  } catch (error) {
    console.error('Erro ao processar recorrências em runtime:', error)
  } finally {
    isProcessingRecurring = false
  }
}

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
  document.documentElement.setAttribute('data-theme', theme.value)
  localStorage.setItem('task-tracker-theme', theme.value)
}

onMounted(async () => {
  await store.loadAppData()
  isLoading.value = false
  document.addEventListener('keydown', handleKeyDown)

  recurringSchedulerId = setInterval(() => {
    void runRecurringSchedulerTick()
    timeTick.value = Date.now()
  }, 60 * 1000)
  
  const savedTheme = localStorage.getItem('task-tracker-theme') as 'dark' | 'light' | null
  if (savedTheme) {
    theme.value = savedTheme
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    theme.value = prefersDark ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-theme', theme.value)

  if (
    import.meta.env.VITE_E2E !== 'true'
    && 'Notification' in window
    && window.Notification.permission === 'default'
  ) {
    void window.Notification.requestPermission()
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  if (recurringSchedulerId) {
    clearInterval(recurringSchedulerId)
    recurringSchedulerId = null
  }
})

function handleKeyDown(e: KeyboardEvent) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    commandPalette.open()
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    handleUndo()
  }
}

function openNewTask(status?: string, date?: string) {
  editingTask.value = null
  initialTaskStatus.value = status || ''
  if (date) {
    currentDate.value = date
  } else if (status) {
    currentDate.value = new Date().toISOString().split('T')[0]
  }
  showTaskModal.value = true
}

function handleOpenNewTask() {
  openNewTask()
}

function handleAddTaskInColumn(status: string) {
  openNewTask(status)
}

function openEditTask(task: Task) {
  editingTask.value = task
  showTaskModal.value = true
}

async function handleSaveTask(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
  if (editingTask.value) {
    await store.updateTask(editingTask.value.id, taskData)
  } else {
    await store.addTask(taskData)
  }
  showTaskModal.value = false
}

async function handleDeleteTask(id: string) {
  await store.deleteTask(id)
  showTaskModal.value = false
}

function openHistoryTable() {
  showHistoryTable.value = true
}

function toggleEditMode() {
  editMode.value = !editMode.value
}

function openEditColumn(column: KanbanColumn) {
  editingColumn.value = column
  showColumnModal.value = true
}

function openAddColumn() {
  editingColumn.value = null
  showColumnModal.value = true
}

async function handleSaveColumn(columnData: ColumnDraft) {
  try {
    if (editingColumn.value) {
      await store.updateColumn(editingColumn.value.id, columnData)
    } else {
      await store.addColumn(columnData)
    }
    showColumnModal.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Não foi possível salvar a coluna.')
  }
}

function openAddProject() {
  editingProject.value = null
  showProjectModal.value = true
}

function openEditProject(project: Project) {
  editingProject.value = project
  showProjectModal.value = true
}

async function handleSaveProject(projectData: Omit<Project, 'id' | 'createdAt'>) {
  try {
    if (editingProject.value) {
      await store.updateProject(editingProject.value.id, projectData)
    } else {
      await store.addProject(projectData)
    }
    showProjectModal.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao salvar projeto')
  }
}

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement
  store.setSearchQuery(target.value)
}

function handleColumnFilterChange(event: Event) {
  const target = event.target as HTMLSelectElement
  store.setColumnFilter(target.value || null)
}

function handleLabelFilterChange(event: Event) {
  const target = event.target as HTMLSelectElement
  store.setLabelFilter(target.value || null)
}

function handleShowOnlyOverdueChange(event: Event) {
  const target = event.target as HTMLInputElement
  store.setShowOnlyOverdueTasks(target.checked)
}

// Calendar handlers
function openAddAppointment(date: string, time?: string) {
  editingAppointment.value = null
  appointmentInitialDate.value = date
  appointmentInitialTime.value = time || ''
  showAppointmentModal.value = true
}

function openEditAppointment(appointment: Appointment) {
  editingAppointment.value = appointment
  appointmentInitialDate.value = ''
  appointmentInitialTime.value = ''
  showAppointmentModal.value = true
}

async function handleSaveAppointment(data: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>) {
  try {
    const conflict = store.checkAppointmentConflict(data, editingAppointment.value?.id)
    if (conflict) {
      toast.warning(`Conflito de horário! Já existe um compromisso "${conflict.title}" neste horário.`)
      return
    }
    
    if (editingAppointment.value) {
      await store.updateAppointment(editingAppointment.value.id, data)
    } else {
      await store.addAppointment(data)
    }
    showAppointmentModal.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao salvar compromisso')
  }
}

async function handleDeleteAppointment(id: string) {
  await store.deleteAppointment(id)
  showAppointmentModal.value = false
}

function openEditMeeting(meeting: Meeting) {
  editingMeeting.value = meeting
  showMeetingModal.value = true
}

function openAddMeeting(date: string, _time?: string) {
  editingMeeting.value = null
  showMeetingModal.value = true
}

async function handleSaveMeeting(data: Omit<Meeting, 'id' | 'createdAt'>) {
  try {
    const conflict = store.checkMeetingConflict(data, editingMeeting.value?.id)
    if (conflict) {
      toast.warning(`Conflito de horário! Já existe uma reunião "${conflict.title}" neste horário.`)
      return
    }
    
    if (editingMeeting.value) {
      await store.updateMeeting(editingMeeting.value.id, data)
    } else {
      await store.addMeeting(data)
    }
    showMeetingModal.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao salvar reunião')
  }
}

async function handleDeleteMeeting(id: string) {
  try {
    await store.deleteMeeting(id)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao excluir reunião')
  }
}

function openEditTaskFromCalendar(task: Task) {
  openEditTask(task)
}

function openAddTaskFromCalendar(date: string) {
  openNewTask(undefined, date)
}

async function handleUndo() {
  if (!store.canUndo()) {
    toast.warning('Nada para desfazer')
    return
  }
  
  const lastAction = store.actionHistory[0]
  const description = lastAction?.description || 'ação'
  
  const success = await store.undoLastAction()
  if (success) {
    toast.success(`Ação desfeita: ${description}`)
  }
}

async function handleSaveWorkSettings(settings: WorkSettings) {
  await store.updateWorkSettings(settings)
  showWorkSettingsModal.value = false
}
</script>

<template>
  <div v-if="isLoading" class="loading-screen">
    <div class="loading-spinner"></div>
    <p>Carregando dados...</p>
  </div>
  <div class="app-wrapper" v-else>
    <div class="app">
      <header class="header">
        <div class="header-left">
          <div class="logo">TT</div>
          <h1>TaskTracker</h1>
        </div>
        <div class="header-actions">
          <div v-if="showSearch" class="search-container">
            <Search :size="16" class="search-icon" />
            <input 
              type="text" 
              class="search-input"
              placeholder="Buscar tarefas..."
              :value="store.searchQuery"
              @input="handleSearchInput"
            />
          </div>
          
          <select 
            class="column-filter"
            :value="store.columnFilter || ''"
            @change="handleColumnFilterChange"
          >
            <option value="">Todas as colunas</option>
            <option v-for="col in store.sortedColumns" :key="col.id" :value="col.status">
              {{ col.title }}
            </option>
          </select>
          
          <select
            class="column-filter"
            :value="store.labelFilter || ''"
            @change="handleLabelFilterChange"
          >
            <option value="">Todas as labels</option>
            <option value="Urgente">Urgente</option>
            <option value="Importante">Importante</option>
            <option value="Bug">Bug</option>
            <option value="Feature">Feature</option>
            <option value="Melhoria">Melhoria</option>
            <option value="Documentação">Documentação</option>
            <option value="Design">Design</option>
            <option value="Backend">Backend</option>
            <option value="Frontend">Frontend</option>
            <option value="Teste">Teste</option>
          </select>

          <label class="overdue-filter">
            <input
              type="checkbox"
              :checked="store.showOnlyOverdueTasks"
              @change="handleShowOnlyOverdueChange"
            />
            <span>Apenas atrasadas</span>
          </label>

          <button @click="showSearch = !showSearch" class="btn btn-icon" title="Buscar">
            <Search :size="18" />
          </button>

          <button
            @click="currentView = 'insights'"
            class="btn btn-icon"
            :class="{ active: currentView === 'insights' }"
            title="Dashboard de Insights"
          >
            <BarChart2 :size="18" />
          </button>

          <button
            @click="currentView = currentView === 'kanban' ? 'calendar' : 'kanban'"
            class="btn btn-icon"
            :class="{ active: currentView === 'calendar' }"
            title="Alternar visualização"
          >
            <Calendar v-if="currentView === 'kanban'" :size="18" />
            <Grid3x3 v-else :size="18" />
            <span class="toggle-label">{{ currentView === 'kanban' ? 'Calendário' : 'Kanban' }}</span>
          </button>
          
          <button @click="toggleTheme" class="btn btn-icon" :title="theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'">
            <Sun v-if="theme === 'dark'" :size="18" />
            <Moon v-else :size="18" />
          </button>
          
          <button @click="openAddProject" class="btn btn-icon" title="Novo Projeto">
            <FolderPlus :size="18" />
          </button>
          
          <div class="date-picker">
            <Calendar :size="16" />
            <input type="date" v-model="currentDate" class="date-input" />
          </div>
          <button @click="showReportModal = true" class="btn btn-icon" title="Dashboard e Relatórios">
            <FileText :size="18" />
          </button>
          <button 
            @click="toggleEditMode" 
            class="btn btn-icon" 
            :class="{ active: editMode }"
            :title="editMode ? 'Modo edição ativo - clique para sair' : 'Editar Quadro'"
          >
            <Pencil :size="18" />
            <span v-if="editMode" class="edit-mode-indicator">Modo Edição</span>
          </button>
          <PomodoroWidget />
          <NotificationBell />
          <button @click="handleOpenNewTask" class="btn btn-primary">
            <Plus :size="18" />
            <span>Nova Tarefa</span>
          </button>
          
          <button @click="showBackupModal = true" class="btn btn-icon" title="Backup e Restauração">
            <Database :size="18" />
          </button>
          
          <button 
            v-if="store.canUndo()"
            @click="handleUndo" 
            class="btn btn-secondary"
            title="Desfazer última ação (Ctrl+Z)"
          >
            <RotateCcw :size="18" />
            <span>Desfazer</span>
          </button>
          
          <button 
            v-if="store.trashedTasks.length > 0"
            class="btn btn-icon trash-indicator"
            title="Ver lixeira"
          >
            <Trash2 :size="18" />
            <span class="trash-badge">{{ store.trashedTasks.length }}</span>
          </button>
        </div>
      </header>

      <div class="main-container">
        <HistorySidebar 
          @open-table="openHistoryTable"
          @edit-task="openEditTask"
          @edit-project="openEditProject"
          @add-project="openAddProject"
        />
        
        <main class="content">
          <KanbanBoard 
            v-if="currentView === 'kanban'"
            :edit-mode="editMode"
            :time-tick="timeTick"
            @edit-task="openEditTask"
            @edit-column="openEditColumn"
            @add-column="openAddColumn"
            @add-task="handleAddTaskInColumn"
          />
          <CalendarContainer
            v-else-if="currentView === 'calendar'"
            :time-tick="timeTick"
            @addTask="openAddTaskFromCalendar"
            @addAppointment="openAddAppointment"
            @addMeeting="openAddMeeting"
            @editAppointment="openEditAppointment"
            @editMeeting="openEditMeeting"
            @editTask="openEditTaskFromCalendar"
            @openSettings="showWorkSettingsModal = true"
          />
          <InsightsDashboardView v-else-if="currentView === 'insights'" />
        </main>
      </div>

      <TaskModal 
        v-if="showTaskModal" 
        :task="editingTask"
        :current-date="currentDate"
        :initial-status="initialTaskStatus"
        @save="handleSaveTask"
        @delete="handleDeleteTask"
        @close="showTaskModal = false"
      />

      <ReportModal 
        v-if="showReportModal" 
        @close="showReportModal = false"
      />

      <HistoryTableModal 
        v-if="showHistoryTable" 
        @edit-task="openEditTask"
        @close="showHistoryTable = false"
      />

      <ColumnModal 
        v-if="showColumnModal" 
        :column="editingColumn"
        @save="handleSaveColumn"
        @close="showColumnModal = false"
      />

      <ProjectModal 
        v-if="showProjectModal" 
        :project="editingProject"
        @save="handleSaveProject"
        @close="showProjectModal = false"
      />

      <AppointmentModal 
        v-if="showAppointmentModal" 
        :appointment="editingAppointment"
        :initial-date="appointmentInitialDate"
        :initial-time="appointmentInitialTime"
        @save="handleSaveAppointment"
        @delete="handleDeleteAppointment"
        @close="showAppointmentModal = false"
      />

      <MeetingModal 
        v-if="showMeetingModal" 
        :meeting="editingMeeting"
        @save="handleSaveMeeting"
        @delete="handleDeleteMeeting"
        @close="showMeetingModal = false"
      />

      <WorkSettingsModal 
        v-if="showWorkSettingsModal" 
        @save="handleSaveWorkSettings"
        @close="showWorkSettingsModal = false"
      />

      <BackupModal 
        v-if="showBackupModal" 
        @close="showBackupModal = false"
      />

      <CommandPalette
        :commands="paletteCommands"
        @edit-task="openEditTask"
      />

      <ToastContainer />
    </div>
  </div>
</template>

<style scoped>
.app-wrapper {
  max-width: 1800px;
  margin: 0 auto;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app {
  min-height: 100%;
  background: var(--bg-primary);
  padding: 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.logo {
  width: 32px;
  height: 32px;
  background: var(--accent);
  color: var(--bg-primary);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 12px;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.date-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
}

.date-input {
  background: transparent;
  border: none;
  color: var(--text-primary);
  outline: none;
  font-size: 13px;
}

.date-input::-webkit-calendar-picker-indicator {
  filter: invert(0.8);
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-icon {
  padding: 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.btn-icon:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-icon.active {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--bg-primary);
}

.toggle-label {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
}

.edit-mode-indicator {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
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
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.main-container {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.sidebar-placeholder {
  width: 336px;
  flex-shrink: 0;
}

.content {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  transition: all 0.3s ease;
}

.content.with-sidebar {
  margin-left: 0;
}

.loading-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.search-container {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
}

.search-icon {
  color: var(--text-muted);
}

.search-input {
  background: none;
  border: none;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  width: 180px;
}

.search-input::placeholder {
  color: var(--text-muted);
}

.column-filter {
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
}

.column-filter:focus {
  outline: none;
  border-color: var(--accent);
}

.overdue-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  user-select: none;
}

.overdue-filter input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--accent);
}

.trash-indicator {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.trash-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--danger, #e74c3c);
  color: white;
  font-size: 9px;
  font-weight: 600;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
</style>
