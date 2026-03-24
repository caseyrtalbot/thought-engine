/**
 * CDP connection helper for attaching Playwright to a running Electron app.
 *
 * Usage:
 *   1. Start the app with: npm run dev:debug
 *   2. Connect from tests or scripts via: connectToApp()
 *
 * This gives you a Page object for the already-open window.
 * No new Electron instance is launched, no test vault is loaded,
 * you interact with whatever state is currently on screen.
 *
 * Limitation: No main-process access (app.evaluate is unavailable).
 * Use the standard e2e tests (app.spec.ts) for IPC/main-process testing.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test'

const DEFAULT_CDP_URL = 'http://localhost:9222'

export interface AppConnection {
  readonly browser: Browser
  readonly context: BrowserContext
  readonly page: Page
  disconnect: () => Promise<void>
}

/**
 * Connect to a running Electron app via Chrome DevTools Protocol.
 * The app must be started with `npm run dev:debug` (REMOTE_DEBUGGING_PORT=9222).
 */
export async function connectToApp(cdpUrl = DEFAULT_CDP_URL): Promise<AppConnection> {
  let browser: Browser
  try {
    browser = await chromium.connectOverCDP(cdpUrl)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(
      `Could not connect to Electron app at ${cdpUrl}.\n` +
        `Make sure the app is running with: npm run dev:debug\n` +
        `Original error: ${msg}`
    )
  }

  const contexts = browser.contexts()
  if (contexts.length === 0) {
    await browser.close()
    throw new Error('Connected to CDP but no browser contexts found. Is the app window open?')
  }

  const context = contexts[0]
  const pages = context.pages()
  if (pages.length === 0) {
    await browser.close()
    throw new Error('Connected to CDP but no pages found. Is the app window loaded?')
  }

  // The main renderer window is typically the first page
  const page = pages[0]

  return {
    browser,
    context,
    page,
    disconnect: async () => {
      // Disconnect without closing the app
      await browser.close()
    }
  }
}
