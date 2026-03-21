# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Electron app with HMR (renderer at localhost:5173)
npm run build        # Typecheck + build all (main, preload, renderer)
npm run build:mac    # Build + package for macOS
npm test             # Run all tests (vitest)
npm test -- tests/engine/parser.test.ts   # Run a single test file
npm run test:watch   # Watch mode
npm run typecheck    # Check both node and web tsconfigs
npm run lint         # ESLint (flat config)
npm run format       # Prettier
```

**npm workaround**: Cache has root-owned files. Use `--cache /tmp/npm-cache-te` for installs.

## Architecture

Electron app with three process boundaries:

```text
Main Process (Node.js)          Preload (Bridge)           Renderer (Browser)
─────────────────────           ────────────────           ──────────────────
src/main/                       src/preload/               src/renderer/src/
├── index.ts (entry)            └── index.ts               ├── main.tsx (entry)
├── ipc/ (handlers)                exposes                 ├── App.tsx (shell)
│   ├── filesystem.ts              window.api              ├── store/ (Zustand)
│   ├── config.ts                  with typed              ├── engine/ (parser/indexer)
│   ├── watcher.ts                 namespaces              ├── panels/ (UI sections)
│   ├── workbench.ts                                       └── design/ (tokens, primitives)
│   └── shell.ts
└── services/
    ├── file-service.ts
    ├── vault-watcher.ts
    └── shell-service.ts
