# Thought Engine UI Redesign: Design Specification

**Date**: 2026-03-12
**Status**: V2 (incorporates architecture review)
**Project**: `/Users/caseytalbot/Projects/thought-engine/`

## Product Vision

Thought Engine is a visual IDE for structured thinking where the "compiler" is an LLM agent and the "code" is interconnected markdown documents. Three co-equal surfaces drive the core interaction loop:

- **Graph** (center): The knowledge navigator. Shows topology, clustering, and gaps so the user can direct the agent's next move. Primary navigation paradigm. The graph is alive: nodes appear in real-time as the agent writes files.
- **Terminal** (right): The agent interaction surface. Claude Code running inside the app. Not a convenience panel, but the core of the workflow.
- **File tree** (left): The agent's output. Structured markdown artifacts organized in a hierarchical vault on the local filesystem.

**The loop**: Orient (graph) > Inspect (editor) > Direct (terminal/agent) > Observe (new nodes appear) > Reorient (graph).

Relationships between ideas are the primary object. Documents are substrate that generates the graph.

**Offline guarantee**: The graph, editor, and file tree are zero-dependency on network. All data is local filesystem. If the Claude API is unreachable, the terminal surfaces connection state but the rest of the app remains fully functional.

## Approach

**Hybrid: Foundation Then Function.** Four phases, each a complete horizontal slice that leaves the app in a working, improved state.

| Phase | Name | Focus |
|-------|------|-------|
| 1 | Foundation | Custom titlebar, layout skeleton, session persistence, error boundaries |
| 2 | Function | Filesystem tree, graph controls, terminal tabs, settings, command palette |
| 3 | Interaction | Neon highlights, physics sliders, real-time graph, Graph/Skills toggle, graph minimap |
| 4 | Polish | Theme coherence, transitions, typography, editor toolbar, backlinks, status bar |

## Cross-Cutting Concerns

### Persistence Strategy

**No localStorage.** All Zustand stores that persist use `electron-store` (main process) or a JSON file in the vault's `.thought-engine/` directory, accessed via IPC. This survives cache clears, is portable with the vault (critical for users who sync across machines), and doesn't break on multi-window if we ever go there.

- **App-level settings** (appearance, editor, terminal preferences): `~/.thought-engine/settings.json` via electron-store
- **Vault-level settings** (graph force values, filter toggles, collapse state): `<vault>/.thought-engine/config.json` via IPC
- **Session state** (workspace.json): `<vault>/.thought-engine/workspace.json` via IPC (see Session Persistence below)

New IPC handlers: `config:read`, `config:write`, `config:watch` (generic key-value, scoped to app or vault). Zustand persist middleware replaced with a custom storage adapter that calls these IPC handlers.

### Session Persistence

On crash or quit, the app must restore to previous state. Phase 1 implements a workspace state file (`<vault>/.thought-engine/workspace.json`) that captures:

- Panel sizes (sidebar width, terminal width)
- Content view state (graph/editor/skills + which file was open)
- Graph viewport (zoom level, pan position via D3 transform)
- Terminal session IDs and scroll positions
- File tree collapse state
- Selected/hovered node ID

**Save strategy**: debounced write on state change (500ms debounce). On app launch, read workspace.json and hydrate all stores before first render. On missing/corrupt file, fall back to defaults (no crash).

### Error Boundaries

Each panel gets its own React error boundary with a graceful fallback. A Canvas2D crash in the graph should not white-screen the entire app.

- `PanelErrorBoundary` wrapper component: catches render errors, shows "Something went wrong" with a retry button and error details expandable
- Wrapped around: Sidebar, ContentArea (graph/editor/skills), TerminalPanel
- Titlebar and StatusBar are simple enough to not need boundaries
- Errors logged to `<vault>/.thought-engine/error.log` for debugging

### File Size Constraint

Single responsibility per file, not an arbitrary line count. If a file does one thing well and is easy to understand, it can be as long as it needs to be. GraphRenderer.ts with glow, dimming, edge brightening, labels, hover state, and selection rings will naturally be large. That's fine as long as its single responsibility (rendering the graph to canvas) is clear and it doesn't take on unrelated concerns.

### Destructive Action Safety

No app-level undo/redo system in V1, but all destructive operations (file delete, folder delete) require confirmation dialogs. File rename is inline and reversible (Escape cancels). Graph node delete is really file delete, so it goes through the same confirmation path.

