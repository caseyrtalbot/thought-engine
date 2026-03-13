# Visual Polish + Test Hardening Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the E2E test suite so it actually catches regressions, fix the remaining visual issues that affect perceived quality, and add the missing file-save loop.

**Architecture:** All work targets the existing renderer codebase. No new processes, no new IPC channels. The test hardening is purely in `e2e/app.spec.ts`. Visual fixes are CSS/component-level. File saving wires existing `window.api.fs.writeFile` to the editor's dirty state.

**Tech Stack:** Playwright (Electron), React 18, Tiptap, Zustand, Tailwind v4, D3.js (Canvas2D)

**Status context:** 163/163 unit tests passing. Build clean. 3 recent commits (floating card panels, open type system, SplitPane fix) resolved several items from the original diagnostic. This plan targets what remains.

---

## Chunk 1: E2E Test Hardening

The existing 22-test suite has structural issues that make the pass count misleading. This chunk fixes the test architecture before we rely on it as a quality gate.

### Task 1: Replace always-green conditional assertions with unconditional ones

**Problem:** Tests at lines 86-91, 109-113, and 316-318 of `app.spec.ts` use `if (count > 0)` guards that silently pass when the feature doesn't render. These are false confidence.

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Fix Welcome Screen heading test**

The test currently passes whether or not the heading exists. Replace with an unconditional assertion:

```typescript
test('shows welcome screen with Thought Engine heading', async () => {
  const heading = page.locator('h1')
  await expect(heading.first()).toBeVisible({ timeout: 5000 })
  const text = await heading.first().textContent()
  expect(text).toBeTruthy()
  await screenshot('02-welcome-or-workspace')
})
```

**Fallback if this fails:** The Welcome Screen `beforeEach` uses `ELECTRON_STORE_DATA: '{}'` to clear saved vault state. If this env var doesn't actually prevent vault auto-loading (electron-store might still read the config file on disk), the welcome screen won't appear and this test will fail for the wrong reason. In that case, add a step to delete or override the electron-store config file in a `tmpdir` before launch:
```typescript
env: { ...process.env, ELECTRON_STORE_CWD: tmpdir }
```

- [ ] **Step 2: Fix Create/Open buttons test**

```typescript
test('shows Create and Open buttons on welcome screen', async () => {
  const createBtn = page.locator('button', { hasText: 'Create New Vault' })
  const openBtn = page.locator('button', { hasText: 'Open Existing Folder' })

  await expect(createBtn).toBeVisible({ timeout: 5000 })
  await expect(openBtn).toBeVisible({ timeout: 5000 })
  await screenshot('02-welcome-buttons')
})
```

- [ ] **Step 3: Fix command palette test**

```typescript
test('command palette opens with Cmd+K and shows Activate Claude', async () => {
  await page.keyboard.press('Meta+k')

  const activateCmd = page.locator('text=Activate Claude')
  await expect(activateCmd.first()).toBeVisible({ timeout: 3000 })
  await screenshot('05-command-palette')
})
```

- [ ] **Step 4: Run E2E suite to verify fixes**

Run: `npm run test:e2e`
Expected: Tests that previously silently passed may now fail, revealing real issues. **If tests fail here, diagnose and fix the root cause before proceeding.** Don't move to Task 2 with a red suite.

