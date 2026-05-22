<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import TaskModal from '@/components/TaskModal.vue'
import ReportModal from '@/components/ReportModal.vue'
import HistorySidebar from '@/components/HistorySidebar.vue'
import HistoryTableModal from '@/components/HistoryTableModal.vue'
import KanbanBoard from '@/components/KanbanBoard.vue'
import KanbanToolbar from '@/components/KanbanToolbar.vue'
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
import {
  FileText,
  Calendar,
  Search,
  FolderPlus,
  Grid3x3,
  RotateCcw,
  Database,
  Moon,
  Sun,
  BarChart2,
  Settings,
  MoreHorizontal,
} from 'lucide-vue-next'
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
const showSettingsMenu = ref(false)
const showMoreMenu = ref(false)
const editingAppointment = ref<Appointment | null>(null)
const editingMeeting = ref<Meeting | null>(null)
const appointmentInitialDate = ref('')
const appointmentInitialTime = ref('')
const theme = ref<'dark' | 'light'>('dark')
const settingsMenuRef = ref<HTMLElement | null>(null)
const moreMenuRef = ref<HTMLElement | null>(null)
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
      setView('insights')
    },
  },
  {
    id: 'open-calendar',
    label: 'Abrir Calendário',
    group: 'actions',
    icon: '📅',
    action: () => {
      setView('calendar')
    },
  },
  {
    id: 'open-kanban',
    label: 'Abrir Kanban',
    group: 'actions',
    icon: '🗂',
    action: () => {
      setView('kanban')
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

function closeMenus() {
  showSettingsMenu.value = false
  showMoreMenu.value = false
}

onMounted(async () => {
  await store.loadAppData()
  isLoading.value = false
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('mousedown', handleDocumentMousedown)

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
  document.removeEventListener('mousedown', handleDocumentMousedown)
  if (recurringSchedulerId) {
    clearInterval(recurringSchedulerId)
    recurringSchedulerId = null
  }
})

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && (showSettingsMenu.value || showMoreMenu.value)) {
    closeMenus()
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openCommandSearch()
    return
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    handleUndo()
  }
}

