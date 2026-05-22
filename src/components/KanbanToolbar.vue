<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Search, SlidersHorizontal, Pencil, X } from 'lucide-vue-next'
import { useTaskStore } from '@/stores/taskStore'

defineProps<{
  editMode: boolean
}>()

const emit = defineEmits<{
  'toggle-edit-mode': []
}>()

const store = useTaskStore()
const showFilters = ref(false)
const filterMenu = ref<HTMLElement | null>(null)

const labelOptions = [
  'Urgente',
  'Importante',
  'Bug',
  'Feature',
  'Melhoria',
  'Documentação',
  'Design',
  'Backend',
  'Frontend',
  'Teste',
]

const activeFilterCount = computed(() => {
  return [
    Boolean(store.columnFilter),
    Boolean(store.labelFilter),
    store.showOnlyOverdueTasks,
  ].filter(Boolean).length
})

const activeColumnTitle = computed(() => {
  return store.sortedColumns.find(column => column.status === store.columnFilter)?.title || ''
})

function updateSearch(event: Event): void {
  const input = event.target as HTMLInputElement
  store.setSearchQuery(input.value)
}

function updateColumnFilter(event: Event): void {
  const select = event.target as HTMLSelectElement
  store.setColumnFilter(select.value || null)
}

function updateLabelFilter(event: Event): void {
  const select = event.target as HTMLSelectElement
  store.setLabelFilter(select.value || null)
}

function updateOverdueFilter(event: Event): void {
  const input = event.target as HTMLInputElement
  store.setShowOnlyOverdueTasks(input.checked)
}

function clearFilters(): void {
  store.setColumnFilter(null)
  store.setLabelFilter(null)
  store.setShowOnlyOverdueTasks(false)
  showFilters.value = false
}

function toggleFilters(): void {
  showFilters.value = !showFilters.value
}

function toggleEditMode(): void {
  emit('toggle-edit-mode')
}

function closeFilters(): void {
  showFilters.value = false
}

function handleDocumentKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    closeFilters()
  }
}

function handleDocumentMousedown(event: MouseEvent): void {
  if (!showFilters.value) {
    return
  }

  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (!filterMenu.value?.contains(target)) {
    closeFilters()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleDocumentKeydown)
  document.addEventListener('mousedown', handleDocumentMousedown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleDocumentKeydown)
  document.removeEventListener('mousedown', handleDocumentMousedown)
})
</script>

