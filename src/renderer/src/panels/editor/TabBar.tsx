import { useCallback } from 'react'
import { colors, transitions } from '../../design/tokens'
import type { Tab } from '../../store/editor-store'

interface TabBarProps {
  readonly tabs: readonly Tab[]
  readonly activePath: string | null
  readonly onSwitch: (path: string) => void
  readonly onClose: (path: string) => void
}

export function TabBar({ tabs, activePath, onSwitch, onClose }: TabBarProps) {
  if (tabs.length === 0) return null

  return (
    <div
      className="flex items-center shrink-0 overflow-x-auto gap-1"
      style={{
        height: 40,
        padding: '4px 8px 4px',
        borderBottom: `1px solid ${colors.border.subtle}`
      }}
    >
      {tabs.map((tab) => (
        <TabItem
          key={tab.path}
          tab={tab}
          isActive={tab.path === activePath}
          onSwitch={onSwitch}
          onClose={onClose}
        />
      ))}
    </div>
  )
}

interface TabItemProps {
  readonly tab: Tab
  readonly isActive: boolean
  readonly onSwitch: (path: string) => void
  readonly onClose: (path: string) => void
}

function TabItem({ tab, isActive, onSwitch, onClose }: TabItemProps) {
  const handleClose = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onClose(tab.path)
    },
    [tab.path, onClose]
  )

  const handleMiddleClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        onClose(tab.path)
      }
    },
    [tab.path, onClose]
  )

  return (
    <div
      className="flex items-center group shrink-0 cursor-pointer"
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
        transition: transitions.default
      }}
      onClick={() => onSwitch(tab.path)}
      onMouseDown={handleMiddleClick}
    >
      <span className="truncate select-none" style={{ maxWidth: 160 }} title={tab.title}>
        {tab.title}
      </span>
      <button
        onClick={handleClose}
        className="flex items-center justify-center w-4 h-4 ml-2 rounded cursor-pointer opacity-0 group-hover:opacity-100"
        style={{
          color: colors.text.muted,
          fontSize: 11,
          transition: transitions.default
        }}
        title="Close tab"
      >
        ×
      </button>
    </div>
  )
}
