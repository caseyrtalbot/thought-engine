import { useState, useMemo, useCallback } from 'react'
import { useVaultStore } from '../../store/vault-store'
import { useUiStore } from '../../store/ui-store'
import { useEditorStore } from '../../store/editor-store'
import { buildGhostIndex, inferFolder, type GhostEntry } from '../../engine/ghost-index'
import { serializeArtifact } from '../../engine/parser'
import { colors, typography } from '../../design/tokens'
import type { Artifact } from '@shared/types'

export function GhostPanel() {
  const graph = useVaultStore((s) => s.graph)
  const artifacts = useVaultStore((s) => s.artifacts)
  const vaultPath = useVaultStore((s) => s.vaultPath)
  const dismissedGhosts = useUiStore((s) => s.dismissedGhosts)
  const dismissGhost = useUiStore((s) => s.dismissGhost)

  const allGhosts = useMemo(() => buildGhostIndex(graph, artifacts), [graph, artifacts])

  const visibleGhosts = useMemo(
    () => allGhosts.filter((g) => !dismissedGhosts.includes(g.id)),
    [allGhosts, dismissedGhosts]
  )

  if (visibleGhosts.length === 0) {
    return <EmptyState hasDismissed={dismissedGhosts.length > 0} />
  }

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        padding: '16px',
        fontFamily: typography.fontFamily.body
      }}
    >
      <div className="text-xs mb-3" style={{ color: colors.text.muted, letterSpacing: '0.05em' }}>
        {visibleGhosts.length} UNRESOLVED REFERENCE{visibleGhosts.length !== 1 ? 'S' : ''}
      </div>
      <div className="flex flex-col gap-2">
        {visibleGhosts.map((ghost) => (
          <GhostCard
            key={ghost.id}
            ghost={ghost}
            vaultPath={vaultPath}
            artifacts={artifacts}
            onDismiss={() => dismissGhost(ghost.id)}
          />
        ))}
      </div>
    </div>
  )
}

function EmptyState({ hasDismissed }: { readonly hasDismissed: boolean }) {
  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-3"
      style={{ color: colors.text.muted }}
    >
      <svg
        width={32}
        height={32}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ opacity: 0.5 }}
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
      <div className="text-sm text-center" style={{ maxWidth: 200 }}>
        All references resolved.
        <br />
        Your vault is fully connected.
      </div>
      {hasDismissed && (
        <div className="text-xs mt-2" style={{ opacity: 0.5 }}>
          Some ghosts are dismissed
        </div>
      )}
    </div>
  )
}

function GhostCard({
  ghost,
  vaultPath,
  artifacts,
  onDismiss
}: {
  readonly ghost: GhostEntry
  readonly vaultPath: string | null
  readonly artifacts: readonly Artifact[]
  readonly onDismiss: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [creating, setCreating] = useState(false)
  const setActiveNote = useEditorStore((s) => s.setActiveNote)

  const handleCreate = useCallback(async () => {
    if (!vaultPath || creating) return
    setCreating(true)

    try {
      const refPaths = artifacts
        .filter((a) => ghost.references.some((r) => r.fileTitle === a.title))
        .map((a) => {
          const pathById = useVaultStore.getState().artifactPathById
          return pathById[a.id] ?? ''
        })
        .filter(Boolean)

      const folder = inferFolder(ghost.id, refPaths, vaultPath)
      const filePath = `${folder}/${ghost.id}.md`

      const sourceIds = ghost.references
        .map((r) => {
          const a = artifacts.find((art) => art.title === r.fileTitle)
          return a?.id ?? ''
        })
        .filter(Boolean)

      const artifact: Artifact = {
        id: ghost.id,
        title: ghost.id,
        type: 'note',
        created: new Date().toISOString().split('T')[0],
        modified: new Date().toISOString().split('T')[0],
        signal: 'untested',
        tags: [],
        connections: sourceIds,
        clusters_with: [],
        tensions_with: [],
        appears_in: [],
        related: [],
        concepts: [],
        bodyLinks: [],
        body: '',
        frontmatter: {}
      }

      const content = serializeArtifact(artifact)

      const exists = await window.api.fs.fileExists(filePath)
      if (exists) {
        setCreating(false)
        return
      }

      await window.api.fs.writeFile(filePath, content)
      setActiveNote(ghost.id, filePath)
    } finally {
      setCreating(false)
    }
  }, [ghost, vaultPath, artifacts, creating, setActiveNote])

  return (
    <div
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255, 255, 255, 0.06)',
        overflow: 'hidden'
      }}
    >
      <button
        className="w-full flex items-center gap-2 px-3 py-2 cursor-pointer"
        style={{ backgroundColor: 'transparent', color: colors.text.primary }}
        onClick={() => setExpanded(!expanded)}
      >
        <span
          className="text-xs"
          style={{
            color: colors.text.muted,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
            transition: 'transform 150ms ease-out'
          }}
        >
          {'\u25B6'}
        </span>
        <span className="text-sm font-medium flex-1 text-left">{ghost.id}</span>
        <span
          className="text-xs px-1.5 py-0.5 rounded-full"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            color: colors.text.secondary
          }}
        >
          {ghost.referenceCount}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3">
          <div className="flex flex-col gap-1.5 mb-3">
            {ghost.references.map((ref, i) => (
              <div
                key={i}
                className="text-xs rounded px-2 py-1.5"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.2)',
                  color: colors.text.secondary
                }}
              >
                <div className="font-medium mb-0.5" style={{ color: colors.text.primary }}>
                  {ref.fileTitle}
                </div>
                <div style={{ opacity: 0.7, lineHeight: 1.4 }}>{ref.context}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button
              className="text-xs px-2.5 py-1 rounded cursor-pointer"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                color: colors.text.primary,
                opacity: creating ? 0.5 : 1
              }}
              onClick={handleCreate}
              disabled={creating}
            >
              {creating ? 'Creating...' : 'Create File'}
            </button>
            <button
              className="text-xs px-2.5 py-1 rounded cursor-pointer"
              style={{
                backgroundColor: 'transparent',
                color: colors.text.muted
              }}
              onClick={onDismiss}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
