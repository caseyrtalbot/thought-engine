# Terminal Dock: Canvas-wide Terminal Status Bar

## Purpose

The canvas is infinite. Terminals can be off-screen while running builds, hitting errors, or finishing tasks. The Terminal Dock is a persistent bottom-bar that surfaces the status of every terminal on the canvas with one-click navigation to any terminal that needs attention.

## Requirements

- Show every terminal card on the canvas (shell and Claude) with real-time process state
- Status signals: idle shell, running process (busy), errored exit, dead session
- Click any terminal pill to pan+zoom the canvas to center on that card
- Collapsible to a compact pill that still shows status dots (errors remain visible)
- No overlap with existing UI: minimap (bottom-right), toolbar (top-right), sidebar (left)
- Wire all styling through design tokens, no standalone values
- Zero new IPC channels, zero new stores

## Status Model

Each terminal derives a status from existing signals:

| Status | Condition | Dot Color | Source |
|--------|-----------|-----------|--------|
| `idle` | `pane_current_command` matches user shell (`zsh`, `bash`, `fish`) | `colors.semantic.cluster` (`#3dca8d`) | `terminal:process-name` IPC |
| `busy` | `pane_current_command` is anything else | `#60a5fa` | `terminal:process-name` IPC |
| `error` | `terminal:exit` fired with non-zero exit code | `#ef4444` | `terminal:exit` event |
| `dead` | `terminal:exit` fired with exit code 0 (clean exit) | `colors.text.muted` (CSS var) | `terminal:exit` event |
| `claude` | `node.metadata.initialCommand === 'claude'` and process running | `#00e5bf` | metadata + IPC |

Status constants match existing precedent: `STATUS_DOT_SHELL` in TerminalTabs.tsx uses `colors.semantic.cluster`, `STATUS_DOT_AGENT` uses `#00e5bf`.

### Polling

A 3-second interval calls `window.api.terminal.getProcessName(sessionId)` for each terminal with an active session. Lightweight: one tmux `display-message` query per terminal.

Exit events are listened to passively via `window.api.on.terminalExit`. When a terminal exits, polling stops for that session.

### Shell Detection

Idle detection compares the process name against a known set: `zsh`, `bash`, `fish`, `sh`, `dash`. Anything else is `busy`. Claude terminals are identified by `node.metadata.initialCommand === 'claude'` and get the `claude` status when busy.

## Architecture

### New Files

| File | Purpose |
|------|---------|
| `src/renderer/src/panels/canvas/TerminalDock.tsx` | Dock component (expanded + collapsed states) |
| `src/renderer/src/panels/canvas/useTerminalStatus.ts` | Hook: polls process names, listens for exits, returns status array |

### No New Stores

The hook derives everything from:
- `canvas-store` nodes filtered to `type === 'terminal'` (terminal card list)
- `window.api.terminal.getProcessName()` IPC calls (process state)
- `window.api.on.terminalExit()` event listener (exit state)

Status is local React state inside the hook, not global Zustand state.

### Component Tree

```
CanvasView
  +-- CanvasSurface (cards, edges)
  +-- CanvasToolbar (top-right)
  +-- CanvasMinimap (bottom-right)
  +-- ZoomIndicator
  +-- TerminalDock (bottom-left)  <-- NEW
        +-- collapse/expand toggle
        +-- TerminalPill[] (one per terminal node)
```

### Integration Point

`TerminalDock` is rendered inside `CanvasView.tsx` as a sibling to the existing floating UI elements. It receives no props; it reads from `canvas-store` directly via `useCanvasStore` selectors.

### useTerminalStatus Hook

```typescript
interface TerminalStatus {
  readonly nodeId: string
  readonly sessionId: string
  readonly label: string        // abbreviated CWD or "Claude Live"
  readonly status: 'idle' | 'busy' | 'error' | 'dead' | 'claude'
  readonly processName: string  // e.g. "npm", "zsh", "claude"
}

function useTerminalStatus(): readonly TerminalStatus[]
```

**Lifecycle:**
1. Subscribe to `canvas-store` for terminal nodes (`node.type === 'terminal'`)
2. Set up 3-second polling interval calling `getProcessName` per active session
3. Listen for `terminal:exit` events, mark sessions as `error` (non-zero code) or `dead`
4. Return sorted array: error terminals first, then busy, then claude, then idle, then dead
5. Cleanup: clear interval and unsubscribe on unmount

**Stale session handling:** If `getProcessName` rejects (session no longer exists in tmux), mark as `dead`.

### Navigation

