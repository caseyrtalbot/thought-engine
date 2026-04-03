import { useMemo } from 'react'
import { useVaultStore } from '../../store/vault-store'
import { useCanvasStore } from '../../store/canvas-store'
import { colors } from '../../design/tokens'
import type { AgentActionName } from '@shared/agent-action-types'

interface CanvasActionBarProps {
  readonly onTriggerAction: (action: AgentActionName) => void
  readonly librarianRunning: boolean
}

const actionLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '11px',
  letterSpacing: '0.06em',
  color: colors.text.muted,
  cursor: 'pointer',
  padding: '4px 0',
  transition: 'color 150ms ease-out',
  background: 'none',
  border: 'none',
  outline: 'none',
  position: 'relative' as const
}

export function CanvasActionBar({
  onTriggerAction,
  librarianRunning
}: CanvasActionBarProps): React.ReactElement | null {
  const artifacts = useVaultStore((s) => s.artifacts)
  const graph = useVaultStore((s) => s.graph)
  const selectedNodeIds = useCanvasStore((s) => s.selectedNodeIds)

  const unprocessedSourceCount = useMemo(() => {
    if (!graph) return 0

    const sourceArtifactIds = new Set<string>()
    for (const artifact of artifacts) {
      if (artifact.origin === 'source') sourceArtifactIds.add(artifact.id)
    }

    const compiledSourceIds = new Set<string>()
    for (const edge of graph.edges) {
      if (edge.kind === 'derived_from' && sourceArtifactIds.has(edge.target)) {
        compiledSourceIds.add(edge.target)
      }
    }

    return sourceArtifactIds.size - compiledSourceIds.size
  }, [artifacts, graph])

  const hasAnyContent = artifacts.length > 0
  const hasSelection = selectedNodeIds.size > 0
  const showCompile = unprocessedSourceCount > 0 || hasSelection

  if (!hasAnyContent && !showCompile) return null

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        zIndex: 30,
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem'
      }}
    >
      {showCompile && (
        <button
          type="button"
          style={actionLabelStyle}
          onClick={() => onTriggerAction('compile')}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.text.primary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.text.muted
          }}
        >
          Compile
          {unprocessedSourceCount > 0 && (
            <span
              style={{
                color: 'var(--color-accent-default)',
                marginLeft: '0.35rem',
                fontSize: '10px'
              }}
            >
              {unprocessedSourceCount}
            </span>
          )}
        </button>
      )}

      {hasAnyContent && (
        <button
          type="button"
          style={actionLabelStyle}
          onClick={() => onTriggerAction('challenge')}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = colors.text.primary
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = colors.text.muted
          }}
        >
          Think
        </button>
      )}

      {hasAnyContent && (
        <button
          type="button"
          style={{
            ...actionLabelStyle,
            ...(librarianRunning ? { color: 'var(--color-accent-default)' } : {})
          }}
          onClick={() => onTriggerAction('librarian')}
          onMouseEnter={(e) => {
            if (!librarianRunning) e.currentTarget.style.color = colors.text.primary
          }}
          onMouseLeave={(e) => {
            if (!librarianRunning) e.currentTarget.style.color = colors.text.muted
          }}
        >
          Librarian
          {librarianRunning && (
            <span
              style={{
                display: 'inline-block',
                width: '100%',
                height: '1px',
                background: 'var(--color-accent-default)',
                position: 'absolute' as const,
                bottom: 0,
                left: 0,
                animation: 'te-pulse 2s ease-in-out infinite'
              }}
            />
          )}
        </button>
      )}
    </div>
  )
}
