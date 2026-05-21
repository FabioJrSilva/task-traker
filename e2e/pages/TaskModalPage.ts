import { type Page, type Locator, expect } from '@playwright/test'

/**
 * Page Object do modal de Nova/Editar Tarefa (TaskModal.vue).
 *
 * Os inputs do modal não têm `id`/`for`, então campos sem placeholder
 * são localizados pelo `.form-group` que contém o texto exato do label.
 */
export class TaskModalPage {
  readonly page: Page
  readonly root: Locator
  readonly titleInput: Locator
  readonly descriptionInput: Locator
  readonly recurrenceCheckbox: Locator
  readonly recurrenceTypeSelect: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    this.page = page
    // Escopo no modal de tarefa: o cabeçalho exibe "Nova Tarefa" ou "Editar Tarefa".
    this.root = page.locator('.modal-overlay', {
      has: page.getByRole('heading', { name: /Tarefa$/ }),
    })
    this.titleInput = this.root.getByPlaceholder('Título da tarefa')
    this.descriptionInput = this.root.getByPlaceholder('Descrição da tarefa')
    this.recurrenceCheckbox = this.root.getByTestId('recurrence-checkbox')
    this.recurrenceTypeSelect = this.root.getByTestId('recurrence-type-select')
    this.saveButton = this.root.getByRole('button', { name: 'Salvar' })
    this.cancelButton = this.root.getByRole('button', { name: 'Cancelar' })
    this.deleteButton = this.root.getByRole('button', { name: 'Excluir' })
  }

  /** Retorna o controle (`input`/`select`/`textarea`) do form-group com o label informado. */
  private field(label: string): Locator {
    return this.root
      .locator('.form-group', { has: this.page.getByText(label, { exact: true }) })
      .locator('input, select, textarea')
      .first()
  }

  async expectVisible(mode: 'Nova' | 'Editar') {
    await expect(this.root.getByRole('heading', { name: `${mode} Tarefa` })).toBeVisible()
  }

  async fillTitle(title: string) {
    await this.titleInput.fill(title)
  }

  async fillDescription(description: string) {
    await this.descriptionInput.fill(description)
  }

  async setDate(isoDate: string) {
    await this.field('Data').fill(isoDate)
  }

  async selectStatus(columnTitle: string) {
    await this.field('Status').selectOption({ label: columnTitle })
  }

  async setTimeSpent(minutes: number) {
    await this.field('Tempo (minutos)').fill(String(minutes))
  }

  async enableRecurrence(type: 'daily' | 'weekly' | 'monthly') {
    await this.recurrenceCheckbox.check()
    await this.recurrenceTypeSelect.selectOption(type)
  }

  /** Preenche e salva uma tarefa nova. */
  async createTask(options: {
    title: string
    description?: string
    date?: string
    status?: string
    timeSpent?: number
    recurrence?: 'daily' | 'weekly' | 'monthly'
  }) {
    await this.expectVisible('Nova')
    await this.fillTitle(options.title)
    if (options.description) await this.fillDescription(options.description)
    if (options.date) await this.setDate(options.date)
    if (options.status) await this.selectStatus(options.status)
    if (options.timeSpent !== undefined) await this.setTimeSpent(options.timeSpent)
    if (options.recurrence) await this.enableRecurrence(options.recurrence)
    await this.save()
  }

  async save() {
    await this.saveButton.click()
    await expect(this.root).toBeHidden()
  }
}