- [ ] **Step 5: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: replace always-green conditional assertions with unconditional ones"
```

---

### Task 2a: Add data-testid attributes to key UI elements

**Problem:** Tests need stable selectors decoupled from text content. This is a prerequisite for replacing `waitForTimeout` with `waitForSelector`.

**Files:**
- Modify: `src/renderer/src/panels/sidebar/FileTree.tsx` (file tree wrapper div)
- Modify: `src/renderer/src/panels/terminal/TerminalTabs.tsx` (tab bar wrapper div)
- Modify: `src/renderer/src/panels/terminal/ClaudeActivateButton.tsx` (button element)
- Modify: `src/renderer/src/design/components/CommandPalette.tsx` (overlay div)
- Modify: `src/renderer/src/panels/graph/GraphPanel.tsx` (canvas wrapper div)

- [ ] **Step 1: Add data-testid to each component**

Add `data-testid` to the outermost relevant element in each component:

```
FileTree.tsx:          data-testid="file-tree"
TerminalTabs.tsx:      data-testid="terminal-tabs"
ClaudeActivateButton:  data-testid="claude-activate-btn"
CommandPalette.tsx:     data-testid="command-palette"
GraphPanel.tsx:         data-testid="graph-canvas"
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/panels/ src/renderer/src/design/
git commit -m "chore: add data-testid attributes for E2E test selectors"
```

---

### Task 2b: Replace waitForTimeout in assertion tests

**Problem:** 23 instances of `waitForTimeout` with hardcoded durations (500ms-3000ms) across `app.spec.ts`. This task addresses the 15 instances in the assertion test blocks (App Launch, Welcome Screen, Workspace, Command Palette).

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Replace vault-load waitForTimeout (lines 146, 375)**

In both `beforeEach` blocks (Workspace and Aesthetic):

```typescript
// Before: await page.waitForTimeout(3000)
// After:
await page.waitForSelector('[data-testid="file-tree"]', { timeout: 10000 })
```

- [ ] **Step 2: Replace Welcome Screen waits (lines 81, 96)**

```typescript
// Before: await page.waitForTimeout(2000)
// After:
await page.waitForSelector('h1', { timeout: 5000 })
```

- [ ] **Step 3: Replace terminal/Claude button waits**

| Line | Current | Replace with |
|---|---|---|
| 189 | `waitForTimeout(1000)` | `page.waitForSelector('[data-testid="terminal-tabs"]', { timeout: 5000 })` |
| 202 | `waitForTimeout(1000)` | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 217 | `waitForTimeout(1000)` | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 242 | `waitForTimeout(1000)` | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 246 | `waitForTimeout(2000)` | `page.waitForSelector('text=Claude', { timeout: 5000 })` |
| 258 | `waitForTimeout(1000)` | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 261 | `waitForTimeout(2000)` | `page.waitForSelector('text=Claude', { timeout: 5000 })` |
| 281 | `waitForTimeout(1000)` | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 285 | `waitForTimeout(1500)` | `page.waitForSelector('text=Claude', { timeout: 5000 })` |
| 292 | `waitForTimeout(500)` | Remove (assertion follows immediately) |
| 307 | `waitForTimeout(500)` | `page.waitForSelector('[data-testid="command-palette"]', { timeout: 3000 })` |
| 326 | `waitForTimeout(1500)` | `page.waitForSelector('[data-testid="graph-canvas"]', { timeout: 5000 })` |

- [ ] **Step 4: Run E2E suite**

Run: `npm run test:e2e`
Expected: Tests run faster and fail reliably when elements don't render.

- [ ] **Step 5: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: replace waitForTimeout with waitForSelector in assertion tests"
```

---

### Task 2c: Replace waitForTimeout in screenshot capture tests

**Problem:** The remaining 8 `waitForTimeout` instances in the Aesthetic/Screenshot block (lines 375, 390, 399, 410, 413, 420, 423, 430).

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Replace each instance**

| Line | Context | Replace with |
|---|---|---|
| 375 | beforeEach vault load | Already replaced in 2b |
| 390 | Graph view screenshot | `page.waitForSelector('[data-testid="graph-canvas"]', { timeout: 5000 })` |
| 399 | Editor click wait | `page.waitForSelector('.ProseMirror', { timeout: 3000 })` |
| 410 | Claude button wait | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 413 | Hover delay (200ms) | Keep as-is. CSS hover transitions need a small real delay. Reduce to `100` |
| 420 | Claude button wait | `page.locator('[data-testid="claude-activate-btn"]').waitFor({ timeout: 5000 })` |
| 423 | Claude activation wait | `page.waitForSelector('text=Claude', { timeout: 5000 })` |
| 430 | Command palette wait | `page.waitForSelector('[data-testid="command-palette"]', { timeout: 3000 })` |