Future consideration: command pattern for app-level undo.

## Phase 1: Foundation

### Custom Titlebar

Replace the OS-native window chrome with a custom titlebar component.

**Electron main process changes** (`src/main/index.ts`):
- `titleBarStyle: 'hidden'` on BrowserWindow config
- `trafficLightPosition: { x: 12, y: 12 }` for macOS traffic light inset
- `titleBarOverlay` config for Windows compatibility
- New IPC handlers: `window:minimize`, `window:maximize`, `window:close` (called via existing `window.electron.ipcRenderer.invoke` pattern, no new preload file needed)
- New IPC handlers for persistence: `config:read`, `config:write` (reads/writes JSON files)

**New component: `Titlebar.tsx`**
- Height: 38px
- macOS traffic lights occupy the left ~70px (OS-rendered, not custom)
- `-webkit-app-region: drag` on the entire titlebar for window movement
- Vault tab: single tab showing current vault name with accent dot, close button (non-functional in V1, visual only)
- Settings gear icon at far right, opens SettingsModal
- All clickable elements inside the drag region get `-webkit-app-region: no-drag`

### Layout Structure

```
App (h-screen w-screen, flex column)
├── Titlebar (38px, flex-shrink-0)
├── PanelErrorBoundary
│   └── SplitPane (flex-1, overflow-hidden)
│       ├── PanelErrorBoundary > Sidebar (240px default, resizable)
│       ├── PanelErrorBoundary > ContentArea (flex-1)
│       │   ├── GraphControls (overlay toggle)
│       │   └── GraphPanel | EditorPanel | SkillsPlaceholder
│       └── PanelErrorBoundary > TerminalPanel (320px default, resizable)
├── StatusBar (24px, flex-shrink-0)
└── CommandPalette (overlay)
    SettingsModal (overlay)
```

The existing `SplitPane` component handles resizable dividers. The viewport is now: titlebar (38px) + panels (flex) + status bar (24px).

**What stays the same**: all panel internals, all four Zustand stores (internal logic unchanged, persistence adapter swapped), all IPC handlers, existing tests.

### Files

| Action | File |
|--------|------|
| Create | `src/renderer/src/components/Titlebar.tsx` |
| Create | `src/renderer/src/components/SettingsModal.tsx` (stub) |
| Create | `src/renderer/src/components/PanelErrorBoundary.tsx` |
| Create | `src/renderer/src/lib/config-storage.ts` (IPC-backed Zustand storage adapter) |
| Create | `src/main/ipc/config.ts` (config:read, config:write handlers) |
| Modify | `src/main/index.ts` (BrowserWindow config, register config IPC, workspace restore) |
| Modify | `src/renderer/src/App.tsx` (titlebar, error boundaries, layout, session hydration) |

## Phase 2: Function

### 2A: Sidebar Filesystem Tree

Replace the flat file list with a hierarchical filesystem tree matching the vault's directory structure.

**File tree behavior**:
- Built client-side from flat file paths in `vault-store.files[]` (parse path segments into a tree structure via a `buildFileTree()` utility, no new IPC call needed)
- Collapsible folders with chevron indicators (right-pointing collapsed, down-pointing expanded)
- Item counts next to each folder name
- Vault root name with total file count at the top
- Active file highlighted with `accent.muted` background
- Each file item shows: artifact type color dot, truncated filename, relative timestamp
- Artifact type dot color derived from frontmatter `type` field or filename prefix

**Action bar** (top of sidebar, below search):
- New file button (triggers IPC to create on disk, watcher picks up change)
- New folder button
- Inline rename: click filename, it becomes an input field. Enter confirms, Escape cancels.
- Delete with confirmation dialog ("Delete budget.md? This cannot be undone.")
- Sort dropdown: Modified (default), Name, Type

**Search bar**: existing component, no changes in this phase.

