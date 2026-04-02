# Ghost Emergence + Graph Neighborhood Pinning

**Date:** 2026-04-02
**Status:** Draft

---

## Feature 1: Graph Neighborhood Pinning

### Problem

When "Show on graph" is triggered from the Ghosts panel, `setSelectedNode(ghost.id)` draws a persistent blue selection ring — but the neighborhood dimming (non-neighbors at 0.3 alpha, neighbor edges glowing green) is driven by `hoveredNodeId`, which clears the instant the mouse moves off the node. The visual emphasis that shows a ghost's context vanishes immediately.

### Design

Add a fallback chain in the graph renderer's highlighting logic:

```
Active focus node = highlightedNode (hover) ?? selectedNodeIndex (click) ?? null
```

**Behavior:**
- When a node is selected (click or "Show on graph"), its neighborhood stays dimmed/glowing — identical visual to hover, but persistent
- Hover still works: moving over a different node temporarily shows *that* node's neighborhood
- When hover clears (mouse leaves all nodes), the renderer falls back to the selected node's neighborhood instead of showing everything flat
- Clicking a new node changes the selection (and its pinned neighborhood)
- Clicking empty canvas clears the selection

**No new state.** The existing `highlightedNode` and `selectedNodeIndex` fields on `GraphRenderer` are sufficient. The change is in how `updateHighlighting()` computes which `neighborSet` to use.

### Files Modified

