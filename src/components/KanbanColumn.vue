<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { Plus, ArrowUp, ArrowDown, Repeat } from 'lucide-vue-next'
import type { Task } from '@/types/Task'
import type { KanbanColumn as KanbanColumnType } from '@/types/Kanban'

const props = defineProps<{
  column: KanbanColumnType
  tasks: Task[]
  editMode: boolean
  timeTick?: number
}>()

const emit = defineEmits<{
  edit: [task: Task]
  move: [taskId: string, newStatus: string]
  addTask: [status: string]
}>()

const store = useTaskStore()

// Drag-and-drop state
const draggedTaskId = ref<string | null>(null)
const draggedOverTaskId = ref<string | null>(null)

// Sort state
const sortOrder = ref<'asc' | 'desc'>('asc')
const sortBy = ref<'date' | 'title' | 'project'>('date')

// Sorted tasks based on sort controls (visual only, not persisted)
const sortedTasks = computed(() => {
  void props.timeTick
  const tasksCopy = [...props.tasks]
  
  tasksCopy.sort((a, b) => {
    let comparison = 0
    
    if (sortBy.value === 'date') {
      comparison = a.date.localeCompare(b.date)
    } else if (sortBy.value === 'title') {
      comparison = a.title.localeCompare(b.title)
    } else if (sortBy.value === 'project') {
      comparison = a.project.localeCompare(b.project)
    }
    
    return sortOrder.value === 'asc' ? comparison : -comparison
  })
  
  return tasksCopy
})

function handleDragStart(e: DragEvent, task: Task) {
  draggedTaskId.value = task.id
  e.dataTransfer?.setData('taskId', task.id)
  e.dataTransfer?.setData('fromStatus', props.column.status)
}

function handleTaskDragOver(e: DragEvent, task: Task) {
  e.preventDefault()
  if (draggedTaskId.value && draggedTaskId.value !== task.id) {
    draggedOverTaskId.value = task.id
  }
}

function handleTaskDrop(e: DragEvent, targetTask: Task) {
  e.preventDefault()
  e.stopPropagation()
  
  const taskId = e.dataTransfer?.getData('taskId')
  const fromStatus = e.dataTransfer?.getData('fromStatus')
  
  if (!taskId) return
  
  // Se for da mesma coluna, reordena
  if (fromStatus === props.column.status) {
    const currentTasks = [...props.tasks]
    const fromIndex = currentTasks.findIndex(t => t.id === taskId)
    const toIndex = currentTasks.findIndex(t => t.id === targetTask.id)
    
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      const [moved] = currentTasks.splice(fromIndex, 1)
      currentTasks.splice(toIndex, 0, moved)
      
      const orderedIds = currentTasks.map(t => t.id)
      store.reorderTasksInColumn(props.column.status, orderedIds)
    }
  } else {
    // Mover para outra coluna
    emit('move', taskId, props.column.status)
  }
  
  draggedTaskId.value = null
  draggedOverTaskId.value = null
}

function handleDragEnd() {
  draggedTaskId.value = null
  draggedOverTaskId.value = null
}

function handleDragOver(e: DragEvent) {
  e.preventDefault()
}

function handleDrop(e: DragEvent) {
  e.preventDefault()
  const taskId = e.dataTransfer?.getData('taskId')
  const fromStatus = e.dataTransfer?.getData('fromStatus')
  
  // Only handle drop if it's from a different column (same column handled by task drop)
  if (taskId && fromStatus !== props.column.status) {
    emit('move', taskId, props.column.status)
  }
}

function toggleSortOrder() {
  sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
}

function addTask() {
  emit('addTask', props.column.status)
}

function getRecurrenceLabel(task: Task): string {
  if (!task.recurrence?.type) return ''
  if (task.recurrence.type === 'daily') return 'Diária'
  if (task.recurrence.type === 'weekly') return 'Semanal'
  return 'Mensal'
}

function isTaskOverdue(task: Task): boolean {
  const now = new Date(props.timeTick ?? Date.now())
  return store.isTaskOverdue(task, now)
}

function isTaskCompletedWithDelay(task: Task): boolean {
  return store.isTaskCompletedWithDelay(task)
}

function getReviewIndicator(reviewStatus: string): string {
  if (reviewStatus === 'pending') return 'REV pendente'
  if (reviewStatus === 'in_review') return 'REV em análise'
  if (reviewStatus === 'changes_requested') return 'REV ajustes'
  if (reviewStatus === 'approved') return 'REV aprovado'
  return ''
}

function shortenBranchName(branchName: string): string {
  if (branchName.length <= 18) {
    return branchName
  }
  return `${branchName.slice(0, 15)}...`
}

function getTaskDevIndicators(task: Task): string[] {
  const metadata = task.developerMetadata
  if (!metadata) {
    return []
  }

  const indicators: string[] = []
  if (metadata.pullRequestUrl) {
    indicators.push('PR')
  }
  if (metadata.branchName) {
    indicators.push(`Branch: ${shortenBranchName(metadata.branchName)}`)
  }
  if (metadata.environment) {
    indicators.push(`Amb: ${metadata.environment}`)
  }
  if (metadata.reviewStatus && metadata.reviewStatus !== 'not_required') {
    const reviewIndicator = getReviewIndicator(metadata.reviewStatus)
    if (reviewIndicator) {
      indicators.push(reviewIndicator)
    }
  }
  return indicators
}
</script>

