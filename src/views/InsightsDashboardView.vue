<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BarChart2, ChevronLeft, ChevronRight, Download } from 'lucide-vue-next'
import { useInsights } from '@/composables/useInsights'
import KpiCard from '@/components/insights/KpiCard.vue'
import ProjectBar from '@/components/insights/ProjectBar.vue'
import TaskTimeList from '@/components/insights/TaskTimeList.vue'
import type { MonthlyProjectTaskRow } from '@/utils/reporting'

const now = new Date()
const selectedMonth = ref(now.getMonth() + 1)
const selectedYear = ref(now.getFullYear())

const { kpis, projectBars, report, exportCSV } = useInsights(selectedMonth, selectedYear)

const activeProjectId = ref<string | null>(null)

watch(projectBars, (bars) => {
  if (bars.length > 0 && !bars.find(b => b.projectId === activeProjectId.value)) {
    activeProjectId.value = bars[0].projectId
  } else if (bars.length === 0) {
    activeProjectId.value = null
  }
}, { immediate: true })

const activeTasks = computed<MonthlyProjectTaskRow[]>(() => {
  if (!activeProjectId.value) return []
  return report.value.projects.find(p => p.projectKey === activeProjectId.value)?.tasks ?? []
})

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const monthLabel = computed(() => `${MONTH_NAMES[selectedMonth.value - 1]} ${selectedYear.value}`)

function prevMonth() {
  if (selectedMonth.value === 1) { selectedMonth.value = 12; selectedYear.value-- }
  else selectedMonth.value--
}

function nextMonth() {
  if (selectedMonth.value === 12) { selectedMonth.value = 1; selectedYear.value++ }
  else selectedMonth.value++
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}min`
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

const kpiCards = computed(() => {
  const { totalMinutes, activeProjects, completedTasks, avgDailyMinutes, vsLastMonthPercent } = kpis.value
  const vsDetail = vsLastMonthPercent !== null
    ? `${vsLastMonthPercent > 0 ? '+' : ''}${vsLastMonthPercent}% vs. mês anterior`
    : 'Sem dados do mês anterior'
  return [
    { label: 'Total de horas', value: formatMinutes(totalMinutes), detail: vsDetail },
    { label: 'Projetos ativos', value: String(activeProjects), detail: 'com horas registradas' },
    { label: 'Tarefas concluídas', value: String(completedTasks), detail: 'no período' },
    { label: 'Média diária', value: formatMinutes(avgDailyMinutes), detail: 'em dias úteis' },
  ]
})

const isEmpty = computed(() => report.value.summary.totalMinutes === 0)
</script>

<template>
  <div class="insights-page">
    <div class="insights-toolbar">
      <div class="insights-month-nav">
        <button class="btn btn-icon" @click="prevMonth" title="Mês anterior">
          <ChevronLeft :size="16" />
        </button>
        <span class="insights-month-label">{{ monthLabel }}</span>
        <button class="btn btn-icon" @click="nextMonth" title="Próximo mês">
          <ChevronRight :size="16" />
        </button>
      </div>
      <button class="btn btn-icon" title="Exportar CSV" @click="exportCSV">
        <Download :size="16" />
        <span>Exportar CSV</span>
      </button>
    </div>

    <div class="insights-kpis">
      <KpiCard
        v-for="card in kpiCards"
        :key="card.label"
        :label="card.label"
        :value="card.value"
        :detail="card.detail"
      />
    </div>

    <div v-if="isEmpty" class="insights-empty">
      <BarChart2 :size="40" style="opacity:0.2" />
      <p>Nenhuma hora registrada em {{ monthLabel }}</p>
    </div>

    <div v-else class="insights-body">
      <div class="insights-section">
        <h3 class="insights-section-title">Horas por projeto</h3>
        <div class="insights-bars">
          <ProjectBar
            v-for="bar in projectBars"
            :key="bar.projectId"
            :bar="bar"
            :is-active="activeProjectId === bar.projectId"
            :formatted-time="formatMinutes(bar.totalMinutes)"
            @select="activeProjectId = bar.projectId"
          />
        </div>
      </div>

      <div class="insights-section">
        <h3 class="insights-section-title">
          Tarefas —
          {{ projectBars.find(b => b.projectId === activeProjectId)?.name ?? '' }}
        </h3>
        <TaskTimeList :tasks="activeTasks" />
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.insights-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 24px;
  max-width: 960px;
  margin: 0 auto;
}
.insights-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.insights-month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}
.insights-month-label { font-weight: 600; font-size: 16px; min-width: 160px; text-align: center; }
.insights-kpis {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
@media (max-width: 700px) {
  .insights-kpis { grid-template-columns: repeat(2, 1fr); }
}
.insights-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px 0;
  opacity: 0.4;
}
.insights-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 700px) {
  .insights-body { grid-template-columns: 1fr; }
}
.insights-section { display: flex; flex-direction: column; gap: 10px; }
.insights-section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
  margin: 0;
}
.insights-bars { display: flex; flex-direction: column; gap: 4px; }
</style>
