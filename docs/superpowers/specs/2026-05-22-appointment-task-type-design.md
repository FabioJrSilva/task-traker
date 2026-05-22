# Spec: Task do Tipo Appointment com Sincronização Bidirecional

> Data: 2026-05-22  
> Status: Aprovado  
> Formato: EARS

---

## 1. Objetivo

Permitir que o usuário crie tasks do tipo "appointment" que são espelhos de appointments do calendário. Ambos são editáveis em qualquer página (Kanban ou Calendário) e mantêm sincronização bidirecional dos campos compartilhados. Soft delete vinculado — deletar de um lado remove os dois.

---

## 2. Stack

- Vue 3 + TypeScript + Pinia + Vite (stack existente)
- Vitest + jsdom (testes unitários)
- Playwright (testes E2E)
- Schema AppData v5 → v6
- Design System: [`DESIGN.md`](../../../DESIGN.md) — todas as cores, tipografia, espaçamento e padrões visuais

---

## 3. Comandos

```bash
npm run dev              # Dev server
npm test                 # Testes unitários
npm run test:e2e         # Testes E2E
npm run typecheck        # Verificação de tipos
npm run build            # Build de produção
```

---

## 4. Modelo de Dados

### 4.1 Task — novos campos

```ts
export type TaskType = 'task' | 'appointment'

// Dentro da interface Task:
type: TaskType           // default: 'task'
appointmentId?: string   // preenchido quando type='appointment'
```

### 4.2 Appointment — novos campos

```ts
taskId?: string          // preenchido quando vinculado a uma task
deletedAt?: string | null // soft delete, consistente com Task
```

### 4.3 Mapeamento de campos na sincronização

| Campo | Task | Appointment | Sincronizado? |
|-------|------|-------------|---------------|
| `title` | ✅ | ✅ | Bidirecional |
| `projectId` | ✅ | ✅ | Bidirecional |
| `startDate` | — | ✅ | → `dueAt` (data) |
| `startTime` | — | ✅ | → `dueAt` (hora) |
| `duration` | — | ✅ | Somente appointment |
| `dueAt` | ✅ | — | → `startDate` + `startTime` |
| `description` | ✅ | ✅ | Bidirecional |
| `status` | ✅ | — | Somente task |
| `labels` | ✅ | — | Somente task |
| `comments` | ✅ | — | Somente task |
| `subtasks` | ✅ | — | Somente task |

### 4.4 Vínculo

O vínculo entre Task e Appointment é via `appointmentId` (na Task) ↔ `taskId` (no Appointment). Ambos são campos explícitos no AppData JSON, persistidos automaticamente e sobrevivendo a backup/restore.

---

## 5. Arquitetura

### 5.1 Store (`taskStore.ts`) — novas ações

| Ação | Descrição |
|------|-----------|
| `addAppointment(data)` | Cria Appointment + Task vinculada (`type='appointment'`), persiste |
| `addAppointmentTask(data)` | Cria Task tipo appointment + Appointment vinculado, persiste |
| `updateAppointment(id, changes)` | Atualiza Appointment e propaga campos compartilhados para Task vinculada |
| `updateTask(id, changes)` | Se task for tipo appointment, atualiza e propaga campos compartilhados para Appointment vinculado |
| `deleteLinked(id)` | Soft delete em ambos (task e appointment vinculados) |
| `restoreLinked(id)` | Restaura ambos do soft delete (task ou appointment) |

### 5.2 Componentes afetados

| Componente | Mudança |
|------------|---------|
| `TaskModal.vue` | Campo `type` (task/appointment). Se appointment, mostra `startDate`, `startTime`, `duration` em vez de `dueAt`. Ao salvar tipo appointment, chama `addAppointmentTask()` |
| `AppointmentModal.vue` | Ao salvar, chama `addAppointment()` que cria task vinculada |
| `CalendarView.vue` | Sem mudanças estruturais. Appointment clicado abre modal que já gerencia vínculo |
| `KanbanBoard.vue` / `KanbanColumn.vue` | Sem mudanças estruturais. Task tipo appointment renderiza normalmente; badge visual opcional futuro |
| `App.vue` | Sem mudanças estruturais |

### 5.3 Fluxo: Criar appointment no Calendário

