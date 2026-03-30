# Canvas Terminal Handoff

Date: 2026-03-30

## Context

This handoff covers the canvas terminal parity pass comparing:

- Thought Engine: `/Users/caseytalbot/Projects/thought-engine`
- Production reference: `/Users/caseytalbot/Desktop/collab-public-0.6.0/collab-electron`

The goal was to identify why the Thought Engine canvas terminal was visibly
buggy versus production, fix the highest-confidence wiring regressions first,
and leave a concrete path for finishing the remaining parity gaps.

## Session Commits

- `24215b4` fix canvas terminal session lifecycle
- `ffe56f4` forward first click into canvas terminal

## Closed Gaps

| Gap | Commit(s) | Status |
|-----|-----------|--------|
| Webview reload after `session-created` | `24215b4` | Done |
| WebGL renderer missing in canvas terminal guest | `24215b4` | Done |
| Refit after font load in terminal guest | `24215b4` | Done |
| First unfocused click not reaching xterm guest | `ffe56f4` | Done |
| Test coverage for first-click activation | `ffe56f4` | Done |

## What Changed

### Thought Engine

- `src/renderer/src/panels/canvas/TerminalCard.tsx`
  - Split persisted session state from launch-time webview URL state.
  - Prevented the terminal webview from navigating again after
    `session-created`.
  - Added mouse event forwarding into the guest webview on first content click.
- `src/renderer/terminal-webview/TerminalApp.tsx`
  - Added `WebglAddon` with graceful fallback.
  - Added an extra fit pass after `document.fonts?.ready`.
- `src/renderer/src/panels/canvas/CardShell.tsx`
  - Added a terminal-only activation callback for initial unfocused content
    clicks.
- Tests added/expanded:
  - `src/renderer/src/panels/canvas/__tests__/CardShell.test.tsx`
  - `src/renderer/src/panels/canvas/__tests__/TerminalCard.test.tsx`
  - `src/renderer/terminal-webview/__tests__/terminal-app.test.ts`

### Production Reference Points

- `packages/components/src/Terminal/TerminalTab.tsx`
- `src/windows/terminal-tile/src/App.tsx`
- `src/windows/shell/src/tile-manager.js`
- `src/main/pty.ts`

## Comparison Summary

### Things now aligned enough to stop the obvious bug

- Both apps now use WebGL in the embedded terminal path when available.
- Both apps coalesce rapid PTY writes.
- Both apps now deliver the first click into the embedded terminal guest.
- Thought Engine no longer tears down and reloads the canvas terminal guest
  after session creation.

### Still different

- Thought Engine uses `@xterm/xterm` `^5.5.0`; production uses `^6.0.0`.
- Thought Engine does not use `@xterm/addon-unicode11`; production does.
- Thought Engine ships `@xterm/addon-canvas` in `package.json` but does not use
  it anywhere.
- Thought Engine relies on system `tmux`; production bundles tmux, terminfo,
  and related resources.
- Thought Engine does not have production's raw-key path for modified Enter
  handling (`Shift+Enter` CSI-u injection).
- Thought Engine reconnect returns empty scrollback by design; production
  capture/replays scrollback on restore.

## Remaining Gaps / Next Work

### 1. Upgrade xterm dependency parity

Target files:

- `package.json`
- `src/renderer/terminal-webview/TerminalApp.tsx`
- `src/renderer/src/panels/terminal/TerminalPanel.tsx`
- terminal-related tests under `src/renderer/terminal-webview/__tests__`

Tasks:

- Upgrade `@xterm/xterm` from `^5.5.0` to `^6.x`.
- Add `@xterm/addon-unicode11`.
- Verify `WebglAddon`, `SearchAddon`, `FitAddon`, `WebLinksAddon` API
  compatibility after the upgrade.
- Remove `@xterm/addon-canvas` if it remains unused.

Why this matters:

- Production is already on xterm 6 and Unicode11.
- The current dependency split is a likely source of rendering and glyph
  behavior drift.

### 2. Add Unicode11 activation

Target files:

- `src/renderer/terminal-webview/TerminalApp.tsx`
- `src/renderer/src/panels/terminal/TerminalPanel.tsx`

Tasks:

- Mirror production:
  - load `new Unicode11Addon()`
  - set `term.unicode.activeVersion = '11'`
- Verify box-drawing, emoji width, and prompt glyph behavior manually.

Why this matters:

- Production explicitly enables Unicode11.
- This is a likely contributor to cursor alignment and glyph width mismatch.

### 3. Add raw-key path for `Shift+Enter`

Target files:

- `src/shared/ipc-channels.ts`
- `src/preload/index.ts`
- `src/preload/terminal-webview.ts`
- `src/main/ipc/shell.ts`
- `src/main/services/shell-service.ts`
- `src/main/services/tmux-service.ts`
- `src/renderer/terminal-webview/TerminalApp.tsx`

Tasks:

- Introduce a `terminal:send-raw-keys` IPC path.
- In tmux mode, mirror production's `send-keys -l` behavior.
- In ephemeral mode, decide whether to:
  - write directly to the PTY, or
  - treat this as tmux-only parity for now.
- Update the embedded terminal key handler so `Shift+Enter` sends CSI-u instead
  of plain `\r`.

Why this matters:

- Production supports modified Enter semantics for TUI apps like Claude Code.
- Thought Engine currently sends regular terminal input only.

### 4. Bundle tmux for packaged builds

Target files:

- `package.json`
- `src/main/services/tmux-paths.ts`
- `resources/` and/or bundled vendor directory

Tasks:

- Add tmux resources to Electron Builder `extraResources`, mirroring the
  production app's packaging approach.
- Update `tmux-paths.ts` so `tmuxExec()` and `verifyTmuxAvailable()` can resolve
  bundled tmux in packaged builds instead of hardcoding `execFileSync('tmux', ...)`.
- Handle `TERMINFO` and related runtime env as needed.

Why this matters:

- Thought Engine currently works on this machine because system `tmux 3.6a` is
  installed.
- Packaged-app persistence will be unreliable on hosts without tmux.

### 5. Re-evaluate restore scrollback behavior

Target files:

- `src/main/services/tmux-service.ts`
- `src/renderer/terminal-webview/TerminalApp.tsx`

Tasks:

- Revisit the current choice to return empty scrollback on reconnect.
- Test whether xterm 6 plus Unicode11 reduces the garbled redraw issue noted in
  `tmux-service.ts`.
- If not, keep the current behavior and document it as an intentional deviation
  from production.

Why this matters:

- Production restores scrollback; Thought Engine intentionally does not.
- This may remain a tradeoff, but it should be revalidated after the renderer
  upgrade work.

## Verification Already Run

```bash
npx vitest run src/renderer/src/panels/canvas/__tests__/CardShell.test.tsx \
  src/renderer/src/panels/canvas/__tests__/TerminalCard.test.tsx \
  src/renderer/terminal-webview/__tests__/terminal-app.test.ts \
  src/renderer/terminal-webview/__tests__/webview-shell.test.ts

npm run typecheck
npm run build
```

All passed after commit `ffe56f4`.

## Suggested Next Prompt

```text
Continue in /Users/caseytalbot/Projects/thought-engine. Read CANVAS_TERMINAL_HANDOFF.md.
Finish the remaining canvas terminal parity gaps in this order:
1. xterm 6 upgrade + Unicode11
2. Shift+Enter raw-key path
3. bundled tmux support for packaged builds
4. re-evaluate reconnect scrollback restore
```
