# Appointment Task Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar task do tipo "appointment" com sincronização bidirecional entre Kanban e Calendário, soft delete vinculado, e persistência via AppData.

**Architecture:** Task ganha `type: 'task' | 'appointment'` e `appointmentId`. Appointment ganha `taskId` e `deletedAt`. Store contém lógica de criação vinculada (`addAppointment`, `addAppointmentTask`), propagação de edições e delete/restore em ambos os lados. Schema AppData v5 → v6.

**Tech Stack:** Vue 3, TypeScript, Pinia, Vitest, jsdom, Playwright, lucide-vue-next.

---

## File Map

- Modify: `src/types/Task.ts` — adicionar `TaskType`, `type`, `appointmentId`
- Modify: `src/types/Appointment.ts` — adicionar `taskId`, `deletedAt`
- Modify: `src/shared/appData.ts` — `CURRENT_SCHEMA_VERSION = 6`, migration v5→v6
- Modify: `src/stores/taskStore.ts` — novas ações, modificar existentes
- Modify: `src/components/TaskModal.vue` — seletor de tipo, campos condicionais
- Modify: `src/components/AppointmentModal.vue` — sem mudanças (store já lida)
- Modify: `src/App.vue` — adaptar `handleDeleteAppointment` para `deleteLinked`
- Modify: `src/__tests__/taskStore.test.ts` — testes para novas ações
- Modify: `src/__tests__/appData.test.ts` — testes de migração v5→v6
- Modify: `src/__tests__/TaskModal.test.ts` — testes do seletor de tipo
- Modify: `e2e/tests/calendar.spec.ts` — cenário: appointment gera task no Kanban
- Modify: `e2e/tests/task-management.spec.ts` — cenário: task appointment gera appointment no calendário

---

### Task 1: Update Types

**Files:**
- Modify: `src/types/Task.ts`
- Modify: `src/types/Appointment.ts`

- [ ] **Step 1: Add TaskType and fields to Task**

In `src/types/Task.ts`, add before the `Task` interface:

```ts
export type TaskType = 'task' | 'appointment'
```

Inside the `Task` interface, add these fields after the existing `id` field (line ~77):

```ts
  type?: TaskType         // default: 'task'
  appointmentId?: string  // preenchido quando type='appointment'
```

Place them just before `id` so all new fields are grouped:

```ts
export interface Task {
  id: string
  type?: TaskType         // default: 'task'
  appointmentId?: string  // preenchido quando type='appointment'
  title: string
  // ... rest of existing fields
}
```

- [ ] **Step 2: Add taskId and deletedAt to Appointment**

In `src/types/Appointment.ts`, add after `id`:

```ts
export interface Appointment {
  id: string
  taskId?: string          // preenchido quando vinculado a uma task
  title: string
  description?: string
  startDate: string
  startTime: string
  duration: number
  attendees?: string[]
  projectId?: string
  color?: string
  deletedAt?: string | null // soft delete
  createdAt: string
  updatedAt: string
}
```

- [ ] **Step 3: Run typecheck to verify no breaking changes**

```bash
npm run typecheck
```

Expected: PASS. Existing code should not break since new fields are optional.

- [ ] **Step 4: Commit**

```bash
git add src/types/Task.ts src/types/Appointment.ts
git commit -m "feat: add TaskType and appointment-task link fields"
```

---

### Task 2: Schema Migration v5 → v6

**Files:**
- Modify: `src/shared/appData.ts`
- Modify: `src/__tests__/appData.test.ts`

- [ ] **Step 1: Write failing migration test**

