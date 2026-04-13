import { useMemo } from 'react'
import { useTabStore, TAB_DEFINITIONS } from '../store/tab-store'
import type { TabType } from '../store/tab-store'
import { useVaultStore } from '../store/vault-store'
import { useUiStore } from '../store/ui-store'
import { useVaultHealthStore } from '../store/vault-health-store'
import { buildGhostIndex } from '../engine/ghost-index'
import { colors } from '../design/tokens'
import { Atom } from '@phosphor-icons/react'

const ICON_SIZE = 20

const EditorIcon = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="12" y2="17" />
  </svg>
)

const CanvasIcon = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="16" width="7" height="5" rx="1" />
    <path d="M10 5.5h4a2 2 0 0 1 2 2v4" />
    <path d="M14 18.5h-4a2 2 0 0 1-2-2v-4" />
  </svg>
)

const GraphIcon = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="6" cy="6" r="2.5" />
    <circle cx="18" cy="8" r="2.5" />
    <circle cx="12" cy="18" r="2.5" />
    <circle cx="5" cy="15" r="1.5" />
    <line x1="8" y1="7" x2="16" y2="7.5" />
    <line x1="7" y1="8" x2="11" y2="16.5" />
    <line x1="16" y1="10" x2="13" y2="16" />
    <line x1="6" y1="13.5" x2="6" y2="8.5" />
  </svg>
)

const GhostsIcon = <Atom size={ICON_SIZE} weight="regular" />

const HealthIcon = (
  <svg
    width={ICON_SIZE}
    height={ICON_SIZE}
    viewBox="0 0 20 20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M2 10 L6 10 L8 4 L10 16 L12 8 L14 10 L18 10" />
  </svg>
)

interface ActivityItem {
  view: TabType
  label: string
  icon: React.ReactNode
}

const ITEMS: ActivityItem[] = [
  { view: 'editor', label: 'Editor', icon: EditorIcon },
  { view: 'canvas', label: 'Canvas', icon: CanvasIcon },
  { view: 'graph', label: 'Graph', icon: GraphIcon },
  { view: 'ghosts', label: 'Ghosts', icon: GhostsIcon },
  { view: 'health', label: 'Health', icon: HealthIcon }
]

function useGhostCount(): number {
  const graph = useVaultStore((s) => s.graph)
  const artifacts = useVaultStore((s) => s.artifacts)
  const dismissed = useUiStore((s) => s.dismissedGhosts)
  const ghosts = useMemo(() => buildGhostIndex(graph, artifacts), [graph, artifacts])
  return useMemo(() => ghosts.filter((g) => !dismissed.includes(g.id)).length, [ghosts, dismissed])
}

const SidebarToggleIcon = ({ expanded }: { expanded: boolean }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      transform: expanded ? 'scaleX(1)' : 'scaleX(-1)',
      transition: 'transform 200ms ease-out'
    }}
  >
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <polyline points="14 9 16 12 14 15" />
  </svg>
)

