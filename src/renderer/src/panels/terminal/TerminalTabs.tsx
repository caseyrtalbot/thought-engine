import { useTerminalStore } from '../../store/terminal-store'
import { colors } from '../../design/tokens'

interface TerminalTabsProps {
  onNewTab: () => void
  onCloseTab: (sessionId: string) => void
}

export function TerminalTabs({ onNewTab, onCloseTab }: TerminalTabsProps) {
  const { sessions, activeSessionId, setActiveSession } = useTerminalStore()

  return (
    <div
      className="flex items-center h-8 border-b overflow-x-auto"
      style={{ backgroundColor: colors.bg.surface, borderColor: colors.border.default }}
    >
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => setActiveSession(session.id)}
          className="flex items-center gap-1 px-3 py-1 text-xs cursor-pointer border-r transition-colors"
          style={{
            borderColor: colors.border.default,
            backgroundColor: session.id === activeSessionId ? colors.bg.elevated : 'transparent',
            color: session.id === activeSessionId ? colors.text.primary : colors.text.secondary
          }}
        >
          <span>{session.title}</span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onCloseTab(session.id)
            }}
            className="ml-1 hover:text-white"
            style={{ color: colors.text.muted }}
          >
            x
          </button>
        </div>
      ))}
      <button
        onClick={onNewTab}
        className="px-2 py-1 text-xs transition-colors"
        style={{ color: colors.text.muted }}
      >
        +
      </button>
    </div>
  )
}
