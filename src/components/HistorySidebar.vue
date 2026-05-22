<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { Search, Table, FolderPlus, Pencil, Trash2, Calendar, List, RotateCcw, X } from 'lucide-vue-next'
import type { Task } from '@/types/Task'
import type { Project } from '@/types/Project'
import type { Meeting } from '@/types/Meeting'
import CalendarView from '@/components/CalendarView.vue'
import MeetingModal from '@/components/MeetingModal.vue'

const emit = defineEmits<{
  openTable: []
  editTask: [task: Task]
  editProject: [project: Project]
  addProject: []
}>()

const store = useTaskStore()
const toast = useToast()

const search = ref('')
const statusFilter = ref<string>('all')
const projectFilter = ref<string>('all')
const showProjects = ref(false)
const showCalendar = ref(false)
const showMeetingModal = ref(false)
const editingMeeting = ref<Meeting | null>(null)
const meetingInitialDate = ref('')
const showTrash = ref(false)
const showConfirmDeleteProject = ref(false)
const showConfirmPermanentDelete = ref(false)
const projectToDelete = ref<Project | null>(null)
const taskToPermanentDelete = ref<string | null>(null)

const projects = computed(() => {
  if (!store.tasks || store.tasks.length === 0) return []
  const projs = new Set(store.tasks.map(t => t.project).filter(p => p))
  return Array.from(projs).sort()
})

const filteredTasks = computed(() => {
  let result = store.tasks ? [...store.tasks] : []
  
  if (search.value) {
    const query = search.value.toLowerCase()
    result = result.filter(t => 
      t.title.toLowerCase().includes(query) || 
      t.description.toLowerCase().includes(query)
    )
  }
  
  if (statusFilter.value !== 'all') {
    result = result.filter(t => t.status === statusFilter.value)
  }
  
  if (projectFilter.value !== 'all') {
    result = result.filter(t => t.project === projectFilter.value)
  }
  
  return result.sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )
})

const statuses = computed(() => store.sortedColumns)

function handleDeleteProject(project: Project) {
  projectToDelete.value = project
  showConfirmDeleteProject.value = true
}

function confirmDeleteProject() {
  if (projectToDelete.value) {
    store.deleteProject(projectToDelete.value.id)
    toast.success('Projeto excluído')
  }
  showConfirmDeleteProject.value = false
  projectToDelete.value = null
}

function cancelDeleteProject() {
  showConfirmDeleteProject.value = false
  projectToDelete.value = null
}

function openAddMeeting(date: string) {
  editingMeeting.value = null
  meetingInitialDate.value = date
  showMeetingModal.value = true
}

function openEditMeeting(meeting: Meeting) {
  editingMeeting.value = meeting
  showMeetingModal.value = true
}

async function handleSaveMeeting(meetingData: Omit<Meeting, 'id' | 'createdAt'>) {
  try {
    if (editingMeeting.value) {
      await store.updateMeeting(editingMeeting.value.id, meetingData)
    } else {
      await store.addMeeting(meetingData)
    }
    showMeetingModal.value = false
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao salvar reunião')
  }
}

function openEditTaskFromCalendar(task: Task) {
  emit('editTask', task)
  showCalendar.value = false
}

async function handleRestoreTask(taskId: string) {
  try {
    await store.restoreTask(taskId)
    toast.success('Tarefa restaurada com sucesso!')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : 'Erro ao restaurar tarefa')
  }
}

async function handlePermanentlyDelete(taskId: string) {
  taskToPermanentDelete.value = taskId
  showConfirmPermanentDelete.value = true
}

async function confirmPermanentDelete() {
  if (taskToPermanentDelete.value) {
    try {
      await store.permanentlyDeleteTask(taskToPermanentDelete.value)
      toast.success('Tarefa excluída permanentemente')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao excluir tarefa')
    }
  }
  showConfirmPermanentDelete.value = false
  taskToPermanentDelete.value = null
}

function cancelPermanentDelete() {
  showConfirmPermanentDelete.value = false
  taskToPermanentDelete.value = null
}

