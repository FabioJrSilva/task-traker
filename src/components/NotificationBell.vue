<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { Bell } from 'lucide-vue-next'
import type { NotificationType } from '@/composables/useNotifications'
import { useNotifications } from '@/composables/useNotifications'

const { notifications, unreadCount, markAllRead } = useNotifications()

const isOpen = ref(false)
const bellRef = ref<HTMLElement | null>(null)

const TYPE_LABELS: Record<NotificationType, string> = {
  'due-soon': 'Prazo em 15 minutos',
  overdue: 'Tarefa atrasada',
  'over-time': 'Tempo estimado excedido',
}

const TYPE_COLORS: Record<NotificationType, string> = {
  'due-soon': 'var(--accent)',
  overdue: '#d14d41',
  'over-time': '#d9a441',
}

function toggleDropdown(): void {
  isOpen.value = !isOpen.value
}

function closeDropdown(): void {
  isOpen.value = false
}

function handleClickOutside(event: MouseEvent): void {
  if (bellRef.value && !bellRef.value.contains(event.target as Node)) {
    closeDropdown()
  }
}

function formatTimeAgo(createdAt: Date): string {
  const diffMinutes = Math.floor((Date.now() - createdAt.getTime()) / 60000)

  if (diffMinutes < 1) {
    return 'agora'
  }

  if (diffMinutes === 1) {
    return 'ha 1 min'
  }

  return `ha ${diffMinutes} min`
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div ref="bellRef" class="notification-bell" data-testid="notification-bell">
    <button
      class="btn btn-icon notification-trigger"
      :class="{ active: isOpen }"
      type="button"
      title="Notificações"
      aria-label="Notificações"
      @click="toggleDropdown"
    >
      <Bell :size="18" />
      <span v-if="unreadCount > 0" class="notification-badge">{{ unreadCount }}</span>
    </button>

    <div
      v-if="isOpen"
      class="notification-dropdown"
      data-testid="notification-dropdown"
    >
      <div class="notification-header">
        <span>Notificações</span>
        <button
          class="notification-mark-read"
          type="button"
          @click="markAllRead"
        >
          Marcar todas como lidas
        </button>
      </div>

      <div
        v-if="notifications.length === 0"
        class="notification-empty"
        data-testid="notification-empty"
      >
        Nenhuma notificação nova
      </div>

      <div
        v-for="notification in notifications"
        v-else
        :key="notification.id"
        class="notification-item"
        :class="{ unread: !notification.read }"
      >
        <span
          class="notification-type-pill"
          :style="{ backgroundColor: TYPE_COLORS[notification.type] }"
        >
          {{ TYPE_LABELS[notification.type] }}
        </span>
        <div class="notification-body">
          <div class="notification-task">{{ notification.taskTitle }}</div>
          <div class="notification-meta">
            {{ formatTimeAgo(notification.createdAt) }} · {{ notification.projectName }}
          </div>
        </div>
        <span
          v-if="!notification.read"
          class="notification-dot"
          :style="{ backgroundColor: TYPE_COLORS[notification.type] }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.notification-bell {
  position: relative;
}

.notification-trigger {
  position: relative;
}

.notification-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #d14d41;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
}

.notification-dropdown {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  width: 340px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--bg-secondary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 10px;
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.28);
  z-index: 1200;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  font-weight: 600;
}

.notification-mark-read {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 11px;
  cursor: pointer;
}

.notification-empty {
  padding: 22px 16px;
  text-align: center;
  color: var(--text-muted);
  font-size: 12px;
}

.notification-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 10px;
  padding: 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  opacity: 0.72;
}

.notification-item.unread {
  opacity: 1;
  background: color-mix(in srgb, var(--bg-primary) 82%, var(--accent) 18%);
}

.notification-type-pill {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  color: #ffffff;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.notification-body {
  min-width: 0;
}

.notification-task {
  margin-top: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notification-meta {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 11px;
}

.notification-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}
</style>
