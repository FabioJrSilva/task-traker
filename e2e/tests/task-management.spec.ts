import { test, expect } from '@playwright/test'
import { TaskTrackerPage } from '../pages/TaskTrackerPage'

const TODAY = new Date().toISOString().slice(0, 10)

test.describe('Gestão de tarefas', () => {
  let app: TaskTrackerPage

  test.beforeEach(async ({ page }) => {
    app = new TaskTrackerPage(page)
    await app.goto()
  })

  test('cria uma tarefa pela command palette global', async () => {
    const modal = await app.openNewTask()
    await modal.createTask({
      title: 'Implementar login',
      description: 'Fluxo de autenticação',
      date: TODAY,
      status: 'Backlog',
    })

    await expect(app.taskCard('Implementar login', 'Backlog')).toBeVisible()
  })

  test('cria uma tarefa direto na coluna escolhida', async () => {
    const modal = await app.openNewTaskInColumn('Em Andamento')
    await modal.createTask({ title: 'Revisar PR', date: TODAY })

    await expect(app.taskCard('Revisar PR', 'Em Andamento')).toBeVisible()
  })

  test('edita o título de uma tarefa existente', async () => {
    const createModal = await app.openNewTaskInColumn('Backlog')
    await createModal.createTask({ title: 'Tarefa rascunho', date: TODAY, status: 'Backlog' })

    const editModal = await app.openTask('Tarefa rascunho')
    await editModal.fillTitle('Tarefa revisada')
    await editModal.save()

    await expect(app.taskCard('Tarefa revisada')).toBeVisible()
    await expect(app.taskCard('Tarefa rascunho')).toHaveCount(0)
  })

  test('conclui uma tarefa movendo-a para a coluna "Concluído"', async () => {
    const createModal = await app.openNewTaskInColumn('Backlog')
    await createModal.createTask({ title: 'Tarefa a concluir', date: TODAY })
    await expect(app.taskCard('Tarefa a concluir', 'Backlog')).toBeVisible()

    const editModal = await app.openTask('Tarefa a concluir')
    await editModal.selectStatus('Concluído')
    await editModal.save()

    await expect(app.taskCard('Tarefa a concluir', 'Concluído')).toBeVisible()
    await expect(app.taskCard('Tarefa a concluir', 'Backlog')).toHaveCount(0)
  })

  test('exclui uma tarefa e desfaz a exclusão com Ctrl+Z', async ({ page }) => {
    const createModal = await app.openNewTaskInColumn('Backlog')
    await createModal.createTask({ title: 'Tarefa descartável', date: TODAY, status: 'Backlog' })

    const editModal = await app.openTask('Tarefa descartável')
    await editModal.deleteButton.click()

    const confirm = page.locator('.confirm-dialog', { hasText: 'Excluir Tarefa' })
    await confirm.getByRole('button', { name: 'Excluir' }).click()

    await expect(app.taskCard('Tarefa descartável')).toHaveCount(0)

    // soft-delete + histórico de undo (Ctrl+Z) restaura a tarefa
    await page.keyboard.press('Control+z')
    await app.toastWith(/Ação desfeita/)
    await expect(app.taskCard('Tarefa descartável')).toBeVisible()
  })

  test('cria uma tarefa recorrente e exibe o indicador de recorrência', async () => {
    const modal = await app.openNewTaskInColumn('Backlog')
    await modal.createTask({
      title: 'Daily standup',
      date: TODAY,
      recurrence: 'daily',
    })

    const card = app.taskCard('Daily standup', 'Backlog')
    await expect(card).toBeVisible()
    await expect(card.locator('.recurrence-indicator')).toBeVisible()
  })

  test('registra tempo gasto e exibe no card', async () => {
    const modal = await app.openNewTaskInColumn('Em Andamento')
    await modal.createTask({ title: 'Tarefa com tempo', date: TODAY, timeSpent: 90 })

    const card = app.taskCard('Tarefa com tempo', 'Em Andamento')
    await expect(card.locator('.time')).toHaveText('1h 30m')
  })
})
