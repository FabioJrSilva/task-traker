import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import {
  computeNextPhase,
  minutesForPhase,
  usePomodoroStore,
} from '@/stores/pomodoroStore'

describe('computeNextPhase', () => {
  it('work -> short-break quando cycleCount nao e multiplo de 4', () => {
    expect(computeNextPhase('work', 1)).toBe('short-break')
    expect(computeNextPhase('work', 2)).toBe('short-break')
    expect(computeNextPhase('work', 3)).toBe('short-break')
  })

  it('work -> long-break quando cycleCount e multiplo de 4, exceto 0', () => {
    expect(computeNextPhase('work', 4)).toBe('long-break')
    expect(computeNextPhase('work', 8)).toBe('long-break')
  })

  it('work -> short-break quando cycleCount e 0', () => {
    expect(computeNextPhase('work', 0)).toBe('short-break')
  })

  it('short-break -> work', () => {
    expect(computeNextPhase('short-break', 2)).toBe('work')
  })

  it('long-break -> work', () => {
    expect(computeNextPhase('long-break', 4)).toBe('work')
  })
})

describe('minutesForPhase', () => {
  it('retorna 25 para work', () => {
    expect(minutesForPhase('work')).toBe(25)
  })

  it('retorna 5 para short-break', () => {
    expect(minutesForPhase('short-break')).toBe(5)
  })

  it('retorna 15 para long-break', () => {
    expect(minutesForPhase('long-break')).toBe(15)
  })

  it('retorna 0 para idle', () => {
    expect(minutesForPhase('idle')).toBe(0)
  })
})

describe('usePomodoroStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('inicia em idle', () => {
    const store = usePomodoroStore()
    expect(store.phase).toBe('idle')
    expect(store.isActive).toBe(false)
  })

  it('start() define phase=work e remainingSeconds=1500', () => {
    const store = usePomodoroStore()
    store.start()
    expect(store.phase).toBe('work')
    expect(store.remainingSeconds).toBe(1500)
    expect(store.isPaused).toBe(false)
  })

  it('stop() volta para idle', () => {
    const store = usePomodoroStore()
    store.start()
    store.stop()
    expect(store.phase).toBe('idle')
    expect(store.remainingSeconds).toBe(0)
  })

  it('togglePause() pausa o timer', () => {
    const store = usePomodoroStore()
    store.start()
    store.togglePause()
    expect(store.isPaused).toBe(true)
  })

  it('togglePause() retoma o timer quando pausado', () => {
    const store = usePomodoroStore()
    store.start()
    store.togglePause()
    expect(store.isPaused).toBe(true)
    store.togglePause()
    expect(store.isPaused).toBe(false)
  })

  it('timer decrementa remainingSeconds a cada segundo', () => {
    const store = usePomodoroStore()
    store.start()
    vi.advanceTimersByTime(5000)
    expect(store.remainingSeconds).toBe(1495)
  })

  it('ao chegar em 0, muda para short-break e nao reinicia sozinho', () => {
    const store = usePomodoroStore()
    store.start()
    vi.advanceTimersByTime(25 * 60 * 1000)
    expect(store.phase).toBe('short-break')
    expect(store.remainingSeconds).toBe(5 * 60)
    expect(store.cycleCount).toBe(1)
    vi.advanceTimersByTime(5000)
    expect(store.remainingSeconds).toBe(5 * 60)
  })

  it('apos 4 ciclos de trabalho, a proxima pausa e long-break', () => {
    const store = usePomodoroStore()
    for (let index = 0; index < 4; index++) {
      store.start()
      vi.advanceTimersByTime(25 * 60 * 1000)
      if (index < 3) {
        store.start()
        vi.advanceTimersByTime(5 * 60 * 1000)
      }
    }
    expect(store.phase).toBe('long-break')
    expect(store.cycleCount).toBe(4)
  })

  it('formattedTime formata MM:SS corretamente', () => {
    const store = usePomodoroStore()
    store.start()
    vi.advanceTimersByTime(60000)
    expect(store.formattedTime).toBe('24:00')
  })

  it('stop() nao reseta cycleCount', () => {
    const store = usePomodoroStore()
    store.start()
    vi.advanceTimersByTime(25 * 60 * 1000)
    expect(store.cycleCount).toBe(1)
    store.stop()
    expect(store.cycleCount).toBe(1)
  })
})
