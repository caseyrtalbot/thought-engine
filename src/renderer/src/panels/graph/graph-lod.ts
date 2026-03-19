import type { LodLevel } from './graph-types'

const MACRO_THRESHOLD = 0.15
const MICRO_THRESHOLD = 1.5

/** Determine LOD tier from current zoom scale. */
export function getGraphLod(scale: number): LodLevel {
  if (scale < MACRO_THRESHOLD) return 'macro'
  if (scale >= MICRO_THRESHOLD) return 'micro'
  return 'meso'
}

/** Whether to show a label for this node at the current LOD.
 *  At meso, labels only appear for hovered/neighbor nodes (passed via isActive).
 *  At micro (zoomed in), all labels appear. */
export function shouldShowLabel(lod: LodLevel, isActive: boolean): boolean {
  if (lod === 'macro') return false
  if (lod === 'micro') return true
  // meso: only show labels for hovered node and its neighbors
  return isActive
}

/** Base node radius scaled by connection count. Min 6, max 28. */
export function nodeRadius(connectionCount: number): number {
  const base = 7
  const scaled = base + Math.sqrt(connectionCount) * 3
  return Math.min(Math.max(scaled, 6), 28)
}

/** Edge line width scaled by zoom (thinner when zoomed out). */
export function edgeWidth(scale: number): number {
  const base = 1.5
  return Math.max(1.0, base * Math.sqrt(Math.max(scale, 0.1)))
}
