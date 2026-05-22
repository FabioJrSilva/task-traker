# Global Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the header's command-palette trigger with a real inline global search for tasks, meetings, appointments, and projects, while preserving `Ctrl+K` for the existing command palette.

**Architecture:** Add a dedicated `useGlobalSearch` composable with pure filtering/grouping helpers, render an inline dropdown anchored to the existing header field in `App.vue`, and keep selection behavior routed through the existing edit-modal handlers. Keep global search and command palette separate so each interaction remains semantically clear and testable.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, Vue Test Utils, Playwright

---

## File Map

- Create: `src/composables/useGlobalSearch.ts`  
  Pure filtering/grouping helpers plus a small reactive controller for query, open state, and active index.

- Create: `src/__tests__/useGlobalSearch.test.ts`  
  Unit coverage for filtering rules, grouping, deleted-item exclusion, and keyboard ordering.

- Modify: `src/App.vue`  
  Replace the header command button with a real input, render the inline dropdown, and route selected results to existing modal handlers.

- Modify: `src/__tests__/App.test.ts`  
  Update the existing header tests so they assert global search behavior instead of command-palette-on-click.

- Modify: `e2e/pages/TaskTrackerPage.ts`  
  Add page-object helpers for the new input and inline dropdown.

- Modify: `e2e/tests/command-palette.spec.ts`  
  Keep palette coverage on `Ctrl+K` only.

- Modify: `e2e/tests/filtering.spec.ts`  
  Add global-search behavior coverage without mixing it with Kanban-local search.

---

### Task 1: Build the global-search helper with failing unit tests first

**Files:**
- Create: `src/composables/useGlobalSearch.ts`
- Create: `src/__tests__/useGlobalSearch.test.ts`

- [ ] **Step 1: Write the failing unit tests for grouped content search**

```ts
import { describe, expect, it } from 'vitest'
import {
  buildGlobalSearchResults,
  flattenGlobalSearchResults,
} from '@/composables/useGlobalSearch'
import type { Task } from '@/types/Task'
import type { Project } from '@/types/Project'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: 'task-1',
    title: 'Planejar release',
    description: '',
    status: 'Backlog',
    date: '2026-05-22',
    timeSpent: 0,
    project: 'Apollo',
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

const projects: Project[] = [
  { id: 'proj-1', name: 'Apollo', createdAt: '2026-05-22T10:00:00.000Z' },
]

const meetings: Meeting[] = [
  { id: 'meet-1', title: 'Weekly Apollo', date: '2026-05-23', time: '10:00', createdAt: '2026-05-22T10:00:00.000Z' },
]

const appointments: Appointment[] = [
  {
    id: 'appt-1',
    title: 'Consulta Apollo',
    startDate: '2026-05-24',
    startTime: '14:00',
    duration: 60,
    createdAt: '2026-05-22T10:00:00.000Z',
    updatedAt: '2026-05-22T10:00:00.000Z',
  },
]

describe('buildGlobalSearchResults', () => {
  it('returns empty groups for blank query', () => {
    const result = buildGlobalSearchResults({
      query: '',
      tasks: [makeTask({})],
      projects,
      meetings,
      appointments,
    })

    expect(result.hasQuery).toBe(false)
    expect(result.totalCount).toBe(0)
    expect(result.tasks).toHaveLength(0)
    expect(result.meetings).toHaveLength(0)
    expect(result.appointments).toHaveLength(0)
    expect(result.projects).toHaveLength(0)
  })

  it('finds tasks, meetings, appointments, and projects by case-insensitive substring', () => {
    const result = buildGlobalSearchResults({
      query: 'apollo',
      tasks: [makeTask({ projectId: 'proj-1' })],
      projects,
      meetings,
      appointments,
    })

    expect(result.tasks).toHaveLength(1)
    expect(result.meetings).toHaveLength(1)
    expect(result.appointments).toHaveLength(1)
    expect(result.projects).toHaveLength(1)
  })

  it('excludes soft-deleted tasks from results', () => {
    const result = buildGlobalSearchResults({
      query: 'planejar',
      tasks: [makeTask({ deletedAt: '2026-05-22T11:00:00.000Z' })],
      projects,
      meetings: [],
      appointments: [],
    })

    expect(result.tasks).toHaveLength(0)
    expect(result.totalCount).toBe(0)
  })

  it('flattens groups in visual order for keyboard navigation', () => {
    const result = buildGlobalSearchResults({
      query: 'apollo',
      tasks: [makeTask({ projectId: 'proj-1' })],
      projects,
      meetings,
      appointments,
    })

    expect(flattenGlobalSearchResults(result).map(item => item.type)).toEqual([
      'task',
      'meeting',
      'appointment',
      'project',
    ])
  })
})
```

