import { defineConfig, devices } from '@playwright/test'

/**
 * Configuração E2E do TaskTracker.
 *
 * Os testes rodam contra um servidor Vite DEDICADO (`pnpm run dev:e2e`,
 * porta 5174, VITE_E2E=true) — separado do `pnpm run dev` (porta 5173) que
 * você usa no dia a dia. Com VITE_E2E=true o app grava em um IndexedDB/
 * localStorage com sufixo `_e2e`, então os dados de teste nunca tocam os
 * reais. Cada teste ainda recebe um browser context isolado.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html']] : [['list'], ['html']],

  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'pnpm run dev:e2e',
    url: 'http://localhost:5174',
    // Sempre sobe um servidor próprio na 5174; não reaproveita o dev na 5173.
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