Clicking a pill calls `useCanvasStore.getState().setViewport()` to center on the target terminal card. The viewport is computed to place the card at screen center at zoom 0.8 (readable terminal size), using the same math as `computeImportViewport` but for a single node.

## Visual Design

All values reference `tokens.ts` exports. No hardcoded colors, fonts, or spacing.

### Expanded Dock (36px bar)

| Property | Token |
|----------|-------|
| Height | `spacing.unit * 9` (36px) |
| Background | `floatingPanel.glass.bg` |
| Backdrop filter | `floatingPanel.glass.blur` |
| Border top | `colors.border.subtle` |
| Shadow | `floatingPanel.shadowCompact` |
| Border radius | `borderRadius.container` (6) top corners only |
| Position | Absolute, bottom-left, width extends to ~100px before minimap |

### Terminal Pill

| Property | Token |
|----------|-------|
| Background | `floatingPanel.glass.inputBg` |
| Hover background | `floatingPanel.glass.inputBgFocus` |
| Border | `colors.border.subtle` |
| Border radius | `borderRadius.inline` (4) |
| Transition | `transitions.hover` |
| Path font | `typography.fontFamily.mono`, 11px, `colors.text.secondary` |
| Process font | `typography.fontFamily.mono`, 10px, `colors.text.muted` |
| Cursor | `pointer` |

### Status Dot

| Property | Value |
|----------|-------|
| Size | 6px circle, `borderRadius.round` |
| Active glow | `boxShadow: 0 0 6px ${statusColor}` (same as AgentSessionCard) |
| Pulse animation | Reuse `te-active-dot` CSS keyframe for busy/claude |
| Error animation | 1s ease-in-out infinite opacity + glow pulse |

### Error Pill Accent

Error terminals get a tinted background: `rgba(239, 68, 68, 0.06)`. This matches the callout-block pattern of tinting backgrounds at ~6-8% opacity of the semantic color.

### Attention Escalation

Error terminals sort to the front (leftmost) of the pill list. In collapsed state, the pill gets a subtle border glow: `boxShadow: 0 0 8px rgba(239, 68, 68, 0.15)`.

### Collapsed Pill (28px)

| Property | Token |
|----------|-------|
| Height | `spacing.unit * 7` (28px) |
| Background | `floatingPanel.glass.bg` |
| Backdrop filter | `floatingPanel.glass.blur` |
| Border | `colors.border.subtle` |
| Border radius | `floatingPanel.borderRadius` (12) |
| Margin from edges | `spacing.unit * 3` (12px) |
| Label font | `typography.fontFamily.body`, 11px, `colors.text.muted` |
| Section label | `floatingPanel.glass.sectionLabel` (10px, uppercase, 0.15em spacing) |

Contents: chevron-up icon, row of status dots (preserving color + animation), count label (e.g. "4 terminals").

### Collapse/Expand Toggle

- Expanded: small chevron-down button at leading edge of bar
- Collapsed: click anywhere on pill to expand
- State persisted in `localStorage` key `te-terminal-dock-collapsed`

### Animations

| Animation | Source |
|-----------|--------|
| Dock appear | `te-card-enter` keyframe (existing: scale 0.985 + translateY 12px, 220ms) |
| Viewport navigate | `animations.spatialTransition` (250ms ease-out) |
| Dot pulse (busy/claude) | `te-active-dot` (existing CSS) |
| Error dot pulse | Custom: 1s ease-in-out infinite, opacity 1 to 0.7, glow 6px to 2px |

### Visibility

The dock only renders when at least one terminal node exists on the canvas. Zero terminals = no dock. The dock appears with `te-card-enter` when the first terminal is added.

## Layout: No Overlap

```
+----------------------------------------------------------+
|                                          [Toolbar]        |
|                                                           |
|              Canvas Content                               |
|                                                           |
|                                                           |
| [Dock: pill pill pill pill]              [Minimap]        |
+----------------------------------------------------------+
```

The dock is positioned `bottom: 0; left: 0` with `right` constrained to leave clearance for the minimap (160px width + 8px margin + 16px gap = 184px from right edge). This is a fixed right-margin, not dynamic.

## Testing

- **Unit tests** for `useTerminalStatus`: mock `getProcessName` IPC, verify status derivation and sort order
- **Unit tests** for status color mapping and shell detection logic
- **Component test** for `TerminalDock`: verify expanded/collapsed render, pill count matches terminal nodes
- No E2E tests (manual verification via `npm run dev`)

## Out of Scope

- Terminal output preview in the dock (just status, not content)
- Drag-reorder of terminal pills
- Dock in non-canvas views (editor, graph, workbench)
- Custom status colors or user-configurable poll interval
