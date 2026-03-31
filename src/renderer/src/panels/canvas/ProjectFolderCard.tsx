import type { CanvasNode } from '@shared/canvas-types'
import { colors } from '../../design/tokens'

interface ProjectFolderCardProps {
  readonly node: CanvasNode
}

export default function ProjectFolderCard({ node }: ProjectFolderCardProps) {
  const { relativePath, childCount, collapsed } = node.metadata as {
    relativePath?: string
    childCount?: number
    collapsed?: boolean
  }

  const folderName =
    relativePath === '.'
      ? ((node.metadata.rootPath as string)?.split('/').pop() ?? 'Root')
      : (relativePath ?? '').split('/').pop() || 'Folder'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '12px 16px',
        borderRadius: '8px',
        background: `color-mix(in oklch, ${colors.bg.elevated} 80%, transparent)`,
        backdropFilter: 'blur(8px)',
        border: `1px solid ${colors.border.subtle}`,
        overflow: 'hidden',
        userSelect: 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span data-testid="folder-icon" style={{ fontSize: '16px', opacity: 0.7 }}>
          {collapsed ? '\u{1F4C1}' : '\u{1F4C2}'}
        </span>
        <span
          data-testid="folder-name"
          style={{
            fontWeight: 600,
            fontSize: '13px',
            color: colors.text.primary,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            flex: 1
          }}
        >
          {folderName}
        </span>
        {typeof childCount === 'number' && childCount > 0 && (
          <span
            data-testid="folder-child-count"
            style={{
              fontSize: '11px',
              padding: '1px 6px',
              borderRadius: '10px',
              background: colors.bg.surface,
              color: colors.text.secondary,
              fontWeight: 500,
              flexShrink: 0
            }}
          >
            {childCount}
          </span>
        )}
      </div>
      {relativePath && relativePath !== '.' && (
        <div
          data-testid="folder-path"
          style={{
            fontSize: '11px',
            color: colors.text.muted,
            marginTop: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {relativePath}
        </div>
      )}
    </div>
  )
}