- [ ] **Step 2: Run the unit test to confirm the helper does not exist yet**

Run:

```bash
rtk npm run test:run -- src/__tests__/useGlobalSearch.test.ts
```

Expected: FAIL with module/function-not-found errors for `useGlobalSearch`.

- [ ] **Step 3: Write the minimal helper implementation**

```ts
import { computed, ref } from 'vue'
import type { Task } from '@/types/Task'
import type { Meeting } from '@/types/Meeting'
import type { Appointment } from '@/types/Appointment'
import type { Project } from '@/types/Project'

export type GlobalSearchItemType = 'task' | 'meeting' | 'appointment' | 'project'

export interface GlobalSearchTaskResult {
  type: 'task'
  id: string
  title: string
  meta: string
  task: Task
}

export interface GlobalSearchMeetingResult {
  type: 'meeting'
  id: string
  title: string
  meta: string
  meeting: Meeting
}

export interface GlobalSearchAppointmentResult {
  type: 'appointment'
  id: string
  title: string
  meta: string
  appointment: Appointment
}

export interface GlobalSearchProjectResult {
  type: 'project'
  id: string
  title: string
  meta: string
  project: Project
}

export interface GlobalSearchResults {
  hasQuery: boolean
  tasks: GlobalSearchTaskResult[]
  meetings: GlobalSearchMeetingResult[]
  appointments: GlobalSearchAppointmentResult[]
  projects: GlobalSearchProjectResult[]
  totalCount: number
}

export function buildGlobalSearchResults(input: {
  query: string
  tasks: Task[]
  meetings: Meeting[]
  appointments: Appointment[]
  projects: Project[]
}): GlobalSearchResults {
  const query = input.query.trim().toLowerCase()
  if (!query) {
    return {
      hasQuery: false,
      tasks: [],
      meetings: [],
      appointments: [],
      projects: [],
      totalCount: 0,
    }
  }

  const projectNameById = new Map(input.projects.map(project => [project.id, project.name]))

  const tasks = input.tasks
    .filter(task => !task.deletedAt)
    .filter(task =>
      task.title.toLowerCase().includes(query)
      || task.description.toLowerCase().includes(query)
      || task.project.toLowerCase().includes(query),
    )
    .map(task => ({
      type: 'task' as const,
      id: task.id,
      title: task.title,
      meta: `${task.status} · ${projectNameById.get(task.projectId ?? '') ?? task.project || 'Sem projeto'}`,
      task,
    }))

  const meetings = input.meetings
    .filter(meeting =>
      meeting.title.toLowerCase().includes(query)
      || (meeting.description ?? '').toLowerCase().includes(query),
    )
    .map(meeting => ({
      type: 'meeting' as const,
      id: meeting.id,
      title: meeting.title,
      meta: `${meeting.date}${meeting.time ? ` · ${meeting.time}` : ''}`,
      meeting,
    }))

  const appointments = input.appointments
    .filter(appointment =>
      appointment.title.toLowerCase().includes(query)
      || (appointment.description ?? '').toLowerCase().includes(query),
    )
    .map(appointment => ({
      type: 'appointment' as const,
      id: appointment.id,
      title: appointment.title,
      meta: `${appointment.startDate} · ${appointment.startTime}`,
      appointment,
    }))

  const projects = input.projects
    .filter(project =>
      project.name.toLowerCase().includes(query)
      || (project.client ?? '').toLowerCase().includes(query),
    )
    .map(project => ({
      type: 'project' as const,
      id: project.id,
      title: project.name,
      meta: project.client ? `Cliente: ${project.client}` : 'Projeto',
      project,
    }))

  return {
    hasQuery: true,
    tasks,
    meetings,
    appointments,
    projects,
    totalCount: tasks.length + meetings.length + appointments.length + projects.length,
  }
}

export function flattenGlobalSearchResults(results: GlobalSearchResults) {
  return [
    ...results.tasks,
    ...results.meetings,
    ...results.appointments,
    ...results.projects,
  ]
}

export function useGlobalSearch() {
  const query = ref('')
  const isOpen = ref(false)
  const activeIndex = ref(0)

  function open() {
    isOpen.value = true
  }

  function close() {
    isOpen.value = false
    query.value = ''
    activeIndex.value = 0
  }

  function resetIndex() {
    activeIndex.value = 0
  }

  function moveDown(total: number) {
    if (total <= 0) return
    activeIndex.value = (activeIndex.value + 1) % total
  }

  function moveUp(total: number) {
    if (total <= 0) return
    activeIndex.value = (activeIndex.value - 1 + total) % total
  }

  return {
    query,
    isOpen,
    activeIndex,
    open,
    close,
    resetIndex,
    moveDown,
    moveUp,
  }
}
```

