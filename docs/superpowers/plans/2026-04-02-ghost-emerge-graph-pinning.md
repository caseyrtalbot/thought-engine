# Ghost Emergence + Graph Neighborhood Pinning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pin graph neighborhood highlighting to selected nodes, and replace empty ghost creation with AI-synthesized notes via Claude CLI.

**Architecture:** Two independent features. Feature 1 modifies the graph renderer's highlighting fallback chain (`hover ?? selected ?? null`). Feature 2 adds a `vault:emerge-ghost` IPC channel that reads referencing notes, calls Claude CLI, and writes a synthesized note with `origin` frontmatter. A prerequisite fix to `serializeArtifact` ensures custom frontmatter keys survive round-trips.

**Tech Stack:** Pixi.js (graph renderer), Zustand (stores), Electron IPC, Claude CLI (`claude --print`), Vitest

---

## Task 0: Fix `serializeArtifact` Frontmatter Round-Trip

**Files:**
- Modify: `src/shared/engine/parser.ts:104-124`
- Test: `tests/engine/parser.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/engine/parser.test.ts`, add:

```typescript
it('preserves custom frontmatter keys through round-trip', () => {
  const markdown = `---
id: test-origin
title: Test Origin
type: note
origin: emerge
custom_field: hello
---

Body content here.`

  const result = parseArtifact(markdown, 'test-origin.md')
  assert(result.ok)
  expect(result.value.frontmatter.origin).toBe('emerge')
  expect(result.value.frontmatter.custom_field).toBe('hello')

  const serialized = serializeArtifact(result.value)
  expect(serialized).toContain('origin: emerge')
  expect(serialized).toContain('custom_field: hello')

  const reparsed = parseArtifact(serialized, 'test-origin.md')
  assert(reparsed.ok)
  expect(reparsed.value.frontmatter.origin).toBe('emerge')
  expect(reparsed.value.frontmatter.custom_field).toBe('hello')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/engine/parser.test.ts -t "preserves custom frontmatter"`
Expected: FAIL — `serialized` does not contain `origin: emerge`

- [ ] **Step 3: Fix `serializeArtifact` to preserve custom frontmatter keys**

In `src/shared/engine/parser.ts`, replace the `serializeArtifact` function:

```typescript
/** Keys that serializeArtifact handles explicitly — do not duplicate from frontmatter spread. */
const EXPLICIT_FRONTMATTER_KEYS = new Set([
  'id', 'title', 'type', 'created', 'modified', 'source', 'frame',
  'signal', 'tags', 'connections', 'clusters_with', 'tensions_with',
  'appears_in', 'related', 'concepts'
])

export function serializeArtifact(artifact: Artifact): string {
  const frontmatter: Record<string, unknown> = {
    id: artifact.id,
    title: artifact.title,
    type: artifact.type,
    created: artifact.created,
    modified: artifact.modified
  }

  if (artifact.source) frontmatter.source = artifact.source
  if (artifact.frame) frontmatter.frame = artifact.frame
  if (artifact.signal !== 'untested') frontmatter.signal = artifact.signal
  if (artifact.tags.length > 0) frontmatter.tags = artifact.tags
  if (artifact.connections.length > 0) frontmatter.connections = artifact.connections
  if (artifact.clusters_with.length > 0) frontmatter.clusters_with = artifact.clusters_with
  if (artifact.tensions_with.length > 0) frontmatter.tensions_with = artifact.tensions_with
  if (artifact.appears_in.length > 0) frontmatter.appears_in = artifact.appears_in
  if (artifact.related.length > 0) frontmatter.related = artifact.related

  // Preserve custom frontmatter keys (origin, etc.) not handled above
  for (const [key, value] of Object.entries(artifact.frontmatter)) {
    if (!EXPLICIT_FRONTMATTER_KEYS.has(key) && value !== undefined && value !== null) {
      frontmatter[key] = value
    }
  }

  return matter.stringify(artifact.body, frontmatter)
}
```

- [ ] **Step 4: Write a guard test against explicit key duplication**

Add to the same test file:

