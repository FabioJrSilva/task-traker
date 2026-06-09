<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { X, RotateCcw } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'
import type { BackupInfo } from '@/types/ElectronApi'

const emit = defineEmits<{
  close: []
}>()

const store = useTaskStore()
const backups = ref<BackupInfo[]>([])
const isLoading = ref(false)
const isRestoring = ref<string | null>(null)
const errorMessage = ref<string | null>(null)

const isElectron = typeof window !== 'undefined' && !!window.electronAPI

async function loadBackups() {
  if (!isElectron) return
  errorMessage.value = null
  
  try {
    backups.value = await window.electronAPI!.listBackups()
  } catch (e) {
    console.error('Error loading backups:', e)
    errorMessage.value = 'Não foi possível carregar os backups.'
  }
}

async function restoreBackup(backup: BackupInfo) {
  if (!isElectron) return
  
  isRestoring.value = backup.name
  errorMessage.value = null
  try {
    const result = await window.electronAPI!.restoreBackup(backup.name)
    if (result.ok && result.data) {
      const data = await window.electronAPI!.loadAppData()
      await store.loadFromStorage(data)
      emit('close')
      return
    }

    errorMessage.value = result.ok
      ? 'Não foi possível restaurar este backup.'
      : result.message
  } catch (e) {
    console.error('Error restoring backup:', e)
    errorMessage.value = 'Não foi possível restaurar este backup.'
  } finally {
    isRestoring.value = null
  }
}

function formatDate(mtime: string): string {
  const date = new Date(mtime)
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function handleClose() {
  emit('close')
}

onMounted(loadBackups)
</script>

<template>
  <div class="modal-overlay" @click.self="handleClose">
    <div class="modal">
      <div class="modal-header">
        <h2>Backup e Restauração</h2>
        <button class="close-btn" @click="handleClose">
          <X :size="20" />
        </button>
      </div>
      
      <div class="modal-body">
        <div v-if="!isElectron" class="info-box">
          <p>Backup automático está disponível apenas na versão desktop (Electron).</p>
        </div>
        
        <div v-else>
          <div v-if="errorMessage" class="error-box">
            {{ errorMessage }}
          </div>

          <div class="info-section">
            <h3>Backup Automático</h3>
            <p>Backups são criados automaticamente a cada save na pasta <code>backups/</code> no diretório de dados do app.</p>
            <p class="info-text">Máximo de 10 backups são mantidos. Backups mais antigos são removidos automaticamente.</p>
          </div>

          <div class="backups-section">
            <h3>Backups Disponíveis</h3>
            
            <div v-if="backups.length === 0" class="no-backups">
              Nenhum backup encontrado.
            </div>
            
            <div v-else class="backups-list">
              <div 
                v-for="backup in backups" 
                :key="backup.name" 
                class="backup-item"
              >
                <div class="backup-info">
                  <span class="backup-name">{{ backup.name }}</span>
                  <span class="backup-date">{{ formatDate(backup.mtime) }}</span>
                </div>
                <button 
                  class="btn btn-small" 
                  :disabled="isRestoring !== null"
                  @click="restoreBackup(backup)"
                >
                  <RotateCcw :size="14" />
                  {{ isRestoring === backup.name ? 'Restaurando...' : 'Restaurar' }}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" @click="handleClose">Fechar</button>
        </div>
      </div>
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
  width: 500px;
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

.info-box {
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  text-align: center;
}

.info-box p {
  margin: 0;
  color: var(--text-secondary);
  font-size: 13px;
}

.info-section {
  margin-bottom: 20px;
}

.error-box {
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 1px solid var(--danger);
  border-radius: 6px;
  background: rgba(239, 68, 68, 0.12);
  color: var(--danger);
  font-size: 13px;
}

.info-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.info-section p {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.info-section code {
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 11px;
}

.info-text {
  color: var(--text-muted);
}

.backups-section h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 12px;
}

.no-backups {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}

.backups-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.backup-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: 6px;
  border: 1px solid var(--border);
}

.backup-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.backup-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.backup-date {
  font-size: 11px;
  color: var(--text-muted);
}

.btn {
  padding: 10px 18px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  gap: 6px;
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

.btn-small {
  padding: 6px 12px;
  font-size: 12px;
  background: var(--accent);
  color: var(--bg-primary);
}

.btn-small:hover {
  background: var(--accent-hover);
}

.btn-small:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
</style>
