# Root-Cause Remediation Handoff

Date: 2026-03-30

## Context

This session implemented the confirmed remediation plan from
`/Users/caseytalbot/Desktop/PLAN.md` in TDD order:

1. write failing regression tests first
2. fix the production code
3. remove dead code last, after green verification

Scope stayed macOS-only. No Windows compatibility branches were added.

## Status

All confirmed defects in the plan are closed:

1. PathGuard symlink-parent escape for nonexistent children
2. Reopened macOS windows losing live updates
3. Coordinated quit handshake mismatch
4. MCP search results returning artifact ids in `path`
5. Editor `activeNoteId` / path corruption
6. Non-tmux terminal ignoring requested geometry
7. Terminal focus/blur listener leaks
8. Sidebar sort control inert + inefficient tree building
9. Audit logger mkdir recovery + DocumentManager autosave failure hygiene
10. Dead code and dead API cleanup

## What Was Just Completed

### Path and persistence hardening

- Consolidated vault-boundary checks onto the canonical path helper in:
  - `src/main/utils/paths.ts`
  - `src/main/services/path-guard.ts`
- Closed the symlink-parent escape for write/mkdir on nonexistent children.
- Fixed `AuditLogger` so a rejected mkdir does not poison future writes.
- Wrapped `DocumentManager` autosave timer failures in explicit handling and
  cleared stale pending-write state on save failure.

### Main-process lifecycle and IPC

- Added a single mutable main-window registry:
  - `src/main/window-registry.ts`
- Added a dedicated quit coordinator:
  - `src/main/services/quit-coordinator.ts`
- Changed watcher/document/workbench/agent/session broadcasts to resolve the
  current window at send time instead of capturing the startup window.
- Replaced the broken mixed quit flow with one invoke/handle handshake.

### Search and editor identity correctness

- Preserved real source file paths through indexing/search:
  - `src/shared/engine/indexer.ts`
  - `src/main/services/vault-indexing.ts`
- Kept MCP response shape the same while making `path` actually openable.
- Removed `activeNoteId` from renderer store state and made `activeNotePath`
  the source of truth, with artifact id derived from vault mappings in
  consumers.

### Terminal, sidebar, and worker hydration

- Non-tmux shell sessions now honor requested `cols` / `rows`.
- Terminal preload gained `offFocus` / `offBlur`, and the renderer now fully
  unsubscribes listeners on cleanup.
- `fs:list-all-files` now returns `{ path, mtime }` entries instead of plain
  strings.
- Sidebar sorting is real for `modified`, `name`, and `type`.
- File tree building now uses a parent-to-children adjacency map instead of
  repeated full-list scans.
- Vault worker progressive hydration is now incremental via append messages
  instead of resending all previously loaded files.

### Cleanup completed last

- Deleted the orphaned canvas sidebar component:
  - `src/renderer/src/panels/canvas/CanvasFloatingSidebar.tsx`
- Removed the stale sidebar-removal comment from `src/renderer/src/App.tsx`
- Removed unused `VaultIndex.search()` and `VaultIndex.getErrors()` after the
  rest of the functional work was green.

## Tests Added Or Extended

New regression coverage was added in:

- `src/main/services/__tests__/shell-service.test.ts`
- `src/main/services/__tests__/document-manager.test.ts`
- `src/main/services/__tests__/quit-coordinator.test.ts`
- `src/main/services/__tests__/session-tailer-window.test.ts`
- `src/main/ipc/__tests__/watcher-window.test.ts`
- `src/main/ipc/__tests__/documents-window.test.ts`
- `src/main/ipc/__tests__/workbench-window.test.ts`
- `src/main/ipc/__tests__/agents-window.test.ts`
- `src/renderer/src/store/__tests__/editor-store-identity.test.ts`
- `src/renderer/src/store/__tests__/vault-persist.test.ts`
- `src/renderer/src/panels/canvas/__tests__/ImportPalette.test.tsx`
- `src/renderer/src/panels/sidebar/__tests__/buildFileTree.test.ts`
- `src/renderer/src/engine/__tests__/useVaultWorker.test.tsx`

Existing suites were extended in the requested areas, including:

- `src/shared/__tests__/path-guard.test.ts`
- `src/main/ipc/__tests__/filesystem-guard.test.ts`
- `src/main/services/__tests__/vault-indexing.test.ts`
- `src/main/services/__tests__/mcp-server.test.ts`
- `src/main/services/__tests__/mcp-lifecycle.test.ts`
- `src/preload/__tests__/terminal-webview.test.ts`
- `src/renderer/terminal-webview/__tests__/terminal-app.test.ts`
- `src/shared/__tests__/audit-logger.test.ts`
- `tests/integration/file-service.test.ts`
- `tests/engine/indexer.test.ts`
- `src/shared/engine/__tests__/shared-engine.test.ts`

## Verification

Latest verification after dead-code cleanup:

- `npm run typecheck` -> passes
- `npm test` -> passes
  - `132` test files
  - `1364` tests
- `npm run lint` -> back to baseline
  - single pre-existing warning only:
    - `src/main/ipc/__tests__/mcp.test.ts:37`

Expected test stderr still appears from existing failure-path coverage:

- tmux socket absence messages during tmux-related tests
- audit logger ENOENT / ENOTDIR traces from explicit failure-path tests

These did not cause failures.

## Key Files

Core implementation files:

- `src/main/index.ts`
- `src/main/window-registry.ts`
- `src/main/services/quit-coordinator.ts`
- `src/main/services/path-guard.ts`
- `src/main/utils/paths.ts`
- `src/main/services/vault-indexing.ts`
- `src/main/services/file-service.ts`
- `src/main/services/shell-service.ts`
- `src/main/services/audit-logger.ts`
- `src/main/services/document-manager.ts`
- `src/main/services/session-tailer.ts`
- `src/main/ipc/watcher.ts`
- `src/main/ipc/documents.ts`
- `src/main/ipc/workbench.ts`
- `src/main/ipc/agents.ts`
- `src/preload/index.ts`
- `src/preload/terminal-webview.ts`
- `src/shared/ipc-channels.ts`
- `src/shared/types.ts`
- `src/shared/engine/indexer.ts`
- `src/renderer/src/App.tsx`
- `src/renderer/src/store/editor-store.ts`
- `src/renderer/src/store/vault-store.ts`
- `src/renderer/src/store/vault-persist.ts`
- `src/renderer/src/panels/sidebar/buildFileTree.ts`
- `src/renderer/src/panels/editor/EditorPanel.tsx`
- `src/renderer/src/panels/canvas/ImportPalette.tsx`
- `src/renderer/src/engine/useVaultWorker.ts`
- `src/renderer/src/engine/vault-worker.ts`
- `src/renderer/terminal-webview/TerminalApp.tsx`

## Residual Risk

Two follow-up risks remain worth keeping in mind:

1. The main-window registry assumes one current main window. If the app grows
   true multi-window behavior, event routing will need to become window-aware
   instead of relying on a single mutable current window.
2. Sidebar modified sorting now uses real mtimes, but watcher-driven resorting
   still depends on async mtime refresh after change batches. Correctness is
   covered, but very bursty external edits may briefly display stale ordering
   until refresh completes.

## Suggested Next Prompt

```text
Continue in /Users/caseytalbot/Projects/thought-engine. Read ROOT_CAUSE_REMEDIATION_HANDOFF.md.
The remediation wave is complete and verified. Review the changes for commit readiness, or pick one residual-risk follow-up if you want another pass.
```
