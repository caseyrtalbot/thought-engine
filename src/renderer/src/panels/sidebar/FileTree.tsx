import { colors, ARTIFACT_COLORS } from '../../design/tokens'
import type { ArtifactType } from '@shared/types'

export interface FileTreeItem {
  path: string
  filename: string
  title: string
  type?: ArtifactType
  modified: string
  depth: number
  isDirectory: boolean
  isExpanded?: boolean
  children?: FileTreeItem[]
}

interface FileTreeProps {
  items: FileTreeItem[]
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  onToggleDirectory: (path: string) => void
}

export function FileTree({
  items,
  activeFilePath,
  onFileSelect,
  onToggleDirectory
}: FileTreeProps) {
  return (
    <div className="text-sm select-none">
      {items.map((item) => (
        <FileTreeNode
          key={item.path}
          item={item}
          activeFilePath={activeFilePath}
          onFileSelect={onFileSelect}
          onToggleDirectory={onToggleDirectory}
        />
      ))}
    </div>
  )
}

function FileTreeNode({
  item,
  activeFilePath,
  onFileSelect,
  onToggleDirectory
}: {
  item: FileTreeItem
  activeFilePath: string | null
  onFileSelect: (path: string) => void
  onToggleDirectory: (path: string) => void
}) {
  const isActive = item.path === activeFilePath
  const paddingLeft = 12 + item.depth * 16

  if (item.isDirectory) {
    return (
      <div>
        <div
          onClick={() => onToggleDirectory(item.path)}
          className="flex items-center py-0.5 cursor-pointer hover:bg-[#1A1A1D] transition-colors"
          style={{ paddingLeft, color: colors.text.secondary }}
        >
          <span className="mr-1 text-xs">{item.isExpanded ? '\u25BE' : '\u25B8'}</span>
          <span className="truncate">{item.title}</span>
          {item.children && (
            <span className="ml-auto mr-2 text-xs" style={{ color: colors.text.muted }}>
              {item.children.length}
            </span>
          )}
        </div>
        {item.isExpanded &&
          item.children?.map((child) => (
            <FileTreeNode
              key={child.path}
              item={child}
              activeFilePath={activeFilePath}
              onFileSelect={onFileSelect}
              onToggleDirectory={onToggleDirectory}
            />
          ))}
      </div>
    )
  }

  return (
    <div
      onClick={() => onFileSelect(item.path)}
      className="flex items-center py-0.5 cursor-pointer hover:bg-[#1A1A1D] transition-colors"
      style={{
        paddingLeft,
        backgroundColor: isActive ? colors.accent.muted : undefined,
        color: isActive ? colors.text.primary : colors.text.secondary
      }}
    >
      {item.type && (
        <span
          className="w-2 h-2 rounded-full mr-2 flex-shrink-0"
          style={{ backgroundColor: ARTIFACT_COLORS[item.type] }}
        />
      )}
      <span className="truncate flex-1">{item.title}</span>
      <span className="text-xs ml-2 mr-2 flex-shrink-0" style={{ color: colors.text.muted }}>
        {item.modified}
      </span>
    </div>
  )
}