function formatDeletedDate(dateString: string | null | undefined): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="sidebar">
    <div class="sidebar-header">
      <h2>{{ showCalendar ? 'Calendário' : 'Histórico' }}</h2>
      <div class="header-actions">
        <button 
          class="view-toggle" 
          @click="showCalendar = !showCalendar"
          :title="showCalendar ? 'Ver lista' : 'Ver calendário'"
        >
          <Calendar v-if="!showCalendar" :size="14" />
          <List v-else :size="14" />
        </button>
        <button class="project-toggle" @click="showProjects = !showProjects" title="Gerenciar Projetos">
          <FolderPlus :size="14" />
        </button>
        <button 
          class="trash-toggle" 
          @click="showTrash = !showTrash"
          :class="{ active: showTrash }"
          title="Lixeira"
        >
          <Trash2 :size="14" />
          <span v-if="store.trashedTasks.length > 0" class="trash-count">{{ store.trashedTasks.length }}</span>
        </button>
      </div>
    </div>
    
    <!-- Projects Section -->
    <div v-if="showProjects" class="projects-section">
      <div class="section-header">
        <span>Projetos</span>
        <button class="add-btn" @click="emit('addProject')" title="Novo Projeto">
          <FolderPlus :size="12" />
        </button>
      </div>
      
      <div class="projects-list">
        <div v-for="project in store.projects" :key="project.id" class="project-item">
          <div class="project-color" :style="{ backgroundColor: project.color || '#7ea4ff' }"></div>
          <div class="project-info">
            <span class="project-name">{{ project.name }}</span>
            <span v-if="project.client" class="project-client">{{ project.client }}</span>
          </div>
          <div class="project-actions">
            <button @click.stop="emit('editProject', project)" title="Editar">
              <Pencil :size="12" />
            </button>
            <button @click.stop="handleDeleteProject(project)" title="Excluir">
              <Trash2 :size="12" />
            </button>
          </div>
        </div>
        
        <div v-if="store.projects.length === 0" class="empty-projects">
          Nenhum projeto
        </div>
      </div>
    </div>
    
    <!-- Trash Section -->
    <div v-if="showTrash" class="trash-section">
      <div class="section-header">
        <span>Lixeira</span>
        <span class="trash-info">{{ store.trashedTasks.length }} item(s)</span>
      </div>
      
      <div class="trash-list">
        <div 
          v-for="task in store.trashedTasks" 
          :key="task.id" 
          class="trash-item"
        >
          <div class="trash-info-content">
            <div class="trash-title">{{ task.title }}</div>
            <div class="trash-meta">
              <span class="project" v-if="task.project">{{ task.project }}</span>
              <span class="deleted-date">Excluída: {{ formatDeletedDate(task.deletedAt) }}</span>
            </div>
          </div>
          <div class="trash-actions">
            <button 
              @click.stop="handleRestoreTask(task.id)" 
              class="restore-btn"
              title="Restaurar"
            >
              <RotateCcw :size="12" />
            </button>
            <button 
              @click.stop="handlePermanentlyDelete(task.id)" 
              class="delete-btn"
              title="Excluir permanentemente"
            >
              <X :size="12" />
            </button>
          </div>
        </div>
        
        <div v-if="store.trashedTasks.length === 0" class="empty-trash">
          Lixeira vazia
        </div>
      </div>
    </div>
    
    <!-- Calendar View -->
    <div v-if="showCalendar" class="calendar-container">
      <CalendarView 
        @addMeeting="openAddMeeting"
        @editMeeting="openEditMeeting"
        @editTask="openEditTaskFromCalendar"
      />
    </div>
    
    <!-- Task List View -->
    <template v-else>
      <div class="filters">
        <div class="search-box">
          <Search :size="14" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Buscar..." 
          />
        </div>
        
        <div class="filter-row">
          <select v-model="statusFilter">
            <option value="all">Status</option>
            <option v-for="column in statuses" :key="column.id" :value="column.status">
              {{ column.title }}
            </option>
          </select>
          
          <select v-model="projectFilter">
            <option value="all">Projeto</option>
            <option v-for="p in projects" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>
      
      <div class="task-list">
        <div 
          v-for="task in filteredTasks" 
          :key="task.id" 
          class="task-item"
          @click="emit('editTask', task)"
        >
          <div class="task-info">
            <div class="task-title">{{ task.title }}</div>
            <div class="task-meta">
              <span class="project" v-if="task.project">{{ task.project }}</span>
              <span class="date">{{ task.date }}</span>
              <span v-if="task.timeSpent" class="time">
                {{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m
              </span>
            </div>
          </div>
          <span :class="['status', task.status]">
            {{ store.getStatusLabel(task.status) }}
          </span>
        </div>
        
        <div v-if="filteredTasks.length === 0" class="empty">
          Nenhuma tarefa
        </div>
      </div>
      
      <div class="sidebar-footer">
        <button class="view-all-btn" @click="emit('openTable')">
          <Table :size="14" />
          Ver todas as tarefas
        </button>
      </div>
    </template>
    
    <!-- Meeting Modal -->
    <MeetingModal 
      v-if="showMeetingModal"
      :meeting="editingMeeting"
      :initialDate="meetingInitialDate"
      @save="handleSaveMeeting"
      @close="showMeetingModal = false"
    />

    <ConfirmDialog
      v-if="showConfirmDeleteProject && projectToDelete"
      title="Excluir Projeto"
      :message="`Excluir projeto &quot;${projectToDelete.name}&quot;?`"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      type="danger"
      @confirm="confirmDeleteProject"
      @cancel="cancelDeleteProject"
    />

    <ConfirmDialog
      v-if="showConfirmPermanentDelete"
      title="Exclusão Permanente"
      message="Esta ação é irreversível. Deseja excluir a tarefa permanentemente?"
      confirm-text="Excluir"
      cancel-text="Cancelar"
      type="danger"
      @confirm="confirmPermanentDelete"
      @cancel="cancelPermanentDelete"
    />
  </div>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  height: 100%;
  width: 336px;
  flex-shrink: 0;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border);
}

