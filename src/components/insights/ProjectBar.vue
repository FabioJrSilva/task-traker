<script setup lang="ts">
import type { ProjectBar } from '@/composables/useInsights'

defineProps<{
  bar: ProjectBar
  isActive: boolean
  formattedTime: string
}>()

defineEmits<{ select: [] }>()
</script>

<template>
  <button
    class="project-bar"
    :class="{ active: isActive }"
    @click="$emit('select')"
  >
    <div class="project-bar-header">
      <span class="project-bar-name">{{ bar.name }}</span>
      <span class="project-bar-time">{{ formattedTime }}</span>
    </div>
    <div class="project-bar-track">
      <div class="project-bar-fill" :style="{ width: bar.percentage + '%' }" />
    </div>
  </button>
</template>

<style scoped>
.project-bar {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  color: inherit;
  transition: background 0.15s;
}
.project-bar:hover,
.project-bar.active {
  background: var(--bg-hover);
  border-color: var(--accent);
}
.project-bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}
.project-bar-name { font-weight: 500; }
.project-bar-time { opacity: 0.65; }
.project-bar-track {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}
.project-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 4px;
  transition: width 0.3s ease;
}
</style>