function handleDocumentMousedown(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  const clickedSettings = settingsMenuRef.value?.contains(target) ?? false
  const clickedMore = moreMenuRef.value?.contains(target) ?? false

  if (!clickedSettings) {
    showSettingsMenu.value = false
  }

  if (!clickedMore) {
    showMoreMenu.value = false
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

function openCommandSearch() {
  commandPalette.open()
}

function setView(view: 'kanban' | 'calendar' | 'insights') {
  currentView.value = view
  closeMenus()
}

function toggleSettingsMenu() {
  showSettingsMenu.value = !showSettingsMenu.value
  if (showSettingsMenu.value) {
    showMoreMenu.value = false
  }
}

function toggleMoreMenu() {
  showMoreMenu.value = !showMoreMenu.value
  if (showMoreMenu.value) {
    showSettingsMenu.value = false
  }
}

function openReportFromMenu() {
  showReportModal.value = true
  closeMenus()
}

function openBackupFromMenu() {
  showBackupModal.value = true
  closeMenus()
}

function openWorkSettingsFromMenu() {
  showWorkSettingsModal.value = true
  closeMenus()
}

function toggleThemeFromMenu() {
  toggleTheme()
  closeMenus()
}

function openProjectFromMenu() {
  openAddProject()
  closeMenus()
}

async function undoFromMenu() {
  closeMenus()
  await handleUndo()
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
        <div class="global-command">
          <button
            class="command-search"
            type="button"
            data-testid="global-command-search"
            @click="openCommandSearch"
          >
            <Search :size="16" aria-hidden="true" />
            <span>Buscar comandos, tarefas e ações</span>
            <span class="command-hint">Ctrl K</span>
          </button>
        </div>
        <div class="header-actions">
          <div class="view-switcher" role="tablist" aria-label="Alternar visualização">
            <button
              class="view-btn"
              :class="{ active: currentView === 'kanban' }"
              type="button"
              data-testid="view-kanban"
              @click="setView('kanban')"
            >
              <Grid3x3 :size="16" aria-hidden="true" />
              <span>Kanban</span>
            </button>
            <button
              class="view-btn"
              :class="{ active: currentView === 'calendar' }"
              type="button"
              data-testid="view-calendar"
              @click="setView('calendar')"
            >
              <Calendar :size="16" aria-hidden="true" />
              <span>Calendar</span>
            </button>
            <button
              class="view-btn"
              :class="{ active: currentView === 'insights' }"
              type="button"
              data-testid="view-insights"
              @click="setView('insights')"
            >
              <BarChart2 :size="16" aria-hidden="true" />
              <span>Insights</span>
            </button>
          </div>
          <PomodoroWidget />
          <NotificationBell />

          <div ref="settingsMenuRef" class="menu-wrapper">
            <button
              class="btn btn-icon"
              type="button"
              :class="{ active: showSettingsMenu }"
              title="Configurações"
              @click="toggleSettingsMenu"
            >
              <Settings :size="18" />
            </button>
            <div v-if="showSettingsMenu" class="app-menu">
              <button class="menu-item" type="button" @click="toggleThemeFromMenu">
                <component :is="theme === 'dark' ? Sun : Moon" :size="16" />
                <span>{{ theme === 'dark' ? 'Modo claro' : 'Modo escuro' }}</span>
              </button>
              <button class="menu-item" type="button" @click="openWorkSettingsFromMenu">
                <Calendar :size="16" />
                <span>Configurar jornada</span>
              </button>
              <button class="menu-item" type="button" @click="openReportFromMenu">
                <FileText :size="16" />
                <span>Relatórios</span>
              </button>
              <button class="menu-item" type="button" @click="openBackupFromMenu">
                <Database :size="16" />
                <span>Backup e restauração</span>
              </button>
            </div>
          </div>

          <div ref="moreMenuRef" class="menu-wrapper">
            <button
              class="btn btn-icon"
              type="button"
              :class="{ active: showMoreMenu }"
              title="Mais ações"
              @click="toggleMoreMenu"
            >
              <MoreHorizontal :size="18" />
            </button>
            <div v-if="showMoreMenu" class="app-menu">
              <button class="menu-item" type="button" @click="openProjectFromMenu">
                <FolderPlus :size="16" />
                <span>Novo projeto</span>
              </button>
              <button
                v-if="store.canUndo()"
                class="menu-item"
                type="button"
                @click="undoFromMenu"
              >
                <RotateCcw :size="16" />
                <span>Desfazer última ação</span>
              </button>
              <div v-if="store.trashedTasks.length > 0" class="menu-item">
                <span>Lixeira</span>
                <span class="menu-badge">{{ store.trashedTasks.length }}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div class="main-container">
        <HistorySidebar 
          @open-table="openHistoryTable"
          @edit-task="openEditTask"
          @edit-project="openEditProject"
          @add-project="openAddProject"
        />
        
        <main class="content" :class="{ 'content--kanban': currentView === 'kanban' }">
          <template v-if="currentView === 'kanban'">
            <KanbanToolbar
              :edit-mode="editMode"
              @toggle-edit-mode="toggleEditMode"
            />
            <KanbanBoard
              :edit-mode="editMode"
              :time-tick="timeTick"
              @edit-task="openEditTask"
              @edit-column="openEditColumn"
              @add-column="openAddColumn"
              @add-task="handleAddTaskInColumn"
            />
          </template>
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
  display: grid;
  grid-template-columns: minmax(0, auto) minmax(240px, 1fr) minmax(0, auto);
  align-items: center;
  gap: 16px;
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
  justify-content: flex-end;
  min-width: 0;
}

.global-command {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.command-search {
  width: min(100%, 440px);
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.command-search:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.command-search span:first-of-type {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}

.command-hint {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  font-size: 11px;
  color: var(--text-muted);
}

.view-switcher {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.view-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.view-btn.active {
  background: var(--accent);
  color: var(--bg-primary);
}

.menu-wrapper {
  position: relative;
}

.app-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 220px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  z-index: 30;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
}

.menu-item:hover {
  background: var(--bg-hover);
}

.menu-item > span:first-of-type {
  flex: 1;
}

.menu-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--danger, #e74c3c);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
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
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  gap: 12px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.content--kanban {
  overflow-x: auto;
  overflow-y: hidden;
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
</style>