**State management**:
- Collapse state: stored in a `useRef<Map<string, boolean>>` to survive re-renders from vault-store updates without triggering unnecessary re-renders itself. Persisted to workspace.json.
- Sort preference: stored in vault-level config
- Tree architecture must not preclude drag-and-drop reordering in a future version. Use a flat data structure with `parentPath` references rather than deeply nested objects, so DnD reorder is a path update, not a tree restructure.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/sidebar/buildFileTree.ts` (flat paths to tree utility) |
| Modify | `src/renderer/src/panels/sidebar/FileTree.tsx` (hierarchy, folders, counts, inline rename, delete) |
| Modify | `src/renderer/src/panels/sidebar/Sidebar.tsx` (action bar, sort dropdown) |

### 2B: Graph Controls Panel

An Obsidian-style settings overlay for the graph, sliding in from the right edge of the center panel.

**Sections**:

**Filters**:
- Orphans toggle (show/hide disconnected nodes)
- Existing files only toggle (hide broken links)

**Groups** (collapsible):
- Maps to artifact type coloring configuration

**Display**:
- Node size slider (base radius)
- Link opacity slider
- Link thickness slider
- Arrows toggle (directional edges)
- Text fade threshold slider (zoom level at which labels appear)
- Animate button (toggles `simulation.alpha(1).restart()` vs `simulation.stop()`)

**Forces** (all sliders):
- Center force: maps to `d3.forceCenter()`
- Repel force: maps to `d3.forceManyBody().strength()`
- Link force: maps to `d3.forceLink().strength()`
- Link distance: maps to `d3.forceLink().distance()`

**Toggle behavior**: small icon in the top-right corner of the graph area opens/closes the panel. Panel overlays the graph, does not push content. The existing `GraphControls.tsx` pill toggle remains at top-center and is modified in Phase 3C to show Graph/Skills instead of Graph/Editor.

**Persistence**: all values stored in `graph-settings-store.ts` persisted to vault-level config via the IPC storage adapter from Phase 1.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/GraphSettingsPanel.tsx` |
| Create | `src/renderer/src/store/graph-settings-store.ts` |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (consume settings) |

### 2C: Terminal Tabs

Restyle the existing terminal tab bar to match the target design.

**Tab bar**:
- Active tab: elevated background (`bg.elevated`) + colored dot (green for shell, purple for Claude)
- Inactive tabs: muted text, dot still visible
- Close button (x) on each tab, hidden on the last remaining tab (behavioral change from current: close buttons on all tabs with no guard)
- "+" button to create a new session
- Tab naming: read process name from PTY (not string matching on the initial command, which is brittle for aliases like `npx claude` or `claude-code`). Fall back to shell name if PTY info unavailable.
- Manual tab rename: double-click tab name to edit inline

**Scrollback and search**:
- Scrollback buffer: 10,000 lines (configurable in settings). Prevents memory bloat from long agent sessions.
- In-terminal search: `Cmd+F` when terminal is focused opens a search bar within the terminal panel (xterm.js addon: `@xterm/addon-search`)

**Files**:

| Action | File |
|--------|------|
| Modify | `src/renderer/src/panels/terminal/TerminalPanel.tsx` (tab styling, close guard, rename, search) |
| Modify | `src/main/ipc/shell.ts` (expose PTY process name) |

### 2D: Basic Settings Modal

A tabbed modal opened from the titlebar settings gear.

**5 tabs**:

| Tab | Settings |
|-----|----------|
| Appearance | Theme (dark only for now, toggle infrastructure), font size, font family |
| Editor | Default edit mode (rich/source), autosave interval, spell check toggle |
| Graph | Default force/display values (reads/writes same store as GraphSettingsPanel) |
| Terminal | Default shell path, font size, scrollback buffer size |
| Vault | Vault path display, re-index button |

