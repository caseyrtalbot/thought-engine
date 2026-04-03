import type { FlatTreeNode } from './buildFileTree'

export type ArtifactOrigin = 'human' | 'source' | 'agent'

const ORIGIN_COLORS: Record<ArtifactOrigin, string | undefined> = {
  source: '#60a5fa', // blue — raw ingested material
  agent: '#4ade80', // green — LLM-produced content
  human: undefined // default (no override)
}

/** Returns a color hex for the given origin, or undefined for human/missing. */
export function getOriginColor(origin: ArtifactOrigin | undefined): string | undefined {
  if (!origin) return undefined
  return ORIGIN_COLORS[origin]
}

/**
 * Determines the dominant non-human origin for a folder's children.
 * Returns the origin color if all file children share the same non-human origin,
 * otherwise returns undefined (default folder color).
 */
export function getFolderOriginColor(
  folderPath: string,
  origins: Map<string, ArtifactOrigin> | undefined,
  nodes: FlatTreeNode[]
): string | undefined {
  if (!origins || origins.size === 0) return undefined
  const children = nodes.filter((n) => !n.isDirectory && n.parentPath === folderPath)
  if (children.length === 0) return undefined

  let sharedOrigin: ArtifactOrigin | undefined
  for (const child of children) {
    const childOrigin = origins.get(child.path)
    if (!childOrigin || childOrigin === 'human') return undefined
    if (sharedOrigin === undefined) {
      sharedOrigin = childOrigin
    } else if (sharedOrigin !== childOrigin) {
      return undefined
    }
  }

  return getOriginColor(sharedOrigin)
}