```

**Shared contracts** live in `src/shared/`: `types.ts` (Artifact, KnowledgeGraph, VaultConfig), `canvas-types.ts` (CanvasNode, CanvasEdge, SystemArtifactNodeMeta), `workbench-types.ts` (session events, milestones), `system-artifacts.ts` (session/pattern/tension frontmatter types, parsing), and `ipc-channels.ts` (typed channel definitions).

### IPC Pattern

All cross-process communication follows: Main registers `ipcMain.handle('channel', handler)` → Preload wraps with `ipcRenderer.invoke('channel')` → Renderer calls `window.api.namespace.method()`. The preload layer exposes namespaces: `fs`, `vault`, `config`, `window`, `shell`, `workbench`, `terminal`, `on` (events).

### Knowledge Engine (`src/renderer/src/engine/`)

Core domain logic that parses markdown files into typed Artifacts and builds a KnowledgeGraph:

- **parser.ts**: gray-matter frontmatter → Artifact. Type is an open string (any value accepted, defaults to `note`). Built-in types: gene, constraint, research, output, note, index. Custom types auto-discovered. Signals: untested, emerging, validated, core.
- **graph-builder.ts**: Artifacts → nodes + edges from relationship fields (connection, cluster, tension, appears_in). Creates ghost nodes for unresolved references.
- **vault-worker.ts**: Web Worker for bulk parsing. Main thread sends files, worker posts back complete result (artifacts, graph, errors, fileToId). Incremental updates on file change.
- **claude-relationship-extractor.ts**: Extracts edges between Claude config components (agent-uses-tool, team-has-member, skill-references, settings-controls). Uses word-boundary matching for skill/agent name references.

### Canvas System (`src/renderer/src/panels/canvas/`)

Infinite pan-zoom canvas with typed cards and edges:

- **CanvasSurface.tsx**: Pan/zoom viewport with SVG dot grid background. Transform via `translate(x,y) scale(zoom)`.
- **CardShell.tsx**: Wrapper for all card types. Title bar with action buttons (copy, convert, open-in-editor, close). Reports `hoveredNodeId` to store for edge reveal.
- **EdgeLayer.tsx**: SVG bezier edges with kind-based colors (connection=#64748b, cluster=#34d399, tension=#f59e0b). Supports `hidden` edges that reveal on endpoint hover.
- **card-registry.ts**: `LazyCards` record maps `CanvasNodeType` → lazy-loaded component. Add new card types here.
- **show-connections.ts**: Pure function for "Show Connections" context menu. Radial layout of graph neighbors around a source card.
- **import-logic.ts**: Graph-to-canvas conversion with typed edge passthrough. `buildIdToPath` for reverse lookup.
- **claude/claude-canvas-layout.ts**: Zone-based grid layout for ~/.claude/ config canvas.

### Workbench System (`src/renderer/src/panels/workbench/`)

Project-scoped canvas that shows Claude session activity, file cards, and system artifacts:

- **WorkbenchPanel.tsx**: Uses "store swap" pattern (saves vault canvas on mount, loads workbench, restores on unmount). Auto-detects project root, parses Claude sessions, lays out file/terminal cards.
- **workbench-layout.ts**: Generates card layout from session events.
- **workbench-artifacts.ts**: Builds session/pattern/tension artifact markdown documents from workbench state.
- **workbench-artifact-placement.ts**: Places system artifact cards on the canvas from sidebar clicks. Contains:
  - `placeArtifactOnWorkbench`: Sync placement with basic metadata, returns node ID.
  - `enrichArtifactMetadata`: Pure function extracting full frontmatter fields (summary, question, file counts, connections, tension refs).
  - `enrichPlacedArtifact`: Async IPC read + gray-matter parse + metadata update + edge wiring.
  - `wireArtifactEdges`: Bidirectional edge computation with dedup against existing store edges.
  - `restorePatternSnapshot`: Loads saved `.canvas.json` with ID-based deduplication.
- **workbench-migration.ts**: Renames legacy `.thought-engine-project-canvas.json` to `.thought-engine-workbench.json`.
- **SystemArtifactCard.tsx**: Renders session/pattern/tension cards with kind badge, status pill, summary, stat chips. Pattern cards with snapshots show a "Restore" button.
- **WorkbenchFileCard.tsx**: Renders project file cards with language icon and touch count.

### Canvas Stores

- **canvas-store.ts**: Active canvas state (nodes, edges, viewport, selection, hover, card context menu). `addNodesAndEdges` for batch insertion, `updateNodeMetadata` for partial updates.
- **claude-canvas-store.ts**: Cached serialized form for ~/.claude/ canvas (avoids disk reads on view switch).
- **workbench-store.ts**: Cached workbench canvas data and project path.
- **ClaudeConfigPanel.tsx**: "Store swap" pattern: saves vault canvas on mount, loads claude canvas, restores on unmount.

### State Management (Zustand)

- **vault-store**: Files, artifacts, graph, parse errors, vault path/config/state, discoveredTypes, systemFiles
- **editor-store**: Active note, mode (rich|source), dirty state, content, cursor, tab management
- **canvas-store**: Nodes, edges, viewport, selection, hover state, card context menu
- **graph-store**: Content view (editor|graph|skills), selected node
- **terminal-store**: Active sessions, history
- **settings-store**: Theme, accent color, font size, font family, editor mode, terminal config (persisted to localStorage)
- **tab-store**: View tabs with persisted state, legacy migration from `project-canvas` to `workbench`
- **workbench-actions-store**: Bridge pattern: WorkbenchPanel registers toolbar action handlers, command palette reads them. Actions disabled when handlers are null.
- **terminal-actions-store**: Bridge pattern with pending activation: palette sets flag + shows terminal, TerminalPanel fulfills on mount.

### UI Organization

- **Panels** (`panels/`): Self-contained UI sections (sidebar, editor, graph, terminal, canvas, claude-config, skills, onboarding, workbench)
- **Design system** (`design/`): ThemeProvider, token system (colors, spacing, typography), retro neon accent palette, Google Fonts integration
- **Components** (`components/`): App-level pieces (Titlebar, StatusBar, SettingsModal, FontPicker, GoogleFontLoader, PanelErrorBoundary)

The editor supports two modes: RichEditor (Tiptap) and SourceEditor (CodeMirror 6), toggled via cmd+/.

### Settings and Theming

`GoogleFontLoader` (mounted at app root) applies font family and font size from `settings-store` to `document.body`. Six themes (Midnight, Slate, Obsidian, Nord, Opal, Light) with eight retro neon accent colors. Settings persisted to localStorage with migration support.

### File System

All file I/O routes through `FileService` in main process (atomic writes via temp+rename). Vault structure:

```text
vault/
├── .thought-engine/       # App config/state (not user content)
│   ├── config.json
│   ├── state.json
│   └── artifacts/         # System artifacts (sessions, patterns, tensions)
│       ├── sessions/
│       ├── patterns/
│       └── tensions/
└── **/*.md                # Knowledge artifacts with frontmatter
```

File watching uses chokidar via `VaultWatcher`, which emits events through `vault:file-changed` IPC channel.

## Code Style

- **Prettier**: single quotes, no semicolons, 100 char width, no trailing commas
- **TypeScript**: Strict mode. Path aliases: `@renderer/*`, `@shared/*`, `@engine/*`
- **Tailwind v4**: Via Vite plugin. Dark theme with CSS variables. Token system in `design/tokens.ts`
- **Immutable data**: Return new copies, never mutate in-place
- **Files under 800 lines**, organized by feature/domain
- **Testing**: Pure functions with dependency injection for testability (e.g., `WorkbenchFs`, `ArtifactReader`, `FsReader` interfaces). Action stores use bridge pattern for cross-component communication without prop drilling.
