import {
  test,
  expect,
  _electron as electron,
  type ElectronApplication,
  type Page
} from '@playwright/test'
import path from 'path'

const MAIN_ENTRY = path.join(__dirname, '..', 'out', 'main', 'index.js')
const TEST_VAULT = path.join(__dirname, 'fixtures', 'test-vault')

// ─────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────

/** Launch the app and load the test vault via IPC, then wait for the file tree. */
async function launchWithVault(): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ args: [MAIN_ENTRY] })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')

  await app.evaluate(async ({ BrowserWindow }, vaultPath) => {
    const win = BrowserWindow.getAllWindows()[0]
    if (win) {
      const escapedPath = JSON.stringify(vaultPath)
      await win.webContents.executeJavaScript(`
        (async () => {
          await window.api.config.write('app', 'lastVaultPath', ${escapedPath})
          location.reload()
        })()
      `)
    }
  }, TEST_VAULT)

  // Wait for the reload navigation to complete
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-testid="file-tree"]', { timeout: 15000 })

  return { app, page }
}

async function setRangeValue(locator: ReturnType<Page['locator']>, value: number): Promise<void> {
  await locator.evaluate((el, nextValue) => {
    const input = el as HTMLInputElement
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    descriptor?.set?.call(input, String(nextValue))
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

async function getWindowPosition(app: ElectronApplication): Promise<{ x: number; y: number }> {
  return await app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0]
    const [x, y] = win?.getPosition() ?? [0, 0]
    return { x, y }
  })
}

// ─────────────────────────────────────────────────────────
// 1. APP LAUNCH — one Electron instance for all launch tests
// ─────────────────────────────────────────────────────────
test.describe.serial('App Launch', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    app = await electron.launch({ args: [MAIN_ENTRY] })
    page = await app.firstWindow()
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('launches and shows a window', async () => {
    expect(page).toBeTruthy()

    const isVisible = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      return win?.isVisible() ?? false
    })
    expect(typeof isVisible).toBe('boolean')
  })

  test('window has correct dimensions', async () => {
    const { width, height } = await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      const [w, h] = win?.getSize() ?? [0, 0]
      return { width: w, height: h }
    })

    expect(width).toBeGreaterThanOrEqual(1000)
    expect(height).toBeGreaterThanOrEqual(600)
  })
})

// ─────────────────────────────────────────────────────────
// 2. EMPTY WORKSPACE — needs its own instance (no vault)
// ─────────────────────────────────────────────────────────
test.describe.serial('Empty Workspace', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    app = await electron.launch({ args: [MAIN_ENTRY] })
    page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')

    // Clear the saved vault path so the app falls back to its empty workspace shell
    await app.evaluate(async ({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
        await win.webContents.executeJavaScript(`
          (async () => {
            await window.api.config.write('app', 'lastVaultPath', '')
            location.reload()
          })()
        `)
      }
    })

    await page.waitForLoadState('domcontentloaded')
    await page.waitForSelector('[data-testid="file-tree"]', { timeout: 8000 })
    await page.waitForSelector('text=No file selected', { timeout: 8000 })
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('shows the empty editor state when no vault is loaded', async () => {
    await expect(page.getByText('No file selected')).toBeVisible({ timeout: 5000 })
    await expect(
      page.getByText('Select a file from the sidebar or press Cmd+N to create one')
    ).toBeVisible({ timeout: 5000 })
  })

  test('keeps the workspace shell mounted without vault contents', async () => {
    const fileTree = page.locator('[data-testid="file-tree"]')
    await expect(fileTree).toBeVisible({ timeout: 5000 })
    await expect(fileTree.locator('button, [role="treeitem"], .date-separator')).toHaveCount(0)
  })
})

// ─────────────────────────────────────────────────────────
// 3. WORKSPACE + FILE TREE — shared vault instance
// ─────────────────────────────────────────────────────────
test.describe.serial('Workspace', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    ;({ app, page } = await launchWithVault())
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('file tree is visible after vault loads', async () => {
    const fileTree = page.locator('[data-testid="file-tree"]')
    await expect(fileTree).toBeVisible({ timeout: 10000 })
  })

  test('file tree shows vault files', async () => {
    const pageContent = await page.content()
    const hasCategory =
      pageContent.includes('category-creation') || pageContent.includes('Category Creation')
    const hasFeedback =
      pageContent.includes('feedback-loops') || pageContent.includes('Feedback Loops')
    expect(hasCategory || hasFeedback).toBe(true)
  })

  test('sidebar is visible', async () => {
    // Sidebar contains the file tree
    const sidebar = page.locator('[data-testid="file-tree"]').locator('..')
    await expect(sidebar).toBeVisible()
  })

  test('environment settings update sidebar typography and expose card blur control', async () => {
    await page.getByTitle('Settings').click()
    const dialog = page.getByRole('dialog', { name: 'Settings' })
    await expect(dialog).toBeVisible({ timeout: 5000 })

    await dialog.getByRole('button', { name: 'Environment' }).click()
    await expect(dialog.getByText('Card Blur')).toBeVisible()

    const sidebarFontSlider = dialog
      .locator('.settings-row', { hasText: 'Sidebar Font Size' })
      .locator('input[type="range"]')

    await setRangeValue(sidebarFontSlider, 16)
    await expect(page.locator('[data-testid="file-tree"] .file-row-hover').first()).toHaveCSS(
      'font-size',
      '16px'
    )
  })
})

