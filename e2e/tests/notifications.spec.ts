import { expect, test } from '@playwright/test'

test.describe('Notificações', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('sino aparece no header', async ({ page }) => {
    await expect(page.getByTestId('notification-bell')).toBeVisible()
  })

  test('dropdown abre ao clicar no sino', async ({ page }) => {
    await page.getByTestId('notification-bell').getByRole('button').click()
    await expect(page.getByTestId('notification-dropdown')).toBeVisible()
  })

  test('dropdown fecha ao clicar fora', async ({ page }) => {
    await page.getByTestId('notification-bell').getByRole('button').click()
    await expect(page.getByTestId('notification-dropdown')).toBeVisible()

    await page.getByRole('heading', { name: 'TaskTracker' }).click()
    await expect(page.getByTestId('notification-dropdown')).toBeHidden()
  })

  test('exibe estado vazio quando nao ha notificacoes', async ({ page }) => {
    await page.getByTestId('notification-bell').getByRole('button').click()
    await expect(page.getByTestId('notification-empty')).toBeVisible()
  })
})
