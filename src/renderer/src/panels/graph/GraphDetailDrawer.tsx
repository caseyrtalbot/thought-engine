import { useState, useMemo } from 'react'
import { useVaultStore } from '@renderer/store/vault-store'
import { useGraphViewStore } from '@renderer/store/graph-view-store'
import { useEditorStore } from '@renderer/store/editor-store'
import { useViewStore } from '@renderer/store/view-store'
import { colors, floatingPanel, getArtifactColor, transitions } from '../../design/tokens'
import type { Artifact } from '@shared/types'

const DRAWER_WIDTH = 340
const SPRING_EASING = 'cubic-bezier(0.16, 1, 0.3, 1)'
const SLIDE_DURATION = '220ms'
const MAX_BODY_LINES = 6
const MAX_BODY_CHARS = 480

function BodyPreview({ body }: { body: string }) {
  if (!body.trim()) return null
  const truncated =
    body.length > MAX_BODY_CHARS ? body.slice(0, MAX_BODY_CHARS).trim() + '...' : body.trim()
  return (
    <p
      className="text-xs leading-relaxed"
      style={{
        color: colors.text.secondary,
        display: '-webkit-box',
        WebkitLineClamp: MAX_BODY_LINES,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden'
      }}
    >
      {truncated}
    </p>
  )
}

function BacklinksList({
  backlinks,
  onNavigate
}: {
  backlinks: readonly Artifact[]
  onNavigate: (id: string) => void
}) {
  if (backlinks.length === 0) return null
  return (
    <div>
      <div
        className="text-[10px] uppercase font-medium mb-1.5"
        style={{
          color: colors.text.muted,
          letterSpacing: '0.15em'
        }}
      >
        Backlinks
      </div>
      <div className="flex flex-col gap-0.5">
        {backlinks.slice(0, 8).map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onNavigate(a.id)}
            className="text-left text-xs truncate px-2 py-1 rounded interactive-hover"
            style={{ color: colors.text.secondary, transition: transitions.hover }}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full mr-1.5"
              style={{ backgroundColor: getArtifactColor(a.type), verticalAlign: 'middle' }}
            />
            {a.title}
          </button>
        ))}
        {backlinks.length > 8 && (
          <span className="text-[10px] px-2" style={{ color: colors.text.muted }}>
            +{backlinks.length - 8} more
          </span>
        )}
      </div>
    </div>
  )
}

export function GraphDetailDrawer() {
  const selectedNodeId = useGraphViewStore((s) => s.selectedNodeId)
  const setSelectedNode = useGraphViewStore((s) => s.setSelectedNode)
  const artifacts = useVaultStore((s) => s.artifacts)
  const artifactPathById = useVaultStore((s) => s.artifactPathById)
  const getBacklinks = useVaultStore((s) => s.getBacklinks)

  // "Sticky" ID: holds the last non-null selection so drawer content
  // persists during the exit slide animation
  const [displayId, setDisplayId] = useState<string | null>(null)
  if (selectedNodeId !== null && selectedNodeId !== displayId) {
    setDisplayId(selectedNodeId)
  }

  const isOpen = selectedNodeId !== null

  const { artifact, backlinks, filePath } = useMemo(() => {
    if (!displayId) return { artifact: null, backlinks: [] as Artifact[], filePath: null }
    const a = artifacts.find((x) => x.id === displayId) ?? null
    return {
      artifact: a,
      backlinks: a ? getBacklinks(displayId) : ([] as Artifact[]),
      filePath: artifactPathById[displayId] ?? null
    }
  }, [displayId, artifacts, artifactPathById, getBacklinks])

  const handleOpenInEditor = () => {
    if (!artifact || !filePath) return
    useEditorStore.getState().setActiveNote(artifact.id, filePath)
    useViewStore.getState().setContentView('editor')
  }

  const handleNavigateBacklink = (id: string) => {
    const path = artifactPathById[id]
    if (path) {
      useEditorStore.getState().setActiveNote(id, path)
      useViewStore.getState().setContentView('editor')
    }
  }

  return (
    <div
      className="absolute z-30 flex flex-col gap-4 overflow-y-auto"
      style={{
        top: 48,
        right: 12,
        bottom: 12,
        width: DRAWER_WIDTH,
        transform: isOpen ? 'translateX(0)' : `translateX(${DRAWER_WIDTH + 24}px)`,
        opacity: isOpen ? 1 : 0,
        transition: `transform ${SLIDE_DURATION} ${SPRING_EASING}, opacity ${SLIDE_DURATION} ${SPRING_EASING}`,
        backgroundColor: floatingPanel.glass.bg,
        backdropFilter: floatingPanel.glass.blur,
        WebkitBackdropFilter: floatingPanel.glass.blur,
        borderRadius: floatingPanel.borderRadius,
        boxShadow: floatingPanel.shadowCompact,
        border: `1px solid ${colors.border.default}`,
        padding: '16px',
        pointerEvents: isOpen ? 'auto' : 'none'
      }}
    >
      {artifact ? (
        <>
          {/* Header: title + type */}
          <div>
            <div className="flex items-start justify-between gap-2">
              <h3
                className="text-[15px] font-semibold leading-tight"
                style={{ color: colors.text.primary }}
              >
                {artifact.title}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedNode(null)}
                className="shrink-0 text-xs rounded p-1 interactive-hover"
                style={{ color: colors.text.muted }}
                title="Close drawer"
              >
                ×
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: getArtifactColor(artifact.type) }}
              />
              <span className="text-[11px]" style={{ color: colors.text.muted }}>
                {artifact.type}
              </span>
            </div>
          </div>

          {/* Tags */}
          {artifact.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {artifact.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[11px] px-2 py-0.5 rounded-full"
                  style={{
                    color: colors.text.muted,
                    backgroundColor: 'rgba(255, 255, 255, 0.04)'
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Open in editor */}
          {filePath && (
            <button
              type="button"
              onClick={handleOpenInEditor}
              className="text-xs self-start interactive-hover px-2 py-1 rounded"
              style={{
                color: colors.accent.default,
                transition: transitions.hover
              }}
            >
              Open in editor
            </button>
          )}

          {/* Body preview */}
          <BodyPreview body={artifact.body} />

          {/* Backlinks */}
          <BacklinksList backlinks={backlinks} onNavigate={handleNavigateBacklink} />
        </>
      ) : (
        <div className="text-xs" style={{ color: colors.text.muted }}>
          No file associated
        </div>
      )}
    </div>
  )
}