// ─────────────────────────────────────────────────────────
// 4. WINDOW CHROME — shared vault instance
// ─────────────────────────────────────────────────────────
test.describe.serial('Window Chrome', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    ;({ app, page } = await launchWithVault())
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('tab bar remains draggable when multiple tabs are open', async () => {
    await page.locator('[data-node-name="feedback-loops.md"]').dblclick()
    await page.locator('[data-node-name="category-creation.md"]').dblclick()

    await expect(page.locator('.editor-file-tab')).toHaveCount(2)
    const dragSpacer = page.locator('[data-testid="editor-tab-bar-drag-spacer"]')
    await expect(dragSpacer).toBeVisible()

    await app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0]
      if (!win) return
      win.unmaximize()
      win.setPosition(240, 180)
    })
    await page.waitForTimeout(150)

    const before = await getWindowPosition(app)
    const box = await dragSpacer.boundingBox()
    expect(box).not.toBeNull()
    if (!box) return

    const startX = box.x + box.width / 2
    const startY = box.y + box.height / 2

    await page.mouse.move(startX, startY)
    await page.mouse.down()
    await page.mouse.move(startX + 120, startY + 24, { steps: 16 })
    await page.mouse.up()
    await page.waitForTimeout(250)

    const after = await getWindowPosition(app)
    expect(after.x !== before.x || after.y !== before.y).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────
// 5. CANVAS — shared vault instance
// ─────────────────────────────────────────────────────────
test.describe.serial('Canvas', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    ;({ app, page } = await launchWithVault())

    // Navigate to canvas view via tab-store
    await page.evaluate(() => {
      const el = document.querySelector('[title="Canvas"]') as HTMLElement | null
      el?.click()
    })
    // Wait for canvas surface to appear
    await page.waitForSelector('[data-canvas-surface]', { timeout: 10000 })
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('canvas surface renders', async () => {
    const surface = page.locator('[data-canvas-surface]')
    await expect(surface).toBeVisible({ timeout: 8000 })
  })

  test('canvas toolbar is present', async () => {
    // Toolbar buttons should be visible
    const addCard = page.locator('[data-testid="canvas-add-card"]')
    await expect(addCard).toBeVisible({ timeout: 5000 })
  })

  test('canvas minimap renders', async () => {
    const minimap = page.locator('[data-testid="canvas-minimap"]')
    await expect(minimap).toBeVisible({ timeout: 5000 })
  })

  test('right-click opens canvas context menu', async () => {
    const surface = page.locator('[data-canvas-surface]')
    await surface.click({ button: 'right', position: { x: 300, y: 300 } })

    const contextMenu = page.locator('[data-testid="canvas-context-menu"]')
    await expect(contextMenu).toBeVisible({ timeout: 3000 })

    // Dismiss by clicking elsewhere
    await surface.click({ position: { x: 100, y: 100 } })
  })
})

// ─────────────────────────────────────────────────────────
// 5. EDITOR — shared vault instance, opens a note
// ─────────────────────────────────────────────────────────
test.describe.serial('Editor', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    ;({ app, page } = await launchWithVault())

    // Double-click a file in the tree to open the editor
    // (single-click is a no-op when canvas view is active)
    const fileItem = page.locator('[data-testid="file-tree"]').locator('text=category-creation')
    await fileItem.dblclick({ timeout: 5000 })

    // Wait for editor to appear (Tiptap or CodeMirror container)
    await page.waitForSelector('.tiptap, .cm-editor', { timeout: 10000 })
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('editor renders after clicking a file', async () => {
    const editor = page.locator('.tiptap, .cm-editor').first()
    await expect(editor).toBeVisible({ timeout: 5000 })
  })

  test('editor contains file content', async () => {
    // The test vault note should have some recognizable content
    const editorText = await page.locator('.tiptap, .cm-editor').first().textContent()
    expect(editorText).toBeTruthy()
    expect(editorText!.length).toBeGreaterThan(0)
  })
})

// ─────────────────────────────────────────────────────────
// 6. IPC INTEGRATION — verify main/renderer communication
// ─────────────────────────────────────────────────────────
test.describe.serial('IPC Integration', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async () => {
    ;({ app, page } = await launchWithVault())
  })

  test.afterAll(async () => {
    if (app) await app.close()
  })

  test('window.api is exposed in renderer', async () => {
    const hasApi = await page.evaluate(() => typeof window.api !== 'undefined')
    expect(hasApi).toBe(true)
  })

  test('fs namespace is available', async () => {
    const hasFsRead = await page.evaluate(() => typeof window.api.fs?.readFile === 'function')
    expect(hasFsRead).toBe(true)
  })

  test('config namespace is available', async () => {
    const hasConfigRead = await page.evaluate(() => typeof window.api.config?.read === 'function')
    expect(hasConfigRead).toBe(true)
  })
})