<template>
  <div 
    class="column"
    :class="{ 'edit-mode': editMode }"
    @dragover="handleDragOver"
    @drop="handleDrop"
  >
    <div class="column-header" :style="{ borderColor: column.color || '#3e3e42' }">
      <div class="column-title-area">
        <span class="column-title" :style="{ color: column.color }">{{ column.title }}</span>
        <span class="task-count">({{ tasks.length }})</span>
      </div>
      <div class="sort-controls">
        <select v-model="sortBy">
          <option value="date">Data</option>
          <option value="title">Título</option>
          <option value="project">Projeto</option>
        </select>
        <button @click="toggleSortOrder" :title="sortOrder === 'asc' ? 'Crescente' : 'Decrescente'">
          <ArrowUp v-if="sortOrder === 'asc'" :size="14" />
          <ArrowDown v-else :size="14" />
        </button>
      </div>
    </div>
    
    <div class="column-content">
      <div 
        v-for="task in sortedTasks" 
        :key="task.id" 
        class="task-card"
        :class="{
          'dragging': draggedTaskId === task.id,
          'drag-over': draggedOverTaskId === task.id,
          'task-overdue': isTaskOverdue(task),
          'task-completed-late': isTaskCompletedWithDelay(task)
        }"
        draggable="true"
        @dragstart="handleDragStart($event, task)"
        @dragover="handleTaskDragOver($event, task)"
        @drop="handleTaskDrop($event, task)"
        @dragend="handleDragEnd"
        @click="emit('edit', task)"
      >
        <div v-if="task.labels && task.labels.length > 0" class="task-labels">
          <span 
            v-for="label in task.labels" 
            :key="label.id"
            class="task-label"
            :style="{ backgroundColor: label.color }"
            :title="label.name"
          ></span>
        </div>
        <div class="task-title-row">
          <div class="task-title">{{ task.title }}</div>
          <span
            v-if="task.isRecurring && task.recurrence"
            class="recurrence-indicator"
            :title="`Tarefa recorrente (${getRecurrenceLabel(task)})`"
          >
            <Repeat :size="12" />
          </span>
        </div>
        <div class="task-meta">
          <span class="project">{{ task.project || 'Sem projeto' }}</span>
          <span v-if="task.timeSpent" class="time">{{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m</span>
        </div>
        <div class="task-date">{{ task.date }}</div>
        <div v-if="getTaskDevIndicators(task).length > 0" class="task-dev-indicators">
          <span
            v-for="indicator in getTaskDevIndicators(task)"
            :key="`${task.id}-${indicator}`"
            class="task-dev-indicator"
          >
            {{ indicator }}
          </span>
        </div>
        <div class="task-badges">
          <span v-if="isTaskOverdue(task)" class="task-badge overdue">Atrasada</span>
          <span v-if="isTaskCompletedWithDelay(task)" class="task-badge completed-late">
            Concluída com atraso
          </span>
        </div>
      </div>
      
      <div v-if="tasks.length === 0" class="empty">
        Nenhuma tarefa
      </div>
    </div>
    
    <button class="add-task-btn" @click="addTask">
      <Plus :size="14" />
      <span>Adicionar tarefa</span>
    </button>
  </div>
</template>

<style scoped>
.column {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.column.edit-mode {
  border-style: dashed;
  border-color: var(--accent);
}

.column-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.task-card {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 10px 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.task-card.task-overdue {
  border-color: var(--danger, #e74c3c);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--danger, #e74c3c) 50%, transparent);
}

.task-card.task-completed-late {
  border-color: #f59e0b;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #f59e0b 45%, transparent);
}

.task-card:hover {
  background: var(--bg-hover);
  border-color: var(--border-light);
}

.task-title {
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-primary);
  font-size: 13px;
}

.task-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.recurrence-indicator {
  display: inline-flex;
  align-items: center;
  color: var(--accent);
}

.task-labels {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}

.task-label {
  width: 24px;
  height: 6px;
  border-radius: 3px;
}

.task-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  margin-bottom: 4px;
}

.project {
  background: rgba(126, 164, 255, 0.15);
  color: var(--accent);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
}

.time {
  color: var(--text-muted);
}

.task-date {
  font-size: 10px;
  color: var(--text-muted);
}

.task-dev-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.task-dev-indicator {
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  background: color-mix(in srgb, var(--bg-secondary) 72%, transparent);
}

.task-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
}

.task-badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 999px;
  border: 1px solid transparent;
}

.task-badge.overdue {
  background: color-mix(in srgb, var(--danger, #e74c3c) 20%, transparent);
  color: var(--danger, #e74c3c);
  border-color: color-mix(in srgb, var(--danger, #e74c3c) 45%, transparent);
}

.task-badge.completed-late {
  background: color-mix(in srgb, #f59e0b 20%, transparent);
  color: #f59e0b;
  border-color: color-mix(in srgb, #f59e0b 45%, transparent);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 24px;
  font-size: 12px;
}

.add-task-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  background: transparent;
  border: 1px dashed var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.add-task-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--accent);
  color: var(--accent);
}

/* Column header styles */
.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  margin-bottom: 8px;
}

.column-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.column-title {
  font-weight: 600;
  font-size: 13px;
}

.task-count {
  color: var(--text-muted);
  font-size: 12px;
}

/* Sort controls */
.sort-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.sort-controls select {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-secondary);
  font-size: 11px;
  padding: 2px 4px;
}

.sort-controls button {
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 2px;
  display: flex;
}

.sort-controls button:hover {
  color: var(--accent);
}

/* Drag-and-drop styles */
.task-card.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

.task-card.drag-over {
  border-color: var(--accent);
  border-width: 2px;
}
</style>
