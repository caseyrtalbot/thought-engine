import { useState, useRef, useEffect } from 'react'
import { useTerminalStore } from '../../store/terminal-store'
import { colors } from '../../design/tokens'
import { ClaudeActivateButton } from './ClaudeActivateButton'

const STATUS_DOT_SHELL = colors.semantic.cluster
const STATUS_DOT_AGENT = '#00e5bf'

function sessionDotColor(title: string): string {
  return title.toLowerCase().includes('claude') ? STATUS_DOT_AGENT : STATUS_DOT_SHELL
}

interface TerminalTabsProps {
  onNewTab: () => void
  onCloseTab: (sessionId: string) => void
  onActivateClaude: () => void
  claudeSessionActive: boolean
  vaultPath: string | null
}

export function TerminalTabs({
  onNewTab,
  onCloseTab,
  onActivateClaude,
  claudeSessionActive,
  vaultPath
}: TerminalTabsProps) {
  const { sessions, activeSessionId, setActiveSession, renameSession } = useTerminalStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editingId])

  function startEditing(id: string, currentTitle: string) {
    setEditingId(id)
    setEditValue(currentTitle)
  }

  function confirmRename() {
    if (editingId) {
      const trimmed = editValue.trim()
      if (trimmed) {
        renameSession(editingId, trimmed)
      }
    }
    setEditingId(null)
    setEditValue('')
  }

  function cancelRename() {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div
      data-testid="terminal-tabs"
      className="flex items-center overflow-x-auto gap-1 shrink-0"
      style={{
        height: 40,
        padding: '4px 8px 4px',
        borderBottom: `1px solid ${colors.border.subtle}`
      }}
    >
      {sessions.map((session) => {
        const isActive = session.id === activeSessionId
        const dotColor = sessionDotColor(session.title)

        return (
          <div
            key={session.id}
            onClick={() => setActiveSession(session.id)}
            className="flex items-center gap-1.5 cursor-pointer group shrink-0 whitespace-nowrap"
            style={{
              padding: '4px 12px',
              fontSize: 12,
              borderRadius: 6,
              border: isActive
                ? '1px solid rgba(0, 229, 191, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.06)',
              backgroundColor: isActive ? 'rgba(0, 229, 191, 0.06)' : 'transparent',
              boxShadow: isActive ? '0 0 8px rgba(0, 229, 191, 0.08)' : 'none',
              color: isActive ? colors.text.primary : colors.text.secondary,
              transition: '150ms ease-out'
            }}
          >
            {/* Status dot */}
            <span
              className="shrink-0 rounded-full"
              style={{ width: 6, height: 6, backgroundColor: dotColor }}
            />

            {/* Title or rename input */}
            {editingId === session.id ? (
              <input
                ref={inputRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmRename()
                  if (e.key === 'Escape') cancelRename()
                }}
                onBlur={confirmRename}
                onClick={(e) => e.stopPropagation()}
                className="bg-transparent outline-none border-b text-xs"
                style={{
                  color: colors.text.primary,
                  borderColor: colors.accent.default,
                  width: Math.max(editValue.length, 4) + 'ch'
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditing(session.id, session.title)
                }}
              >
                {session.title}
              </span>
            )}

            {/* Close button: visible on hover only */}
            {sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCloseTab(session.id)
                }}
                className="opacity-0 group-hover:opacity-100"
                style={{
                  color: colors.text.muted,
                  fontSize: 11,
                  transition: '150ms ease-out'
                }}
              >
                ×
              </button>
            )}
          </div>
        )
      })}
      <button
        onClick={onNewTab}
        className="px-2 py-1 text-xs transition-colors"
        style={{ color: colors.text.muted }}
      >
        +
      </button>
      <div className="flex-1" />
      <div className="px-2">
        <ClaudeActivateButton
          onClick={onActivateClaude}
          isActive={claudeSessionActive}
          disabled={!vaultPath}
        />
      </div>
    </div>
  )
}
