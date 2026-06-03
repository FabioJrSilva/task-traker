import { test, expect } from '@playwright/test'
import { TaskTrackerPage } from '../pages/TaskTrackerPage'
import { CalendarPage } from '../pages/CalendarPage'

const TODAY = new Date()
const TODAY_STR = TODAY.toISOString().slice(0, 10)
const TODAY_DAY = TODAY.getDate()

test.describe('Calendário', () => {
  let app: TaskTrackerPage
  let calendar: CalendarPage

  test.beforeEach(async ({ page }) => {
    app = new TaskTrackerPage(page)
    calendar = new CalendarPage(page)
    await app.goto()
    await app.viewCalendarButton.click()
    await calendar.expectVisible()
  })

  // ──────────────────────────────────────────────────────────────
  // Navegação
  // ──────────────────────────────────────────────────────────────

  test('exibe a view de calendário ao clicar no botão de calendário', async () => {
    await expect(calendar.root).toBeVisible()
    await expect(app.kanbanBoard).toBeHidden()
  })

  test('alterna entre views Dia, Semana e Mês', async () => {
    await calendar.switchView('Dia')
    await expect(calendar.root.locator('.day-view')).toBeVisible()

    await calendar.switchView('Semana')
    await expect(calendar.root.locator('.week-view')).toBeVisible()

    await calendar.switchView('Mês')
    await expect(calendar.root.locator('.month-view')).toBeVisible()
  })

  test('navega para o mês anterior e para o próximo', async () => {
    const titleBefore = await calendar.periodTitle.textContent()

    await calendar.goToNext()
    const titleNext = await calendar.periodTitle.textContent()
    expect(titleNext).not.toBe(titleBefore)

    await calendar.goToPrev()
    await calendar.goToPrev()
    const titlePrev = await calendar.periodTitle.textContent()
    expect(titlePrev).not.toBe(titleBefore)
    expect(titlePrev).not.toBe(titleNext)
  })

  test('botão Hoje retorna ao período atual após navegar', async () => {
    const titleCurrent = await calendar.periodTitle.textContent()

    await calendar.goToNext()
    await calendar.goToNext()
    expect(await calendar.periodTitle.textContent()).not.toBe(titleCurrent)

    await calendar.goToToday()
    expect(await calendar.periodTitle.textContent()).toBe(titleCurrent)
  })

  test('destaca o dia atual na view de mês', async () => {
    await expect(calendar.root.locator('.month-cell.today')).toBeVisible()
  })

  // ──────────────────────────────────────────────────────────────
  // Reuniões
  // ──────────────────────────────────────────────────────────────

  test('abre painel de detalhes ao clicar em um dia', async () => {
    await calendar.selectDay(TODAY_DAY)
    await expect(calendar.selectedDayPanel).toBeVisible()
  })

  test('data é pré-preenchida com o dia clicado ao criar reunião', async () => {
    await calendar.selectDay(TODAY_DAY)
    const modal = await calendar.openAddMeetingFromPanel()

    const dateValue = await modal.getDateValue()
    expect(dateValue).toBe(TODAY_STR)
  })

  test('cria uma reunião e ela aparece no painel do dia correto', async () => {
    await calendar.selectDay(TODAY_DAY)
    const modal = await calendar.openAddMeetingFromPanel()
    await modal.createMeeting({ title: 'Reunião de planejamento', time: '10:00' })

    await calendar.selectDay(TODAY_DAY)
    await expect(
      calendar.selectedDayPanel.locator('.item-card', { hasText: 'Reunião de planejamento' })
    ).toBeVisible()
  })

  test('indicador de reunião aparece na célula do dia no mês', async () => {
    await calendar.selectDay(TODAY_DAY)
    const modal = await calendar.openAddMeetingFromPanel()
    await modal.createMeeting({ title: 'Reunião do calendário' })

    await expect(calendar.meetingDotInCell(TODAY_DAY)).toBeVisible()
  })

  test('edita o título de uma reunião existente', async () => {
    // Cria a reunião
    await calendar.selectDay(TODAY_DAY)
    let modal = await calendar.openAddMeetingFromPanel()
    await modal.createMeeting({ title: 'Reunião original' })

    // Edita
    await calendar.selectDay(TODAY_DAY)
    const editModal = await calendar.openMeetingFromPanel('Reunião original')
    await editModal.fillTitle('Reunião atualizada')
    await editModal.save()

    // Verifica no painel
    await calendar.selectDay(TODAY_DAY)
    await expect(
      calendar.selectedDayPanel.locator('.item-card', { hasText: 'Reunião atualizada' })
    ).toBeVisible()
    await expect(
      calendar.selectedDayPanel.locator('.item-card', { hasText: 'Reunião original' })
    ).toHaveCount(0)
  })

  test('exclui uma reunião', async ({ page }) => {
    // Cria
    await calendar.selectDay(TODAY_DAY)
    let modal = await calendar.openAddMeetingFromPanel()
    await modal.createMeeting({ title: 'Reunião a excluir' })

    // Exclui
    await calendar.selectDay(TODAY_DAY)
    const editModal = await calendar.openMeetingFromPanel('Reunião a excluir')
    await editModal.deleteButton.click()

    const confirm = page.locator('.confirm-dialog', { hasText: 'Excluir Reunião' })
    await confirm.getByRole('button', { name: 'Excluir' }).click()

    await calendar.selectDay(TODAY_DAY)
    await expect(
      calendar.selectedDayPanel.locator('.item-card', { hasText: 'Reunião a excluir' })
    ).toHaveCount(0)
  })

  // ──────────────────────────────────────────────────────────────
  // Agendamentos
  // ──────────────────────────────────────────────────────────────

  test('cria um agendamento clicando num slot de hora na view de dia', async () => {
    await calendar.switchView('Dia')
    const modal = await calendar.clickHourSlot(1)
    await modal.createAppointment({ title: 'Consulta médica' })

    await expect(calendar.appointmentBlock('Consulta médica')).toBeVisible()
  })

  test('data é pré-preenchida com o dia atual ao criar agendamento na view de dia', async () => {
    await calendar.switchView('Dia')
    const modal = await calendar.clickHourSlot(0)

    const dateValue = await modal.getDateValue()
    expect(dateValue).toBe(TODAY_STR)
    await modal.cancelButton.click()
  })

  test('horário é pré-preenchido com o slot clicado ao criar agendamento', async () => {
    await calendar.switchView('Dia')

    // O segundo slot (índice 1) deve corresponder à segunda hora da grade
    const modal = await calendar.clickHourSlot(1)
    const timeValue = await modal.getTimeValue()
    // Deve ser um horário HH:00 válido
    expect(timeValue).toMatch(/^\d{2}:00$/)
    await modal.cancelButton.click()
  })

  test('cria um agendamento na view de semana', async () => {
    await calendar.switchView('Semana')
    const modal = await calendar.clickWeekHourSlot(0, 0)
    await modal.createAppointment({ title: 'Sprint planning' })

    // Verifica na view de dia indo para hoje
    await calendar.switchView('Dia')
    await calendar.goToToday()
    await expect(calendar.appointmentBlock('Sprint planning')).toBeVisible()
  })

  test('edita um agendamento existente', async () => {
    await calendar.switchView('Dia')
    const modal = await calendar.clickHourSlot(0)
    await modal.createAppointment({ title: 'Agendamento original' })

    const editModal = await calendar.openAppointmentFromDayView('Agendamento original')
    await editModal.fillTitle('Agendamento atualizado')
    await editModal.save()

    await expect(calendar.appointmentBlock('Agendamento atualizado')).toBeVisible()
    await expect(calendar.appointmentBlock('Agendamento original')).toHaveCount(0)
  })
})