**Behavior**:
- Settings apply immediately on change (no save button)
- Escape key or backdrop click closes modal
- Persisted via IPC storage adapter (app-level settings to electron-store, vault-level to vault config)

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/components/SettingsModal.tsx` (full implementation, replacing Phase 1 stub) |
| Create | `src/renderer/src/store/settings-store.ts` |
| Modify | `src/renderer/src/App.tsx` (wire modal open from titlebar) |

### 2E: Command Palette

Full specification for the `Cmd+K` command palette (already in layout tree but never specified).

**Modes**:
- **Default**: fuzzy search across file names, recent files (top 5, sorted by last opened), and runnable commands
- **File search**: type to fuzzy-match file names. Enter opens in editor. Results show folder path and artifact type dot.
- **Command search**: prefix with `>` to filter to commands only (like VS Code). Commands: toggle graph/editor, toggle sidebar, toggle terminal, new note, open settings, re-index vault, zoom to fit graph.
- **Future**: `/` prefix for slash-commands that pipe to the terminal agent (not implemented in V1, but the prefix routing architecture should support it)

**Behavior**:
- `Cmd+K` opens, `Escape` closes
- Most recent files shown immediately on open (before typing)
- Fuzzy matching with highlighted match characters
- Arrow keys to navigate, Enter to select
- Palette dismisses on selection

**Files**:

| Action | File |
|--------|------|
| Modify | `src/renderer/src/design/components/CommandPalette.tsx` (fuzzy search, recent files, command prefix routing) |
| Modify | `src/renderer/src/App.tsx` (expanded command handler) |

## Phase 3: Interaction

### 3A: Node Selection with Neon Highlight

Three interaction layers on graph nodes:

**Idle state**:
- Nodes are small by default (base radius ~3-5px)
- All nodes have a faint ambient glow: pre-rendered to an offscreen canvas per artifact color (draw circle with shadowBlur once, cache as ImageBitmap). On each frame, `ctx.drawImage(glowSprite, ...)` instead of per-node `shadowBlur`. This scales to hundreds of nodes without GPU thrashing.
- Edges are dim, low opacity
- Constellation aesthetic

**Hover (transient)**:
- Mousing over a node triggers network reveal:
  - Hovered node: real-time `ctx.shadowBlur = 12-16` (only applied to this one node + neighbors, not the full graph)
  - Connected edges brighten to accent color (purple/violet), opacity ~0.7, slightly thicker
  - Connected neighbor nodes brighten with glow at their artifact type color (real-time shadowBlur for neighbors)
  - Non-connected nodes and edges dim to ~0.08-0.15 opacity
  - Labels appear on hovered node and its neighbors
- Mouse-leave: everything returns to idle state
- Transition in: 200ms ease-out. Transition out: 300ms ease-out (slower fade-out feels natural)

**Click (persistent)**:
- Same visual as hover but stays locked until clicking empty canvas or another node
- Useful for inspecting a neighborhood without holding the mouse still

**Right-click context menu** on nodes:
- Open in editor
- Reveal in sidebar (scroll file tree to this file)
- Copy file path
- Delete (with confirmation dialog)

**Double-click**:
- Opens the clicked node's file in the editor panel (transitions `contentView` to `'editor'`)

**Canvas2D implementation** (the graph uses `<canvas>` + `CanvasRenderingContext2D`, not SVG):
- Ambient glow: pre-rendered glow sprites per artifact color (offscreen canvas, cached). `drawImage` per node per frame.
- Hover/selected glow: real-time `ctx.shadowBlur = 12-16` on hovered node and its neighbors only (not the whole graph)
- Dimming: set `ctx.globalAlpha = 0.08` for non-connected nodes/edges, `1.0` for connected
- Edge brightening on hover: draw connected edges with artifact accent color at `globalAlpha = 0.7` and `lineWidth = 1.5`
- Selected node outer ring: draw a second `ctx.arc` at `r + 4` with `strokeStyle = accent` and low alpha
- Labels on hover: `ctx.fillText` for hovered node and connected neighbors
- `useGraphHighlight.ts` hook manages the hover/click/deselect state machine and computes the connected node/edge sets (adjacency list, built once on graph change, O(1) lookup per hover)

**`prefers-reduced-motion` in JS**: check `window.matchMedia('(prefers-reduced-motion: reduce)')`. When set, disable glow transitions, skip node enter/exit animations, and reduce simulation alpha reheating. Nodes still highlight on hover but without animation.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/useGraphHighlight.ts` (hover/click state machine, adjacency list, connected set computation) |
| Create | `src/renderer/src/panels/graph/GraphContextMenu.tsx` (right-click menu) |
| Create | `src/renderer/src/panels/graph/glowSprites.ts` (offscreen glow sprite cache) |
| Modify | `src/renderer/src/panels/graph/GraphRenderer.ts` (glow sprites, dimming, edge brightening, label rendering) |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (event handlers, double-click, right-click, highlight integration) |

### 3B: Real-Time Graph Updates

When the agent writes a file via the terminal, the graph updates reactively.

**Data pipeline** (already partially exists):
1. Agent writes file to disk
2. Chokidar watcher (via `registerWatcherIpc`) detects the change
3. IPC sends file change event to renderer
4. `vault-store` updates `files[]`
5. `GraphPanel` diffs previous vs current file list

**Diff logic**: diff by file path as key. Detect adds, removes, and renames (rename = remove + add with same content hash within a short time window). A rename should animate as a position-preserving transition, not exit-old + enter-new.