```typescript
it('does not duplicate explicit fields from frontmatter spread', () => {
  const markdown = `---
id: dup-test
title: Dup Test
type: note
tags:
  - alpha
origin: emerge
---

Body.`

  const result = parseArtifact(markdown, 'dup-test.md')
  assert(result.ok)
  const serialized = serializeArtifact(result.value)

  // 'tags' should appear exactly once (from explicit handling, not from frontmatter spread)
  const tagMatches = serialized.match(/^tags:/gm)
  expect(tagMatches?.length ?? 0).toBe(1)

  // 'origin' should appear exactly once (from frontmatter spread)
  const originMatches = serialized.match(/^origin:/gm)
  expect(originMatches?.length ?? 0).toBe(1)
})
```

- [ ] **Step 5: Run all parser tests**

Run: `npx vitest run tests/engine/parser.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/shared/engine/parser.ts tests/engine/parser.test.ts
git commit -m "fix: preserve custom frontmatter keys in serializeArtifact round-trip"
```

---

## Task 1: Graph Neighborhood Pinning — Renderer

**Files:**
- Modify: `src/renderer/src/panels/graph/graph-renderer.ts:18-25` (RendererCallbacks)
- Modify: `src/renderer/src/panels/graph/graph-renderer.ts:413-535` (renderEdges, updateNodePositions)
- Modify: `src/renderer/src/panels/graph/graph-renderer.ts:705-719` (handlePointerUp)

- [ ] **Step 1: Add `onDeselect` to `RendererCallbacks`**

In `src/renderer/src/panels/graph/graph-renderer.ts`, update the interface:

```typescript
export interface RendererCallbacks {
  readonly onNodeHover: (nodeIndex: number | null) => void
  readonly onNodeClick: (nodeIndex: number) => void
  readonly onNodeDrag: (nodeIndex: number, x: number, y: number) => void
  readonly onNodeDragEnd: (nodeIndex: number) => void
  readonly onViewportChange: (viewport: GraphViewport) => void
  readonly onDeselect: () => void
}
```

- [ ] **Step 2: Update `renderEdges` to use focus node fallback**

In `renderEdges()`, replace the `neighborSet` computation (~line 424-427):

```typescript
    const focusNode = this.highlightedNode ?? this.selectedNodeIndex
    const neighborSet =
      focusNode !== null
        ? (this.adjacency.get(focusNode) ?? new Set<number>())
        : null
```

And update the edge highlight check (~line 443-444) to use `focusNode`:

```typescript
        isHighlighted =
          edge.sourceIndex === focusNode || edge.targetIndex === focusNode
```

- [ ] **Step 3: Update `updateNodePositions` to use focus node fallback**

In `updateNodePositions()`, replace the `neighborSet` computation (~line 494-497):

```typescript
    const focusNode = this.highlightedNode ?? this.selectedNodeIndex
    const neighborSet =
      focusNode !== null
        ? (this.adjacency.get(focusNode) ?? new Set<number>())
        : null
```

And update the scale check (~line 523) to use `focusNode`:

```typescript
      const isHighlighted = i === focusNode
```

- [ ] **Step 4: Add empty-canvas click detection in `handlePointerUp`**

In `handlePointerUp()` (~line 705-719), add before the cleanup block:

```typescript
  private handlePointerUp(_e: PointerEvent): void {
    if (this.dragNodeIndex !== null) {
      if (!this.pointerMoved) {
        // Click (didn't move enough to be a drag)
        this.callbacks.onNodeClick(this.dragNodeIndex)
      } else {
        this.callbacks.onNodeDragEnd(this.dragNodeIndex)
      }
    } else if (this.isPanning && !this.pointerMoved) {
      // Tap on empty canvas (not a pan gesture) — clear selection
      this.callbacks.onDeselect()
    }

    this.dragNodeIndex = null
    this.isPanning = false
    this.pointerMoved = false
    this.updateCursor()
  }
```

- [ ] **Step 5: Commit**

```bash
git add src/renderer/src/panels/graph/graph-renderer.ts
git commit -m "feat: pin neighborhood highlight to selected node in graph renderer"
```

---

