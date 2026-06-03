import { type Page, type Locator, expect } from '@playwright/test'

export class AppointmentModalPage {
  readonly page: Page
  readonly root: Locator
  readonly titleInput: Locator
  readonly dateInput: Locator
  readonly timeInput: Locator
  readonly saveButton: Locator
  readonly cancelButton: Locator
  readonly deleteButton: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.locator('.modal-overlay', {
      has: page.getByRole('heading', { name: /Agendamento$/ }),
    })
    this.titleInput = this.root.getByPlaceholder('Título do agendamento')
    this.dateInput = this.root.locator('input[type="date"]')
    this.timeInput = this.root.locator('input[type="time"]')
    this.saveButton = this.root.getByRole('button', { name: 'Salvar' })
    this.cancelButton = this.root.getByRole('button', { name: 'Cancelar' })
    this.deleteButton = this.root.getByRole('button', { name: 'Excluir' })
  }

  async expectVisible(mode: 'Novo' | 'Editar') {
    await expect(this.root.getByRole('heading', { name: `${mode} Agendamento` })).toBeVisible()
  }

  async fillTitle(title: string) {
    await this.titleInput.fill(title)
  }

  async setDate(isoDate: string) {
    await this.dateInput.fill(isoDate)
  }

  async setTime(time: string) {
    await this.timeInput.fill(time)
  }

  async getDateValue(): Promise<string> {
    return this.dateInput.inputValue()
  }

  async getTimeValue(): Promise<string> {
    return this.timeInput.inputValue()
  }

  async createAppointment(options: { title: string; date?: string; time?: string }) {
    await this.expectVisible('Novo')
    await this.fillTitle(options.title)
    if (options.date) await this.setDate(options.date)
    if (options.time) await this.setTime(options.time)
    await this.save()
  }

  async save() {
    await this.saveButton.click()
    await expect(this.root).toBeHidden()
  }
}
