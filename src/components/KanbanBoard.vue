<script setup lang="ts">
import { ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import KanbanColumn from '@/components/KanbanColumn.vue'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Task } from '@/types/Task'
import type { KanbanColumn as KanbanColumnType } from '@/types/Kanban'
import { Plus, GripVertical, Pencil, Trash2 } from 'lucide-vue-next'

const props = defineProps<{
  editMode: boolean
  timeTick?: number
}>()

const emit = defineEmits<{
  editTask: [task: Task]
  editColumn: [column: KanbanColumnType]
  addColumn: []
  addTask: [status: string]
}>()

const store = useTaskStore()
const toast = useToast()

const draggedColumnIndex = ref<number | null>(null)
const confirmDelete = ref<{ show: boolean; column: KanbanColumnType | null }>({
  show: false,
  column: null
})

function handleColumnDragStart(e: DragEvent, index: number) {
  if (!props.editMode) return
  draggedColumnIndex.value = index
  e.dataTransfer?.setData('columnIndex', index.toString())
}

function handleColumnDragOver(e: DragEvent, index: number) {
  if (!props.editMode) return
  e.preventDefault()
}

function handleColumnDrop(e: DragEvent, toIndex: number) {
  if (!props.editMode) return
  e.preventDefault()
  const fromIndex = parseInt(e.dataTransfer?.getData('columnIndex') || '-1')
  if (fromIndex !== -1 && fromIndex !== toIndex) {
    store.moveColumn(fromIndex, toIndex)
  }
  draggedColumnIndex.value = null
}

function handleTaskMove(taskId: string, newStatus: string) {
  store.moveTask(taskId, newStatus)
}

function openEditColumn(column: KanbanColumnType) {
  emit('editColumn', column)
}

function confirmDeleteColumn(column: KanbanColumnType) {
  const tasksInColumn = store.getTasksByStatus(column.status)
  if (tasksInColumn.length > 0) {
    toast.warning(`Esta coluna contém ${tasksInColumn.length} tarefa(s). Mova ou exclua as tarefas primeiro.`)
    return
  }
  confirmDelete.value = { show: true, column }
}

function handleConfirmDelete() {
  if (confirmDelete.value.column) {
    try {
      store.deleteColumn(confirmDelete.value.column.id)
      toast.success('Coluna excluída')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir coluna')
    }
  }
  confirmDelete.value = { show: false, column: null }
}

function handleCancelDelete() {
  confirmDelete.value = { show: false, column: null }
}

function addTaskInColumn(status: string) {
  emit('addTask', status)
}
</script>

<template>
  <div class="kanban-board">
    <div 
      v-for="(column, index) in store.sortedColumns" 
      :key="column.id"
      class="column-wrapper"
      :class="{ 'edit-mode': editMode, 'dragging': draggedColumnIndex === index }"
      draggable="true"
      @dragstart="handleColumnDragStart($event, index)"
      @dragover="handleColumnDragOver($event, index)"
      @drop="handleColumnDrop($event, index)"
    >
      <div class="column-header" :style="{ borderColor: column.color || '#3e3e42' }">
        <div class="column-title-area">
          <GripVertical v-if="editMode" :size="14" class="drag-handle" />
          <span class="column-title" :style="{ color: column.color }">{{ column.title }}</span>
          <span class="task-count">({{ store.filteredSortedTasksByColumn[column.status]?.length || 0 }})</span>
        </div>
        <div v-if="editMode" class="column-actions">
          <button @click="openEditColumn(column)" title="Editar coluna">
            <Pencil :size="14" />
          </button>
          <button @click="confirmDeleteColumn(column)" title="Excluir coluna" class="delete-btn">
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
      
      <KanbanColumn
        :column="column"
        :tasks="store.filteredSortedTasksByColumn[column.status] || []"
        :edit-mode="editMode"
        :time-tick="props.timeTick"
        @edit="(task: Task) => emit('editTask', task)"
        @move="handleTaskMove"
        @add-task="addTaskInColumn"
      />
    </div>
    
    <div v-if="editMode" class="add-column-wrapper">
      <button class="add-column-btn" @click="emit('addColumn')">
        <Plus :size="16" />
        <span>Nova Coluna</span>
      </button>
    </div>

    <ConfirmDialog
      v-if="confirmDelete.show && confirmDelete.column"
      title="Excluir Coluna"
      :message="`Excluir coluna &quot;${confirmDelete.column.title}&quot;?`"
      confirm-text="Excluir"
      type="danger"
      @confirm="handleConfirmDelete"
      @cancel="handleCancelDelete"
    />
  </div>
</template>

<style scoped>
.kanban-board {
  display: flex;
  align-items: stretch;
  gap: 12px;
  overflow-x: auto;
  overflow-y: hidden;
  height: 100%;
  min-width: 100%;
  width: 100%;
}

.column-wrapper {
  flex: 1 1 0;
  min-width: 250px;
  max-width: none;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.column-wrapper.edit-mode {
  border: 2px dashed transparent;
  border-radius: 8px;
  padding: 2px;
  cursor: grab;
}

.column-wrapper:not(.edit-mode) {
  flex: 1 1 0;
}

.column-wrapper.edit-mode:hover {
  border-color: var(--accent);
}

.column-wrapper.dragging {
  opacity: 0.5;
}

.column-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-left: 3px solid;
  border-radius: 6px;
}

.column-title-area {
  display: flex;
  align-items: center;
  gap: 8px;
}

.drag-handle {
  color: var(--text-muted);
  cursor: grab;
}

.column-title {
  font-weight: 600;
  font-size: 13px;
}

.task-count {
  color: var(--text-muted);
  font-size: 12px;
}

.column-actions {
  display: flex;
  gap: 4px;
}

.column-actions button {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 4px;
  display: flex;
}

.column-actions button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.column-actions .delete-btn:hover {
  color: var(--danger);
}

.add-column-wrapper {
  flex-shrink: 0;
  width: 280px;
  display: flex;
  align-items: flex-start;
  padding-top: 36px;
}

.add-column-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 2px dashed var(--border);
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-column-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--bg-tertiary);
}
</style>
