import { useState, useEffect } from 'react'
import { useCanvasStore } from '../../store/canvas-store'
import { useVaultStore } from '../../store/vault-store'
import { CardShell } from './CardShell'
import { colors } from '../../design/tokens'
import type { CanvasNode } from '@shared/canvas-types'

interface NoteCardProps {
  node: CanvasNode
}

export function NoteCard({ node }: NoteCardProps) {
  const [body, setBody] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const removeNode = useCanvasStore((s) => s.removeNode)
  const artifacts = useVaultStore((s) => s.artifacts)
  const fileToId = useVaultStore((s) => s.fileToId)

  // The node.content holds the vault file path
  const filePath = node.content
  const artifactId = fileToId[filePath]
  const artifact = artifacts.find((a) => a.id === artifactId)
  const title = artifact?.title ?? filePath.split('/').pop()?.replace('.md', '') ?? 'Note'

  // Load file content
  useEffect(() => {
    if (!filePath) {
      setLoading(false)
      return
    }
    setLoading(true)
    window.api.fs
      .readFile(filePath)
      .then((content: string) => {
        // Strip frontmatter for display
        const fmEnd = content.indexOf('---', content.indexOf('---') + 3)
        const bodyStart = fmEnd > 0 ? fmEnd + 3 : 0
        setBody(content.slice(bodyStart).trim())
        setLoading(false)
      })
      .catch(() => {
        setBody('Failed to load note')
        setLoading(false)
      })
  }, [filePath])

  // Re-read on vault file changes (reactive)
  useEffect(() => {
    const unsub = window.api.on.fileChanged((data) => {
      if (data.path === filePath && data.event === 'change') {
        window.api.fs
          .readFile(filePath)
          .then((content: string) => {
            const fmEnd = content.indexOf('---', content.indexOf('---') + 3)
            const bodyStart = fmEnd > 0 ? fmEnd + 3 : 0
            setBody(content.slice(bodyStart).trim())
          })
          .catch(() => {})
      }
    })
    return () => {
      unsub()
    }
  }, [filePath])

  return (
    <CardShell node={node} title={title} onClose={() => removeNode(node.id)}>
      <div className="p-3 text-sm whitespace-pre-wrap" style={{ color: colors.text.primary }}>
        {loading ? (
          <span style={{ color: colors.text.muted }}>Loading...</span>
        ) : (
          body || <span style={{ color: colors.text.muted }}>Empty note</span>
        )}
      </div>
    </CardShell>
  )
}
