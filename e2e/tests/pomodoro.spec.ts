import { expect, test } from '@playwright/test'

test.describe('Pomodoro Timer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('botao idle aparece no header', async ({ page }) => {
    await expect(page.locator('.pomodoro-idle-btn')).toBeVisible()
  })

  test('clicar em Iniciar Pomodoro exibe o widget com countdown', async ({ page }) => {
    await page.locator('.pomodoro-idle-btn').click()
    await expect(page.locator('.pomodoro-widget')).toBeVisible()
    await expect(page.locator('.pomodoro-time')).toContainText('24:')
  })

  test('widget mostra a label do ciclo', async ({ page }) => {
    await page.locator('.pomodoro-idle-btn').click()
    await expect(page.locator('.pomodoro-label')).toContainText('ciclo 1/4')
  })

  test('pausar congela o timer', async ({ page }) => {
    await page.locator('.pomodoro-idle-btn').click()
    const timeLocator = page.locator('.pomodoro-time')
    const pauseButton = page.locator('.pomodoro-btn').first()

    await page.waitForTimeout(1200)
    await pauseButton.click()

    const pausedTime = await timeLocator.textContent()
    await page.waitForTimeout(2000)
    const pausedTimeAfterWait = await timeLocator.textContent()

    expect(pausedTime).toBe(pausedTimeAfterWait)
  })

  test('finalizar volta ao botao idle', async ({ page }) => {
    await page.locator('.pomodoro-idle-btn').click()
    await expect(page.locator('.pomodoro-widget')).toBeVisible()

    await page.locator('.pomodoro-btn').last().click()
    await expect(page.locator('.pomodoro-widget')).toBeHidden()
    await expect(page.locator('.pomodoro-idle-btn')).toBeVisible()
  })
})
