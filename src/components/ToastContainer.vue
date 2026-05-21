<script setup lang="ts">
import { useToast } from '@/utils/toast'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-vue-next'

const { toasts, remove } = useToast()

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info
}
</script>

<template>
  <div class="toast-container">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', toast.type]"
      >
        <component :is="icons[toast.type]" :size="18" class="toast-icon" />
        <span class="toast-message">{{ toast.message }}</span>
        <button class="toast-close" @click="remove(toast.id)">
          <X :size="14" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 16px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
}

.toast {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 6px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  font-size: 13px;
}

.toast.success {
  border-color: var(--success, #89d185);
  background: rgba(137, 209, 133, 0.1);
}

.toast.error {
  border-color: var(--danger, #e74c3c);
  background: rgba(231, 76, 60, 0.1);
}

.toast.warning {
  border-color: var(--warning, #dcdcaa);
  background: rgba(220, 220, 170, 0.1);
}

.toast.info {
  border-color: var(--accent, #7ea4ff);
  background: rgba(126, 164, 255, 0.1);
}

.toast-icon {
  flex-shrink: 0;
}

.toast.success .toast-icon { color: var(--success, #89d185); }
.toast.error .toast-icon { color: var(--danger, #e74c3c); }
.toast.warning .toast-icon { color: var(--warning, #dcdcaa); }
.toast.info .toast-icon { color: var(--accent, #7ea4ff); }

.toast-message {
  flex: 1;
  color: var(--text-primary);
}

.toast-close {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  padding: 2px;
  display: flex;
  border-radius: 4px;
}

.toast-close:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

/* Transitions */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(30px);
}
</style>
