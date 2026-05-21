<script setup lang="ts">
defineProps<{
  label: string
  value: string
  detail?: string
}>()
</script>

<template>
  <div class="kpi-card">
    <span class="kpi-label">{{ label }}</span>
    <span class="kpi-value">{{ value }}</span>
    <span v-if="detail" class="kpi-detail">{{ detail }}</span>
  </div>
</template>

<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 16px 20px;
  background: var(--bg-secondary, #1e1e2e);
  border-radius: 8px;
  border: 1px solid var(--border-color, rgba(255,255,255,0.08));
}
.kpi-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.5;
}
.kpi-value {
  font-size: 26px;
  font-weight: 700;
  line-height: 1.1;
}
.kpi-detail {
  font-size: 12px;
  opacity: 0.5;
}
</style>