## Task 2: Graph Neighborhood Pinning — GraphPanel + LabelLayer

**Files:**
- Modify: `src/renderer/src/panels/graph/GraphPanel.tsx:219-270` (callbacks + label render sites)

- [ ] **Step 1: Add `onDeselect` callback in mount effect**

In `GraphPanel.tsx`, inside the `useEffect` that creates the renderer (~line 219), add `onDeselect` to the callbacks object:

```typescript
    const renderer = new GraphRenderer({
      onNodeHover: (idx) => {
        if (!mountedRef.current) return
        const id = idx !== null ? (simNodesRef.current[idx]?.id ?? null) : null
        setHoveredNode(id)
        renderer.setHighlightedNode(idx)
      },
      onNodeClick: (idx) => {
        if (!mountedRef.current) return
        const node = simNodesRef.current[idx]
        if (!node) return

        // Toggle selection: clicking the same node again deselects
        const currentSelected = useGraphViewStore.getState().selectedNodeId
        const nextId = currentSelected === node.id ? null : node.id
        setSelectedNode(nextId)
        renderer.setSelectedNode(nextId !== null ? idx : null)
      },
      onDeselect: () => {
        if (!mountedRef.current) return
        setSelectedNode(null)
        renderer.setSelectedNode(null)
      },
      onNodeDrag: (idx, x, y) => {
```

- [ ] **Step 2: Create a helper to compute effective focus index**

Add a helper function inside the component (before the `useEffect` or as a `useCallback`):

```typescript
  /** Resolve the effective focus node index: hover takes priority, falls back to selection. */
  const getFocusIdx = useCallback((): number | null => {
    const hoveredId = useGraphViewStore.getState().hoveredNodeId
    const selectedId = useGraphViewStore.getState().selectedNodeId
    const effectiveId = hoveredId ?? selectedId
    return effectiveId ? (nodeIndexMapRef.current.get(effectiveId) ?? null) : null
  }, [])
```

- [ ] **Step 3: Update the 3 LabelLayer render call sites**

Replace the `hoveredIdx` + `neighborSet` computation pattern at each of the three sites. The pattern to find and replace (appears at ~lines 255-257, 303-305, 410-412):

**Old pattern (repeated 3 times):**
```typescript
          const hoveredId = useGraphViewStore.getState().hoveredNodeId
          const hoveredIdx = hoveredId ? (nodeIndexMapRef.current.get(hoveredId) ?? null) : null
          const ns = hoveredIdx !== null ? getNeighborSet(hoveredIdx) : null
```

**New pattern (all 3 sites):**
```typescript
          const focusIdx = getFocusIdx()
          const ns = focusIdx !== null ? getNeighborSet(focusIdx) : null
```

Update each `ll.render()` call to pass `focusIdx` instead of `hoveredIdx`:

```typescript
          ll.render(
            simNodesRef.current,
            positionsRef.current,
            vp,
            lod,
            focusIdx,
            ns,
            showLabels,
            labelScale
          )
```

Apply the same change to the physics worker `onmessage` handler (~line 303-318):

```typescript
        const focusIdx = getFocusIdx()
        const neighborSet = focusIdx !== null ? getNeighborSet(focusIdx) : null

        const { showLabels, labelScale } = useGraphViewStore.getState()
        labelLayer.render(
          simNodesRef.current,
          msg.buffer,
          vp,
          lod,
          focusIdx,
          neighborSet,
          showLabels,
          labelScale
        )
```

- [ ] **Step 4: Verify graph panel compiles**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors related to graph files

- [ ] **Step 5: Manual test**

Run: `npm run dev`
Test: Open graph → click a node → neighborhood stays dimmed → hover another node → temporary override → move mouse away → snap back to selected → click empty space → clears

- [ ] **Step 6: Commit**

```bash
git add src/renderer/src/panels/graph/GraphPanel.tsx
git commit -m "feat: wire neighborhood pinning fallback into GraphPanel and LabelLayer"
```

---

## Task 3: Add `vault:emerge-ghost` IPC Channel

