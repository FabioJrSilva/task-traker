<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import { buildDashboardModel, getReferenceDateFromInput } from '@/utils/reporting'
import { X, Download, Upload } from 'lucide-vue-next'

const emit = defineEmits<{
  close: []
}>()

const store = useTaskStore()
const toast = useToast()
const exporting = ref(false)
const showImport = ref(false)
const importFile = ref<HTMLInputElement | null>(null)
const reportType = ref<'dashboard' | 'tasks' | 'projects' | 'meetings' | 'monthly_projects'>('dashboard')
const dashboardPeriod = ref<'today' | 'week' | 'month'>('today')

const today = new Date()
const endDate = ref(formatDate(today))
const startDate = ref(formatDate(new Date(today.getFullYear(), today.getMonth(), 1)))
const referenceDate = ref(formatDate(today))
const monthlyReference = ref(formatMonth(today))

const isRangeValid = computed(() => startDate.value <= endDate.value)
const canExport = computed(() => {
  if (reportType.value === 'dashboard') {
    return false
  }
  if (reportType.value === 'projects' || reportType.value === 'monthly_projects') {
    return true
  }
  return isRangeValid.value
})

const tasks = computed(() => {
  if (!isRangeValid.value) return []
  return store.getTasksByDateRange(startDate.value, endDate.value)
})

const meetings = computed(() => {
  if (!isRangeValid.value) return []
  return store.meetings.filter(m => m.date >= startDate.value && m.date <= endDate.value)
})

const statusSummary = computed(() => {
  return store.sortedColumns.map(column => ({
    status: column.status,
    title: column.title,
    color: column.color,
    count: tasks.value.filter(task => task.status === column.status).length
  }))
})

const totalHours = computed(() => {
  const total = tasks.value.reduce((acc, task) => acc + store.getTaskTimeSpent(task.id), 0)
  return (total / 60).toFixed(1)
})

const dashboardModel = computed(() => {
  const refDate = getReferenceDateFromInput(referenceDate.value, new Date())
  return buildDashboardModel({
    period: dashboardPeriod.value,
    referenceDate: refDate,
    columns: store.columns,
    projects: store.projects,
    tasks: store.tasks,
    meetings: store.meetings,
    appointments: store.appointments,
    timeEntries: store.timeEntries
  })
})

const monthlyReport = computed(() => {
  return store.getMonthlyProjectReport(monthlyReference.value)
})