Add to `src/__tests__/appData.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { migrateAppData, CURRENT_SCHEMA_VERSION, createDefaultAppData } from '@/shared/appData'

describe('appData migration v5 → v6', () => {
  it('adiciona type: task a tasks sem type', () => {
    const v5Data = {
      schemaVersion: 5,
      columns: [],
      tasks: [
        {
          id: 't1',
          title: 'Tarefa existente',
          description: '',
          status: 'backlog',
          date: '2026-01-01',
          timeSpent: 0,
          project: '',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      projects: [],
      meetings: [],
      appointments: [],
      taskOrder: {},
      workSettings: { workStartTime: '08:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
    }

    const result = migrateAppData(v5Data)

    expect(result.schemaVersion).toBe(6)
    expect(result.tasks[0].type).toBe('task')
    expect(result.tasks[0].appointmentId).toBeUndefined()
  })

  it('adiciona taskId: undefined a appointments sem taskId', () => {
    const v5Data = {
      schemaVersion: 5,
      columns: [],
      tasks: [],
      projects: [],
      meetings: [],
      appointments: [
        {
          id: 'a1',
          title: 'Consulta',
          startDate: '2026-02-01',
          startTime: '10:00',
          duration: 60,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      taskOrder: {},
      workSettings: { workStartTime: '08:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
    }

    const result = migrateAppData(v5Data)

    expect(result.schemaVersion).toBe(6)
  })

  it('preserva task.type e appointment.taskId se já existirem (idempotência)', () => {
    const v5Data = {
      schemaVersion: 5,
      columns: [],
      tasks: [
        {
          id: 't1',
          title: 'Tarefa',
          description: '',
          status: 'backlog',
          date: '2026-01-01',
          timeSpent: 0,
          project: '',
          type: 'appointment',
          appointmentId: 'a1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      projects: [],
      meetings: [],
      appointments: [
        {
          id: 'a1',
          title: 'Consulta',
          startDate: '2026-02-01',
          startTime: '10:00',
          duration: 60,
          taskId: 't1',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      taskOrder: {},
      workSettings: { workStartTime: '08:00', workEndTime: '18:00', workDays: [1, 2, 3, 4, 5] },
    }

    const result = migrateAppData(v5Data)

    // Run twice to test idempotence
    const result2 = migrateAppData(result)

    expect(result.tasks[0].type).toBe('appointment')
    expect(result.tasks[0].appointmentId).toBe('a1')
    expect(result2.tasks[0].type).toBe('appointment')
    expect(result2.tasks[0].appointmentId).toBe('a1')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/appData.test.ts
```

Expected: FAIL — `schemaVersion` still 5, `type` missing from tasks.

- [ ] **Step 3: Implement migration v5→v6**

In `src/shared/appData.ts`, change `CURRENT_SCHEMA_VERSION`:

```ts
export const CURRENT_SCHEMA_VERSION = 6
```

In `migrateAppData()`, add after the `normalizedBase` block and before the `if (schemaVersion <= 2)` block, add:

```ts
  // Migration v5 → v6: add task type and appointment link fields
  if (schemaVersion < 6) {
    normalizedBase.tasks = normalizedBase.tasks.map(task => ({
      ...task,
      type: (task as Record<string, unknown>).type as TaskType | undefined || 'task',
      appointmentId: (task as Record<string, unknown>).appointmentId as string | undefined,
    }))

    normalizedBase.appointments = normalizedBase.appointments.map(appointment => ({
      ...appointment,
      taskId: (appointment as Record<string, unknown>).taskId as string | undefined,
      deletedAt: (appointment as Record<string, unknown>).deletedAt as string | null | undefined,
    }))

    normalizedBase.schemaVersion = CURRENT_SCHEMA_VERSION
  }
```

You also need to import `TaskType` from the Task type. Add to the imports at the top of appData.ts:

```ts
import type {
  // ... existing imports
  TaskType,
} from '../types/Task'
```

- [ ] **Step 4: Run tests to verify migration passes**

```bash
npm run test:run -- src/__tests__/appData.test.ts
```