- [ ] **Step 4: Run the helper tests and make them pass**

Run:

```bash
rtk npm run test:run -- src/__tests__/useGlobalSearch.test.ts
```

Expected: PASS with 4 passing tests.

- [ ] **Step 5: Commit the helper slice**

```bash
rtk git add src/composables/useGlobalSearch.ts src/__tests__/useGlobalSearch.test.ts
rtk git commit -m "feat: add global search helper"
```

---

### Task 2: Integrate the inline dropdown in `App.vue` with focused component tests

**Files:**
- Modify: `src/App.vue`
- Modify: `src/__tests__/App.test.ts`

- [ ] **Step 1: Add failing App tests for inline global search behavior**

Add tests like:

```ts
it('does not open results when the header search receives focus with an empty query', async () => {
  const wrapper = await mountApp()

  await wrapper.get('[data-testid="global-search-input"]').trigger('focus')

  expect(wrapper.find('[data-testid="global-search-dropdown"]').exists()).toBe(false)
})

it('shows grouped global search results when typing in the header input', async () => {
  mockStore.tasks = [
    {
      id: 'task-1',
      title: 'Planejar Apollo',
      description: '',
      status: 'Backlog',
      date: '2026-05-22',
      timeSpent: 0,
      project: 'Apollo',
      createdAt: '2026-05-22T10:00:00.000Z',
      updatedAt: '2026-05-22T10:00:00.000Z',
      deletedAt: null,
    },
  ]
  mockStore.projects = [{ id: 'proj-1', name: 'Apollo', createdAt: '2026-05-22T10:00:00.000Z' }]

  const wrapper = await mountApp()
  await wrapper.get('[data-testid="global-search-input"]').setValue('apollo')

  expect(wrapper.get('[data-testid="global-search-dropdown"]').text()).toContain('Tarefas')
  expect(wrapper.get('[data-testid="global-search-dropdown"]').text()).toContain('Projetos')
})

it('clicking the header search does not open the command palette', async () => {
  const wrapper = await mountApp()

  await wrapper.get('[data-testid="global-search-input"]').trigger('focus')
  await wrapper.get('[data-testid="global-search-input"]').setValue('apollo')

  expect(commandPaletteState.isOpen.value).toBe(false)
  expect(wrapper.get('[data-testid="command-palette"]').attributes('data-open')).toBe('false')
})
```

- [ ] **Step 2: Run the App tests to capture the pre-integration failure**

Run:

```bash
rtk npm run test:run -- src/__tests__/App.test.ts
```

Expected: FAIL because `global-search-input` and `global-search-dropdown` do not exist yet.

- [ ] **Step 3: Replace the header command trigger with a real input and inline dropdown**

Implement in `src/App.vue`:

```vue
<script setup lang="ts">
import {
  buildGlobalSearchResults,
  flattenGlobalSearchResults,
  useGlobalSearch,
} from '@/composables/useGlobalSearch'

const globalSearchRef = ref<HTMLElement | null>(null)
const globalSearch = useGlobalSearch()

const globalSearchResults = computed(() =>
  buildGlobalSearchResults({
    query: globalSearch.query.value,
    tasks: store.tasks,
    meetings: store.meetings,
    appointments: store.appointments,
    projects: store.projects,
  }),
)

const globalSearchItems = computed(() => flattenGlobalSearchResults(globalSearchResults.value))

function selectGlobalSearchItem(index: number) {
  const item = globalSearchItems.value[index]
  if (!item) return

  if (item.type === 'task') {
    openEditTask(item.task)
  } else if (item.type === 'meeting') {
    openEditMeeting(item.meeting)
  } else if (item.type === 'appointment') {
    openEditAppointment(item.appointment)
  } else if (item.type === 'project') {
    openEditProject(item.project)
  }

  globalSearch.close()
}
```

```vue
<div ref="globalSearchRef" class="global-command">
  <div class="global-search-shell">
    <Search :size="16" aria-hidden="true" />
    <input
      v-model="globalSearch.query.value"
      class="command-search-input"
      data-testid="global-search-input"
      type="text"
      placeholder="Buscar tarefas, reuniões, compromissos e projetos"
      aria-label="Buscar tarefas, reuniões, compromissos e projetos"
      @focus="globalSearch.open()"
    />

    <div
      v-if="globalSearch.isOpen.value && globalSearchResults.hasQuery"
      class="global-search-dropdown"
      data-testid="global-search-dropdown"
    >
      <!-- render grouped sections here -->
    </div>
  </div>
</div>
```

Also wire document key handling in `App.vue`:

```ts
if (globalSearch.isOpen.value && globalSearchResults.value.totalCount > 0) {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    globalSearch.moveDown(globalSearchItems.value.length)
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    globalSearch.moveUp(globalSearchItems.value.length)
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    selectGlobalSearchItem(globalSearch.activeIndex.value)
    return
  }
}
```

- [ ] **Step 4: Add the minimal CSS for an inline dropdown without changing the header structure**

```css
.global-search-shell {
  position: relative;
  width: min(100%, 440px);
}

.command-search-input {
  width: 100%;
  height: 36px;
  padding: 0 12px 0 36px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-primary);
}

.global-search-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  right: 0;
  max-height: 360px;
  overflow: auto;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
  z-index: 40;
}
```

- [ ] **Step 5: Run App tests and the build**

Run:

```bash
rtk npm run test:run -- src/__tests__/App.test.ts
rtk npm run build
```

Expected: PASS for App tests and successful Vite build.

- [ ] **Step 6: Commit the integration slice**

```bash
rtk git add src/App.vue src/__tests__/App.test.ts
rtk git commit -m "feat: add inline global search"
```

---

### Task 3: Preserve keyboard, outside-click, and modal-opening behavior

**Files:**
- Modify: `src/App.vue`
- Modify: `src/__tests__/App.test.ts`

- [ ] **Step 1: Add failing tests for close behavior and modal routing**

Add tests like:

```ts
it('closes the global search on Escape', async () => {
  const wrapper = await mountApp()
  await wrapper.get('[data-testid="global-search-input"]').setValue('apollo')

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await nextTick()

  expect(wrapper.find('[data-testid="global-search-dropdown"]').exists()).toBe(false)
})

it('opens the matching task modal when Enter selects the active result', async () => {
  mockStore.tasks = [/* seeded task */]
  const wrapper = await mountApp()

  await wrapper.get('[data-testid="global-search-input"]').setValue('planejar')
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  await nextTick()

  expect((wrapper.vm as unknown as { showTaskModal: boolean }).showTaskModal).toBe(true)
})
```

- [ ] **Step 2: Run the focused App suite**

Run:

```bash
rtk npm run test:run -- src/__tests__/App.test.ts
```

Expected: FAIL on missing close/routing behavior.

