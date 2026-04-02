import type { FlatTreeNode } from './buildFileTree'

export const ORIGIN_FILE_COLOR = '#4ade80'
export const ORIGIN_FOLDER_COLOR = '#60a5fa'

export function isFolderOrigin(
  folderPath: string,
  origins: Map<string, string> | undefined,
  nodes: FlatTreeNode[]
): boolean {
  if (!origins || origins.size === 0) return false
  const children = nodes.filter((n) => !n.isDirectory && n.parentPath === folderPath)
  return children.length > 0 && children.every((c) => origins.has(c.path))
}
