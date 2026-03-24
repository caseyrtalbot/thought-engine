import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useCanvasStore } from '../../store/canvas-store'
import { colors } from '../../design/tokens'
import { createEditorExtensions, detectLanguage } from './shared/codemirror-setup'

interface CanvasSplitEditorProps {
  readonly filePath: string
}

export function CanvasSplitEditor({ filePath }: CanvasSplitEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPathRef = useRef(filePath)
  const closeSplit = useCanvasStore((s) => s.closeSplit)

  const scheduleAutosave = useCallback((path: string, content: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      window.api.fs.writeFile(path, content)
    }, 1000)
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    currentPathRef.current = filePath

    if (viewRef.current) {
      viewRef.current.destroy()
      viewRef.current = null
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }

    let cancelled = false

    async function mount() {
      const content = await window.api.fs.readFile(filePath).catch(() => null)
      if (cancelled || !containerRef.current) return

      if (content === null) return

      const extensions = await createEditorExtensions(detectLanguage(filePath), {
        readOnly: false,
        onUpdate: (text) => scheduleAutosave(currentPathRef.current, text),
        fontSize: '13px',
        contentPadding: '12px 0'
      })

      const state = EditorState.create({ doc: content, extensions })
      const view = new EditorView({ state, parent: containerRef.current })
      viewRef.current = view
    }

    mount()

    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (viewRef.current) {
        viewRef.current.destroy()
        viewRef.current = null
      }
    }
  }, [filePath, scheduleAutosave])

  const filename = filePath.split('/').pop() ?? filePath
  const dirPath = filePath.split('/').slice(-2, -1)[0] ?? ''

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: colors.bg.base }}>
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-3 shrink-0"
        style={
          {
            height: 34,
            borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            position: 'relative',
            zIndex: 60,
            WebkitAppRegion: 'no-drag'
          } as React.CSSProperties
        }
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {dirPath && (
            <span className="text-xs shrink-0" style={{ color: 'rgba(255, 255, 255, 0.25)' }}>
              {dirPath}/
            </span>
          )}
          <span
            className="text-xs truncate"
            style={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}
          >
            {filename}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            closeSplit()
          }}
          className="flex items-center justify-center rounded cursor-pointer shrink-0"
          style={{
            width: 24,
            height: 24,
            color: colors.text.muted,
            opacity: 0.5,
            border: 'none',
            background: 'transparent',
            zIndex: 10
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.5'
          }}
          title="Close split editor (Cmd+Shift+E)"
        >
          <svg
            width={12}
            height={12}
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      </div>
      {/* Editor container */}
      <div ref={containerRef} className="flex-1 overflow-hidden" style={{ minHeight: 0 }} />
    </div>
  )
}
