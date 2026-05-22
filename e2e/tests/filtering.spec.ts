import { test, expect } from '@playwright/test'
import { TaskTrackerPage } from '../pages/TaskTrackerPage'

const TODAY = new Date().toISOString().slice(0, 10)

test.describe('Busca e filtros', () => {
  let app: TaskTrackerPage

  test.beforeEach(async ({ page }) => {
    app = new TaskTrackerPage(page)
    await app.goto()

    // Cria um conjunto conhecido de tarefas para os filtros agirem sobre.
    for (const [title, column] of [
      ['Corrigir bug de cache', 'Backlog'],
      ['Documentar API', 'Backlog'],
      ['Deploy de produção', 'Em Andamento'],
    ] as const) {
      const modal = await app.openNewTaskInColumn(column)
      await modal.createTask({ title, date: TODAY })
    }
  })

  test('busca por texto filtra os cards visíveis', async () => {
    await app.search('bug')

    await expect(app.taskCard('Corrigir bug de cache')).toBeVisible()
    await expect(app.taskCard('Documentar API')).toHaveCount(0)
    await expect(app.taskCard('Deploy de produção')).toHaveCount(0)
  })

  test('limpar a busca volta a exibir todas as tarefas', async () => {
    await app.search('bug')
    await expect(app.taskCard('Documentar API')).toHaveCount(0)

    await app.search('')
    await expect(app.taskCard('Documentar API')).toBeVisible()
    await expect(app.taskCard('Deploy de produção')).toBeVisible()
  })

  test('filtro por coluna mostra apenas a coluna selecionada', async () => {
    await app.filterByColumn('Em Andamento')

    await expect(app.taskCard('Deploy de produção', 'Em Andamento')).toBeVisible()
    expect(await app.taskCountInColumn('Backlog')).toBe(0)

    await app.clearColumnFilter()
    expect(await app.taskCountInColumn('Backlog')).toBe(2)
  })

  test('filtro por label e limpar filtros funcionam na toolbar do Kanban', async () => {
    const modal = await app.openNewTaskInColumn('Backlog')
    await modal.createTask({ title: 'Bug visual do header', date: TODAY, status: 'Backlog' })
    const editModal = await app.openTask('Bug visual do header')
    await editModal.root.locator('.label-chip', { hasText: 'Bug' }).click()
    await editModal.save()

    await app.filterByLabel('Bug')
    await expect(app.taskCard('Bug visual do header', 'Backlog')).toBeVisible()
    await expect(app.taskCard('Documentar API')).toHaveCount(0)

    await app.clearFilters()
    await expect(app.taskCard('Documentar API')).toBeVisible()
  })
})