**Files:**
- Modify: `src/shared/ipc-channels.ts`
- Modify: `src/preload/index.ts`

- [ ] **Step 1: Add channel type to IPC contract**

In `src/shared/ipc-channels.ts`, add after the `vault:update-system-artifact` block (~line 62):

```typescript
  'vault:emerge-ghost': {
    request: {
      ghostId: string
      ghostTitle: string
      referencePaths: readonly string[]
      vaultPath: string
    }
    response: {
      filePath: string
      folderCreated: boolean
      folderPath: string
    }
  }
```

- [ ] **Step 2: Expose in preload**

In `src/preload/index.ts`, add to the `vault` namespace object (~after line 71):

```typescript
    emergeGhost: (ghostId: string, ghostTitle: string, referencePaths: readonly string[], vaultPath: string) =>
      typedInvoke('vault:emerge-ghost', { ghostId, ghostTitle, referencePaths, vaultPath }),
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit -p tsconfig.node.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/shared/ipc-channels.ts src/preload/index.ts
git commit -m "feat: add vault:emerge-ghost IPC channel and preload bridge"
```

---

## Task 4: Export `callClaude` and `extractJsonFromResponse`

**Files:**
- Modify: `src/main/services/agent-action-runner.ts`

These functions are already exported but let's verify they're importable from the new handler.

- [ ] **Step 1: Verify exports**

Check that `callClaude`, `extractJsonFromResponse`, and `CallClaudeFn` are already exported from `agent-action-runner.ts`. They are (lines 59, 371, 373). No code change needed.

- [ ] **Step 2: Commit** (skip — no changes)

---

## Task 5: Ghost Emergence Handler

**Files:**
- Create: `src/main/ipc/ghost-emerge.ts`
- Modify: `src/main/index.ts`
- Test: `tests/main/ghost-emerge.test.ts`

- [ ] **Step 1: Write the failing test for prompt building**

Create `tests/main/ghost-emerge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildEmergePrompt, parseEmergeResponse } from '../../src/main/ipc/ghost-emerge'

describe('buildEmergePrompt', () => {
  it('builds prompt with truncated reference bodies', () => {
    const refs = [
      { title: 'Note A', tags: ['philosophy'], body: 'x'.repeat(600) },
      { title: 'Note B', tags: ['coding'], body: 'Short body' }
    ]
    const prompt = buildEmergePrompt('VIBE CODING', refs)

    expect(prompt).toContain('VIBE CODING')
    expect(prompt).toContain('Note A')
    expect(prompt).toContain('Note B')
    // First ref body should be truncated to 500 chars
    expect(prompt).not.toContain('x'.repeat(600))
    expect(prompt).toContain('x'.repeat(500))
    // Second ref body should be intact
    expect(prompt).toContain('Short body')
  })
})

describe('parseEmergeResponse', () => {
  it('parses valid JSON response', () => {
    const raw = JSON.stringify({
      tags: ['philosophy', 'coding'],
      origin: 'emerge',
      body: '# VIBE CODING\n\nSynthesized content.'
    })

    const result = parseEmergeResponse(raw)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tags).toEqual(['philosophy', 'coding'])
      expect(result.value.origin).toBe('emerge')
      expect(result.value.body).toContain('Synthesized content.')
    }
  })

  it('parses JSON wrapped in code fence', () => {
    const raw = '```json\n{"tags": ["test"], "origin": "emerge", "body": "Content"}\n```'
    const result = parseEmergeResponse(raw)
    expect(result.ok).toBe(true)
  })

  it('rejects response missing required fields', () => {
    const raw = JSON.stringify({ tags: ['test'] })
    const result = parseEmergeResponse(raw)
    expect(result.ok).toBe(false)
  })

  it('rejects non-JSON response', () => {
    const result = parseEmergeResponse('I cannot help with that.')
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/main/ghost-emerge.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the handler**

Create `src/main/ipc/ghost-emerge.ts`:

```typescript
// @vitest-environment node
import { existsSync, mkdirSync, openSync, writeSync, closeSync, statSync, constants } from 'fs'
import { join, dirname } from 'path'
import { typedHandle } from '../typed-ipc'
import { FileService } from '../services/file-service'
import { callClaude, extractJsonFromResponse } from '../services/agent-action-runner'
import { serializeArtifact } from '@shared/engine/parser'
import { inferFolder } from '@shared/engine/ghost-index'
import type { Artifact } from '@shared/types'
import type { CallClaudeFn } from '../services/agent-action-runner'
import type { Result } from '@shared/engine/types'