| File | Change |
|------|--------|
| `src/renderer/src/panels/graph/graph-renderer.ts` | `updateHighlighting()`: compute `focusNode = highlightedNode ?? selectedNodeIndex`, use it for neighbor dimming. `handlePointerUp`: detect clicks on empty canvas (when `dragNodeIndex` is null and pointer didn't move), clear `selectedNodeIndex` and fire `onDeselect` callback. ~20 lines total. |
| `src/renderer/src/panels/graph/GraphPanel.tsx` | Add `onDeselect` to `RendererCallbacks` — clears `selectedNodeId` in store. Update the 4 sites that build `neighborSet` from `hoveredIdx` to use `hoveredIdx ?? selectedIdx` as fallback. ~20 lines. |

### Edge Cases

- **Click on empty space:** Currently `handlePointerUp` only acts when `dragNodeIndex !== null`. Add: when `dragNodeIndex` is null and `!pointerMoved`, fire new `onDeselect` callback → clears selection + pinned neighborhood.
- **Hover same node as selected:** No visual change — hover and selection produce identical dimming.
- **Ghost node selected:** Ghost nodes are valid selection targets. Their neighborhoods are typically small (mostly inbound edges from referencing notes).

---

## Feature 2: Ghost Emergence

### Problem

Creating a note from a ghost produces an empty file with frontmatter connections. The user must manually write all content. Since the app already has Claude CLI integration (`agent-action-runner.ts`), ghost creation should synthesize a unified note from all referencing content.

### Design

New IPC channel `ghost:emerge` in main process. When the user clicks "Create" on a ghost:

1. **Renderer** sends `ghost:emerge` with ghost title, reference file paths, vault path, and existing folder list
2. **Main process** reads all reference files from disk
3. **Main process** calls `claude` CLI with a synthesis prompt containing all reference bodies, the ghost title, and the folder list
4. **Claude** returns structured JSON: `{ folder, title, tags, origin, body }`
5. **Main process** creates folder if new, writes the note file with full frontmatter
6. **Renderer** opens note in editor, marks new folders/notes with origin color coding in sidebar

### IPC Contract

```typescript
// In src/shared/ipc-channels.ts — add to IpcChannels
'ghost:emerge': {
  params: {
    ghostId: string
    ghostTitle: string
    referencePaths: readonly string[]
    vaultPath: string
    existingFolders: readonly string[]
  }
  result: {
    filePath: string
    folderCreated: boolean
    folderPath: string
  }
}
```

### Claude Prompt Structure

```
You are a knowledge synthesizer for a personal knowledge vault.

## Task
Create a unified note for the concept "{ghostTitle}" by synthesizing insights from the {N} notes that reference it.

## Reference Notes
{for each reference: title, tags, body}

## Existing Vault Folders
{folder list}

## Instructions
1. Synthesize the key ideas about "{ghostTitle}" across all references into a cohesive note
2. Choose the most appropriate existing folder, or suggest a new folder name if none fit
3. Generate relevant tags based on the content
4. Write in the same voice and style as the reference notes

## Response Format (JSON)
{
  "folder": "string — existing folder name or new folder name",
  "title": "string — note title",
  "tags": ["string"],
  "origin": "emerge",
  "body": "string — markdown body content"
}
```

### Origin Field

New frontmatter field `origin` on serialized artifacts. Not added to the `Artifact` interface (it's a free-form frontmatter key, read via `frontmatter` record). Values: `emerge`, `challenge`, or any future agent action name.

When serializing:
```yaml
---
title: Jorge Luis Borges
type: note
origin: emerge
tags:
  - literature
  - fiction
connections:
  - Ficciones
  - The Library of Babel
---
```

### Sidebar Color Coding

Files and folders with `origin` in their frontmatter (or containing only origin-tagged files) get visual markers in the sidebar file tree:

| Element | Color | Condition |
|---------|-------|-----------|
| Folder icon | Blue (`#60a5fa`) | Folder was created by ghost emergence |
| File icon | Green (`#4ade80`) | File has `origin` field in frontmatter |

**Implementation:** `FolderIcon` and `fileKindIcon()` in `FileTree.tsx` check the artifact's frontmatter for `origin`. For folders, check if the folder was created in the current emergence (tracked via a `Set<string>` in vault-store, persisted to `.machina/state.json`).

### Files Modified/Created

| File | Change |
|------|--------|
| `src/shared/ipc-channels.ts` | Add `ghost:emerge` channel type |
| `src/main/ipc/ghosts.ts` | **New.** Handler: read refs, call claude CLI, write file, create folder |
| `src/main/index.ts` | Register ghost IPC handlers |
| `src/preload/index.ts` | Expose `ghost.emerge()` under new `ghost` namespace |
| `src/renderer/src/panels/ghosts/GhostPanel.tsx` | Replace `handleCreate` with `ghost:emerge` IPC call, add loading state |
| `src/renderer/src/panels/graph/GraphDetailDrawer.tsx` | Same — replace create flow with emerge call |
| `src/renderer/src/panels/sidebar/FileTree.tsx` | `FolderIcon` + `fileKindIcon`: check origin, apply blue/green color |
| `src/renderer/src/store/vault-store.ts` | Add `emergedFolders: Set<string>` for tracking AI-created folders |
| `src/shared/engine/parser.ts` | Ensure `origin` survives parse round-trip via `frontmatter` record (no Artifact type change needed) |

### Error Handling

- **Claude CLI not found:** Fall back to creating an empty note (current behavior) with a toast notification
- **Claude timeout (60s):** Same fallback + toast
- **Invalid JSON response:** Retry once with a stricter prompt, then fallback
- **Folder creation fails:** Write to vault root instead

### Data Flow

```
GhostPanel "Create" click
  → window.api.ghost.emerge({ ghostId, referencePaths, vaultPath, existingFolders })
  → IPC: ghost:emerge
  → main/ipc/ghosts.ts:
      1. Read reference files via file-service
      2. Build prompt with bodies + folder list
      3. Spawn claude CLI (same pattern as agent-action-runner)
      4. Parse JSON response
      5. mkdir if new folder
      6. serializeArtifact with origin + tags + body
      7. Write file via file-service
      8. Return { filePath, folderCreated, folderPath }
  → Renderer: setActiveNote(filePath), update emergedFolders if new
  → Sidebar re-renders with blue folder / green file icons
```

---

## Testing Strategy

### Feature 1: Graph Pinning
- Unit test: `getNeighborSet` fallback logic (hover ?? selected ?? null)
- Manual: "Show on graph" from ghosts panel → verify neighborhood stays dimmed → hover another node → verify temporary override → move mouse away → verify snap-back to selected neighborhood → click empty space → verify clear

### Feature 2: Ghost Emergence
- Unit test: prompt builder (reference formatting, folder list)
- Unit test: JSON response parsing + validation
- Unit test: `origin` frontmatter round-trip through parser
- Integration test: mock claude CLI → verify file written with correct content/folder
- Manual: create ghost → verify note opens with content → verify folder color → verify file color
