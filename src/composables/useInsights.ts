import { computed } from 'vue'
import type { Ref } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import {
  buildMonthlyProjectReport,
  buildMonthlyProjectReportCSV,
  type MonthlyProjectReport,
} from '@/utils/reporting'

export interface InsightsKpis {
  totalMinutes: number
  activeProjects: number
  completedTasks: number
  avgDailyMinutes: number
  vsLastMonthPercent: number | null
}

export interface ProjectBar {
  projectId: string
  name: string
  client: string
  totalMinutes: number
  percentage: number
}

export function countWorkingDays(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate()
  let count = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

function buildReport(year: number, month: number, store: ReturnType<typeof useTaskStore>): MonthlyProjectReport {
  return buildMonthlyProjectReport({
    referenceDate: new Date(year, month - 1, 1, 12, 0, 0, 0),
    columns: store.columns,
    projects: store.projects,
    tasks: store.tasks,
    timeEntries: store.timeEntries,
  })
}

export function useInsights(month: Ref<number>, year: Ref<number>) {
  const store = useTaskStore()

  const report = computed(() => buildReport(year.value, month.value, store))

  const prevReport = computed(() => {
    let m = month.value - 1
    let y = year.value
    if (m === 0) { m = 12; y-- }
    return buildReport(y, m, store)
  })

  const kpis = computed<InsightsKpis>(() => {
    const { summary, projects } = report.value
    const completedTasks = projects.reduce((sum, p) => sum + p.completedInMonth, 0)
    const workingDays = countWorkingDays(year.value, month.value)
    const avgDailyMinutes = workingDays > 0 ? Math.round(summary.totalMinutes / workingDays) : 0
    const prevTotal = prevReport.value.summary.totalMinutes
    const vsLastMonthPercent = prevTotal > 0
      ? Math.round(((summary.totalMinutes - prevTotal) / prevTotal) * 100)
      : null
    return {
      totalMinutes: summary.totalMinutes,
      activeProjects: summary.totalProjects,
      completedTasks,
      avgDailyMinutes,
      vsLastMonthPercent,
    }
  })

  const projectBars = computed<ProjectBar[]>(() => {
    const maxMinutes = report.value.projects[0]?.totalMinutes ?? 0
    return report.value.projects.map(p => ({
      projectId: p.projectKey,
      name: p.projectName,
      client: p.client,
      totalMinutes: p.totalMinutes,
      percentage: maxMinutes > 0 ? Math.round((p.totalMinutes / maxMinutes) * 100) : 0,
    }))
  })

  function exportCSV() {
    const csv = buildMonthlyProjectReportCSV(report.value)
    const filename = `insights-${report.value.monthKey}.csv`
    if (window.electronAPI) {
      void window.electronAPI.exportCSV(csv, filename).then(result => {
        if (!result.ok) {
          console.error('Erro ao exportar CSV de insights:', result.message)
        }
      })
    } else {
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  return { report, kpis, projectBars, exportCSV }
}