**Batching**: rapid-fire file creation (agent writing 10 files in 2 seconds) is batched on a `requestAnimationFrame` cadence. Accumulate file change events, apply them as a single batch on the next animation frame, then restart the simulation once (not per-file).

**New node entry animation**:
- Opacity: 0 to 1 over 400ms
- Scale: 0.5 to 1 over 400ms
- Position: gentle drift from graph center
- D3 simulation: `alpha(0.3).restart()` (gentle re-settle, not full re-layout)

**Removed node exit**: fade out over 200ms, then removed from simulation.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/useGraphAnimation.ts` (enter/exit transitions, rename detection, rAF batching) |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (diff logic, animation integration) |

### 3C: Graph/Skills Toggle

Extends the center panel's content view to include a Skills lens.

**Content view states**: `'graph' | 'editor' | 'skills'`

**Toggle UI**: refactor existing `GraphControls.tsx` pill toggle from Graph/Editor to Graph/Skills. Active tab has `accent.muted` background. Editor is no longer in the pill toggle; it is accessed exclusively via node double-click in the graph or file selection in the sidebar.

**Skills view (placeholder)**: minimal component with icon, title "Skills", and description "Agent capabilities and automation recipes. Coming soon." Clean placeholder ready for future implementation.

**Keyboard shortcut changes**:
- `Cmd+G`: when in editor view, returns to graph view. When in graph view, switches to skills. When in skills, switches to graph. (Cycles graph > skills > graph, and always escapes editor back to graph.)
- The existing `onToggleView` handler in `useKeyboard` is updated to implement this cycle.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/SkillsPlaceholder.tsx` |
| Modify | `src/renderer/src/panels/graph/GraphControls.tsx` (Graph/Skills toggle, remove Editor button) |
| Modify | `src/renderer/src/store/graph-store.ts` (add `'skills'` to contentView union) |
| Modify | `src/renderer/src/App.tsx` (ContentArea renders SkillsPlaceholder, update toggle logic) |
| Modify | `src/renderer/src/hooks/useKeyboard.ts` (updated Cmd+G cycle) |

### 3D: Enhanced Node Sizing

Node size is configurable via a mode selector in the Graph Settings Panel.

**Three modes**:

| Mode | Formula | Effect |
|------|---------|--------|
| Degree (total) | `r = baseSize + Math.sqrt(degree) * scaleFactor` | Hub nodes larger, leaf nodes smaller |
| Uniform | `r = baseSize` | All nodes same size, color differentiates |
| Content length | `r = baseSize + Math.log(charCount / 100) * scaleFactor` | Larger files appear bigger (log scale prevents extremes) |

Degree is total degree (in-degree + out-degree). In a knowledge graph where backlinks and forward links are directional, total degree best represents a node's overall connectivity. The existing `connectionCount` field maps to this. If we later need in-degree or out-degree as separate sizing options, the graph data model already supports directional edges.

The "Node size" slider in the controls panel sets `baseSize`. The mode selector (dropdown) determines the scaling function. Default mode: degree. Default base size: small (3-5px range).

**Files**:

| Action | File |
|--------|------|
| Modify | `src/renderer/src/store/graph-settings-store.ts` (node size mode) |
| Modify | `src/renderer/src/panels/graph/GraphRenderer.ts` (sizing logic) |
| Modify | `src/renderer/src/panels/graph/GraphSettingsPanel.tsx` (mode dropdown) |

### 3E: Graph Performance and Virtualization

At 500+ nodes, Canvas2D with per-node effects will chug. This section establishes the performance strategy.

**Rendering budget**:
- Cull off-screen nodes: don't draw nodes outside the current viewport (check against transform + canvas bounds before drawing)
- Level of detail (LOD): at zoom levels where nodes are < 2px on screen, drop labels entirely and use simple `fillRect` instead of `arc` + glow. At extreme zoom-out, render edges as a single low-alpha overlay rather than individual lines.
- Frame budget target: 16ms (60fps). If a frame exceeds this, log a warning and reduce glow quality (skip ambient sprites, reduce shadowBlur resolution).

**Glow performance**: ambient glow uses pre-rendered sprites (see 3A). Real-time `shadowBlur` reserved for hovered node + neighbors only (typically < 20 nodes at once).

