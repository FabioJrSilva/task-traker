<script setup lang="ts">
import { ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import ConfirmDialog from '@/components/ConfirmDialog.vue'
import type { Project } from '@/types/Project'

const props = defineProps<{
  project: Project | null
}>()

const emit = defineEmits<{
  save: [project: Omit<Project, 'id' | 'createdAt'>]
  close: []
}>()

const name = ref('')
const client = ref('')
const color = ref('#7ea4ff')
const showConfirmClose = ref(false)

const colors = [
  '#7ea4ff', '#c990c0', '#dcdcaa', '#89d185', 
  '#f5a623', '#e05858', '#8b572a', '#9012fe'
]

watch(() => props.project, (p) => {
  if (p) {
    name.value = p.name
    client.value = p.client || ''
    color.value = p.color || '#7ea4ff'
  } else {
    name.value = ''
    client.value = ''
    color.value = '#7ea4ff'
  }
}, { immediate: true })

function handleSubmit() {
  if (!name.value.trim()) return
  
  emit('save', {
    name: name.value,
    client: client.value || undefined,
    color: color.value
  })
}

function handleClose() {
  const hasData = name.value || client.value
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
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>{{ project ? 'Editar Projeto' : 'Novo Projeto' }}</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <form @submit.prevent="handleSubmit" class="modal-body">
        <div class="form-group">
          <label>Nome do Projeto</label>
          <input v-model="name" type="text" required placeholder="Nome do projeto" />
        </div>
        
        <div class="form-group">
          <label>Cliente (opcional)</label>
          <input v-model="client" type="text" placeholder="Nome do cliente" />
        </div>
        
        <div class="form-group">
          <label>Cor</label>
          <div class="color-picker">
            <button 
              v-for="c in colors" 
              :key="c"
              type="button"
              class="color-option"
              :class="{ selected: color === c }"
              :style="{ backgroundColor: c }"
              @click="color = c"
            ></button>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">Fechar</button>
          <button type="submit" class="btn btn-primary">Salvar</button>
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

.color-picker {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.color-option {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-option:hover {
  transform: scale(1.1);
}

.color-option.selected {
  border-color: var(--text-primary);
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