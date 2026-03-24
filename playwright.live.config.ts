import { defineConfig } from '@playwright/test'

/**
 * Config for live CDP tests against a running Electron app.
 * Start the app first: npm run dev:debug
 * Then run: npm run test:live
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'live.spec.ts',
  timeout: 15000,
  retries: 0,
  workers: 1,
  fullyParallel: false,
  use: {
    trace: 'on-first-retry'
  },
  reporter: [['list']]
})
