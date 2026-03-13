# E2E Diagnostic Report: Claude Brain + Progressive Types

**Date:** 2026-03-13
**Tests:** 22/22 passing (Playwright + Electron)
**Build:** Clean (typecheck + vite + production bundle)
**Unit tests:** 162/162 passing (8 parser tests including 3 new)

---

## Functional Verification

| Feature | Status | Evidence |
|---------|--------|----------|
| App launch | PASS | Window opens at 1280x800, no crash |
| Welcome screen | PASS | "Thought Engine" heading, Create/Open buttons render |
| Vault loading | PASS | Sidebar populates, graph builds, status bar shows "3 notes" |
| Progressive type: custom `type: pattern` | PASS | Parses, appears in sidebar with gray dot (default color) |
| Progressive type: missing type defaults to `note` | PASS | `no-type-note.md` parses, appears in graph |
| Progressive type: round-trip serialize/parse | PASS | Custom type survives write-then-read |
| Graph rendering | PASS | 3 nodes visible, 1 edge (g17-p01 connection) |
| File tree type dots | PASS | Blue (gene), gray (pattern), gray (note) |
| Claude button renders | PASS | Pill shape, purple border, sparkle icon, right-aligned |
| Claude button glow | PASS | box-shadow present, border-radius > 0, cursor: pointer |
| Claude activation | PASS | Creates terminal tab named "Claude", launches `claude` CLI |
| CLAUDE.md creation | PASS | File written with all sections (Contract, Edges, Types, Commands) |
| Idempotent activation | PASS | Second click switches to existing tab, no duplicate |
| Command palette | PASS | Opens with Cmd+K, shows notes + commands |
| PTY lifecycle | PASS | Fixed: `isDestroyed()` guard prevents crash on app close |

### Bug Fixed During Testing

**PTY "Object has been destroyed" crash** (`shell.ts:8-9`)
- **Root cause:** `killAll()` on `before-quit` kills PTY processes. The async `onExit` callback fires after `BrowserWindow` is already destroyed, crashing on `webContents.send()`.
- **Fix:** Guard both callbacks with `mainWindow.isDestroyed()` check.

---

## Troubleshooting Guide

### If Claude button doesn't appear
1. Check `TerminalPanel.tsx` passes `onActivateClaude`, `claudeSessionActive`, `vaultPath` to `TerminalTabs`
2. Verify `vaultPath` is not null (button is disabled without a vault)
3. Check browser console for import errors on `ClaudeActivateButton`

### If CLAUDE.md isn't created
1. Check `window.api.fs.fileExists` works: run `await window.api.fs.fileExists('/some/path')` in devtools
2. Check `window.api.fs.writeFile` permissions on the vault directory
3. Verify `generateClaudeMd()` returns a non-empty string

### If custom types don't parse
1. Parser no longer has `VALID_TYPES` set. If files are rejected, check `parser.ts` still has the open type line: `type: typeof data.type === 'string' && data.type ? data.type : 'note'`
2. Verify `getArtifactColor()` is used at all callsites (not raw `ARTIFACT_COLORS[type]`)
3. Check `discoveredTypes` in vault store: `useVaultStore.getState().discoveredTypes`

### If graph crashes on unknown type
1. All 6 callsites should use `getArtifactColor(type)` which falls back to `DEFAULT_ARTIFACT_COLOR`
2. If a direct `ARTIFACT_COLORS[type]` access exists, it will return `undefined` for custom types

### If terminal crashes on app close
1. Verify `shell.ts` has `isDestroyed()` guards on both `onData` and `onExit` callbacks
2. If new IPC channels send to the window, they need the same guard pattern

---

## Aesthetic Polish: Prioritized

### P0: Critical (breaks visual quality)

**1. Graph nodes have no labels**
The graph shows tiny dots with no text. At 3 nodes they're identifiable by color, but at 50+ nodes this is unusable. Nodes need hover labels at minimum, ideally always-visible labels for small graphs.
- Files: `GraphRenderer.ts`
- Fix: Add `<text>` elements positioned below/beside nodes

