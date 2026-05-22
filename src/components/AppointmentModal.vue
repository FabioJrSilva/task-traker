<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Appointment } from '@/types/Appointment'

const props = defineProps<{
  appointment: Appointment | null
  initialDate?: string
  initialTime?: string
}>()

const emit = defineEmits<{
  save: [appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>]
  delete: [id: string]
  close: []
}>()

const store = useTaskStore()
const toast = useToast()

const title = ref('')
const date = ref(props.initialDate || new Date().toISOString().split('T')[0])
const startTime = ref(props.initialTime || '09:00')
const duration = ref(60)
const customDuration = ref(60)
const useCustomDuration = ref(false)
const projectId = ref('')
const attendees = ref('')
const description = ref('')
const color = ref('')
const showConfirmClose = ref(false)
const showConfirmDelete = ref(false)

const projectOptions = computed(() => {
  return store.projects.map(p => ({
    value: p.id,
    label: p.name
  }))
})

const durationOptions = [
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
  { value: 60, label: '1 hora' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2 horas' },
  { value: -1, label: 'Personalizado' }
]

watch(() => props.appointment, (a) => {
  if (a) {
    title.value = a.title
    date.value = a.startDate
    startTime.value = a.startTime || '09:00'
    duration.value = a.duration
    projectId.value = a.projectId || ''
    attendees.value = a.attendees?.join(', ') || ''
    description.value = a.description || ''
    color.value = a.color || ''
    
    // Check if custom duration
    const isCustom = !durationOptions.some(o => o.value === a.duration)
    if (isCustom) {
      useCustomDuration.value = true
      customDuration.value = a.duration
    } else {
      useCustomDuration.value = false
    }
  } else {
    title.value = ''
    date.value = props.initialDate || new Date().toISOString().split('T')[0]
    startTime.value = props.initialTime || '09:00'
    duration.value = 60
    useCustomDuration.value = false
    customDuration.value = 60
    projectId.value = ''
    attendees.value = ''
    description.value = ''
    color.value = ''
  }
}, { immediate: true })

const colorPresets = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'
]

function handleSubmit() {
  if (!title.value.trim() || !date.value) return
  
  const attendeesList = attendees.value
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0)
  
  const finalDuration = useCustomDuration.value ? customDuration.value : duration.value
  
  emit('save', {
    title: title.value,
    description: description.value || undefined,
    startDate: date.value,
    startTime: startTime.value,
    duration: finalDuration,
    attendees: attendeesList.length > 0 ? attendeesList : undefined,
    projectId: projectId.value || undefined,
    color: color.value || undefined
  })
}

function handleClose() {
  const hasData = title.value || description.value || attendees.value || color.value
  if (hasData) {
    showConfirmClose.value = true
  } else {
    emit('close')
  }
}

function handleConfirmClose() {
  showConfirmClose.value = false
  emit('close')
}

function handleCancelClose() {
  showConfirmClose.value = false
}

function handleDelete() {
  showConfirmDelete.value = true
}

function handleConfirmDelete() {
  if (props.appointment) {
    emit('delete', props.appointment.id)
    emit('close')
  }
  showConfirmDelete.value = false
}

function handleCancelDelete() {
  showConfirmDelete.value = false
}
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ appointment ? 'Editar Agendamento' : 'Novo Agendamento' }}</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label>Título</label>
          <input v-model="title" type="text" required placeholder="Título do agendamento" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Data</label>
            <input v-model="date" type="date" required />
          </div>
          
          <div class="form-group">
            <label>Hora de Início</label>
            <input v-model="startTime" type="time" required />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Duração</label>
            <select v-model="duration" :disabled="useCustomDuration">
              <option v-for="opt in durationOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
          
          <div class="form-group">
            <label>Projeto</label>
            <select v-model="projectId">
              <option value="">Selecione...</option>
              <option v-for="opt in projectOptions" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>
        </div>
        
        <div class="form-group" v-if="duration === -1 || useCustomDuration">
          <label>Duração Personalizada (minutos)</label>
          <input v-model.number="customDuration" type="number" min="1" step="5" />
        </div>
        
        <div class="form-group">
          <label>Participantes</label>
          <input v-model="attendees" type="text" placeholder="Nomes separados por vírgula" />
        </div>
        
        <div class="form-group">
          <label>Descrição</label>
          <textarea v-model="description" rows="3" placeholder="Descrição do agendamento"></textarea>
        </div>
        
        <div class="form-group">
          <label>Cor</label>
          <div class="color-picker">
            <button 
              type="button"
              class="color-btn"
              :class="{ active: color === '' }"
              @click="color = ''"
              title="Padrão"
            >
              <span class="color-default"></span>
            </button>
            <button 
              v-for="preset in colorPresets" 
              :key="preset"
              type="button"
              class="color-btn"
              :class="{ active: color === preset }"
              :style="{ backgroundColor: preset }"
              @click="color = preset"
            ></button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button v-if="appointment" type="button" class="btn btn-danger" @click="handleDelete">Excluir</button>
          <div class="footer-right">
            <button type="button" class="btn btn-secondary" @click="handleClose">Fechar</button>
            <button type="submit" class="btn btn-primary">Salvar</button>
          </div>
        </div>
      </form>

      <ConfirmDialog
        v-if="showConfirmClose"
        title="Descartar Alterações"
        message="Descartar alterações não salvas?"
        confirm-text="Descartar"
        cancel-text="Manter"
        type="warning"
        @confirm="handleConfirmClose"
        @cancel="handleCancelClose"
      />

      <ConfirmDialog
        v-if="showConfirmDelete && appointment"
        title="Excluir Agendamento"
        :message="`Excluir agendamento &quot;${appointment.title}&quot;?`"
        confirm-text="Excluir"
        cancel-text="Cancelar"
        type="danger"
        @confirm="handleConfirmDelete"
        @cancel="handleCancelDelete"
      />
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
  width: 480px;
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
.form-group textarea,
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
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-group input::placeholder,
.form-group textarea::placeholder {
  color: var(--text-muted);
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-btn {
  width: 28px;
  height: 28px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.15s;
}

.color-btn.active {
  border-color: var(--accent);
}

.color-default {
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #ccc 25%, transparent 25%),
              linear-gradient(225deg, #ccc 25%, transparent 25%),
              linear-gradient(45deg, #ccc 25%, transparent 25%),
              linear-gradient(315deg, #ccc 25%, #fff 25%);
  background-size: 10px 10px;
  background-position: 0 0, 5px 0, 5px -5px, 0px 5px;
  border-radius: 2px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.footer-right {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 18px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-danger {
  background: var(--danger, #e74c3c);
  color: white;
}

.btn-danger:hover {
  background: #c0392b;
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