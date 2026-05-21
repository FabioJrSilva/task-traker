<script setup lang="ts">
import { ref, computed } from 'vue'
import type { MonthlyProjectTaskRow } from '@/utils/reporting'

const props = defineProps<{
  tasks: MonthlyProjectTaskRow[]
}>()

const PAGE_SIZE = 10
const expanded = ref(false)

const visibleTasks = computed(() =>
  expanded.value ? props.tasks : props.tasks.slice(0, PAGE_SIZE)
)
const hiddenCount = computed(() => Math.max(0, props.tasks.length - PAGE_SIZE))

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'min' : ''}`.trim() : `${m}min`
}
</script>

<template>
  <div class="task-time-list">
    <div v-if="tasks.length === 0" class="task-time-empty">
      Nenhuma tarefa com tempo registrado.
    </div>
    <template v-else>
      <div
        v-for="task in visibleTasks"
        :key="task.taskId"
        class="task-time-row"
      >
        <span class="task-time-title">{{ task.title }}</span>
        <span class="task-time-duration">{{ formatMinutes(task.timeMinutes) }}</span>
      </div>
      <button
        v-if="!expanded && hiddenCount > 0"
        class="task-time-more"
        @click="expanded = true"
      >
        Ver mais {{ hiddenCount }} {{ hiddenCount === 1 ? 'tarefa' : 'tarefas' }}…
      </button>
    </template>
  </div>
</template>

<style scoped>
.task-time-list { display: flex; flex-direction: column; gap: 4px; }
.task-time-empty { font-size: 13px; opacity: 0.4; padding: 8px 0; }
.task-time-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 8px;
  font-size: 13px;
  border-radius: 4px;
  background: var(--bg-tertiary);
}
.task-time-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 12px;
}
.task-time-duration { opacity: 0.6; white-space: nowrap; }
.task-time-more {
  margin-top: 4px;
  padding: 4px 0;
  font-size: 12px;
  color: var(--accent);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}
</style>
