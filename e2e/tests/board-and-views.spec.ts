import { test, expect } from '@playwright/test'
import { TaskTrackerPage } from '../pages/TaskTrackerPage'

test.describe('Quadro e visualizações', () => {
  let app: TaskTrackerPage

  test.beforeEach(async ({ page }) => {
    app = new TaskTrackerPage(page)
    await app.goto()
  })

  test('exibe as colunas padrão do Kanban ao carregar', async () => {
    for (const title of ['Backlog', 'Aguardando', 'Em Andamento', 'Concluído']) {
      await expect(app.column(title)).toBeVisible()
    }
  })

  test('adiciona uma nova coluna pelo modo de edição', async ({ page }) => {
    await app.editBoardButton.click()

    await page.getByRole('button', { name: 'Nova Coluna' }).click()
    const columnModal = page.locator('.modal-overlay', {
      has: page.getByRole('heading', { name: 'Nova Coluna' }),
    })
    await columnModal.getByPlaceholder('Ex: Em Desenvolvimento').fill('Em Revisão')
    await columnModal.getByRole('button', { name: 'Salvar' }).click()

    await expect(app.column('Em Revisão')).toBeVisible()
  })

  test('cria um projeto e o disponibiliza no modal de tarefa', async ({ page }) => {
    await app.openNewProjectFromMenu()
    const projectModal = page.locator('.modal-overlay', {
      has: page.getByRole('heading', { name: 'Novo Projeto' }),
    })
    await projectModal.getByPlaceholder('Nome do projeto').fill('Projeto Apollo')
    await projectModal.getByRole('button', { name: 'Salvar' }).click()
    await expect(projectModal).toBeHidden()

    const taskModal = await app.openNewTask()
    await expect(
      taskModal.root.locator('option', { hasText: 'Projeto Apollo' }),
    ).toHaveCount(1)
  })

  test('alterna entre as visualizações Kanban e Calendário', async ({ page }) => {
    await expect(app.kanbanBoard).toBeVisible()

    await app.viewCalendarButton.click()
    await expect(page.locator('.calendar-container')).toBeVisible()
    await expect(app.kanbanBoard).toBeHidden()

    await app.viewKanbanButton.click()
    await expect(app.kanbanBoard).toBeVisible()
  })

  test('alterna o tema entre claro e escuro', async ({ page }) => {
    const html = page.locator('html')
    const initialTheme = await html.getAttribute('data-theme')

    await app.toggleThemeFromSettings()
    await expect(html).not.toHaveAttribute('data-theme', initialTheme ?? '')
  })

  test('abre o modal de Dashboard e Relatórios', async ({ page }) => {
    await app.openReportsFromSettings()
    await expect(page.getByRole('heading', { name: 'Relatório por Período' })).toBeVisible()
  })

  test('abre o modal de Backup e Restauração', async ({ page }) => {
    await app.openBackupFromSettings()
    await expect(page.getByRole('heading', { name: 'Backup e Restauração' })).toBeVisible()
  })

  test('toolbar do Kanban aparece só na view Kanban e não há botão global Nova Tarefa', async ({
    page,
  }) => {
    await expect(app.kanbanSearchInput).toBeVisible()
    await expect(page.getByRole('button', { name: /Nova Tarefa/i })).toHaveCount(0)

    await app.viewCalendarButton.click()
    await expect(app.kanbanSearchInput).toHaveCount(0)
  })
})
