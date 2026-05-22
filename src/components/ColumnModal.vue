<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useToast } from '@/utils/toast'
import type { KanbanColumn } from '@/types/Kanban'
import { normalizeStatusId } from '@/shared/appData'

const props = defineProps<{
  column: KanbanColumn | null
}>()

const emit = defineEmits<{
  save: [column: { title: string; status: string; color: string }]
  close: []
}>()

const toast = useToast()

const title = ref('')
const status = ref('')
const color = ref('#7ea4ff')

const colors = [
  { value: '#7ea4ff', name: 'Azul' },
  { value: '#c990c0', name: 'Rosa' },
  { value: '#dcdcaa', name: 'Amarelo' },
  { value: '#89d185', name: 'Verde' },
  { value: '#f48771', name: 'Vermelho' },
  { value: '#9cdcfe', name: 'Ciano' },
  { value: '#d4d4d4', name: 'Cinza' },
  { value: '#ce9178', name: 'Laranja' }
]

watch(() => props.column, (col) => {
  if (col) {
    title.value = col.title
    status.value = col.status
    color.value = col.color || '#7ea4ff'
  } else {
    title.value = ''
    status.value = ''
    color.value = '#7ea4ff'
  }
}, { immediate: true })

function generateStatusFromTitle(title: string): string {
  return normalizeStatusId(title)
}

function handleSubmit() {
  if (!title.value.trim()) return
  
  let finalStatus = generateStatusFromTitle(status.value)
  if (!finalStatus) {
    finalStatus = generateStatusFromTitle(title.value)
  }

  if (!finalStatus) {
    toast.warning('Informe um identificador válido para a coluna.')
    return
  }
  
  emit('save', {
    title: title.value.trim(),
    status: finalStatus,
    color: color.value
  })
}
</script>

<template>
  <div class="modal-overlay" @click.self="emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ column ? 'Editar Coluna' : 'Nova Coluna' }}</h2>
        <button class="close-btn" @click="emit('close')">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label>Nome da Coluna</label>
          <input 
            v-model="title" 
            type="text" 
            required 
            placeholder="Ex: Em Desenvolvimento" 
          />
        </div>
        
        <div class="form-group">
          <label>Status (identificador)</label>
          <input 
            v-model="status" 
            type="text" 
            placeholder="em_desenvolvimento (gerado automaticamente se vazio)"
          />
          <small class="hint">Usado para identificar as tarefas desta coluna</small>
        </div>
        
        <div class="form-group">
          <label>Cor</label>
          <div class="color-picker">
            <button
              v-for="c in colors"
              :key="c.value"
              type="button"
              class="color-option"
              :class="{ selected: color === c.value }"
              :style="{ backgroundColor: c.value }"
              @click="color = c.value"
              :title="c.name"
            />
          </div>
        </div>
        
        <div class="preview">
          <span class="preview-label">Preview:</span>
          <div class="preview-column" :style="{ borderLeftColor: color }">
            <span :style="{ color: color }">{{ title || 'Nome da Coluna' }}</span>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="emit('close')">Fechar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
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
  margin-bottom: 16px;
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

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 4px;
  font-size: 13px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.form-group input:focus {
  outline: none;
  border-color: var(--accent);
}

.hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-muted);
}

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text-primary);
}

.preview {
  margin-top: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 4px;
}

.preview-label {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-bottom: 8px;
}

.preview-column {
  padding: 8px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-left: 3px solid;
  border-radius: 4px;
  font-weight: 600;
  font-size: 13px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.btn {
  padding: 10px 18px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
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