.sidebar-header h2 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 4px;
}

.view-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.view-toggle:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.close-btn {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 4px;
  display: flex;
}

.close-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.filters {
  padding: 12px;
  border-bottom: 1px solid var(--border);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 12px;
}

.search-box input::placeholder {
  color: var(--text-muted);
}

.filter-row {
  display: flex;
  gap: 6px;
}

.filter-row select {
  flex: 1;
  padding: 6px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 11px;
}

.task-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s ease;
  margin-bottom: 4px;
}

.task-item:hover {
  background: var(--bg-tertiary);
}

.task-info {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.task-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.task-meta .project {
  background: rgba(126, 164, 255, 0.15);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 3px;
}

.status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 9px;
  font-weight: 600;
}

.status.backlog {
  background: rgba(220, 220, 170, 0.15);
  color: var(--warning);
}

.status.in_progress {
  background: rgba(126, 164, 255, 0.15);
  color: var(--accent);
}

.status.done {
  background: rgba(137, 209, 133, 0.15);
  color: var(--success);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
  font-size: 12px;
}

.sidebar-footer {
  padding: 10px;
  border-top: 1px solid var(--border);
}

.view-all-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.view-all-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.projects-section {
  border-bottom: 1px solid var(--border);
  max-height: 200px;
  overflow-y: auto;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.add-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.add-btn:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.projects-list {
  padding: 0 8px 8px;
}

.project-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  margin-bottom: 4px;
}

.project-item:hover {
  background: var(--bg-tertiary);
}

.project-color {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.project-info {
  flex: 1;
  min-width: 0;
}

.project-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  display: block;
}

.project-client {
  font-size: 11px;
  color: var(--text-muted);
}

.project-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.project-item:hover .project-actions {
  opacity: 1;
}

.project-actions button {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.project-actions button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.empty-projects {
  text-align: center;
  color: var(--text-muted);
  padding: 12px;
  font-size: 11px;
}

.project-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.project-toggle:hover {
  background: var(--bg-hover);
  color: var(--accent);
}

.calendar-container {
  flex: 1;
  overflow: hidden;
  padding: 8px;
}

/* Trash Section */
.trash-section {
  border-bottom: 1px solid var(--border);
  max-height: 280px;
  overflow-y: auto;
}

.trash-section .section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.trash-info {
  font-weight: 400;
  text-transform: none;
  color: var(--text-muted);
}

.trash-list {
  padding: 0 8px 8px;
}

.trash-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 4px;
  background: var(--bg-tertiary);
  opacity: 0.8;
}

.trash-info-content {
  flex: 1;
  min-width: 0;
}

.trash-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.trash-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.trash-meta .project {
  background: rgba(126, 164, 255, 0.15);
  color: var(--accent);
  padding: 1px 5px;
  border-radius: 3px;
}

.deleted-date {
  color: var(--danger, #e74c3c);
}

.trash-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.restore-btn,
.delete-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
}

.restore-btn:hover {
  background: var(--bg-hover);
  color: var(--success);
}

.delete-btn:hover {
  background: var(--bg-hover);
  color: var(--danger);
}

.empty-trash {
  text-align: center;
  color: var(--text-muted);
  padding: 20px;
  font-size: 11px;
}

.trash-toggle {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 4px;
  display: flex;
  border-radius: 4px;
  position: relative;
}

.trash-toggle:hover {
  background: var(--bg-hover);
  color: var(--danger);
}

.trash-toggle.active {
  color: var(--danger);
  background: rgba(231, 76, 60, 0.1);
}

.trash-count {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--danger);
  color: white;
  font-size: 9px;
  font-weight: 600;
  min-width: 14px;
  height: 14px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
