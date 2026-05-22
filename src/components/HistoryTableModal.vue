<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import { 
  Search, X, ChevronDown, ChevronUp,
  Edit2, Trash2
} from 'lucide-vue-next'
import type { Task } from '@/types/Task'

const emit = defineEmits<{
  close: []
  editTask: [task: Task]
}>()

const store = useTaskStore()
const toast = useToast()

const search = ref('')
const statusFilter = ref<string>('all')
const projectFilter = ref<string>('all')
const sortColumn = ref<string>('date')
const sortDirection = ref<'asc' | 'desc'>('desc')
const showConfirmDelete = ref(false)
const taskToDelete = ref<Task | null>(null)

const projects = computed(() => {
  const projs = new Set(store.tasks.map(t => t.project).filter(p => p))
  return Array.from(projs).sort()
})
const statuses = computed(() => store.sortedColumns)

const filteredTasks = computed(() => {
  let result = [...store.tasks]
  
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
  
  result.sort((a, b) => {
    let valA: any, valB: any
    
    switch (sortColumn.value) {
      case 'date':
        valA = new Date(a.date).getTime()
        valB = new Date(b.date).getTime()
        break
      case 'title':
        valA = a.title.toLowerCase()
        valB = b.title.toLowerCase()
        break
      case 'project':
        valA = a.project || ''
        valB = b.project || ''
        break
      case 'status':
        valA = a.status
        valB = b.status
        break
      case 'timeSpent':
        valA = a.timeSpent
        valB = b.timeSpent
        break
      default:
        return 0
    }
    
    if (valA < valB) return sortDirection.value === 'asc' ? -1 : 1
    if (valA > valB) return sortDirection.value === 'asc' ? 1 : -1
    return 0
  })
  
  return result
})

const totalHours = computed(() => {
  const total = filteredTasks.value.reduce((acc, t) => acc + t.timeSpent, 0)
  return (total / 60).toFixed(1)
})

function toggleSort(column: string) {
  if (sortColumn.value === column) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortColumn.value = column
    sortDirection.value = 'desc'
  }
}

function editTask(task: Task) {
  emit('editTask', task)
  emit('close')
}

function deleteTask(task: Task) {
  taskToDelete.value = task
  showConfirmDelete.value = true
}

function handleConfirmDelete() {
  if (taskToDelete.value) {
    store.deleteTask(taskToDelete.value.id)
    toast.success('Tarefa movida para a lixeira')
  }
  showConfirmDelete.value = false
  taskToDelete.value = null
}

function handleCancelDelete() {
  showConfirmDelete.value = false
  taskToDelete.value = null
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Todas as Tarefas</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      
      <div class="filters">
        <div class="search-box">
          <Search :size="16" />
          <input 
            v-model="search" 
            type="text" 
            placeholder="Buscar tarefas..." 
          />
        </div>
        
        <div class="filter-row">
          <select v-model="statusFilter">
            <option value="all">Todos os status</option>
            <option v-for="column in statuses" :key="column.id" :value="column.status">
              {{ column.title }}
            </option>
          </select>
          
          <select v-model="projectFilter">
            <option value="all">Todos os projetos</option>
            <option v-for="p in projects" :key="p" :value="p">{{ p }}</option>
          </select>
        </div>
      </div>
      
      <div class="stats">
        <span>{{ filteredTasks.length }} tarefas</span>
        <span>{{ totalHours }}h total</span>
      </div>
      
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th @click="toggleSort('date')" class="sortable">
                Data
                <ChevronDown v-if="sortColumn === 'date' && sortDirection === 'desc'" :size="12" />
                <ChevronUp v-else-if="sortColumn === 'date'" :size="12" />
              </th>
              <th @click="toggleSort('title')" class="sortable">
                Tarefa
                <ChevronDown v-if="sortColumn === 'title' && sortDirection === 'desc'" :size="12" />
                <ChevronUp v-else-if="sortColumn === 'title'" :size="12" />
              </th>
              <th @click="toggleSort('project')" class="sortable">
                Projeto
                <ChevronDown v-if="sortColumn === 'project' && sortDirection === 'desc'" :size="12" />
                <ChevronUp v-else-if="sortColumn === 'project'" :size="12" />
              </th>
              <th @click="toggleSort('status')" class="sortable">
                Status
                <ChevronDown v-if="sortColumn === 'status' && sortDirection === 'desc'" :size="12" />
                <ChevronUp v-else-if="sortColumn === 'status'" :size="12" />
              </th>
              <th @click="toggleSort('timeSpent')" class="sortable">
                Tempo
                <ChevronDown v-if="sortColumn === 'timeSpent' && sortDirection === 'desc'" :size="12" />
                <ChevronUp v-else-if="sortColumn === 'timeSpent'" :size="12" />
              </th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="task in filteredTasks" :key="task.id">
              <td class="date">{{ task.date }}</td>
              <td class="title" :title="task.description">{{ task.title }}</td>
              <td class="project">{{ task.project || '-' }}</td>
              <td>
                <span :class="['status', task.status]">
                  {{ store.getStatusLabel(task.status) }}
                </span>
              </td>
              <td class="time">
                {{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m
              </td>
              <td class="actions">
                <button @click="editTask(task)" title="Editar">
                  <Edit2 :size="14" />
                </button>
                <button @click="deleteTask(task)" title="Excluir" class="danger">
                  <Trash2 :size="14" />
                </button>
              </td>
            </tr>
          </tbody>
        </table>
        
        <div v-if="filteredTasks.length === 0" class="empty">
          Nenhuma tarefa encontrada
        </div>
      </div>

      <ConfirmDialog
        v-if="showConfirmDelete && taskToDelete"
        title="Excluir Tarefa"
        :message="`Excluir tarefa &quot;${taskToDelete.title}&quot;?`"
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
  width: 900px;
  max-width: 90vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
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

.filters {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border);
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  margin-bottom: 12px;
  color: var(--text-muted);
}

.search-box input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
}

.search-box input::placeholder {
  color: var(--text-muted);
}

.filter-row {
  display: flex;
  gap: 12px;
}

.filter-row select {
  flex: 1;
  padding: 8px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
}

.stats {
  display: flex;
  justify-content: space-between;
  padding: 10px 20px;
  font-size: 12px;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}

.table-container {
  flex: 1;
  overflow-y: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th, td {
  padding: 12px 10px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  background: var(--bg-tertiary);
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  position: sticky;
  top: 0;
}

th.sortable {
  cursor: pointer;
  user-select: none;
}

th.sortable:hover {
  color: var(--text-primary);
}

th :deep(svg) {
  vertical-align: middle;
  margin-left: 4px;
}

td {
  color: var(--text-primary);
}

td.date {
  white-space: nowrap;
  color: var(--text-muted);
  width: 100px;
}

td.title {
  max-width: 250px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

td.project {
  color: var(--text-secondary);
  font-size: 12px;
  width: 120px;
}

td.time {
  white-space: nowrap;
  color: var(--text-muted);
  width: 80px;
}

.status {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
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

.actions {
  width: 70px;
}

.actions button {
  background: none;
  border: none;
  padding: 5px;
  cursor: pointer;
  color: var(--text-muted);
  border-radius: 3px;
  margin-right: 4px;
}

.actions button:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.actions button.danger:hover {
  color: var(--danger);
}

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}
</style>