```
Usuário preenche AppointmentModal
  → store.addAppointment(data)
    → Cria Appointment em appointments[]
    → Cria Task com type='appointment', appointmentId=appointment.id
    → Appointment.taskId = task.id
    → queueSave()
```

### 5.4 Fluxo: Criar task tipo appointment no Kanban

```
Usuário preenche TaskModal com type='appointment'
  → store.addAppointmentTask(data)
    → Cria Task com type='appointment'
    → Cria Appointment vinculado
    → Task.appointmentId = appointment.id
    → Appointment.taskId = task.id
    → queueSave()
```

### 5.5 Fluxo: Editar

```
Usuário edita em qualquer lado
  → store.updateTask() ou store.updateAppointment()
    → Propaga campos compartilhados (title, description, projectId, dates)
    → queueSave()
```

### 5.6 Fluxo: Soft delete

```
Usuário deleta de qualquer lado
  → store.deleteLinked(taskId | appointmentId)
    → task.deletedAt = now
    → appointment.deletedAt = now
    → queueSave()
  → Restore: store.restoreLinked(taskId | appointmentId)
    → task.deletedAt = null
    → appointment.deletedAt = null
    → queueSave()
```

---

## 6. Schema Migration (v5 → v6)

`migrateAppData()` em `src/shared/appData.ts`:

- `CURRENT_SCHEMA_VERSION = 6`
- Todas tasks existentes ganham `type: 'task'`
- Todos appointments existentes ganham `taskId: undefined`
- Nenhum vínculo retroativo — appointments pré-existentes continuam sem task

---

## 7. Estratégia de Testes

### 7.1 Testes unitários (Vitest)

| Arquivo | Cobertura |
|---------|-----------|
| `src/__tests__/taskStore.test.ts` | `addAppointment` cria ambos vinculados; `addAppointmentTask` cria ambos vinculados; `updateAppointment` propaga para task; `updateTask` tipo appointment propaga para appointment; `deleteLinked` soft delete vinculado; `restoreLinked` restaura ambos; idempotência: recriar não duplica |
| `src/__tests__/appData.test.ts` | `migrateAppData()` v5→v6: tasks antigas ganham `type: 'task'`, appointments ganham `taskId: undefined`; backup/restore preserva links |
| `src/__tests__/TaskModal.test.ts` | Campo `type` no formulário; troca condicional `dueAt` ↔ `startDate/startTime/duration` conforme tipo |
| `src/__tests__/AppointmentModal.test.ts` | Salvar cria task vinculada via store |

### 7.2 Testes E2E (Playwright)

| Spec | Cenários |
|------|----------|
| `e2e/tests/calendar.spec.ts` | Criar appointment → task aparece no Kanban; editar título no calendário → task reflete; deletar → ambos somem |
| `e2e/tests/task-management.spec.ts` | Criar task tipo appointment → appointment aparece no calendário; editar no Kanban → calendário reflete; soft delete restaura ambos |

### 7.3 Verificação

```bash
npm run typecheck   # Deve passar sem erros
npm test            # Todos os testes unitários passam
npm run build       # Build de produção sem erros
```

---

## 8. Boundaries

- **Always:** Seguir padrão de codificação do AGENTS.md; mensagens de erro em português; usar `queueSave()` para persistência; validar IDs de vínculo antes de operações; executar `migrateAppData()` antes de usar dados carregados
- **Ask first:** Mudanças no schema além de v5→v6; alterações na UI do KanbanColumn para badge visual; adicionar novos campos ao mapeamento de sincronização
- **Never:** Bypassar o store para criar/editar/deletar entidades vinculadas; expor erros internos ao usuário; quebrar compatibilidade com backups existentes

---

## 9. Critérios de Sucesso

- [ ] Criar appointment no calendário gera task tipo appointment no Kanban com título e data sincronizados
- [ ] Criar task tipo appointment no Kanban gera appointment no calendário
- [ ] Editar título/data/projeto em qualquer lado atualiza o outro lado
- [ ] Soft delete de um lado remove ambos; restore restaura ambos
- [ ] Tasks tipo appointment aparecem normalmente no Kanban (arrastáveis entre colunas, filtráveis)
- [ ] Backup/restore preserva vínculos `appointmentId`/`taskId`
- [ ] Dados existentes (tasks sem tipo, appointments sem taskId) migram corretamente sem perda
- [ ] `npm run typecheck` passa; `npm test` passa; `npm run build` passa