const fileService = new FileService()
const MAX_BODY_LENGTH = 500

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

interface ReferenceNote {
  readonly title: string
  readonly tags: readonly string[]
  readonly body: string
}

export function buildEmergePrompt(ghostTitle: string, refs: readonly ReferenceNote[]): string {
  const refSection = refs
    .map((r, i) => {
      const truncated =
        r.body.length > MAX_BODY_LENGTH ? r.body.slice(0, MAX_BODY_LENGTH) + '...' : r.body
      return `### Reference ${i + 1}: ${r.title}\nTags: ${r.tags.join(', ') || 'none'}\n\n${truncated}`
    })
    .join('\n\n')

  return `You are a knowledge synthesizer for a personal knowledge vault.

## Task
Create a unified note for the concept "${ghostTitle}" by synthesizing insights from the ${refs.length} notes that reference it.

## Reference Notes

${refSection}

## Instructions
1. Synthesize the key ideas about "${ghostTitle}" across all references into a cohesive note
2. Generate relevant tags based on the content
3. Write in the same voice and style as the reference notes

Respond ONLY with a JSON object. Do not add any prose before or after.

{"tags": ["string"], "origin": "emerge", "body": "string — markdown body content"}`
}

// ---------------------------------------------------------------------------
// Response Parser
// ---------------------------------------------------------------------------

interface EmergeResult {
  readonly tags: string[]
  readonly origin: string
  readonly body: string
}

