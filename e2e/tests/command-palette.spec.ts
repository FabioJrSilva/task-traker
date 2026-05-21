import { expect, test } from '@playwright/test'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('Ctrl+K abre o modal', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('.command-palette')).toBeVisible()
  })

  test('ESC fecha o modal', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.locator('.command-palette')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('.command-palette')).toBeHidden()
  })

  test('digitar no input filtra os resultados', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.locator('.palette-input').fill('insights')

    await expect(page.locator('.palette-item')).toHaveCount(1)
    await expect(page.locator('.palette-item').first()).toContainText('Insights')
  })

  test('enter executa o comando e navega para insights', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await page.locator('.palette-input').fill('insights')
    await page.keyboard.press('Enter')

    await expect(page.locator('.command-palette')).toBeHidden()
    await expect(page.locator('.insights-page')).toBeVisible()
  })
})
