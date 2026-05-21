<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import type { WorkSettings } from '@/shared/appData'

const emit = defineEmits<{
  save: [settings: WorkSettings]
  close: []
}>()

const store = useTaskStore()

const workStartTime = ref('08:00')
const workEndTime = ref('18:00')
const workDays = ref<number[]>([1, 2, 3, 4, 5])

const daysOfWeek = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' }
]

watch(() => store.workSettings, (settings) => {
  workStartTime.value = settings.workStartTime
  workEndTime.value = settings.workEndTime
  workDays.value = [...settings.workDays]
}, { immediate: true })

function toggleDay(day: number) {
  const index = workDays.value.indexOf(day)
  if (index === -1) {
    workDays.value.push(day)
    workDays.value.sort((a, b) => a - b)
  } else {
    workDays.value.splice(index, 1)
  }
}

const timeError = computed(() => {
  const start = workStartTime.value
  const end = workEndTime.value
  if (start && end && end <= start) {
    return 'O horário final deve ser posterior ao horário inicial.'
  }
  return ''
})

function handleSubmit() {
  if (timeError.value) {
    return
  }
  emit('save', {
    workStartTime: workStartTime.value,
    workEndTime: workEndTime.value,
    workDays: [...workDays.value]
  })
}

function handleClose() {
  emit('close')
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>Configurações de Trabalho</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-row">
          <div class="form-group">
            <label>Horário de Início</label>
            <input v-model="workStartTime" type="time" required />
          </div>

          <div class="form-group">
            <label>Horário de Fim</label>
            <input v-model="workEndTime" type="time" required />
          </div>
        </div>

        <p v-if="timeError" class="time-error">{{ timeError }}</p>
        
        <div class="form-group">
          <label>Dias Úteis</label>
          <div class="days-selector">
            <button
              v-for="day in daysOfWeek"
              :key="day.value"
              type="button"
              class="day-btn"
              :class="{ active: workDays.includes(day.value) }"
              @click="toggleDay(day.value)"
            >
              {{ day.label }}
            </button>
          </div>
        </div>
        
        <div class="info-text">
          <p>Essas configurações afetam a exibição do calendário e a disponibilidade de agendamentos.</p>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">Cancelar</button>
          <button type="submit" class="btn btn-primary" :disabled="!!timeError">Salvar</button>
        </div>
      </form>
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
  width: 400px;
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

.form-group {
  margin-bottom: 14px;
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.days-selector {
  display: flex;
  gap: 6px;
}

.day-btn {
  flex: 1;
  padding: 8px 4px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.day-btn:hover {
  background: var(--bg-hover);
}

.day-btn.active {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.time-error {
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--danger, #e74c3c);
}

.info-text {
  margin-bottom: 14px;
  padding: 10px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.info-text p {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
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

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}

.btn-secondary:hover {
  background: var(--bg-hover);
}
</style>