**WebGL fallback**: not implemented in V1, but the renderer interface is designed as a pluggable abstraction (`GraphRendererInterface` with `render()`, `hitTest()`, `resize()` methods) so a pixi.js or regl-based renderer can be swapped in later without changing GraphPanel or any store logic.

**Graph loading state**: first paint on a large vault shows a skeleton state while D3 force simulation stabilizes (1-3 seconds). A subtle pulsing dot cluster animation centered in the graph area, replaced by the real graph once simulation alpha drops below 0.1.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/GraphRendererInterface.ts` (renderer abstraction) |
| Modify | `src/renderer/src/panels/graph/GraphRenderer.ts` (implement interface, viewport culling, LOD) |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (loading state, renderer swap point) |

### 3F: Graph Minimap

Once zoomed into a cluster, spatial context is lost. A minimap restores it.

- Small inset canvas (120x80px) in the bottom-left corner of the graph area
- Renders the full graph at thumbnail scale (simple dots, no glow, no labels)
- Viewport rectangle overlay showing the current visible area
- Clicking the minimap pans the main graph to that location
- Toggle visibility in graph settings (Display section)

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/GraphMinimap.tsx` |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (minimap integration, pass transform state) |

## Phase 4: Polish

### 4A: Theme Coherence

Audit and unify all visual styling across every component.

**Actions**:
- Replace all hardcoded hex colors with token references from `tokens.ts`
- Panel dividers: replace hard 1px borders with subtle gradient separators (`bg.surface` to transparent)
- Standardize border-radius: 6px for containers, 4px for inline elements, 50% for dots/avatars
- All interactive elements get `bg.elevated` hover state with 150ms transition
- Focus rings: `accent.default` at 0.3 opacity, 2px offset, for keyboard navigation
- Scrollbar styling: thin, `bg.elevated` thumb, transparent track

**Files**:

| Action | File |
|--------|------|
| Modify | `src/renderer/src/design/tokens.ts` (border-radius constants) |
| Modify | `src/renderer/src/assets/index.css` (scrollbar styles, CSS custom properties) |
| Modify | All components with hardcoded colors (audit pass) |

### 4B: Typography System

Extend `tokens.ts` with a complete type scale.

**Display font (Inter)**:

| Role | Size | Weight | Color |
|------|------|--------|-------|
| Page title | 20px | 600 | text.primary |
| Section heading | 15px | 600 | text.primary |
| Body | 13px | 400 | text.primary |
| Secondary | 12px | 400 | text.secondary |
| Label/caption | 12px | 400 | text.muted |

Labels use `text-transform: uppercase` and `letter-spacing: 0.05em`. Minimum text size floor: 12px for any text that isn't purely decorative (11px is unreadable on non-Retina). For non-Retina displays (`window.devicePixelRatio < 2`), the type scale shifts up 1px across the board.

**Mono font (JetBrains Mono)**:

| Role | Size |
|------|------|
| Terminal output, code blocks | 13px |
| Editor source mode | 12px |
| Inline code, file paths | 12px |

**Settings-driven**: font family and base size come from settings store. All other sizes are relative. Exposed as CSS custom properties (`--font-body`, `--text-sm`, etc.) for Tailwind consumption.

### 4C: Editor Toolbar and Features

New toolbar, breadcrumb, backlinks panel, and frontmatter handling for the editor.

**Breadcrumb** (`EditorBreadcrumb.tsx`):
- Back/forward navigation arrows
- File path: `folder / filename.md`
- Clicking a folder segment scrolls the sidebar file tree to that folder and expands it (dispatches a sidebar scroll-to action, not a stretch goal)

**Toolbar** (`EditorToolbar.tsx`):
- Undo / Redo
- Separator
- H1 / H2 / H3 / H4 heading toggles (H1 included; it is not reserved for title. If the user wants H1, they can use it.)
- Separator
- Bold / Italic / Strikethrough
- Separator
- Bullet list / Ordered list / Checkbox list
- Separator
- Code block / Link
- Right-aligned: Source mode toggle button

**Behavior**:
- Toolbar buttons map to Tiptap editor commands
- Active formatting reflected in button state (e.g., Bold highlighted when selection is bold)
- Toolbar hides when in source mode (CodeMirror has its own conventions)

**Frontmatter rendering**: if a file has YAML frontmatter, render it as a collapsible metadata header above the content (showing artifact type, tags, dates as styled key-value pairs). In source mode, show raw YAML. Toggle to expand/collapse the metadata header. Never show raw YAML in rich mode.