Expected: PASS — migration test and all existing tests pass.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/appData.ts src/__tests__/appData.test.ts
git commit -m "feat: add schema v5→v6 migration for appointment task type"
```

---

### Task 3: Store — addAppointment with Linked Task

**Files:**
- Modify: `src/stores/taskStore.ts`
- Modify: `src/__tests__/taskStore.test.ts`

- [ ] **Step 1: Write failing tests for addAppointment creates linked task**

Add to `src/__tests__/taskStore.test.ts`, inside the existing describe block or a new describe block:

```ts
describe('TaskStore - appointment task linking', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 15, 10, 0, 0))
    mockStorage.save.mockClear()
    mockStorage.load.mockReset()
    mockStorage.load.mockImplementation(async () => createBaseData())
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('addAppointment cria appointment e task vinculada', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Consulta médica',
      description: 'Checkup anual',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
      projectId: undefined,
    })

    expect(store.appointments).toHaveLength(1)
    const appt = store.appointments[0]
    expect(appt.title).toBe('Consulta médica')
    expect(appt.startDate).toBe('2026-01-20')
    expect(appt.duration).toBe(60)

    // Verificar task vinculada
    expect(store.tasks).toHaveLength(1)
    const task = store.tasks[0]
    expect(task.type).toBe('appointment')
    expect(task.appointmentId).toBe(appt.id)
    expect(task.title).toBe('Consulta médica')
    expect(task.description).toBe('Checkup anual')
    expect(task.dueAt).toBe('2026-01-20')
    expect(task.status).toBe('backlog')

    // Verificar link bidirecional
    expect(appt.taskId).toBe(task.id)
  })

  it('addAppointmentTask cria task tipo appointment e appointment vinculado', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointmentTask({
      title: 'Reunião projeto',
      description: 'Alinhamento semanal',
      status: 'backlog',
      date: '2026-01-22',
      timeSpent: 0,
      project: '',
      startDate: '2026-01-22',
      startTime: '10:00',
      duration: 30,
    })

    expect(store.tasks).toHaveLength(1)
    const task = store.tasks[0]
    expect(task.type).toBe('appointment')
    expect(task.title).toBe('Reunião projeto')
    expect(task.dueAt).toBe('2026-01-22')

    expect(store.appointments).toHaveLength(1)
    const appt = store.appointments[0]
    expect(appt.taskId).toBe(task.id)
    expect(appt.title).toBe('Reunião projeto')
    expect(appt.startDate).toBe('2026-01-22')
    expect(appt.duration).toBe(30)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: FAIL — `addAppointmentTask` is not defined.

- [ ] **Step 3: Add a helper to create linked task from appointment**

In `src/stores/taskStore.ts`, add a helper function before `addAppointment`:

```ts
  function createTaskFromAppointment(
    appointment: Appointment,
    taskId: string,
    initialStatus: string = 'backlog',
  ): Task {
    const now = new Date().toISOString()
    return {
      id: taskId,
      type: 'appointment',
      appointmentId: appointment.id,
      title: appointment.title,
      description: appointment.description || '',
      status: initialStatus,
      date: appointment.startDate,
      dueAt: appointment.startDate,
      dueHasTime: false,
      completedWithDelay: null,
      timeSpent: 0,
      project: '',
      projectId: appointment.projectId,
      completedAt: null,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
  }
```

- [ ] **Step 4: Modify addAppointment to create linked task**

Replace the existing `addAppointment` function (lines ~1602-1612):

```ts
  function addAppointment(
    appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'taskId' | 'deletedAt'>,
  ) {
    const now = new Date().toISOString()
    const taskId = uuidv4()
    const appointmentId = uuidv4()

    const newAppointment: Appointment = {
      ...appointment,
      id: appointmentId,
      taskId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    appointments.value.push(newAppointment)

    const newTask = createTaskFromAppointment(newAppointment, taskId)
    tasks.value.push(newTask)

    if (newTask.timeSpent > 0) {
      const entry: TimeEntry = {
        id: uuidv4(),
        taskId: newTask.id,
        projectId: newTask.projectId,
        startedAt: now,
        endedAt: now,
        durationMinutes: Math.max(1, Math.round(newTask.timeSpent)),
        source: 'manual',
      }
      timeEntries.value.push(entry)
    }

    return queueSave()
  }
```

- [ ] **Step 5: Add addAppointmentTask function**

Add after `addAppointment`:

```ts
  function addAppointmentTask(
    data: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'type' | 'appointmentId'> & {
      startDate: string
      startTime: string
      duration: number
    },
  ) {
    const now = new Date().toISOString()
    const taskId = uuidv4()
    const appointmentId = uuidv4()

    const { startDate, startTime, duration, ...taskData } = data

    const newTask: Task = {
      ...taskData,
      ...normalizeDueFields(taskData),
      id: taskId,
      type: 'appointment',
      appointmentId,
      completedAt: null,
      completedWithDelay: null,
      createdAt: now,
      updatedAt: now,
    }
    tasks.value.push(newTask)

    const newAppointment: Appointment = {
      id: appointmentId,
      taskId,
      title: taskData.title,
      description: taskData.description || undefined,
      startDate,
      startTime,
      duration,
      projectId: taskData.projectId,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }
    appointments.value.push(newAppointment)

    return queueSave()
  }
```

- [ ] **Step 6: Export the new function in the return statement**

Add `addAppointmentTask` to the return object:

```ts
    addAppointmentTask,
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: PASS — new tests pass, existing tests remain green.

- [ ] **Step 8: Commit**

```bash
git add src/stores/taskStore.ts src/__tests__/taskStore.test.ts
git commit -m "feat: addAppointment creates linked task, add addAppointmentTask"
```

---

### Task 4: Store — Bidirectional Sync on Update

**Files:**
- Modify: `src/stores/taskStore.ts`
- Modify: `src/__tests__/taskStore.test.ts`

- [ ] **Step 1: Write failing tests for bidirectional sync**

Add to the test file:

```ts
  it('updateAppointment propaga title e description para task vinculada', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Original',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.updateAppointment(apptId, {
      title: 'Alterado',
      description: 'Nova descrição',
    })

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.title).toBe('Alterado')
    expect(task?.description).toBe('Nova descrição')
  })

  it('updateAppointment propaga projectId para task vinculada', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()
    await store.addProject({ name: 'Projeto X' })
    const projectId = store.projects[0].id

    await store.addAppointment({
      title: 'Com projeto',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.updateAppointment(apptId, { projectId })

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.projectId).toBe(projectId)
  })

  it('updateAppointment propaga startDate/startTime para dueAt da task', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Data',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.updateAppointment(apptId, {
      startDate: '2026-02-15',
      startTime: '16:30',
    })

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.dueAt).toBe('2026-02-15')
  })

  it('updateTask tipo appointment propaga title para appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Original',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const task = store.tasks[0]
    await store.updateTask(task.id, { title: 'Task alterada' })

    const appt = store.appointments.find(a => a.taskId === task.id)
    expect(appt?.title).toBe('Task alterada')
  })

  it('updateTask tipo appointment propaga dueAt para startDate do appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Data',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const task = store.tasks[0]
    await store.updateTask(task.id, { dueAt: '2026-03-10' })

    const appt = store.appointments.find(a => a.taskId === task.id)
    expect(appt?.startDate).toBe('2026-03-10')
  })

  it('updateTask NÃO propaga para appointment se task.type !== appointment', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    // Criar task normal + appointment separado
    await store.addTask({
      title: 'Task normal',
      description: '',
      status: 'backlog',
      date: '2026-01-20',
      timeSpent: 0,
      project: '',
    })
    store.appointments.push({
      id: 'a-standalone',
      title: 'Standalone',
      startDate: '2026-01-20',
      startTime: '10:00',
      duration: 30,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })

    await store.updateTask(store.tasks[0].id, { title: 'Mudou' })

    const appt = store.appointments.find(a => a.id === 'a-standalone')
    expect(appt?.title).toBe('Standalone') // não mudou
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: FAIL — propagation not happening.

- [ ] **Step 3: Add sync helper**

Add before the existing `updateAppointment` function:

```ts
  function syncTaskFromAppointment(appointmentId: string, appointment: Appointment) {
    const task = tasks.value.find(t => t.appointmentId === appointmentId)
    if (!task) return

    const index = tasks.value.findIndex(t => t.appointmentId === appointmentId)
    if (index === -1) return

    tasks.value[index] = {
      ...task,
      title: appointment.title,
      description: appointment.description || task.description,
      projectId: appointment.projectId || task.projectId,
      date: appointment.startDate,
      dueAt: appointment.startDate,
      updatedAt: new Date().toISOString(),
    }
  }

  function syncAppointmentFromTask(taskId: string, task: Task) {
    if (task.type !== 'appointment') return

    const appointment = appointments.value.find(a => a.taskId === taskId)
    if (!appointment) return

    const index = appointments.value.findIndex(a => a.taskId === taskId)
    if (index === -1) return

    appointments.value[index] = {
      ...appointment,
      title: task.title,
      description: task.description || undefined,
      projectId: task.projectId || appointment.projectId,
      startDate: task.dueAt || appointment.startDate,
      updatedAt: new Date().toISOString(),
    }
  }
```

- [ ] **Step 4: Modify updateAppointment to call syncTaskFromAppointment**

Replace `updateAppointment`:

```ts
  function updateAppointment(id: string, updates: Partial<Appointment>) {
    const index = appointments.value.findIndex(a => a.id === id)
    if (index !== -1) {
      appointments.value[index] = {
        ...appointments.value[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      syncTaskFromAppointment(id, appointments.value[index])
      return queueSave()
    }
    return Promise.resolve()
  }
```

- [ ] **Step 5: Modify updateTask to call syncAppointmentFromTask**

Find the existing `updateTask` function and add after the task update logic, before the `queueSave()` return:

After the line where `tasks.value[taskIndex]` is updated (and after time entry handling), add:

```ts
    syncAppointmentFromTask(id, tasks.value[taskIndex])
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: PASS — sync tests pass, existing tests remain green.

- [ ] **Step 7: Commit**

```bash
git add src/stores/taskStore.ts src/__tests__/taskStore.test.ts
git commit -m "feat: bidirectional sync on update for appointment tasks"
```

---

### Task 5: Store — deleteLinked and restoreLinked

**Files:**
- Modify: `src/stores/taskStore.ts`
- Modify: `src/__tests__/taskStore.test.ts`

- [ ] **Step 1: Write failing tests for linked delete/restore**

Add to the test file:

```ts
  it('deleteLinked faz soft delete em ambos (appointment + task)', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Para deletar',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const taskId = store.tasks[0].id
    await store.deleteLinked(taskId)

    const task = store.tasks.find(t => t.id === taskId)
    expect(task?.deletedAt).not.toBeNull()

    const apptId = task?.appointmentId
    const appt = store.appointments.find(a => a.id === apptId)
    expect(appt?.deletedAt).not.toBeNull()
  })

  it('deleteLinked funciona passando appointmentId', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Para deletar via appt',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const apptId = store.appointments[0].id
    await store.deleteLinked(apptId)

    const appt = store.appointments.find(a => a.id === apptId)
    expect(appt?.deletedAt).not.toBeNull()

    const task = store.tasks.find(t => t.appointmentId === apptId)
    expect(task?.deletedAt).not.toBeNull()
  })

  it('restoreLinked restaura ambos do soft delete', async () => {
    const store = useTaskStore()
    await store.loadFromStorage()

    await store.addAppointment({
      title: 'Restaurável',
      startDate: '2026-01-20',
      startTime: '14:00',
      duration: 60,
    })

    const taskId = store.tasks[0].id
    await store.deleteLinked(taskId)

    await store.restoreLinked(taskId)

    const task = store.tasks.find(t => t.id === taskId)
    expect(task?.deletedAt).toBeNull()

    const appt = store.appointments.find(a => a.taskId === taskId)
    expect(appt?.deletedAt).toBeNull()
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: FAIL — `deleteLinked` is not defined.

- [ ] **Step 3: Add deleteLinked and restoreLinked to store**

Add after `deleteAppointment`:

```ts
  function deleteLinked(id: string) {
    const now = new Date().toISOString()

    // Try finding by taskId first
    const task = tasks.value.find(t => t.id === id)
    const appointment = appointments.value.find(a => a.id === id)

    if (task && task.type === 'appointment' && task.appointmentId) {
      // Delete by task
      const taskIndex = tasks.value.findIndex(t => t.id === id)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: now, updatedAt: now }
      }
      const apptIndex = appointments.value.findIndex(a => a.id === task.appointmentId)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: now, updatedAt: now }
      }
    } else if (appointment && appointment.taskId) {
      // Delete by appointment
      const apptIndex = appointments.value.findIndex(a => a.id === id)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: now, updatedAt: now }
      }
      const taskIndex = tasks.value.findIndex(t => t.id === appointment.taskId)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: now, updatedAt: now }
      }
    }

    return queueSave()
  }

  function restoreLinked(id: string) {
    const task = tasks.value.find(t => t.id === id)
    const appointment = appointments.value.find(a => a.id === id)

    if (task && task.type === 'appointment' && task.appointmentId) {
      const taskIndex = tasks.value.findIndex(t => t.id === id)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
      const apptIndex = appointments.value.findIndex(a => a.id === task.appointmentId)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
    } else if (appointment && appointment.taskId) {
      const apptIndex = appointments.value.findIndex(a => a.id === id)
      if (apptIndex !== -1) {
        appointments.value[apptIndex] = { ...appointments.value[apptIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
      const taskIndex = tasks.value.findIndex(t => t.id === appointment.taskId)
      if (taskIndex !== -1) {
        tasks.value[taskIndex] = { ...tasks.value[taskIndex], deletedAt: null, updatedAt: new Date().toISOString() }
      }
    }

    return queueSave()
  }
```

- [ ] **Step 4: Export new functions**

Add to the return object:

```ts
    deleteLinked,
    restoreLinked,
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm run test:run -- src/__tests__/taskStore.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stores/taskStore.ts src/__tests__/taskStore.test.ts
git commit -m "feat: add deleteLinked and restoreLinked for appointment tasks"
```

---

### Task 6: TaskModal — Task Type Selector and Conditional Fields

**Files:**
- Modify: `src/components/TaskModal.vue`
- Modify: `src/__tests__/TaskModal.test.ts`

- [ ] **Step 1: Write failing test for type selector in TaskModal**

Add to `src/__tests__/TaskModal.test.ts`:

```ts
  it('exibe seletor de tipo task/appointment', async () => {
    const wrapper = mount(TaskModal, {
      props: {
        task: null,
        currentDate: '2026-01-15',
        initialStatus: 'backlog',
      },
      global: {
        stubs: { ConfirmDialog: true },
        plugins: [createPinia()],
      },
    })

    const typeSelect = wrapper.find('[data-testid="task-type-select"]')
    expect(typeSelect.exists()).toBe(true)
  })

  it('tipo appointment mostra campos startDate/startTime/duration em vez de dueAt', async () => {
    const wrapper = mount(TaskModal, {
      props: {
        task: null,
        currentDate: '2026-01-15',
        initialStatus: 'backlog',
      },
      global: {
        stubs: { ConfirmDialog: true },
        plugins: [createPinia()],
      },
    })

    const typeSelect = wrapper.find('[data-testid="task-type-select"]')
    await typeSelect.setValue('appointment')

    // Campos de appointment devem estar visíveis
    expect(wrapper.find('[data-testid="appt-start-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="appt-start-time"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="appt-duration"]').exists()).toBe(true)

    // Campos de dueAt não devem estar visíveis
    expect(wrapper.find('[data-testid="due-date-input"]').exists()).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/__tests__/TaskModal.test.ts
```

Expected: FAIL — type selector not in the DOM.

- [ ] **Step 3: Add type selector and conditional fields to TaskModal**

In `src/components/TaskModal.vue`:

3a. Add new reactive refs in `<script setup>`:

```ts
const taskType = ref<TaskType>('task')
const apptStartDate = ref('')
const apptStartTime = ref('09:00')
const apptDuration = ref(60)
```

3b. Add a watcher for when `props.task` is loaded — set `taskType` from existing task:

In the watch block that populates form fields (around line ~185-220), add:

```ts
  taskType.value = a?.type || 'task'
  if (a?.type === 'appointment' && a?.appointmentId) {
    const linkedAppt = store.appointments.find(apt => apt.id === a.appointmentId)
    if (linkedAppt) {
      apptStartDate.value = linkedAppt.startDate
      apptStartTime.value = linkedAppt.startTime
      apptDuration.value = linkedAppt.duration
    }
  }
```

3c. In `handleSubmit`, handle appointment type:

After the existing validation, add:

```ts
  if (taskType.value === 'appointment') {
    store.addAppointmentTask({
      title: title.value,
      description: description.value,
      status: status.value,
      date: apptStartDate.value,
      timeSpent: timeSpent.value,
      project: project.value,
      projectId: projectId.value || undefined,
      labels: labels.value.length > 0 ? cloneLabels(labels.value) : undefined,
      comments: comments.value.length > 0 ? cloneComments(comments.value) : undefined,
      subtasks: subtasks.value.length > 0 ? cloneSubtasks(subtasks.value) : undefined,
      isRecurring: isRecurring.value,
      recurrence: isRecurring.value ? recurrenceConfig.value : undefined,
      startDate: apptStartDate.value,
      startTime: apptStartTime.value,
      duration: apptDuration.value,
    })
    emit('close')
    return
  }
```

3d. Add the type selector in `<template>`, before the title field:

```html
        <div class="form-group">
          <label>Tipo</label>
          <select v-model="taskType" data-testid="task-type-select">
            <option value="task">Tarefa</option>
            <option value="appointment">Agendamento</option>
          </select>
        </div>
```

3e. Make the date fields conditional — wrap existing date/time fields in `v-if="taskType === 'task'"` and add appointment fields:

```html
        <!-- Task type fields (existing) -->
        <template v-if="taskType === 'task'">
          <div class="form-row">
            <div class="form-group">
              <label>Data</label>
              <input v-model="date" type="date" required />
            </div>
            <div class="form-group">
              <label>Tempo Gasto (min)</label>
              <input v-model.number="timeSpent" type="number" min="0" />
            </div>
          </div>
          <!-- existing dueAt fields... -->
        </template>

        <!-- Appointment type fields -->
        <template v-if="taskType === 'appointment'">
          <div class="form-row">
            <div class="form-group">
              <label>Data</label>
              <input v-model="apptStartDate" type="date" required data-testid="appt-start-date" />
            </div>
            <div class="form-group">
              <label>Hora de Início</label>
              <input v-model="apptStartTime" type="time" required data-testid="appt-start-time" />
            </div>
          </div>
          <div class="form-group">
            <label>Duração (minutos)</label>
            <select v-model="apptDuration" data-testid="appt-duration">
              <option :value="15">15 minutos</option>
              <option :value="30">30 minutos</option>
              <option :value="60">1 hora</option>
              <option :value="90">1h30</option>
              <option :value="120">2 horas</option>
            </select>
          </div>
        </template>
```

- [ ] **Step 4: Run tests**

```bash
npm run test:run -- src/__tests__/TaskModal.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/TaskModal.vue src/__tests__/TaskModal.test.ts
git commit -m "feat: add task type selector and appointment fields to TaskModal"
```

---

### Task 7: App.vue — Adapt delete flow

**Files:**
- Modify: `src/App.vue`

- [ ] **Step 1: Update handleDeleteAppointment to use deleteLinked**

Find `handleDeleteAppointment` in `src/App.vue` (line ~518):

Replace:
```ts
async function handleDeleteAppointment(id: string) {
  await store.deleteAppointment(id)
  toast.success('Agendamento excluído')
}
```

With:
```ts
async function handleDeleteAppointment(id: string) {
  await store.deleteLinked(id)
  toast.success('Agendamento excluído')
}
```

- [ ] **Step 2: Verify typecheck and build**

```bash
npm run typecheck
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/App.vue
git commit -m "feat: use deleteLinked for appointment deletion"
```

---

### Task 8: E2E Tests

**Files:**
- Modify: `e2e/tests/calendar.spec.ts`
- Modify: `e2e/tests/task-management.spec.ts`
- Modify: `e2e/pages/TaskTrackerPage.ts` (if needed)

- [ ] **Step 1: Add calendar E2E scenario**

Add to `e2e/tests/calendar.spec.ts`:

```ts
test('criar appointment no calendário gera task no Kanban', async ({ page }) => {
  const app = new TaskTrackerPage(page)
  await app.goto()

  // Navigate to calendar
  await app.switchView('calendar')

  // Create appointment
  // ... use existing appointment creation flow
  const calendar = page.locator('[data-testid="calendar-view"]')
  await calendar.click()

  // Fill appointment modal
  await page.fill('[placeholder="Título do agendamento"]', 'Reunião Kanban')
  await page.click('button:has-text("Salvar")')

  // Switch to Kanban
  await app.switchView('kanban')

  // Verify task exists with correct title
  await expect(page.locator('.task-card:has-text("Reunião Kanban")')).toBeVisible()
})
```

- [ ] **Step 2: Add task-management E2E scenario**

Add to `e2e/tests/task-management.spec.ts`:

```ts
test('criar task tipo appointment gera appointment no calendário', async ({ page }) => {
  const app = new TaskTrackerPage(page)
  await app.goto()

  const modal = await app.openNewTaskInColumn('Backlog')

  // Select appointment type
  await modal.page.selectOption('[data-testid="task-type-select"]', 'appointment')
  await modal.page.fill('[data-testid="appt-start-date"]', '2026-06-15')
  await modal.page.fill('[placeholder="Título"]', 'Task Appointment')
  await modal.save()

  // Switch to calendar - find June 2026
  await app.switchView('calendar')
  // Navigate to June 2026
  // Verify appointment appears
})
```

- [ ] **Step 3: Run E2E tests**

```bash
npm run test:e2e -- e2e/tests/calendar.spec.ts e2e/tests/task-management.spec.ts
```

- [ ] **Step 4: Fix any issues and commit**

```bash
git add e2e/tests/calendar.spec.ts e2e/tests/task-management.spec.ts
git commit -m "test: add E2E coverage for appointment-task linking"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full unit test suite**

```bash
npm run test:run
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: PASS — no TypeScript errors.

- [ ] **Step 3: Run production build**

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit any verification fixes**

If verification required fixes, commit them. If no fixes needed, do not create an empty commit.

---

## Self-Review

- Spec coverage:
  - Tipo `appointment` na Task: Tasks 1, 2
  - Vínculo bidirecional (`appointmentId`/`taskId`): Tasks 1, 3
  - `addAppointment()` cria Task vinculada: Task 3
  - `addAppointmentTask()` cria Appointment vinculado: Tasks 3, 6
  - Sincronização bidirecional na edição: Task 4
  - Soft delete vinculado + restore: Task 5
  - Schema migration v5→v6: Task 2
  - TaskModal com seletor de tipo: Task 6
  - App.vue adaptado: Task 7
  - Backup/restore preserva links: Task 2 (migration idempotent)
  - Testes unitários: Tasks 2, 3, 4, 5, 6
  - Testes E2E: Task 8
  - DESIGN.md: já referenciado no spec

- Placeholder scan: no TBD, TODO, incomplete sections, or vague "add appropriate error handling" directives.

- Type consistency:
  - `TaskType` defined in Task 1, used in Tasks 2, 3, 4, 5, 6
  - `createTaskFromAppointment`, `syncTaskFromAppointment`, `syncAppointmentFromTask` used consistently in Tasks 3, 4
  - `deleteLinked`, `restoreLinked` used consistently in Tasks 5, 7
  - Store exports (`addAppointmentTask`, `deleteLinked`, `restoreLinked`) match usage in Tasks 6, 7
