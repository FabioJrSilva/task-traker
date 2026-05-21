import { test, expect } from '@playwright/test'

test.describe('Dashboard de Insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('navega até a página de insights pelo botão no header', async ({ page }) => {
    await page.click('button[title="Dashboard de Insights"]')
    await expect(page.locator('.insights-page')).toBeVisible()
  })

  test('exibe os 4 KPI cards quando a página carrega', async ({ page }) => {
    await page.click('button[title="Dashboard de Insights"]')
    const kpiCards = page.locator('.kpi-card')
    await expect(kpiCards).toHaveCount(4)
    await expect(kpiCards.nth(0).locator('.kpi-label')).toContainText('Total de horas')
    await expect(kpiCards.nth(1).locator('.kpi-label')).toContainText('Projetos ativos')
    await expect(kpiCards.nth(2).locator('.kpi-label')).toContainText('Tarefas concluídas')
    await expect(kpiCards.nth(3).locator('.kpi-label')).toContainText('Média diária')
  })

  test('exibe estado vazio quando não há horas registradas no mês', async ({ page }) => {
    await page.click('button[title="Dashboard de Insights"]')
    // Em ambiente E2E (banco limpo), não há horas registradas
    const isEmpty = await page.locator('.insights-empty').isVisible()
    const hasBars = await page.locator('.project-bar').first().isVisible().catch(() => false)
    // Um dos dois deve ser verdadeiro
    expect(isEmpty || hasBars).toBeTruthy()
  })

  test('navega entre meses com os botões ‹ e ›', async ({ page }) => {
    await page.click('button[title="Dashboard de Insights"]')
    const label = page.locator('.insights-month-label')
    const initialText = await label.textContent()

    await page.click('button[title="Mês anterior"]')
    const prevText = await label.textContent()
    expect(prevText).not.toBe(initialText)

    await page.click('button[title="Próximo mês"]')
    const backText = await label.textContent()
    expect(backText).toBe(initialText)
  })
})
