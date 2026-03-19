import { getArtifactColor } from '@renderer/design/tokens'
import type { ArtifactType, RelationshipKind } from '@shared/types'
import type { GraphThemeColors } from './graph-types'

/** Convert a hex color string to a PixiJS-compatible integer. */
export function hexToPixi(hex: string): number {
  let h = hex.replace('#', '')
  if (h.length === 3) {
    h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  }
  return parseInt(h, 16)
}

/** Convert CSS color string (hex or rgb()) to PixiJS integer. */
export function cssColorToPixi(css: string): number {
  if (css.startsWith('#')) return hexToPixi(css)
  const match = css.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (match) {
    return (parseInt(match[1]) << 16) | (parseInt(match[2]) << 8) | parseInt(match[3])
  }
  return 0x94a3b8 // fallback: slate
}

/** Get the PixiJS tint color for an artifact type. */
export function nodeColorForType(type: ArtifactType): number {
  return hexToPixi(getArtifactColor(type))
}

// Semantic relationship colors (from tokens.ts)
const CLUSTER_COLOR = 0x34d399
const TENSION_COLOR = 0xf59e0b
const DEFAULT_EDGE_COLOR = 0x475569
const COOCCURRENCE_COLOR = 0x334155
const APPEARS_IN_COLOR = 0x64748b

/** Get the PixiJS color for an edge based on its relationship kind. */
export function buildEdgeColor(kind: RelationshipKind): number {
  switch (kind) {
    case 'cluster':
      return CLUSTER_COLOR
    case 'tension':
      return TENSION_COLOR
    case 'connection':
      return DEFAULT_EDGE_COLOR
    case 'appears_in':
      return APPEARS_IN_COLOR
    case 'co-occurrence':
      return COOCCURRENCE_COLOR
  }
}

/** Edge opacity by kind (explicit relationships more visible than inferred). */
export function edgeOpacity(kind: RelationshipKind): number {
  switch (kind) {
    case 'connection':
    case 'cluster':
    case 'tension':
      return 0.6
    case 'appears_in':
      return 0.4
    case 'co-occurrence':
      return 0.2
  }
}

/**
 * Read resolved CSS colors from the DOM.
 * Call once on mount and on theme change.
 */
export function readThemeColors(): GraphThemeColors {
  const root = document.documentElement
  const style = getComputedStyle(root)
  const bg = style.getPropertyValue('--color-bg-base').trim()
  const text = style.getPropertyValue('--color-text-primary').trim()
  const textDim = style.getPropertyValue('--color-text-muted').trim()
  const accent = style.getPropertyValue('--color-accent-default').trim()

  return {
    background: bg ? cssColorToPixi(bg) : 0x141414,
    nodeFill: 0x94a3b8,
    nodeFillFocused: accent ? cssColorToPixi(accent) : 0x00e5bf,
    nodeFillGhost: 0x334155,
    nodeStroke: 0x475569,
    edge: DEFAULT_EDGE_COLOR,
    edgeHighlight: accent ? cssColorToPixi(accent) : 0x00e5bf,
    labelText: text ? cssColorToPixi(text) : 0xe2e8f0,
    labelTextDim: textDim ? cssColorToPixi(textDim) : 0x64748b
  }
}
