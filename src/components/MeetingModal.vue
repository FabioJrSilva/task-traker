<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import { useToast } from '@/utils/toast'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Meeting } from '@/types/Meeting'

const props = defineProps<{
  meeting: Meeting | null
  initialDate?: string
}>()

const emit = defineEmits<{
  save: [meeting: Omit<Meeting, 'id' | 'createdAt'>]
  delete: [id: string]
  close: []
}>()

const store = useTaskStore()
const toast = useToast()

const title = ref('')
const date = ref(props.initialDate || new Date().toISOString().split('T')[0])
const time = ref('')
const duration = ref(60)
const projectId = ref('')
const description = ref('')
const attendees = ref('')
const showConfirmClose = ref(false)
const showConfirmDelete = ref(false)

const projectOptions = computed(() => {
  return store.projects.map(p => ({
    value: p.id,
    label: p.name
  }))
})

watch(() => props.meeting, (m) => {
  if (m) {
    title.value = m.title
    date.value = m.date
    time.value = m.time || ''
    duration.value = m.duration || 60
    projectId.value = m.projectId || ''
    description.value = m.description || ''
    attendees.value = m.attendees?.join(', ') || ''
  } else {
    title.value = ''
    time.value = ''
    duration.value = 60
    projectId.value = ''
    description.value = ''
    attendees.value = ''
    date.value = props.initialDate || new Date().toISOString().split('T')[0]
  }
}, { immediate: true })

function handleSubmit() {
  if (!title.value.trim() || !date.value) return
  
  const attendeesList = attendees.value
    .split(',')
    .map(a => a.trim())
    .filter(a => a.length > 0)
  
  emit('save', {
    title: title.value,
    date: date.value,
    time: time.value || undefined,
    duration: duration.value || undefined,
    projectId: projectId.value || undefined,
    description: description.value || undefined,
    attendees: attendeesList.length > 0 ? attendeesList : undefined
  })
}

function handleClose() {
  const hasData = title.value || description.value || attendees.value
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
  if (props.meeting) {
    emit('delete', props.meeting.id)
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
        <h2>{{ meeting ? 'Editar Reunião' : 'Nova Reunião' }}</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label>Título</label>
          <input v-model="title" type="text" required placeholder="Título da reunião" />
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Data</label>
            <input v-model="date" type="date" required />
          </div>
          
          <div class="form-group">
            <label>Horário</label>
            <input v-model="time" type="time" />
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label>Duração (minutos)</label>
            <input v-model.number="duration" type="number" min="15" step="15" />
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
        
        <div class="form-group">
          <label>Participantes</label>
          <input v-model="attendees" type="text" placeholder="Nomes separados por vírgula" />
        </div>
        
        <div class="form-group">
          <label>Descrição</label>
          <textarea v-model="description" rows="3" placeholder="Descrição da reunião"></textarea>
        </div>
        
        <div class="modal-footer">
          <button v-if="meeting" type="button" class="btn btn-danger" @click="handleDelete">Excluir</button>
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
        v-if="showConfirmDelete && meeting"
        title="Excluir Reunião"
        :message="`Excluir reunião &quot;${meeting.title}&quot;?`"
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

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
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
}

.btn-danger {
  background: #e05858;
  color: white;
  font-weight: 500;
}

.btn-danger:hover {
  background: #c94444;
}

.btn-primary {
  background: var(--accent);
  color: var(--bg-primary);
  font-weight: 500;
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border);
}
</style>