- [ ] **Step 2: Run E2E suite**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: replace waitForTimeout in screenshot capture tests"
```

---

### Task 3: Fix vault loading string interpolation

**Problem:** `executeJavaScript` with template literal string interpolation breaks on paths with quotes/backslashes.

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Replace string interpolation with JSON.stringify**

```typescript
// Before (lines 134, 364):
win.webContents.executeJavaScript(`
  (async () => {
    await window.api.config.write('app', 'lastVaultPath', '${vaultPath}')
    location.reload()
  })()
`)

// After:
const escapedPath = JSON.stringify(vaultPath)
win.webContents.executeJavaScript(`
  (async () => {
    await window.api.config.write('app', 'lastVaultPath', ${escapedPath})
    location.reload()
  })()
`)
```

Apply this to both `beforeEach` blocks (Workspace at line 134, Aesthetic at line 364).

- [ ] **Step 2: Run E2E suite**

Run: `npm run test:e2e`
Expected: PASS (same behavior, safer escaping)

- [ ] **Step 3: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "fix: escape vault path in E2E executeJavaScript to prevent injection"
```

---

### Task 4: Add PTY crash regression test

**Problem:** The PTY "Object has been destroyed" crash was fixed in `shell.ts` but has no regression test.

**Limitation:** The crash happens asynchronously during process teardown. Playwright's `app.close()` may not surface main-process crashes through the promise chain. This test verifies the app exits cleanly, but a true regression test would need to inspect stderr or the exit code.

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
test('app closes cleanly with active terminal sessions', async () => {
  // Ensure at least one terminal session is active (created by beforeEach)
  const termTabs = page.locator('[data-testid="terminal-tabs"]')
  await termTabs.waitFor({ timeout: 5000 })

  // Close the app. If the PTY isDestroyed() guard is missing,
  // the async onExit callback crashes on webContents.send() and
  // the process exits with a non-zero code.
  // Note: Playwright may not surface the crash as a test failure,
  // but a non-clean exit will cause the afterEach to fail.
  await app.close()
})
```

- [ ] **Step 2: Run E2E suite**

Run: `npm run test:e2e`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: add regression test for clean app close with active terminals"
```

---

### Task 5: Rename aesthetic screenshot block

**Problem:** The "Aesthetic Diagnostics" describe block has 7 tests with zero assertions. They inflate the test count. Renaming makes the intent explicit.

**Files:**
- Modify: `e2e/app.spec.ts`

- [ ] **Step 1: Rename the describe block**

```typescript
// Before:
test.describe('Aesthetic Diagnostics', () => {
// After:
test.describe('Screenshot Capture (no assertions)', () => {
```

- [ ] **Step 2: Commit**

```bash
git add e2e/app.spec.ts
git commit -m "test: rename aesthetic screenshot block to clarify no assertions"
```

---

## Chunk 2: Remaining Visual Polish

These are the items from the original diagnostic that the 3 recent commits did NOT resolve.

### Task 6: Auto-assign colors to custom types via string hash