async function handleExport() {
  if (reportType.value === 'dashboard') {
    toast.warning('Selecione um tipo de relatório exportável.')
    return
  }

  if (!canExport.value) {
    toast.warning('A data inicial não pode ser maior que a data final.')
    return
  }

  exporting.value = true
  try {
    if (reportType.value === 'monthly_projects') {
      await store.downloadReport('monthly_projects', monthlyReference.value)
    } else {
      await store.downloadReport(reportType.value, startDate.value, endDate.value)
    }
    toast.success('Relatório exportado com sucesso!')
    emit('close')
  } catch (error) {
    toast.error('Erro ao exportar relatório. Tente novamente.')
    console.error('Falha no download do relatório:', error)
  } finally {
    exporting.value = false
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  const reader = new FileReader()
  reader.onload = async (e) => {
    const content = e.target?.result as string
    const result = store.importTasksFromCSV(content)
    if (result.success > 0) {
      toast.success(`${result.success} tarefa(s) importada(s)`)
    }
    if (result.errors > 0) {
      toast.warning(`${result.errors} erro(s) encontrado(s)`)
    }
    showImport.value = false
    if (importFile.value) {
      importFile.value.value = ''
    }
  }
  reader.readAsText(file)
}

function formatDate(date: Date) {
  return date.toISOString().split('T')[0]
}

function formatMonth(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>Relatório por Período</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      
      <div class="modal-body">
        <div class="filters">
          <div class="form-group">
            <label>Tipo de Relatório</label>
            <select v-model="reportType">
              <option value="dashboard">Dashboard (Hoje/Semana/Mês)</option>
              <option value="tasks">Tarefas</option>
              <option value="meetings">Reuniões</option>
              <option value="projects">Projetos</option>
              <option value="monthly_projects">Consolidado mensal por projeto</option>
            </select>
          </div>
        </div>

        <div v-if="reportType === 'dashboard'" class="dashboard-section">
          <div class="filters">
            <div class="form-group">
              <label>Período</label>
              <div class="period-toggle">
                <button
                  class="period-btn"
                  :class="{ active: dashboardPeriod === 'today' }"
                  @click="dashboardPeriod = 'today'"
                >
                  Hoje
                </button>
                <button
                  class="period-btn"
                  :class="{ active: dashboardPeriod === 'week' }"
                  @click="dashboardPeriod = 'week'"
                >
                  Semana
                </button>
                <button
                  class="period-btn"
                  :class="{ active: dashboardPeriod === 'month' }"
                  @click="dashboardPeriod = 'month'"
                >
                  Mês
                </button>
              </div>
            </div>
            <div class="form-group">
              <label>Data de referência</label>
              <input v-model="referenceDate" type="date" />
            </div>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span class="label">Tarefas do período</span>
              <span class="value">{{ dashboardModel.cards.tasksInPeriod }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Concluídas no período</span>
              <span class="value">{{ dashboardModel.cards.completedInPeriod }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Atrasadas ativas</span>
              <span class="value">{{ dashboardModel.cards.overdueActive }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Tempo no período</span>
              <span class="value">{{ (dashboardModel.cards.timeMinutes / 60).toFixed(1) }}h</span>
            </div>
            <div class="summary-item">
              <span class="label">Agenda</span>
              <span class="value">{{ dashboardModel.cards.agendaItems }}</span>
            </div>
          </div>

          <div class="summary secondary-summary">
            <div class="summary-item">
              <span class="label">Recorrências geradas</span>
              <span class="value">{{ dashboardModel.cards.recurringGeneratedInPeriod }}</span>
            </div>
          </div>

          <div class="tasks-list">
            <h3>Tarefas priorizadas</h3>
            <table v-if="dashboardModel.prioritizedTasks.length > 0">
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Projeto</th>
                  <th>Status</th>
                  <th>Tempo</th>
                  <th>Alerta</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in dashboardModel.prioritizedTasks" :key="task.id">
                  <td>{{ task.title }}</td>
                  <td>{{ task.projectName }}</td>
                  <td>{{ store.getStatusLabel(task.status) }}</td>
                  <td>{{ (task.timeMinutes / 60).toFixed(1) }}h</td>
                  <td>{{ task.isOverdue ? 'Atrasada' : '-' }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty">Nenhuma tarefa no período selecionado.</div>
          </div>

          <div class="tasks-list">
            <h3>Tempo por projeto</h3>
            <table v-if="dashboardModel.projectTime.length > 0">
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Tempo (h)</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="project in dashboardModel.projectTime" :key="project.projectKey">
                  <td>{{ project.projectName }}</td>
                  <td>{{ (project.totalMinutes / 60).toFixed(2) }}</td>
                </tr>
              </tbody>
            </table>
            <div v-else class="empty">Sem tempo registrado no período.</div>
          </div>

          <div class="tasks-list">
            <h3>Concluídas com atraso</h3>
            <ul v-if="dashboardModel.completedWithDelayTasks.length > 0" class="simple-list">
              <li v-for="task in dashboardModel.completedWithDelayTasks" :key="task.id">
                {{ task.title }} • {{ task.projectName }}
              </li>
            </ul>
            <div v-else class="empty">Nenhuma tarefa concluída com atraso no período.</div>
          </div>

          <div class="tasks-list">
            <h3>Agenda resumida</h3>
            <ul v-if="dashboardModel.cards.agendaItems > 0" class="simple-list">
              <li v-for="meeting in dashboardModel.meetings" :key="meeting.id">
                Reunião: {{ meeting.title }} ({{ meeting.date }})
              </li>
              <li v-for="appointment in dashboardModel.appointments" :key="appointment.id">
                Compromisso: {{ appointment.title }} ({{ appointment.startDate }} {{ appointment.startTime }})
              </li>
            </ul>
            <div v-else class="empty">Sem itens de agenda no período.</div>
          </div>
        </div>

        <div v-else-if="reportType === 'monthly_projects'" class="preview-section">
          <div class="filters">
            <div class="form-group">
              <label>Mês de referência</label>
              <input v-model="monthlyReference" type="month" />
            </div>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span class="label">Projetos</span>
              <span class="value">{{ monthlyReport.summary.totalProjects }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Tarefas com tempo</span>
              <span class="value">{{ monthlyReport.summary.totalTasksWithTime }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Tempo total</span>
              <span class="value">{{ (monthlyReport.summary.totalMinutes / 60).toFixed(2) }}h</span>
            </div>
          </div>

          <div class="tasks-list" v-if="monthlyReport.projects.length > 0">
            <h3>Consolidado por projeto</h3>
            <table>
              <thead>
                <tr>
                  <th>Projeto</th>
                  <th>Cliente</th>
                  <th>Horas</th>
                  <th>Tarefas com tempo</th>
                  <th>Concluídas</th>
                  <th>Com atraso</th>
                  <th>Atrasadas ativas</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="project in monthlyReport.projects" :key="project.projectKey">
                  <td>
                    <details>
                      <summary>{{ project.projectName }}</summary>
                      <ul class="project-task-list">
                        <li v-for="task in project.tasks" :key="task.taskId">
                          {{ task.title }} • {{ store.getStatusLabel(task.status) }} • {{ (task.timeMinutes / 60).toFixed(2) }}h
                        </li>
                      </ul>
                    </details>
                  </td>
                  <td>{{ project.client || '-' }}</td>
                  <td>{{ (project.totalMinutes / 60).toFixed(2) }}</td>
                  <td>{{ project.tasksWithTime }}</td>
                  <td>{{ project.completedInMonth }}</td>
                  <td>{{ project.completedWithDelay }}</td>
                  <td>{{ project.overdueActive }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">Nenhum lançamento de tempo finalizado no mês selecionado.</div>
        </div>

        <div v-else class="filters">
          <div class="form-group">
            <label>Data Inicial</label>
            <input v-model="startDate" type="date" :disabled="reportType === 'projects'" />
          </div>
          
          <div class="form-group">
            <label>Data Final</label>
            <input v-model="endDate" type="date" :disabled="reportType === 'projects'" />
          </div>
        </div>

        <p v-if="!isRangeValid && reportType !== 'projects'" class="range-error">
          A data inicial deve ser menor ou igual à data final.
        </p>

        <div v-if="reportType === 'tasks'" class="preview-section">
          <div class="summary">
            <div class="summary-item">
              <span class="label">Total de Tarefas</span>
              <span class="value">{{ tasks.length }}</span>
            </div>
            <div class="summary-item">
              <span class="label">Horas Trabalhadas</span>
              <span class="value">{{ totalHours }}h</span>
            </div>
            <div
              v-for="summary in statusSummary"
              :key="summary.status"
              class="summary-item"
            >
              <span class="label">{{ summary.title }}</span>
              <span class="value" :style="{ color: summary.color || 'var(--text-primary)' }">
                {{ summary.count }}
              </span>
            </div>
          </div>

          <div class="tasks-list" v-if="tasks.length > 0">
            <h3>Tarefas do período</h3>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tarefa</th>
                  <th>Projeto</th>
                  <th>Status</th>
                  <th>Tempo</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="task in tasks" :key="task.id">
                  <td>{{ task.date }}</td>
                  <td>{{ task.title }}</td>
                  <td>{{ task.project || '-' }}</td>
                  <td>
                    <span :class="['status', task.status]">
                      {{ store.getStatusLabel(task.status) }}
                    </span>
                  </td>
                  <td>{{ Math.floor(task.timeSpent / 60) }}h {{ task.timeSpent % 60 }}m</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">
            Nenhuma tarefa encontrada para este período.
          </div>
        </div>

        <div v-else-if="reportType === 'meetings'" class="preview-section">
          <div class="summary">
            <div class="summary-item">
              <span class="label">Total de Reuniões</span>
              <span class="value">{{ meetings.length }}</span>
            </div>
          </div>

          <div class="tasks-list" v-if="meetings.length > 0">
            <h3>Reuniões do período</h3>
            <table>
              <thead>
                <tr>
                  <th>Título</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Duração (min)</th>
                  <th>Projeto</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="meeting in meetings" :key="meeting.id">
                  <td>{{ meeting.title }}</td>
                  <td>{{ meeting.date }}</td>
                  <td>{{ meeting.time || '-' }}</td>
                  <td>{{ meeting.duration || '-' }}</td>
                  <td>{{ store.projects.find(p => p.id === meeting.projectId)?.name || '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">
            Nenhuma reunião encontrada para este período.
          </div>
        </div>

        <div v-else-if="reportType === 'projects'" class="preview-section">
          <div class="summary">
            <div class="summary-item">
              <span class="label">Total de Projetos</span>
              <span class="value">{{ store.projects.length }}</span>
            </div>
          </div>

          <div class="tasks-list" v-if="store.projects.length > 0">
            <h3>Projetos</h3>
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Cliente</th>
                  <th>Cor</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="project in store.projects" :key="project.id">
                  <td>{{ project.name }}</td>
                  <td>{{ project.client || '-' }}</td>
                  <td>
                    <span v-if="project.color" class="color-dot" :style="{ backgroundColor: project.color }"></span>
                    <span v-else>-</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-else class="empty">
            Nenhum projeto encontrado.
          </div>
        </div>
        
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="emit('close')">Fechar</button>
          <button
            v-if="reportType !== 'dashboard'"
            class="btn btn-primary"
            @click="handleExport"
            :disabled="exporting || !canExport"
          >
            <Download :size="16" />
            {{ exporting ? 'Exportando...' : 'Exportar CSV' }}
          </button>
        </div>
        
        <div class="import-section">
          <button @click="showImport = !showImport" class="btn btn-secondary">
            <Upload :size="16" />
            Importar Tarefas CSV
          </button>
          <div v-if="showImport" class="import-form">
            <input 
              ref="importFile"
              type="file" 
              accept=".csv"
              @change="handleFileSelect"
            />
            <p class="help-text">
              Formato: Data, Título, Descrição, Projeto, Status, Tempo (horas)
            </p>
          </div>
        </div>
      </div>
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
  width: 700px;
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

.filters {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.form-group {
  flex: 1;
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
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.range-error {
  margin-bottom: 20px;
  font-size: 12px;
  color: var(--danger);
}

.summary {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.secondary-summary {
  grid-template-columns: 1fr;
}

.summary-item {
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  padding: 12px;
  border-radius: 4px;
  text-align: center;
}

.summary-item .label {
  display: block;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 4px;
}

.summary-item .value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.summary-item .value.done {
  color: var(--success);
}

.summary-item .value.progress {
  color: var(--accent);
}

.summary-item .value.backlog {
  color: var(--warning);
}

.tasks-list h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin-bottom: 10px;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th, td {
  padding: 10px 8px;
  text-align: left;
  border-bottom: 1px solid var(--border);
}

th {
  background: var(--bg-tertiary);
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.3px;
}

td {
  color: var(--text-primary);
}

.status {
  padding: 2px 6px;
  border-radius: 3px;
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

.empty {
  text-align: center;
  color: var(--text-muted);
  padding: 40px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 18px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 500;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.btn-primary:disabled {
  background: var(--bg-tertiary);
  color: var(--text-muted);
  cursor: not-allowed;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}

.import-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.import-form {
  margin-top: 12px;
}

.help-text {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 8px;
}

.dashboard-section {
  margin-bottom: 12px;
}

.period-toggle {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
}

.period-btn {
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border-radius: 4px;
  padding: 8px 10px;
  cursor: pointer;
  font-size: 12px;
}

.period-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}

.simple-list {
  margin: 0;
  padding-left: 16px;
  display: grid;
  gap: 6px;
  color: var(--text-primary);
  font-size: 12px;
}

.project-task-list {
  margin-top: 8px;
  margin-bottom: 0;
  padding-left: 16px;
  display: grid;
  gap: 4px;
}

.color-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 50%;
}
</style>
