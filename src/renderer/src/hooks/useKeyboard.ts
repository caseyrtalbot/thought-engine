import { useEffect } from 'react'

interface KeyboardConfig {
  onToggleSidebar?: () => void
  onNewNote?: () => void
  onOpenDailyNote?: () => void
  onCycleView?: () => void
  onToggleSourceMode?: () => void
  onCommandPalette?: () => void
  onQuickSwitcher?: () => void
  onSave?: () => void
  onNewTerminalTab?: () => void
  onCloseTab?: () => void
  onGoBack?: () => void
  onGoForward?: () => void
  onSplitEditor?: () => void
  onEscape?: () => void
}

const META_KEY_BINDINGS = [
  { key: 'b', handler: 'onToggleSidebar' },
  { key: 'n', handler: 'onNewNote' },
  { key: 'd', handler: 'onOpenDailyNote' },
  { key: 'g', handler: 'onCycleView' },
  { key: '/', handler: 'onToggleSourceMode' },
  { key: 'k', handler: 'onCommandPalette' },
  { key: 'o', handler: 'onQuickSwitcher' },
  { key: 's', handler: 'onSave' },
  { key: 't', handler: 'onNewTerminalTab' },
  { key: 'w', handler: 'onCloseTab' },
  { key: '[', handler: 'onGoBack' },
  { key: ']', handler: 'onGoForward' },
  { key: '\\', handler: 'onSplitEditor' }
] as const satisfies ReadonlyArray<{ key: string; handler: keyof KeyboardConfig }>

/** Bindings that should be suppressed when focus is inside an editable surface. */
const EDITABLE_GUARDED = new Set<string>(['onQuickSwitcher'])

function isEditableTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  if (el.isContentEditable) return true
  return false
}

export function useKeyboard(config: KeyboardConfig): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && config.onEscape) {
        e.preventDefault()
        config.onEscape()
        return
      }

      if (!e.metaKey) return

      for (const binding of META_KEY_BINDINGS) {
        if (e.key === binding.key) {
          if (EDITABLE_GUARDED.has(binding.handler) && isEditableTarget(e.target)) return
          const handler = config[binding.handler]
          if (handler) {
            e.preventDefault()
            handler()
          }
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [config])
}