**Backlinks panel**: collapsible panel below the editor content showing all files that link to the current file. Each backlink entry shows: file title, the line containing the link (surrounding context, ~50 chars before and after), and artifact type dot. Clicking a backlink opens that file. Data source: the vault index (already tracks relationships via `getGraph()`). Collapsed by default, toggle via a "Backlinks (N)" button in the editor footer.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/editor/EditorToolbar.tsx` |
| Create | `src/renderer/src/panels/editor/EditorBreadcrumb.tsx` |
| Create | `src/renderer/src/panels/editor/BacklinksPanel.tsx` |
| Create | `src/renderer/src/panels/editor/FrontmatterHeader.tsx` |
| Modify | `src/renderer/src/panels/editor/EditorPanel.tsx` (integrate toolbar, breadcrumb, frontmatter, backlinks) |

### 4D: Enhanced Status Bar

Extract from inline in App.tsx to its own component with context-sensitive content.

**Left side** (always visible):
- Vault name
- Note count
- Git branch with status dot (green = clean, yellow = dirty)

**Right side** (context-sensitive):
- Editor mode: cursor position (Ln/Col), word count, encoding (UTF-8)
- Graph mode: node count, edge count, selected node name (if any)

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/components/StatusBar.tsx` |
| Modify | `src/renderer/src/App.tsx` (replace inline StatusBar) |

### 4E: Transition and Animation Standards

All animations cataloged with consistent timing.

**Micro-interactions**:
- Hover states: 150ms ease-out
- Panel divider drag: immediate (no transition)
- Tooltip appear: 100ms ease-in
- Focus ring: 100ms ease-out

**Panel transitions**:
- Graph to Editor crossfade: 200ms
- Settings panel slide: 250ms ease-out
- Modal overlay: 200ms fade-in
- Command palette: 150ms scale + fade

**Graph animations**:
- Node hover glow: 200ms ease-out
- Network reveal (hover): 200ms ease-out
- Network dim (mouse-leave): 300ms ease-out
- New node enter: 400ms fade + scale
- Node exit: 200ms fade

**Principles**:
- Never block interaction with animation
- Exit faster than enter
- No animations over 400ms
- Respect `prefers-reduced-motion`: CSS animations via media query. Canvas2D/JS animations via `window.matchMedia('(prefers-reduced-motion: reduce)')` check. When set: disable glow transitions, skip node enter/exit animations, reduce D3 simulation alpha reheating, instant state changes instead of animated ones.

**Implementation**: add `transitions` and `animations` sections to `tokens.ts` as named constants. Components reference these rather than inline timing values.

**Files**:

| Action | File |
|--------|------|
| Modify | `src/renderer/src/design/tokens.ts` (transition/animation constants) |
| Modify | `src/renderer/src/assets/index.css` (prefers-reduced-motion media query) |

### 4F: Graph Keyboard Navigation

Accessibility and power-user keyboard navigation for the graph.

- `Tab` when graph is focused: select the first/next node (cycle through nodes in alphabetical order)
- `Shift+Tab`: select previous node
- `Arrow keys`: when a node is selected, traverse to connected neighbors (up/down for vertical, left/right for horizontal, based on spatial position)
- `Enter`: open selected node in editor (same as double-click)
- `Space`: toggle persistent selection (same as click)
- `Escape`: deselect current node
- Visual focus indicator: the same neon highlight used for hover, applied to the keyboard-focused node

The graph canvas receives focus via `tabIndex={0}` and a focus ring. All keyboard events handled in the `onKeyDown` handler of the canvas wrapper div.

**Files**:

| Action | File |
|--------|------|
| Create | `src/renderer/src/panels/graph/useGraphKeyboard.ts` (keyboard navigation hook) |
| Modify | `src/renderer/src/panels/graph/GraphPanel.tsx` (keyboard handler integration, tabIndex, focus management) |

## Design System Summary

### Color Tokens (existing, preserved)

