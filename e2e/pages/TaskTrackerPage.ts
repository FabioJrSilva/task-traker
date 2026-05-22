import { type Page, type Locator, expect } from '@playwright/test'
import { TaskModalPage } from './TaskModalPage'

/**
 * Page Object da tela principal do TaskTracker (App.vue):
 * header global, toolbar do Kanban e board.
 */
export class TaskTrackerPage {
  readonly page: Page
  readonly globalSearchInput: Locator
  readonly globalSearchDropdown: Locator
  readonly commandPalette: Locator
  readonly kanbanSearchInput: Locator
  readonly kanbanFilterButton: Locator
  readonly columnFilter: Locator
  readonly labelFilter: Locator
  readonly overdueFilter: Locator
  readonly clearFiltersButton: Locator
  readonly viewKanbanButton: Locator
  readonly viewCalendarButton: Locator
  readonly viewInsightsButton: Locator
  readonly settingsMenuButton: Locator
  readonly moreMenuButton: Locator
  readonly editBoardButton: Locator
  readonly kanbanBoard: Locator
  readonly calendarView: Locator
  readonly insightsView: Locator

  constructor(page: Page) {
    this.page = page
    this.globalSearchInput = page.getByTestId('global-search-input')
    this.globalSearchDropdown = page.getByTestId('global-search-dropdown')
    this.commandPalette = page.locator('.command-palette')
    this.kanbanSearchInput = page.getByTestId('kanban-search-input')
    this.kanbanFilterButton = page.getByTestId('kanban-filter-button')
    this.columnFilter = page.getByTestId('column-filter-select')
    this.labelFilter = page.getByTestId('label-filter-select')
    this.overdueFilter = page.getByTestId('overdue-filter-checkbox')
    this.clearFiltersButton = page.getByTestId('clear-kanban-filters')
    this.viewKanbanButton = page.getByTestId('view-kanban')
    this.viewCalendarButton = page.getByTestId('view-calendar')
    this.viewInsightsButton = page.getByTestId('view-insights')
    this.settingsMenuButton = page.getByRole('button', { name: 'Abrir menu de configurações' })
    this.moreMenuButton = page.getByRole('button', { name: 'Abrir menu de mais ações' })
    this.editBoardButton = page.getByTestId('toggle-board-edit')
    this.kanbanBoard = page.locator('.kanban-board')
    this.calendarView = page.locator('.calendar-container, .calendar-view')
    this.insightsView = page.locator('.insights-page')
  }

  async goto() {
    await this.page.goto('/')
    await expect(this.kanbanBoard).toBeVisible()
  }

  column(title: string): Locator {
    return this.page.locator('.column', {
      has: this.page.locator('.column-title', { hasText: title }),
    })
  }

  taskCard(title: string, columnTitle?: string): Locator {
    const scope = columnTitle ? this.column(columnTitle) : this.page
    return scope.locator('.task-card', {
      has: this.page.locator('.task-title', { hasText: title }),
    })
  }

  /** Abre o TaskModal a partir da command palette global. */
  async openNewTask(): Promise<TaskModalPage> {
    await this.page.keyboard.press('Control+k')
    await expect(this.commandPalette).toBeVisible()
    await this.page.locator('.palette-item', { hasText: 'Nova Tarefa' }).first().click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Nova')
    return modal
  }

  async searchGlobally(query: string) {
    await this.globalSearchInput.click()
    await this.globalSearchInput.fill(query)
  }

  async openNewTaskInColumn(columnTitle: string): Promise<TaskModalPage> {
    await this.column(columnTitle).getByRole('button', { name: 'Adicionar tarefa' }).click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Nova')
    return modal
  }

  async openTask(title: string): Promise<TaskModalPage> {
    await this.taskCard(title).click()
    const modal = new TaskModalPage(this.page)
    await modal.expectVisible('Editar')
    return modal
  }

  async search(query: string) {
    await this.kanbanSearchInput.fill(query)
  }

  async openFilters() {
    if (!(await this.columnFilter.isVisible().catch(() => false))) {
      await this.kanbanFilterButton.click()
    }
    await expect(this.columnFilter).toBeVisible()
  }

  async filterByColumn(columnTitle: string) {
    await this.openFilters()
    await this.columnFilter.selectOption({ label: columnTitle })
  }

  async clearColumnFilter() {
    await this.openFilters()
    await this.columnFilter.selectOption({ label: 'Todas' })
  }

  async filterByLabel(label: string) {
    await this.openFilters()
    await this.labelFilter.selectOption({ label })
  }

  async toggleOverdueOnly() {
    await this.openFilters()
    await this.overdueFilter.check()
  }

  async clearFilters() {
    await this.openFilters()
    await this.clearFiltersButton.click()
  }

  async openSettingsMenu() {
    await this.settingsMenuButton.click()
  }

  async openMoreMenu() {
    await this.moreMenuButton.click()
  }

  async openNewProjectFromMenu() {
    await this.openMoreMenu()
    await this.page.getByRole('button', { name: 'Novo projeto' }).click()
  }

  async openReportsFromSettings() {
    await this.openSettingsMenu()
    await this.page.getByRole('button', { name: 'Relatórios' }).click()
  }

  async openBackupFromSettings() {
    await this.openSettingsMenu()
    await this.page.getByRole('button', { name: 'Backup e restauração' }).click()
  }

  async toggleThemeFromSettings() {
    await this.openSettingsMenu()
    await this.page.getByRole('button', { name: /Modo claro|Modo escuro/ }).click()
  }

  async taskCountInColumn(columnTitle: string): Promise<number> {
    return this.column(columnTitle).locator('.task-card').count()
  }

  async toastWith(text: string | RegExp): Promise<Locator> {
    const toast = this.page.locator('.toast', { hasText: text })
    await expect(toast.first()).toBeVisible()
    return toast.first()
  }
}