- [ ] **Step 3: Finish event handling for outside click, Escape, and selection dispatch**

Add logic like:

```ts
function closeGlobalSearch() {
  globalSearch.close()
}

function handleDocumentMousedown(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Node)) {
    return
  }

  if (globalSearchRef.value && !globalSearchRef.value.contains(target)) {
    closeGlobalSearch()
  }

  // existing settings / more menu logic remains below
}
```

And in `handleKeyDown`:

```ts
if (e.key === 'Escape' && globalSearch.isOpen.value) {
  closeGlobalSearch()
  return
}
```

- [ ] **Step 4: Re-run tests and typecheck**

Run:

```bash
rtk npm run test:run -- src/__tests__/App.test.ts src/__tests__/useGlobalSearch.test.ts
rtk npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the interaction slice**

```bash
rtk git add src/App.vue src/__tests__/App.test.ts src/__tests__/useGlobalSearch.test.ts
rtk git commit -m "fix: complete global search interactions"
```

---

### Task 4: Add Playwright coverage and final verification

**Files:**
- Modify: `e2e/pages/TaskTrackerPage.ts`
- Modify: `e2e/tests/filtering.spec.ts`
- Modify: `e2e/tests/command-palette.spec.ts`

- [ ] **Step 1: Add failing E2E coverage for the new header search**

Extend `TaskTrackerPage` with helpers like:

```ts
readonly globalSearchInput = page.getByTestId('global-search-input')
readonly globalSearchDropdown = page.getByTestId('global-search-dropdown')

async searchGlobally(query: string) {
  await this.globalSearchInput.fill(query)
}
```

Add scenarios:

```ts
test('busca global encontra uma tarefa sem abrir a command palette', async () => {
  const modal = await app.openNewTaskInColumn('Backlog')
  await modal.createTask({ title: 'Planejar Apollo', date: TODAY })

  await app.searchGlobally('apollo')

  await expect(app.globalSearchDropdown).toContainText('Tarefas')
  await expect(app.globalSearchDropdown).not.toContainText('Nova Tarefa')
})

test('Ctrl+K continua abrindo a command palette', async ({ page }) => {
  await page.keyboard.press('Control+K')
  await expect(page.locator('.command-palette')).toBeVisible()
})
```

- [ ] **Step 2: Run the targeted E2E suite and confirm the new tests fail first**

Run:

```bash
rtk npm run test:e2e -- e2e/tests/filtering.spec.ts e2e/tests/command-palette.spec.ts
```

Expected: FAIL until the new locators and dropdown behavior are wired correctly.

- [ ] **Step 3: Finish the page object and E2E assertions**

Update `e2e/pages/TaskTrackerPage.ts` and the two specs so they:

- use the real `data-testid="global-search-input"`
- assert that global search returns content groups
- assert that command actions do not appear in global-search results
- keep the palette test triggered exclusively by `Ctrl+K`

- [ ] **Step 4: Run the full verification set**

Run:

```bash
rtk npm run test:run -- src/__tests__/useGlobalSearch.test.ts src/__tests__/App.test.ts
rtk npm run test:e2e -- e2e/tests/filtering.spec.ts e2e/tests/command-palette.spec.ts
rtk npm run typecheck
rtk npm run build
```

Expected: all commands PASS.

- [ ] **Step 5: Commit the verification slice**

```bash
rtk git add e2e/pages/TaskTrackerPage.ts e2e/tests/filtering.spec.ts e2e/tests/command-palette.spec.ts
rtk git commit -m "test: cover global search behavior"
```

---

## Self-Review

- Spec coverage:
  - inline dropdown: covered in Task 2
  - content-only search: covered in Tasks 1, 2, and 4
  - `Ctrl+K` palette separation: covered in Tasks 2 and 4
  - selection opens existing modals: covered in Task 3
  - no auto-results on empty query: covered in Tasks 1 and 2

- Placeholder scan:
  - no `TODO`, `TBD`, or “appropriate error handling” placeholders remain

- Type consistency:
  - result types are defined in Task 1 and reused consistently in Tasks 2 and 3