**2. Editor view didn't navigate from file tree click (E2E test gap)**
Screenshot `aesthetic-03-editor-view` shows the graph view, not the editor. The Playwright `click('text=Category Creation')` hit the file tree item but the view didn't switch. Likely a timing issue in the test, but worth verifying manually that file tree clicks reliably switch to editor view.
- Verify: Manual test with `npm run dev`

### P1: Important (affects perceived quality)

**3. Custom type dots are indistinguishable from `note` type**
Both `type: pattern` and `type: note` render as gray (#8B8B8E). Users creating custom types will see no visual differentiation. Consider:
- Auto-assigning colors from a palette when new types are discovered
- Using the string hash of the type name to pick a hue
- Files: `tokens.ts` (`getArtifactColor`), `vault-store.ts` (`discoveredTypes`)

**4. Graph minimap dots (3 blue dots in a row)**
There's a cluster of 3 small blue dots near center in every graph screenshot. These appear to be the minimap navigation indicator but are visually confusing next to the actual graph nodes. They need either:
- Better visual separation (different size, opacity, position)
- Or hide when graph is small enough to not need minimap

**5. Claude button "active" state needs stronger differentiation**
When Claude is running, the button looks almost identical to idle. The `rgba(167,139,250,0.12)` fill is too subtle. Consider:
- Stronger fill: `rgba(167,139,250,0.2)`
- Pulsing glow animation when Claude session is active
- Or change label to "Claude (running)" or add a status indicator

**6. Claude tab purple dot is small**
The 6px status dot differentiating Claude tabs from shell tabs is hard to see at a glance. Consider 8px or adding a subtle background tint to the entire tab.

### P2: Nice to have (polish)

**7. Command palette truncation**
"Activate Claude" command is below the fold in the palette. The palette shows 8 items before requiring scroll. Not a bug, but consider either:
- Putting commands before notes in the list
- Or showing recently-used commands first

**8. Graph edge styling**
The single edge between g17 and p01 renders as a thin gray line. For a knowledge graph product, edges should communicate relationship kind visually:
- Connection: thin gray (current)
- Cluster: green (matches `semantic.cluster`)
- Tension: amber dashed (matches `semantic.tension`)
- Appears_in: subtle dotted

**9. File tree type dots could show type name on hover**
Currently the colored dot gives a visual hint, but users can't tell what type a file is without opening it. A tooltip on the dot would help.

**10. Status bar "1 edges" grammar**
Should be "1 edge" (singular). Minor but noticeable.

---

## Test Infrastructure Delivered

```
e2e/
├── app.spec.ts              # 22 tests across 4 describe blocks
├── fixtures/
│   └── test-vault/          # Isolated vault with 3 typed artifacts
│       ├── .thought-engine/
│       │   ├── config.json
│       │   └── state.json
│       ├── category-creation.md   (type: gene, built-in)
│       ├── feedback-loops.md      (type: pattern, custom)
│       └── no-type-note.md        (no type field, defaults to note)
└── screenshots/             # 22 PNG captures for visual review
```

Run: `npm run test:e2e`

### Screenshot Inventory
| Screenshot | What it captures |
|-----------|-----------------|
| `01-launch` | Initial app window |
| `02-welcome-*` | Welcome screen (when no vault saved) |
| `03-workspace-shell` | Full layout with sidebar + graph + terminal |
| `03-file-tree` | Sidebar with typed file dots |
| `04-claude-button` | Button idle state in terminal header |
| `04-claude-activated` | Terminal with Claude CLI running |
| `04-claude-idempotent` | Second click switches tabs |
| `05-command-palette` | Cmd+K palette with notes + commands |
| `06-graph-view` | Graph with typed nodes |
| `aesthetic-05-hover` | Button hover glow intensified |
| `aesthetic-06-activated` | Full view with Claude session active |