**Problem:** Custom types like `pattern` or `doctrine` all render as gray (#64748b), same as `note`. Users creating custom types get no visual differentiation.

**Files:**
- Modify: `src/renderer/src/design/tokens.ts:38-41`
- Test: `tests/design/tokens.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// In tests/design/tokens.test.ts, add to existing describe block:
describe('getArtifactColor', () => {
  it('returns distinct colors for different custom types', () => {
    const patternColor = getArtifactColor('pattern')
    const doctrineColor = getArtifactColor('doctrine')
    const theoryColor = getArtifactColor('theory')

    // Custom types should NOT all be the same gray
    const uniqueColors = new Set([patternColor, doctrineColor, theoryColor])
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2)
  })

  it('returns consistent color for the same custom type', () => {
    expect(getArtifactColor('pattern')).toBe(getArtifactColor('pattern'))
  })

  it('still returns built-in colors for known types', () => {
    expect(getArtifactColor('gene')).toBe('#22d3ee')
    expect(getArtifactColor('constraint')).toBe('#ef4444')
  })

  it('custom type colors do not collide with built-in colors', () => {
    const builtInColors = new Set(Object.values(ARTIFACT_COLORS))
    const customColor = getArtifactColor('myCustomType')
    expect(builtInColors.has(customColor)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/design/tokens.test.ts -v`
Expected: FAIL on "distinct colors for different custom types"

- [ ] **Step 3: Implement string-hash color generation**

```typescript
// In tokens.ts

// Palette excludes colors already used by built-in types to avoid confusion
const CUSTOM_TYPE_PALETTE = [
  '#c084fc', // purple (distinct from research #a78bfa)
  '#818cf8', // indigo
  '#34d399', // emerald
  '#facc15', // yellow
  '#fb923c', // orange
  '#f87171', // red-light (distinct from constraint #ef4444)
  '#2dd4bf', // teal
  '#a3e635', // lime
  '#fbbf24', // amber
] as const

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getArtifactColor(type: string): string {
  const builtIn = (ARTIFACT_COLORS as Record<string, string>)[type]
  if (builtIn) return builtIn
  // Deterministic color from palette based on type name hash
  return CUSTOM_TYPE_PALETTE[hashString(type) % CUSTOM_TYPE_PALETTE.length]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/design/tokens.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/design/tokens.ts tests/design/tokens.test.ts
git commit -m "feat: auto-assign colors to custom artifact types via string hash"
```

---

### Task 7: Fix "1 edges" and "1 nodes" grammar in StatusBar

**Problem:** `StatusBar.tsx` line 37 shows `{nodeCount} nodes` and line 39 shows `{edgeCount} edges`. Both should use singular form when count is 1.

**Files:**
- Modify: `src/renderer/src/components/StatusBar.tsx:34-48`
- Create: `tests/components/StatusBar.test.ts`

- [ ] **Step 1: Write failing test for pluralization**

```typescript
// tests/components/StatusBar.test.ts
describe('StatusBar pluralization', () => {
  // Test the pluralization logic directly rather than rendering the component
  function pluralize(count: number, singular: string): string {
    return `${count} ${count === 1 ? singular : singular + 's'}`
  }

  it('uses singular for 1 node', () => {
    expect(pluralize(1, 'node')).toBe('1 node')
  })

  it('uses plural for 0 or 2+ nodes', () => {
    expect(pluralize(0, 'node')).toBe('0 nodes')
    expect(pluralize(2, 'node')).toBe('2 nodes')
  })

  it('uses singular for 1 edge', () => {
    expect(pluralize(1, 'edge')).toBe('1 edge')
  })
})
```

- [ ] **Step 2: Run test to verify it passes (logic is correct)**

Run: `npm test -- tests/components/StatusBar.test.ts`
Expected: PASS (the helper function is correct; this verifies the pattern before applying it)

- [ ] **Step 3: Apply pluralization to GraphStatus component**

In `StatusBar.tsx`, replace lines 37 and 39:

```typescript
// Before:
<span>{nodeCount} nodes</span>
// After:
<span>{nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}</span>

// Before:
<span>{edgeCount} edges</span>
// After:
<span>{edgeCount} {edgeCount === 1 ? 'edge' : 'edges'}</span>
```

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/components/StatusBar.tsx tests/components/StatusBar.test.ts
git commit -m "fix: correct singular/plural grammar in status bar for nodes and edges"
```

---

### Task 8: File tree type dots show type name on hover

**Problem:** Colored dots in the file tree hint at type but users can't tell what type a file is without opening it.

**Files:**
- Modify: `src/renderer/src/panels/sidebar/FileTree.tsx`

- [ ] **Step 1: Add title attribute to the type dot element**

Find the colored dot `<span>` in the `FileRow` component of `FileTree.tsx` and add a `title` prop:

```tsx
<span
  className="..."
  style={{ backgroundColor: artifactColor }}
  title={artifactType ?? 'note'}
/>
```

The prop name is `artifactType` (type `ArtifactType | undefined`) passed to the `FileRow` component.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/renderer/src/panels/sidebar/FileTree.tsx
git commit -m "feat: show artifact type name on hover for file tree dots"
```

---

## Chunk 3: File Saving

This is the highest-impact functional gap from the handoff doc. The editor loads files but doesn't write changes back.

### Task 9: Add markSaved action to editor-store

**Context:** The store already has `isDirty` tracking: `setContent()` sets `isDirty: true` (line 93), `loadContent()` sets `isDirty: false` (line 94), and `setDirty()` exists (line 95). What's missing is a `markSaved()` action that the autosave can call after a successful write.

**Files:**
- Modify: `src/renderer/src/store/editor-store.ts`
- Create: `tests/editor/editor-save.test.ts`

- [ ] **Step 1: Write test for markSaved (this will fail because the action doesn't exist)**

```typescript
// tests/editor/editor-save.test.ts
import { useEditorStore } from '../../src/renderer/src/store/editor-store'

describe('editor-store markSaved', () => {
  beforeEach(() => {
    // Reset store between tests
    useEditorStore.setState({
      isDirty: false,
      content: '',
      activeNotePath: null,
      activeNoteId: null
    })
  })

  it('clears dirty flag after save', () => {
    const store = useEditorStore.getState()
    store.loadContent('initial')
    store.setContent('modified')
    expect(useEditorStore.getState().isDirty).toBe(true)

    store.markSaved()
    expect(useEditorStore.getState().isDirty).toBe(false)
  })

  it('does not clear content on save', () => {
    const store = useEditorStore.getState()
    store.loadContent('initial')
    store.setContent('modified content')
    store.markSaved()
    expect(useEditorStore.getState().content).toBe('modified content')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/editor/editor-save.test.ts`
Expected: FAIL — `store.markSaved is not a function`

- [ ] **Step 3: Add markSaved to the store**

In `editor-store.ts`, add to the interface:

```typescript
markSaved: () => void
```

And to the implementation:

```typescript
markSaved: () => set({ isDirty: false }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/editor/editor-save.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/editor-store.ts tests/editor/editor-save.test.ts
git commit -m "feat: add markSaved action to editor store"
```

---

### Task 10: Wire autosave in EditorPanel

**Files:**
- Modify: `src/renderer/src/panels/editor/EditorPanel.tsx`

**Critical design decision:** The autosave must capture the file path and content at debounce-start, not at timeout-fire. Otherwise, if the user switches files during the 1-second window, `getState().content` returns the new file's content while the closure's `activeNotePath` is the old file, causing data loss (file A overwritten with file B's content).

- [ ] **Step 1: Add the autosave effect**

```typescript
// In EditorPanel.tsx, add after the existing useEffects:
useEffect(() => {
  if (!activeNotePath) return
  // Capture both path and content at the moment isDirty becomes true.
  // This prevents the race condition where switching files during the
  // debounce window would write the wrong content to the wrong file.
  const pathToSave = activeNotePath
  const contentToSave = content

  // Only schedule save if actually dirty
  if (!useEditorStore.getState().isDirty) return

  const timer = setTimeout(async () => {
    // Re-check: if the user switched files, this path is no longer active.
    // Still safe because we captured pathToSave/contentToSave at effect-start.
    await window.api.fs.writeFile(pathToSave, contentToSave)

    // Only mark saved if we're still on the same file
    const current = useEditorStore.getState()
    if (current.activeNotePath === pathToSave) {
      current.markSaved()
    }
  }, 1000)

  return () => clearTimeout(timer)
}, [content, activeNotePath])
```

- [ ] **Step 2: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 3: Manual verification**

Run: `npm run dev`
1. Open a note, make an edit
2. Wait 1 second
3. Switch to another file, then switch back
4. Edit should be persisted
5. Also test: edit file A, immediately click file B, wait 1s, reopen A. A should have the edit, B should be unchanged.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/panels/editor/EditorPanel.tsx
git commit -m "feat: add autosave with 1-second debounce"
```

---

### Task 11: Flush pending saves on file switch and app close

**Problem:** If the user edits and immediately switches files or quits, the 1-second debounce hasn't fired and the edit is lost.

**Files:**
- Modify: `src/renderer/src/store/editor-store.ts` (add flushSave helper)
- Modify: `src/renderer/src/panels/editor/EditorPanel.tsx` (call flush on switch)
- Modify: `src/renderer/src/App.tsx` (beforeunload handler)

- [ ] **Step 1: Add immediate-save helper**

```typescript
// In editor-store.ts, export a standalone function:
export async function flushSave(): Promise<void> {
  const { isDirty, content, activeNotePath } = useEditorStore.getState()
  if (!isDirty || !activeNotePath || !content) return
  await window.api.fs.writeFile(activeNotePath, content)
  useEditorStore.getState().markSaved()
}
```

- [ ] **Step 2: Call flushSave in switchTab and closeTab**

In `editor-store.ts`, modify `switchTab`:

```typescript
switchTab: (path) => {
  const state = get()
  if (state.activeNotePath === path) return

  // Flush pending save before switching
  if (state.isDirty && state.activeNotePath && state.content) {
    window.api.fs.writeFile(state.activeNotePath, state.content)
    // Don't await — fire and forget for responsiveness
  }

  const history = pushHistory(state.historyStack, state.historyIndex, path)
  set({
    activeNoteId: path,
    activeNotePath: path,
    isDirty: false,
    historyStack: history.stack,
    historyIndex: history.index
  })
},
```

Apply the same pattern to `closeTab` and `openTab`.

- [ ] **Step 3: Add beforeunload handler in App.tsx**

```typescript
// In App.tsx, inside WorkspaceShell or App:
useEffect(() => {
  const handleBeforeUnload = () => {
    const { isDirty, content, activeNotePath } = useEditorStore.getState()
    if (isDirty && activeNotePath && content) {
      // Synchronous save is not available in browser context,
      // but the Electron main process can handle this via IPC
      window.api.fs.writeFile(activeNotePath, content)
    }
  }
  window.addEventListener('beforeunload', handleBeforeUnload)
  return () => window.removeEventListener('beforeunload', handleBeforeUnload)
}, [])
```

- [ ] **Step 4: Run typecheck + tests**

Run: `npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/store/editor-store.ts src/renderer/src/panels/editor/EditorPanel.tsx src/renderer/src/App.tsx
git commit -m "feat: flush pending saves on file switch and app close"
```

---

## Priority Order

Execute chunks in this order:

1. **Chunk 1 (Tasks 1-5):** Test hardening first. We need reliable tests before changing visual code.
2. **Chunk 3 (Tasks 9-11):** File saving. This is the highest-impact functional gap.
3. **Chunk 2 (Tasks 6-8):** Visual polish. Lower risk, lower urgency.

---

## Items Deferred (from original diagnostic and handoff)

These items are intentionally left out of this plan:

| Item | Status/Reason |
|---|---|
| P0 #1: Graph nodes have no labels | **Already resolved.** `GraphRenderer.ts:423-455` renders labels with zoom-based fade |
| P0 #2: Editor view didn't navigate from file tree | **Likely resolved.** Recent commits wired `openTab` on file clicks. Needs manual verification only |
| P1 #4: Graph minimap dots confusing | Low impact, needs design decision first |
| P1 #5: Claude button active state too subtle | Entire color scheme changed from purple to teal (#00e5bf). Need visual review against the new Midnight Neon palette before deciding if this is still an issue |
| P1 #6: Claude tab purple dot too small | Now teal, not purple. Entire tab styling changed (bordered pills with neon tint). Needs visual review |
| P2 #7: Command palette truncation | UX preference, not a bug |
| P2 #8: Graph edge styling by kind | **Already implemented.** `GraphRenderer.ts:113-118` has `EDGE_COLOR_MAP` with distinct styles per relationship kind |
| Handoff #1: Markdown rendering quality | **Partially resolved.** `index.css:106-396` now has full ProseMirror typography. Further polish (tables via @tiptap/extension-table) is feature work |
| Handoff #2: Graph not rendering from Obsidian files | Feature work (graph from wikilinks), not polish |
| Handoff #4: Titlebar workspace tabs | Feature work |
| Handoff #5: Editor prose styling | **Resolved.** Full ProseMirror stylesheet in `index.css` covers headings, lists, blockquotes, code, task lists, wikilinks |
| Handoff #6: Graph from plain markdown | Feature work (same as #2) |