<template>
  <section class="kanban-toolbar" aria-label="Ferramentas do quadro Kanban">
    <div class="toolbar-main">
      <label class="search-field">
        <Search :size="16" aria-hidden="true" />
        <input
          :value="store.searchQuery"
          data-testid="kanban-search-input"
          type="search"
          aria-label="Buscar tarefas do quadro"
          placeholder="Buscar tarefas..."
          @input="updateSearch"
        />
      </label>

      <div class="toolbar-actions">
        <div ref="filterMenu" class="filter-menu">
          <button
            class="toolbar-button"
            :class="{ active: showFilters || activeFilterCount > 0 }"
            type="button"
            data-testid="kanban-filter-button"
            :aria-expanded="showFilters"
            aria-controls="kanban-filter-popover"
            @click="toggleFilters"
          >
            <SlidersHorizontal :size="16" aria-hidden="true" />
            <span>Filtros</span>
            <span v-if="activeFilterCount > 0" class="filter-count">
              {{ activeFilterCount }}
            </span>
          </button>

          <div
            v-if="showFilters"
            id="kanban-filter-popover"
            class="filter-popover"
          >
            <label class="filter-field">
              <span>Coluna</span>
              <select
                :value="store.columnFilter || ''"
                data-testid="column-filter-select"
                @change="updateColumnFilter"
              >
                <option value="">Todas</option>
                <option
                  v-for="column in store.sortedColumns"
                  :key="column.id"
                  :value="column.status"
                >
                  {{ column.title }}
                </option>
              </select>
            </label>

            <label class="filter-field">
              <span>Label</span>
              <select
                :value="store.labelFilter || ''"
                data-testid="label-filter-select"
                @change="updateLabelFilter"
              >
                <option value="">Todas</option>
                <option
                  v-for="label in labelOptions"
                  :key="label"
                  :value="label"
                >
                  {{ label }}
                </option>
              </select>
            </label>

            <label class="overdue-toggle">
              <input
                :checked="store.showOnlyOverdueTasks"
                data-testid="overdue-filter-checkbox"
                type="checkbox"
                @change="updateOverdueFilter"
              />
              <span>Somente atrasadas</span>
            </label>

            <button
              class="clear-filters"
              type="button"
              data-testid="clear-kanban-filters"
              :disabled="activeFilterCount === 0"
              @click="clearFilters"
            >
              <X :size="14" aria-hidden="true" />
              <span>Limpar filtros</span>
            </button>
          </div>
        </div>

        <button
          class="toolbar-button"
          :class="{ active: editMode }"
          type="button"
          data-testid="toggle-board-edit"
          :aria-pressed="editMode"
          @click="toggleEditMode"
        >
          <Pencil :size="16" aria-hidden="true" />
          <span>{{ editMode ? 'Concluir' : 'Editar' }}</span>
        </button>
      </div>
    </div>

    <div
      v-if="activeFilterCount > 0"
      class="active-chips"
      aria-label="Filtros ativos"
    >
      <span v-if="activeColumnTitle" class="filter-chip">
        Coluna: {{ activeColumnTitle }}
      </span>
      <span v-if="store.labelFilter" class="filter-chip">
        Label: {{ store.labelFilter }}
      </span>
      <span v-if="store.showOnlyOverdueTasks" class="filter-chip">
        Atrasadas
      </span>
    </div>
  </section>
</template>

<style scoped>
.kanban-toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
}

.toolbar-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.search-field {
  flex: 1 1 280px;
  min-width: 180px;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  padding: 0 10px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 5px;
}

.search-field:focus-within {
  border-color: var(--accent);
  color: var(--text-secondary);
}

.search-field input {
  width: 100%;
  min-width: 0;
  color: var(--text-primary);
  background: transparent;
  border: 0;
  outline: 0;
  font-size: 13px;
}

.search-field input::placeholder {
  color: var(--text-muted);
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.filter-menu {
  position: relative;
}

.toolbar-button,
.clear-filters {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 10px;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.toolbar-button:hover,
.toolbar-button.active,
.clear-filters:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--selection);
  border-color: var(--accent);
}

.filter-count {
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  color: var(--bg-secondary);
  background: var(--accent);
  border-radius: 5px;
  font-size: 10px;
  line-height: 1;
}

.filter-popover {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 20;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28);
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: var(--text-secondary);
  font-size: 12px;
}

.filter-field select {
  height: 32px;
  padding: 0 8px;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 13px;
}

.filter-field select:focus {
  outline: none;
  border-color: var(--accent);
}

.overdue-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 13px;
}

.overdue-toggle input {
  width: 15px;
  height: 15px;
  accent-color: var(--accent);
}

.clear-filters {
  width: 100%;
}

.clear-filters:disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  opacity: 0.65;
}

.active-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 24px;
  padding: 3px 8px;
  color: var(--text-primary);
  background: var(--selection);
  border: 1px solid var(--border);
  border-radius: 5px;
  font-size: 12px;
  line-height: 1.3;
}

@media (max-width: 640px) {
  .toolbar-main {
    align-items: stretch;
    flex-direction: column;
  }

  .search-field {
    flex-basis: auto;
    width: 100%;
  }

  .toolbar-actions {
    width: 100%;
  }

  .filter-menu,
  .toolbar-button {
    flex: 1;
  }

  .filter-popover {
    left: 0;
    right: auto;
    width: min(100%, 280px);
  }
}
</style>
