import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testIgnore: 'live.spec.ts',
  timeout: 30000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  use: {
    trace: 'retain-on-failure'
  },
  reporter: [['list'], ['html', { open: 'never' }]]
})