export function ActivityBar({
  onToggleSidebar,
  sidebarExpanded,
  onOpenSettings
}: {
  onToggleSidebar?: () => void
  sidebarExpanded?: boolean
  onOpenSettings?: () => void
}) {
  const activeTabId = useTabStore((s) => s.activeTabId)
  const openTab = useTabStore((s) => s.openTab)
  const ghostCount = useGhostCount()
  const healthStatus = useVaultHealthStore((s) => s.status)

  return (
    <div
      className="workspace-activity-rail flex flex-col items-center shrink-0 pt-10 gap-1 relative"
      style={{
        width: 48,
        backgroundColor: 'var(--chrome-rail-bg)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)'
      }}
    >
      <div className="flex flex-col items-center gap-1 w-full">
        {ITEMS.map(({ view, label, icon }) => {
          const isActive = activeTabId === view
          const def = TAB_DEFINITIONS[view]
          const isGhostTab = view === 'ghosts'
          const isHealthTab = view === 'health'
          const ghostTint = isGhostTab && ghostCount > 0 ? colors.text.primary : undefined
          const healthTint =
            isHealthTab && healthStatus === 'degraded' ? colors.text.primary : undefined
          const hasTint = !!(ghostTint || healthTint)
          return (
            <button
              key={view}
              type="button"
              onClick={() =>
                openTab({ id: view, type: view, label: def.label, closeable: view !== 'editor' })
              }
              className="activity-btn relative flex items-center justify-center cursor-pointer"
              data-active={isActive || undefined}
              aria-pressed={isActive}
              style={
                {
                  width: 34,
                  height: 36,
                  '--base-opacity': isActive ? 0.94 : hasTint ? 0.74 : 0.46,
                  '--base-bg': isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  color: ghostTint ?? healthTint ?? colors.text.primary,
                  borderRadius: 10,
                  transition:
                    'opacity 150ms ease-out, background-color 150ms ease-out, color 300ms ease-out'
                } as React.CSSProperties
              }
              title={isGhostTab ? `${label} (${ghostCount})` : label}
              aria-label={`Switch to ${label} view`}
            >
              {icon}
            </button>
          )
        })}
      </div>

      {onOpenSettings && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="activity-btn flex items-center justify-center cursor-pointer mt-auto"
          style={
            {
              width: 34,
              height: 36,
              '--base-opacity': 0.46,
              '--base-bg': 'transparent',
              color: colors.text.primary,
              borderRadius: 10,
              transition: 'opacity 150ms ease-out, background-color 150ms ease-out'
            } as React.CSSProperties
          }
          title="Settings"
          aria-label="Open settings"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 4.754a3.246 3.246 0 100 6.492 3.246 3.246 0 000-6.492zM5.754 8a2.246 2.246 0 114.492 0 2.246 2.246 0 01-4.492 0z" />
            <path d="M9.796 1.343c-.527-1.79-3.065-1.79-3.592 0l-.094.319a.873.873 0 01-1.255.52l-.292-.16c-1.64-.892-3.433.902-2.54 2.541l.159.292a.873.873 0 01-.52 1.255l-.319.094c-1.79.527-1.79 3.065 0 3.592l.319.094a.873.873 0 01.52 1.255l-.16.292c-.892 1.64.901 3.434 2.541 2.54l.292-.159a.873.873 0 011.255.52l.094.319c.527 1.79 3.065 1.79 3.592 0l.094-.319a.873.873 0 011.255-.52l.292.16c1.64.893 3.434-.902 2.54-2.541l-.159-.292a.873.873 0 01.52-1.255l.319-.094c1.79-.527 1.79-3.065 0-3.592l-.319-.094a.873.873 0 01-.52-1.255l.16-.292c.893-1.64-.902-3.433-2.541-2.54l-.292.159a.873.873 0 01-1.255-.52l-.094-.319zm-2.633.283c.246-.835 1.428-.835 1.674 0l.094.319a1.873 1.873 0 002.693 1.115l.291-.16c.764-.415 1.6.42 1.184 1.185l-.159.292a1.873 1.873 0 001.116 2.692l.318.094c.835.246.835 1.428 0 1.674l-.319.094a1.873 1.873 0 00-1.115 2.693l.16.291c.415.764-.421 1.6-1.185 1.184l-.291-.159a1.873 1.873 0 00-2.693 1.116l-.094.318c-.246.835-1.428.835-1.674 0l-.094-.319a1.873 1.873 0 00-2.692-1.115l-.292.16c-.764.415-1.6-.421-1.184-1.185l.159-.291A1.873 1.873 0 001.945 8.93l-.319-.094c-.835-.246-.835-1.428 0-1.674l.319-.094A1.873 1.873 0 003.06 4.377l-.16-.292c-.415-.764.421-1.6 1.185-1.184l.292.159a1.873 1.873 0 002.692-1.115l.094-.319z" />
          </svg>
        </button>
      )}

      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          className="activity-btn flex items-center justify-center cursor-pointer mb-3"
          style={
            {
              width: 34,
              height: 36,
              '--base-opacity': 0.46,
              '--base-bg': 'transparent',
              color: colors.text.primary,
              borderRadius: 10,
              transition: 'opacity 150ms ease-out, background-color 150ms ease-out'
            } as React.CSSProperties
          }
          title={sidebarExpanded ? 'Hide sidebar (\u2318B)' : 'Show sidebar (\u2318B)'}
          aria-label="Toggle sidebar"
        >
          <SidebarToggleIcon expanded={sidebarExpanded ?? true} />
        </button>
      )}
    </div>
  )
}
