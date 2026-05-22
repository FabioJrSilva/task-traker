<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue'
import { useTaskStore } from '@/stores/taskStore'
import {
  filterPalette,
  type PaletteCommand,
  type PaletteTaskResult,
  useCommandPalette,
} from '@/composables/useCommandPalette'
import type { Task } from '@/types/Task'

const props = defineProps<{
  commands: PaletteCommand[]
}>()

const emit = defineEmits<{
  editTask: [task: Task]
}>()

const store = useTaskStore()
const { isOpen, query, activeIndex, close, moveUp, moveDown, resetIndex } = useCommandPalette()

const filtered = computed(() =>
  filterPalette(props.commands, store.tasks, store.projects, query.value),
)

const flatItems = computed(() => [
  ...filtered.value.actionItems,
  ...filtered.value.pomodoroItems,
  ...filtered.value.taskItems,
])

watch(query, () => {
  resetIndex()
})

function executeItem(index: number): void {
  const item = flatItems.value[index]
  if (!item) {
    return
  }

  if ('task' in item) {
    emit('editTask', (item as PaletteTaskResult).task)
    close()
    return
  }

  const command = item as PaletteCommand
  if (command.disabled) {
    return
  }

  command.action()
  close()
}

function handleKeyDown(event: KeyboardEvent): void {
  if (!isOpen.value) {
    return
  }

  if (event.key === 'Escape') {
    close()
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    moveDown(flatItems.value.length)
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    moveUp(flatItems.value.length)
    return
  }

  if (event.key === 'Enter') {
    event.preventDefault()
    executeItem(activeIndex.value)
  }
}

function getItemIndex(group: 'actions' | 'pomodoro' | 'tasks', localIndex: number): number {
  if (group === 'actions') {
    return localIndex
  }

  if (group === 'pomodoro') {
    return filtered.value.actionItems.length + localIndex
  }

  return filtered.value.actionItems.length + filtered.value.pomodoroItems.length + localIndex
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="palette-backdrop"
      @mousedown.self="close"
    >
      <div
        class="command-palette"
        role="dialog"
        aria-label="Command palette"
      >
        <div class="palette-input-row">
          <span class="palette-search-icon">🔍</span>
          <input
            v-model="query"
            class="palette-input"
            placeholder="Digite um comando ou nome de tarefa..."
            autofocus
          />
          <span class="palette-esc-hint">ESC para fechar</span>
        </div>

        <div
          v-if="flatItems.length > 0"
          class="palette-results"
        >
          <template v-if="filtered.actionItems.length > 0">
            <div class="palette-group-label">Ações</div>
            <button
              v-for="(command, index) in filtered.actionItems"
              :key="command.id"
              class="palette-item"
              :class="{ active: getItemIndex('actions', index) === activeIndex }"
              @click="executeItem(getItemIndex('actions', index))"
            >
              <span class="palette-item-icon">{{ command.icon }}</span>
              <span class="palette-item-label">{{ command.label }}</span>
            </button>
          </template>

          <template v-if="filtered.pomodoroItems.length > 0">
            <div class="palette-group-label">Pomodoro</div>
            <button
              v-for="(command, index) in filtered.pomodoroItems"
              :key="command.id"
              class="palette-item"
              :class="{
                active: getItemIndex('pomodoro', index) === activeIndex,
                disabled: command.disabled,
              }"
              @click="executeItem(getItemIndex('pomodoro', index))"
            >
              <span class="palette-item-icon">{{ command.icon }}</span>
              <span class="palette-item-label">{{ command.label }}</span>
              <span
                v-if="command.disabled"
                class="palette-item-soon"
              >
                em breve
              </span>
            </button>
          </template>

          <template v-if="filtered.taskItems.length > 0">
            <div class="palette-group-label">Tarefas</div>
            <button
              v-for="(item, index) in filtered.taskItems"
              :key="item.id"
              class="palette-item"
              :class="{ active: getItemIndex('tasks', index) === activeIndex }"
              @click="executeItem(getItemIndex('tasks', index))"
            >
              <span class="palette-item-icon">☑</span>
              <div class="palette-item-task">
                <span class="palette-item-label">{{ item.title }}</span>
                <span class="palette-item-meta">{{ item.projectName }} · {{ item.status }}</span>
              </div>
            </button>
          </template>
        </div>

        <div
          v-else-if="query"
          class="palette-empty"
        >
          Nenhum resultado para "{{ query }}"
        </div>

        <div class="palette-footer">
          <span>↑↓ navegar</span>
          <span>Enter selecionar</span>
          <span>ESC fechar</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.palette-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 15vh;
  background: rgba(0, 0, 0, 0.5);
}

.command-palette {
  width: min(560px, calc(100vw - 24px));
  overflow: hidden;
  background: var(--bg-primary);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
}

.palette-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.palette-search-icon {
  font-size: 16px;
  opacity: 0.4;
}

.palette-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  color: inherit;
  font-size: 14px;
}

.palette-esc-hint {
  font-size: 11px;
  white-space: nowrap;
  opacity: 0.3;
}

.palette-results {
  max-height: 380px;
  overflow-y: auto;
}

.palette-group-label {
  padding: 8px 14px 4px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  opacity: 0.4;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: calc(100% - 8px);
  margin: 0 4px;
  padding: 7px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 0.1s;
}

.palette-item:hover,
.palette-item.active {
  background: rgba(99, 102, 241, 0.15);
}

.palette-item.disabled {
  cursor: default;
  opacity: 0.5;
}

.palette-item-icon {
  width: 20px;
  flex-shrink: 0;
  text-align: center;
  font-size: 14px;
}

.palette-item-label {
  flex: 1;
  font-size: 13px;
}

.palette-item-task {
  flex: 1;
  min-width: 0;
}

.palette-item-meta {
  display: block;
  font-size: 11px;
  opacity: 0.4;
}

.palette-item-soon {
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  font-size: 11px;
  opacity: 0.4;
}

.palette-empty {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  opacity: 0.4;
}

.palette-footer {
  display: flex;
  gap: 16px;
  padding: 8px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 11px;
  opacity: 0.3;
}
</style>