```typescript
// Backgrounds
bg.base: '#0A0A0B'     // Graph canvas, app base
bg.surface: '#111113'   // Sidebar, terminal, titlebar, status bar
bg.elevated: '#1A1A1D'  // Active tabs, hover states, modals

// Text
text.primary: '#EDEDEF'
text.secondary: '#8B8B8E'
text.muted: '#5A5A5E'

// Accent
accent.default: '#6C63FF'
accent.hover: '#7B73FF'
accent.muted: 'rgba(108, 99, 255, 0.12)'

// Borders
border.default: '#2A2A2E'

// Artifact types
gene: '#6C63FF'
constraint: '#EF4444'
research: '#2DD4BF'
output: '#EC4899'
note: '#8B8B8E'
index: '#38BDF8'

// Semantic
cluster: '#34D399'
tension: '#F59E0B'
```

### New Stores

| Store | Purpose | Persistence |
|-------|---------|-------------|
| `graph-settings-store` | Graph display/force slider values, filter toggles, node size mode | Vault config (`.thought-engine/config.json`) |
| `settings-store` | App preferences (appearance, editor, terminal) | App config (`electron-store`) |

### File Inventory

**New files (19)**:
- `src/renderer/src/components/Titlebar.tsx`
- `src/renderer/src/components/SettingsModal.tsx`
- `src/renderer/src/components/StatusBar.tsx`
- `src/renderer/src/components/PanelErrorBoundary.tsx`
- `src/renderer/src/lib/config-storage.ts`
- `src/main/ipc/config.ts`
- `src/renderer/src/panels/sidebar/buildFileTree.ts`
- `src/renderer/src/panels/graph/GraphSettingsPanel.tsx`
- `src/renderer/src/panels/graph/SkillsPlaceholder.tsx`
- `src/renderer/src/panels/graph/useGraphHighlight.ts`
- `src/renderer/src/panels/graph/useGraphAnimation.ts`
- `src/renderer/src/panels/graph/GraphContextMenu.tsx`
- `src/renderer/src/panels/graph/glowSprites.ts`
- `src/renderer/src/panels/graph/GraphRendererInterface.ts`
- `src/renderer/src/panels/graph/GraphMinimap.tsx`
- `src/renderer/src/panels/graph/useGraphKeyboard.ts`
- `src/renderer/src/panels/editor/EditorToolbar.tsx`
- `src/renderer/src/panels/editor/EditorBreadcrumb.tsx`
- `src/renderer/src/panels/editor/BacklinksPanel.tsx`
- `src/renderer/src/panels/editor/FrontmatterHeader.tsx`
- `src/renderer/src/store/graph-settings-store.ts`
- `src/renderer/src/store/settings-store.ts`

**Modified files (16)**:
- `src/main/index.ts` (BrowserWindow config, config IPC registration, workspace restore)
- `src/main/ipc/shell.ts` (expose PTY process name)
- `src/renderer/src/App.tsx` (titlebar, error boundaries, layout, session hydration, expanded command handler)
- `src/renderer/src/panels/sidebar/FileTree.tsx` (hierarchy, folders, counts, inline rename, delete)
- `src/renderer/src/panels/sidebar/Sidebar.tsx` (action bar, sort dropdown)
- `src/renderer/src/panels/graph/GraphPanel.tsx` (settings, sizing, highlights, animation, minimap, loading state, keyboard, right-click)
- `src/renderer/src/panels/graph/GraphRenderer.ts` (Canvas2D glow sprites, dimming, edge brightening, viewport culling, LOD, renderer interface)
- `src/renderer/src/panels/graph/GraphControls.tsx` (Graph/Skills toggle, remove Editor button)
- `src/renderer/src/panels/terminal/TerminalPanel.tsx` (tab styling, close guard, rename, search addon)
- `src/renderer/src/panels/editor/EditorPanel.tsx` (toolbar, breadcrumb, frontmatter, backlinks)
- `src/renderer/src/design/components/CommandPalette.tsx` (fuzzy search, recent files, command routing)
- `src/renderer/src/store/graph-store.ts` ('skills' in contentView)
- `src/renderer/src/hooks/useKeyboard.ts` (updated Cmd+G cycle)
- `src/renderer/src/design/tokens.ts` (type scale, animation constants)
- `src/renderer/src/assets/index.css` (CSS custom properties, prefers-reduced-motion)

## Constraints

- Immutable data: return new copies, never mutate in-place
- Single responsibility per file (not an arbitrary line count)
- No hardcoded secrets; use env vars
- Commits: `<type>: <description>` format
- npm workaround: use `--cache /tmp/npm-cache-te` for installs
- Existing 35 tests must continue passing throughout all phases
- All destructive operations require confirmation dialogs
- Zero network dependency for graph, editor, and file tree
