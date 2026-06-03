import { type Page, type Locator, expect } from '@playwright/test'
import { MeetingModalPage } from './MeetingModalPage'
import { AppointmentModalPage } from './AppointmentModalPage'

export class CalendarPage {
  readonly page: Page
  readonly root: Locator
  readonly prevButton: Locator
  readonly nextButton: Locator
  readonly todayButton: Locator
  readonly periodTitle: Locator
  readonly selectedDayPanel: Locator

  constructor(page: Page) {
    this.page = page
    this.root = page.locator('.calendar-container')
    this.prevButton = this.root.locator('.nav-btn').first()
    this.nextButton = this.root.locator('.nav-btn').last()
    this.todayButton = this.root.locator('.today-btn')
    this.periodTitle = this.root.locator('.period-title')
    this.selectedDayPanel = this.root.locator('.selected-day-panel')
  }

  async expectVisible() {
    await expect(this.root).toBeVisible()
  }

  async switchView(view: 'Dia' | 'Semana' | 'Mês') {
    await this.root.locator('.tab-btn', { hasText: view }).click()
  }

  async goToPrev() {
    await this.prevButton.click()
  }

  async goToNext() {
    await this.nextButton.click()
  }

  async goToToday() {
    await this.todayButton.click()
  }

  /** Célula do mês (exclui dias de outros meses). */
  monthCell(dayNumber: number): Locator {
    return this.root.locator('.month-cell:not(.other-month)', {
      has: this.page.locator('.month-day-number', { hasText: String(dayNumber) }),
    })
  }

  /** Seleciona um dia no mês clicando na célula. */
  async selectDay(dayNumber: number) {
    await this.monthCell(dayNumber).click()
    await expect(this.selectedDayPanel).toBeVisible()
  }

  /** Abre o modal de nova reunião a partir do painel do dia selecionado. */
  async openAddMeetingFromPanel(): Promise<MeetingModalPage> {
    const meetingsSection = this.selectedDayPanel.locator('.panel-section', { hasText: 'Reuniões' })
    await meetingsSection.locator('.add-btn-small').click()
    const modal = new MeetingModalPage(this.page)
    await modal.expectVisible('Nova')
    return modal
  }

  /** Abre o modal de edição de reunião clicando no card no painel do dia. */
  async openMeetingFromPanel(title: string): Promise<MeetingModalPage> {
    await this.selectedDayPanel.locator('.item-card', { hasText: title }).click()
    const modal = new MeetingModalPage(this.page)
    await modal.expectVisible('Editar')
    return modal
  }

  /** Clica em um slot de hora na view de dia para criar agendamento. */
  async clickHourSlot(hourIndex = 0): Promise<AppointmentModalPage> {
    await this.root.locator('.hour-cell').nth(hourIndex).click()
    const modal = new AppointmentModalPage(this.page)
    await modal.expectVisible('Novo')
    return modal
  }

  /** Clica em um slot de hora na view de semana (primeira coluna por padrão). */
  async clickWeekHourSlot(dayIndex = 0, hourIndex = 0): Promise<AppointmentModalPage> {
    const dayColumn = this.root.locator('.week-day-column').nth(dayIndex)
    await dayColumn.locator('.week-hour-cell').nth(hourIndex).click()
    const modal = new AppointmentModalPage(this.page)
    await modal.expectVisible('Novo')
    return modal
  }

  /** Abre o modal de edição de agendamento na view de dia. */
  async openAppointmentFromDayView(title: string): Promise<AppointmentModalPage> {
    await this.root.locator('.appointment-block', { hasText: title }).click()
    const modal = new AppointmentModalPage(this.page)
    await modal.expectVisible('Editar')
    return modal
  }

  /** Indicador de reunião em uma célula do mês. */
  meetingDotInCell(dayNumber: number): Locator {
    return this.monthCell(dayNumber).locator('.meeting-dot')
  }

  /** Indicador de agendamento em uma célula do mês. */
  aptDotInCell(dayNumber: number): Locator {
    return this.monthCell(dayNumber).locator('.apt-dot')
  }

  /** Bloco de agendamento na view de dia. */
  appointmentBlock(title: string): Locator {
    return this.root.locator('.appointment-block', { hasText: title })
  }

  /** Bloco de reunião na view de semana. */
  weekMeetingBlock(title: string): Locator {
    return this.root.locator('.week-meeting', { hasText: title })
  }
}
