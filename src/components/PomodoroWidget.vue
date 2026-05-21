<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { usePomodoroStore } from '@/stores/pomodoroStore'

const store = usePomodoroStore()
const originalTitle = document.title

watch(
  () => store.remainingSeconds,
  () => {
    if (store.isActive) {
      document.title = `${store.formattedTime} 🍅 — TaskTracker`
      return
    }

    document.title = originalTitle
  },
)

onUnmounted(() => {
  document.title = originalTitle
})
</script>

<template>
  <button
    v-if="!store.isActive"
    class="pomodoro-idle-btn"
    title="Iniciar Pomodoro"
    @click="store.start()"
  >
    <span aria-hidden="true">🍅</span>
    <span class="pomodoro-idle-label">Iniciar Pomodoro</span>
  </button>

  <div
    v-else
    class="pomodoro-widget"
    :class="store.phase === 'work' ? 'pomodoro-work' : 'pomodoro-break'"
  >
    <div class="pomodoro-info">
      <span class="pomodoro-phase-icon">
        {{ store.phase === 'work' ? '🍅' : '☕' }}
      </span>
      <div class="pomodoro-text">
        <span class="pomodoro-label">{{ store.cycleLabel }}</span>
        <span class="pomodoro-time">{{ store.formattedTime }}</span>
      </div>
    </div>

    <div class="pomodoro-actions">
      <button
        v-if="store.phase === 'work'"
        class="pomodoro-btn"
        :title="store.isPaused ? 'Continuar' : 'Pausar'"
        @click="store.togglePause()"
      >
        {{ store.isPaused ? '▶' : '⏸' }}
      </button>
      <button
        class="pomodoro-btn"
        title="Finalizar"
        @click="store.stop()"
      >
        ⏹
      </button>
    </div>
  </div>
</template>

<style scoped>
.pomodoro-idle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 36px;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, color 0.15s ease,
    transform 0.15s ease;
}

.pomodoro-idle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.pomodoro-idle-btn:active {
  transform: scale(0.96);
}

.pomodoro-idle-label {
  font-size: 12px;
}

.pomodoro-widget {
  display: flex;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid;
  border-radius: 6px;
}

.pomodoro-work {
  background: rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
}

.pomodoro-break {
  background: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.pomodoro-info {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 6px 12px;
}

.pomodoro-phase-icon {
  font-size: 13px;
}

.pomodoro-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.pomodoro-label {
  font-size: 10px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  opacity: 0.5;
}

.pomodoro-time {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.pomodoro-work .pomodoro-time {
  color: #f87171;
}

.pomodoro-break .pomodoro-time {
  color: #4ade80;
}

.pomodoro-actions {
  display: flex;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
}

.pomodoro-btn {
  padding: 6px 9px;
  border: none;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  background: transparent;
  cursor: pointer;
  font-size: 14px;
  opacity: 0.7;
  transition: opacity 0.1s ease;
}

.pomodoro-btn:first-child {
  border-left: none;
}

.pomodoro-btn:hover {
  opacity: 1;
}
</style>
