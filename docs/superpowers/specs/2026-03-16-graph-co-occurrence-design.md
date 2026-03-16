# Graph Co-occurrence Redesign

## Problem

The knowledge graph is dominated by tag hub nodes that create a dense rectangular grid layout. Tags are the only edge type in the vault, so disabling them removes all structure. The visual rendering (3px edges, uniform opacity, straight lines) creates noise rather than insight.

## Design

### Data Model: Unified Co-occurrence Edges

Replace the current tag-hub and concept-ghost node architecture with direct file-to-file co-occurrence edges.

**Term extraction per file:**
- Collect `Set(tags.map(lowercase) + concepts.map(lowercase))`
- This is the file's "term set"

**Global term frequency:**
- `termFreq: Map<string, number>` counting how many files contain each term

**Edge creation (for each pair of files sharing at least one term):**
- `weight = sum(1 / log2(fileCount))` for each shared term
- Skip terms where `fileCount >= 20` (too common to be meaningful)
- Skip edges where `weight < minEdgeWeight` (default 0.3, user-tunable)
- Edge kind: `'co-occurrence'`

**What gets removed:**
- Tag nodes (`tag:strategy` etc.)
- Ghost nodes (`ghost:strategy` etc.)
- `'tag'` and `'concept'` entries from `RELATIONSHIP_KINDS`

**What remains unchanged:**
- Frontmatter edges: `connection`, `cluster`, `tension`, `appears_in`
- Artifact parsing, concept extraction, all non-graph systems

### Visual: Edge Rendering

- **Curved**: Quadratic bezier paths (control point offset perpendicular to midpoint)
- **Opacity**: Mapped to normalized edge weight (strong connections ~0.25 alpha, weak ~0.06)
- **Thickness**: 0.5-1.2px range based on weight (never the old 3px)
- **Color**: Soft lavender `rgba(180, 170, 210, alpha)` in idle mode
- **Highlight mode**: Connected edges brighten to off-white, others invisible (unchanged behavior)

### Visual: Node Rendering

- **All circles**: No more diamond (tag) or square (attachment) shapes since only file nodes exist
- **Size**: `2 + sqrt(connectionCount)` * multiplier (unchanged formula)
- **Outer ring**: Nodes with connectionCount > 8 get a subtle outer stroke ring
- **Color palette**: Unchanged (gray default, purple visited, group rule overrides)

### Physics Defaults

| Parameter | Old | New |
|-----------|-----|-----|
| Repel force | -120 | -200 |
| Link distance | 50 | 80 |
| Center force | 0.02 | 0.03 |
| Link force | 0.7 | 0.5 |
| Link thickness slider max | 3.0 | 2.0 |

### Settings Panel

**Remove:** Tags toggle, Attachments toggle
**Keep:** Global/Local, Search, Existing Only, Orphans, all Display + Forces
**Add:** "Min edge weight" slider (0.1 - 1.0, default 0.3)

### RELATIONSHIP_KINDS Update

```typescript
['connection', 'cluster', 'tension', 'appears_in', 'co-occurrence'] as const
```

## Files Changed

| File | Action |
|------|--------|
| `src/renderer/src/engine/graph-builder.ts` | Rewrite: co-occurrence edges, no ghost/tag nodes |
| `src/shared/types.ts` | Update RELATIONSHIP_KINDS |
| `src/renderer/src/panels/graph/GraphRenderer.ts` | Curved edges, weight-mapped opacity, remove diamond/square |
| `src/renderer/src/panels/graph/graph-config.ts` | New physics defaults, LINK_STRENGTH update |
| `src/renderer/src/panels/graph/graph-model.ts` | Remove tag/attachment filter logic |
| `src/renderer/src/panels/graph/GraphSettingsPanel.tsx` | Remove toggles, add min-weight slider |
| `src/renderer/src/store/graph-settings-store.ts` | Remove showTags/showAttachments, add minEdgeWeight |
| `src/renderer/src/panels/graph/GraphMinimap.tsx` | Remove diamond rendering |
| `tests/engine/graph-builder.test.ts` | Rewrite for co-occurrence logic |
| `tests/graph/graph-model.test.ts` | Update for removed filters |

## Edge Cases

- **File with no tags and no concepts**: Zero terms, no co-occurrence edges. Appears as orphan (filterable).
- **Two files sharing only high-frequency terms (>20 files)**: All terms capped, no edge created. Correct behavior: they aren't meaningfully related.
- **Same word as tag and concept in same file**: Deduplicated in the Set. One entry.
- **Single file with rare tag**: No co-occurrence possible (needs 2+ files). Node appears unconnected.
- **Frontmatter + co-occurrence for same pair**: Both edges created (different kinds). `hasExplicitEdge` check prevents co-occurrence if frontmatter edge already exists.
