import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type PomodoroPhase = 'idle' | 'work' | 'short-break' | 'long-break'

const WORK_MINUTES = 25
const SHORT_BREAK_MINUTES = 5
const LONG_BREAK_MINUTES = 15
const CYCLES_BEFORE_LONG_BREAK = 4

export function computeNextPhase(
  currentPhase: PomodoroPhase,
  cycleCount: number,
): PomodoroPhase {
  if (currentPhase === 'work') {
    return cycleCount > 0 && cycleCount % CYCLES_BEFORE_LONG_BREAK === 0
      ? 'long-break'
      : 'short-break'
  }

  return 'work'
}

export function minutesForPhase(phase: PomodoroPhase): number {
  switch (phase) {
    case 'work':
      return WORK_MINUTES
    case 'short-break':
      return SHORT_BREAK_MINUTES
    case 'long-break':
      return LONG_BREAK_MINUTES
    default:
      return 0
  }
}

export const usePomodoroStore = defineStore('pomodoro', () => {
  const phase = ref<PomodoroPhase>('idle')
  const remainingSeconds = ref(0)
  const cycleCount = ref(0)
  const isPaused = ref(false)
  let intervalId: ReturnType<typeof setInterval> | null = null

  const isActive = computed(() => phase.value !== 'idle')

  const formattedTime = computed(() => {
    const minutes = Math.floor(remainingSeconds.value / 60)
    const seconds = remainingSeconds.value % 60

    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  })

  const cycleLabel = computed(() => {
    if (phase.value === 'work') {
      const cyclePosition = (cycleCount.value % CYCLES_BEFORE_LONG_BREAK) + 1
      return `ciclo ${cyclePosition}/${CYCLES_BEFORE_LONG_BREAK}`
    }

    if (phase.value === 'short-break') {
      return 'Pausa curta'
    }

    if (phase.value === 'long-break') {
      return 'Pausa longa'
    }

    return ''
  })

  function clearTimer(): void {
    if (intervalId !== null) {
      clearInterval(intervalId)
      intervalId = null
    }
  }

  function notifyCycleEnd(nextPhase: PomodoroPhase): void {
    if (
      typeof window === 'undefined'
      || !('Notification' in window)
      || window.Notification.permission !== 'granted'
    ) {
      return
    }

    let title = '🍅 Pomodoro concluído!'
    let body = `Hora de descansar. Ciclo ${cycleCount.value} completo.`

    if (nextPhase === 'work') {
      title = '☕ Pausa encerrada'
      body = 'Pronto para o próximo ciclo?'
    } else if (nextPhase === 'long-break') {
      body = `Hora de descansar. Ciclo ${cycleCount.value} completo.`
    }

    new window.Notification(title, { body })
  }

  function onCycleEnd(): void {
    clearTimer()

    if (phase.value === 'work') {
      cycleCount.value++
    }

    const nextPhase = computeNextPhase(phase.value, cycleCount.value)
    phase.value = nextPhase
    remainingSeconds.value = minutesForPhase(nextPhase) * 60
    isPaused.value = false

    notifyCycleEnd(nextPhase)
  }

  function startInterval(): void {
    clearTimer()
    intervalId = setInterval(() => {
      if (remainingSeconds.value <= 1) {
        remainingSeconds.value = 0
        onCycleEnd()
        return
      }

      remainingSeconds.value--
    }, 1000)
  }

  function start(): void {
    if (phase.value === 'idle') {
      phase.value = 'work'
      remainingSeconds.value = WORK_MINUTES * 60
      cycleCount.value = 0
      isPaused.value = false
    } else if (isPaused.value) {
      isPaused.value = false
    }

    startInterval()
  }

  function togglePause(): void {
    if (phase.value === 'idle') {
      return
    }

    if (isPaused.value) {
      isPaused.value = false
      startInterval()
      return
    }

    isPaused.value = true
    clearTimer()
  }

  function stop(): void {
    clearTimer()
    phase.value = 'idle'
    remainingSeconds.value = 0
    isPaused.value = false
  }

  return {
    phase,
    remainingSeconds,
    cycleCount,
    isPaused,
    isActive,
    formattedTime,
    cycleLabel,
    start,
    togglePause,
    stop,
  }
})
