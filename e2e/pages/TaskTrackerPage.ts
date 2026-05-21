import { type Page, type Locator, expect } from '@playwright/test'
import { TaskModalPage } from './TaskModalPage'

/**
 * Page Object da tela principal do TaskTracker (App.vue):
 * header com ações, board Kanban e filtros.
 */
export class TaskTrackerPage {
  readonly page: Page
  readonly newTaskButton: Locator
  readonly searchToggleButton: Locator
  readonly searchInput: Locator
  readonly columnFilter: Locator
  readonly labelFilter: Locator
  readonly overdueFilter: Locator
  readonly viewToggleButton: Locator
  readonly themeToggleButton: Locator
  readonly newProjectButton: Locator
  readonly reportButton: Locator
  readonly editBoardButton: Locator
  readonly backupButton: Locator
  readonly undoButton: Locator
  readonly kanbanBoard: Locator
  readonly calendarView: Locator

  constructor(page: Page) {
    this.page = page
    this.newTaskButton = page.getByRole('button', { name: 'Nova Tarefa' })
    this.searchToggleButton = page.getByRole('button', { name: 'Buscar' })
    this.searchInput = page.getByPlaceholder('Buscar tarefas...')
    this.columnFilter = page.locator('select.column-filter').first()
    this.labelFilter = page.locator('select.column-filter').nth(1)
    this.overdueFilter = page.getByRole('checkbox')
    // O botão tem `title` e texto interno ("Calendário"/"Kanban"); o texto
    // vira o nome acessível, então localizamos pela `.toggle-label` (única).
    this.viewToggleButton = page.locator('button:has(.toggle-label)')
    this.themeToggleButton = page.getByRole('button', { name: /Modo (Claro|Escuro)/ })
    this.newProjectButton = page.getByRole('button', { name: 'Novo Projeto' })
    this.reportButton = page.getByRole('button', { name: 'Dashboard e Relatórios' })
    this.editBoardButton = page.getByRole('button', { name: /Editar Quadro|Modo edição/ })
    this.backupButton = page.getByRole('button', { name: 'Backup e Restauração' })
    this.undoButton = page.getByRole('button', { name: /Desfazer/ })
    this.kanbanBoard = page.locator('.kanban-board')
    this.calendarView = page.locator('.calendar-container, .calendar-view')
  }

  async goto() {
    await this.page.goto('/')
    // App.vue exibe um spinner até loadAppData() concluir.
    await expect(this.kanbanBoard).toBeVisible()
  }

  /** Localiza a coluna do board pelo título visível. */
  column(title: string): Locator {
    return this.page.locator('.column', {
      has: this.page.locator('.column-title', { hasText: title }),
    })
  }

  /** Localiza um card de tarefa pelo título (opcionalmente dentro de uma coluna). */
  taskCard(title: string, columnTitle?: string): Locator {
    const scope = columnTitle ? this.column(columnTitle) : this.page
    return scope.locator('.task-card', {
      has: this.page.locator('.task-title', { hasText: title }),
    })
  }

  /** Abre o TaskModal a partir do botão "Nova Tarefa" do header. */
  async openNewTask(): Promise<TaskModalPage> {
    await this.newTaskButton.click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Nova')
    return modal
  }

  /** Abre o TaskModal a partir do botão "Adicionar tarefa" de uma coluna. */
  async openNewTaskInColumn(columnTitle: string): Promise<TaskModalPage> {
    await this.column(columnTitle).getByRole('button', { name: 'Adicionar tarefa' }).click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Nova')
    return modal
  }

  /** Abre o TaskModal de edição clicando no card. */
  async openTask(title: string): Promise<TaskModalPage> {
    await this.taskCard(title).click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Editar')
    return modal
  }

  async search(query: string) {
    if (!(await this.searchInput.isVisible())) {
      await this.searchToggleButton.click()
    }
    await this.searchInput.fill(query)
  }

  async filterByColumn(columnTitle: string) {
    await this.columnFilter.selectOption({ label: columnTitle })
  }

  async clearColumnFilter() {
    await this.columnFilter.selectOption({ label: 'Todas as colunas' })
  }

  /** Conta cards de tarefa visíveis em uma coluna. */
  async taskCountInColumn(columnTitle: string): Promise<number> {
    return this.column(columnTitle).locator('.task-card').count()
  }

  async toastWith(text: string | RegExp): Promise<Locator> {
    const toast = this.page.locator('.toast', { hasText: text })
    await expect(toast.first()).toBeVisible()
    return toast.first()
  }
}