export function parseEmergeResponse(raw: string): Result<EmergeResult> {
  try {
    const parsed = extractJsonFromResponse(raw)
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      !Array.isArray((parsed as Record<string, unknown>).tags) ||
      typeof (parsed as Record<string, unknown>).origin !== 'string' ||
      typeof (parsed as Record<string, unknown>).body !== 'string'
    ) {
      return { ok: false, error: 'Response missing required fields: tags, origin, body' }
    }
    const obj = parsed as Record<string, unknown>
    return {
      ok: true,
      value: {
        tags: (obj.tags as unknown[]).map(String),
        origin: String(obj.origin),
        body: String(obj.body)
      }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// Atomic File Write
// ---------------------------------------------------------------------------

function writeFileExclusive(filePath: string, content: string): Result<void> {
  try {
    const dir = dirname(filePath)
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }
    const fd = openSync(filePath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL)
    writeSync(fd, content, 0, 'utf8')
    closeSync(fd)
    return { ok: true, value: undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

// ---------------------------------------------------------------------------
// IPC Handler
// ---------------------------------------------------------------------------

export function registerGhostEmergeIpc(callClaudeFn: CallClaudeFn = callClaude): void {
  typedHandle('vault:emerge-ghost', async (args) => {
    const { ghostId, ghostTitle, referencePaths, vaultPath } = args

    // 1. Read reference files and parse them
    const refs: ReferenceNote[] = []
    for (const refPath of referencePaths) {
      try {
        const content = await fileService.readFile(refPath)
        // Quick frontmatter parse to get title and tags
        const titleMatch = /^title:\s*(.+)$/m.exec(content)
        const tagsMatch = content.match(/^tags:\n((?:\s+-\s+.+\n?)*)/m)
        const title = titleMatch?.[1]?.trim() ?? refPath.split('/').pop()?.replace('.md', '') ?? ghostId
        const tags = tagsMatch?.[1]
          ?.split('\n')
          .map((l) => l.replace(/^\s+-\s+/, '').trim())
          .filter(Boolean) ?? []
        // Body is everything after the closing ---
        const bodyMatch = /^---\n[\s\S]*?\n---\n([\s\S]*)$/m.exec(content)
        const body = bodyMatch?.[1]?.trim() ?? content
        refs.push({ title, tags, body })
      } catch {
        // Skip unreadable files
      }
    }

    // 2. Determine folder
    const folder = inferFolder(ghostId, referencePaths, vaultPath)
    const filePath = join(folder, `${ghostId}.md`)
    const folderCreated = !existsSync(folder) || folder === vaultPath ? false : true

    // 3. Try Claude synthesis
    let emergeResult: EmergeResult | null = null
    if (refs.length > 0) {
      try {
        const prompt = buildEmergePrompt(ghostTitle, refs)
        const response = await callClaudeFn(prompt)
        const parsed = parseEmergeResponse(response)
        if (parsed.ok) {
          emergeResult = parsed.value
        }
      } catch {
        // Fall through to empty note
      }
    }

    // 4. Build artifact
    const sourceIds = referencePaths
      .map((p) => p.split('/').pop()?.replace('.md', '') ?? '')
      .filter(Boolean)

    const artifact: Artifact = {
      id: ghostId,
      title: ghostTitle,
      type: 'note',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0],
      signal: 'untested',
      tags: emergeResult?.tags ?? [],
      connections: sourceIds,
      clusters_with: [],
      tensions_with: [],
      appears_in: [],
      related: [],
      concepts: [],
      bodyLinks: [],
      body: emergeResult?.body ?? '',
      frontmatter: emergeResult ? { origin: emergeResult.origin } : {}
    }

    const content = serializeArtifact(artifact)

    // 5. Atomic write
    const writeResult = writeFileExclusive(filePath, content)
    if (!writeResult.ok) {
      throw new Error(`Failed to write ghost note: ${writeResult.error}`)
    }

    return {
      filePath,
      folderCreated: folderCreated && !existsSync(folder),
      folderPath: folder
    }
  })
}
```

- [ ] **Step 4: Register in main process**

In `src/main/index.ts`, add the import and call:

```typescript
import { registerGhostEmergeIpc } from './ipc/ghost-emerge'
```

Add the registration call alongside the other `register*Ipc()` calls:

```typescript
registerGhostEmergeIpc()
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/main/ghost-emerge.test.ts`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc/ghost-emerge.ts src/main/index.ts tests/main/ghost-emerge.test.ts
git commit -m "feat: add ghost emergence handler with Claude CLI synthesis"
```

---

## Task 6: `useGhostEmerge` Hook

**Files:**
- Create: `src/renderer/src/hooks/useGhostEmerge.ts`

- [ ] **Step 1: Create the shared hook**

```typescript
import { useCallback, useState } from 'react'
import { useEditorStore } from '../store/editor-store'
import { useVaultStore } from '../store/vault-store'

interface UseGhostEmergeResult {
  readonly emerge: (
    ghostId: string,
    ghostTitle: string,
    referencePaths: readonly string[]
  ) => Promise<void>
  readonly isEmerging: boolean
}

export function useGhostEmerge(): UseGhostEmergeResult {
  const [isEmerging, setIsEmerging] = useState(false)
  const setActiveNote = useEditorStore((s) => s.setActiveNote)

  const emerge = useCallback(
    async (ghostId: string, ghostTitle: string, referencePaths: readonly string[]) => {
      const vaultPath = useVaultStore.getState().vaultPath
      if (!vaultPath || isEmerging) return

      setIsEmerging(true)
      try {
        const result = await window.api.vault.emergeGhost(
          ghostId,
          ghostTitle,
          referencePaths,
          vaultPath
        )
        setActiveNote(result.filePath)
      } catch (err) {
        console.error('[useGhostEmerge] emergence failed:', err)
      } finally {
        setIsEmerging(false)
      }
    },
    [isEmerging, setActiveNote]
  )

  return { emerge, isEmerging }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/src/hooks/useGhostEmerge.ts
git commit -m "feat: add useGhostEmerge shared hook"
```

---

## Task 7: Wire GhostPanel + GraphDetailDrawer to `useGhostEmerge`

**Files:**
- Modify: `src/renderer/src/panels/ghosts/GhostPanel.tsx:120-181`
- Modify: `src/renderer/src/panels/graph/GraphDetailDrawer.tsx`

- [ ] **Step 1: Update GhostPanel's `GhostCard` component**

In `GhostPanel.tsx`, in the `GhostCard` component:

1. Remove the `creating` state and the entire `handleCreate` callback (lines 123-181)
2. Add the hook import and usage:

```typescript
import { useGhostEmerge } from '../../hooks/useGhostEmerge'
```

Inside `GhostCard`:

```typescript
  const { emerge, isEmerging } = useGhostEmerge()

  const handleCreate = useCallback(async () => {
    const refPaths = artifacts
      .filter((a) => ghost.references.some((r) => r.fileTitle === a.title))
      .map((a) => {
        const pathById = useVaultStore.getState().artifactPathById
        return pathById[a.id] ?? ''
      })
      .filter(Boolean)

    await emerge(ghost.id, ghost.id, refPaths)
  }, [ghost, artifacts, emerge])
```

Replace any references to `creating` with `isEmerging` in the JSX (loading states, disabled props).

- [ ] **Step 2: Update GraphDetailDrawer**

In `GraphDetailDrawer.tsx`, apply the same pattern: replace the inline `handleCreate` with `useGhostEmerge`. Import the hook, call `emerge(ghost.id, ghost.id, refPaths)` with the same reference path logic.

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/panels/ghosts/GhostPanel.tsx src/renderer/src/panels/graph/GraphDetailDrawer.tsx
git commit -m "feat: wire ghost panels to useGhostEmerge hook"
```

---

## Task 8: Sidebar Origin Color Coding

**Files:**
- Modify: `src/renderer/src/panels/sidebar/FileTree.tsx`
- Modify: `src/renderer/src/panels/sidebar/Sidebar.tsx`
- Modify: `src/renderer/src/App.tsx`

- [ ] **Step 1: Add `artifactOrigins` prop to FileTree**

In `FileTree.tsx`, update the `FileTreeProps` interface (~line 90):

```typescript
interface FileTreeProps {
  nodes: FlatTreeNode[]
  activeFilePath: string | null
  collapsedPaths: Set<string>
  sortMode?: TreeSortMode
  artifactTypes?: Map<string, ArtifactType>
  artifactOrigins?: Map<string, string>
  onCanvasPaths?: ReadonlySet<string>
  canvasConnectionCounts?: ReadonlyMap<string, number>
  onFileSelect: (path: string) => void
  onFileDoubleClick?: (path: string) => void
  onToggleDirectory: (path: string) => void
  onContextMenu?: (e: React.MouseEvent, path: string, isDirectory: boolean) => void
  renamingPath?: string | null
  onRenameConfirm?: (newName: string) => void
  onRenameCancel?: () => void
}
```

- [ ] **Step 2: Update `FileIcon` to show green for origin files**

Replace the `FileIcon` component:

```typescript
const ORIGIN_FILE_COLOR = '#4ade80'

function FileIcon({
  filename,
  origin
}: {
  readonly filename: string
  readonly origin?: string
}) {
  const kind = getFileIconKind(filename)
  const Icon = ICON_COMPONENT[kind]
  const color = origin ? ORIGIN_FILE_COLOR : ICON_COLORS[kind]
  return <Icon size={14} color={color} weight="duotone" />
}
```

- [ ] **Step 3: Update `FolderIcon` to show blue for origin folders**

Replace the `FolderIcon` component:

```typescript
const ORIGIN_FOLDER_COLOR = '#60a5fa'

function FolderIcon({ isOriginFolder }: { readonly isOriginFolder?: boolean }) {
  const color = isOriginFolder ? ORIGIN_FOLDER_COLOR : '#a1a1aa'
  return <FolderSimple size={14} color={color} weight="duotone" />
}
```

- [ ] **Step 4: Thread `artifactOrigins` through FileTree rendering**

In the `FileTree` component function, destructure the new prop:

```typescript
  artifactOrigins,
```

Pass `origin` to `FileIcon` in the file row render (~line 326):

```typescript
  <FileIcon filename={node.name} origin={artifactOrigins?.get(node.path)} />
```

For `FolderIcon`, compute whether all children have origins. In the directory row render, pass:

```typescript
  <FolderIcon isOriginFolder={isOriginFolder(node.path, artifactOrigins)} />
```

Add the helper function inside `FileTree.tsx`:

```typescript
function isOriginFolder(
  folderPath: string,
  origins: Map<string, string> | undefined,
  nodes: FlatTreeNode[]
): boolean {
  if (!origins || origins.size === 0) return false
  const children = nodes.filter(
    (n) => !n.isDirectory && n.parentPath === folderPath
  )
  return children.length > 0 && children.every((c) => origins.has(c.path))
}
```

- [ ] **Step 5: Build `artifactOrigins` map in App.tsx**

In `App.tsx`, add a `useMemo` alongside the existing `artifactTypes` memo (~line 231):

```typescript
  const artifactOrigins = useMemo(() => {
    const map = new Map<string, string>()
    const artifactById = new Map(artifacts.map((a) => [a.id, a]))
    for (const [filePath, artifactId] of Object.entries(fileToId)) {
      const artifact = artifactById.get(artifactId)
      const origin = artifact?.frontmatter?.origin
      if (typeof origin === 'string') {
        map.set(filePath, origin)
      }
    }
    return map
  }, [artifacts, fileToId])
```

Pass it through `Sidebar` to `FileTree`:

```typescript
  artifactOrigins={artifactOrigins}
```

- [ ] **Step 6: Thread through Sidebar.tsx**

Add `artifactOrigins` to the `Sidebar` props interface and pass through to `<FileTree>`.

- [ ] **Step 7: Verify compilation**

Run: `npx tsc --noEmit -p tsconfig.web.json`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add src/renderer/src/panels/sidebar/FileTree.tsx src/renderer/src/panels/sidebar/Sidebar.tsx src/renderer/src/App.tsx
git commit -m "feat: add blue/green origin color coding to sidebar file tree"
```

---

## Task 9: Integration Test + Quality Gate

**Files:**
- Create: `tests/main/ghost-emerge-integration.test.ts`

- [ ] **Step 1: Write integration test with mocked Claude**

```typescript
// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { buildEmergePrompt, parseEmergeResponse } from '../../src/main/ipc/ghost-emerge'

describe('ghost emergence integration', () => {
  it('truncates reference bodies to 500 chars', () => {
    const refs = [
      { title: 'Long Note', tags: ['test'], body: 'a'.repeat(1000) }
    ]
    const prompt = buildEmergePrompt('Test Ghost', refs)
    // Should contain exactly 500 a's followed by ...
    expect(prompt).toContain('a'.repeat(500) + '...')
    expect(prompt).not.toContain('a'.repeat(501))
  })

  it('handles Claude returning valid JSON', () => {
    const response = JSON.stringify({
      tags: ['philosophy'],
      origin: 'emerge',
      body: '# Synthesized\n\nContent here.'
    })
    const result = parseEmergeResponse(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.body).toBe('# Synthesized\n\nContent here.')
    }
  })

  it('handles Claude returning wrapped JSON', () => {
    const response = 'Here is your note:\n```json\n{"tags":[],"origin":"emerge","body":"Test"}\n```'
    const result = parseEmergeResponse(response)
    expect(result.ok).toBe(true)
  })

  it('handles Claude returning garbage', () => {
    const result = parseEmergeResponse('Sorry, I cannot do that.')
    expect(result.ok).toBe(false)
  })

  it('handles empty tags array', () => {
    const response = JSON.stringify({ tags: [], origin: 'emerge', body: 'Content' })
    const result = parseEmergeResponse(response)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.tags).toEqual([])
    }
  })
})
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run tests/main/ghost-emerge.test.ts tests/main/ghost-emerge-integration.test.ts tests/engine/parser.test.ts`
Expected: All PASS

- [ ] **Step 3: Run quality gate**

Run: `npm run check`
Expected: Zero lint errors, zero type errors, all tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/main/ghost-emerge-integration.test.ts
git commit -m "test: add ghost emergence integration tests"
```
