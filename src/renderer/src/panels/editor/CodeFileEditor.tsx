import { useEffect, useRef, useCallback } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { colors } from '../../design/tokens'
import { createEditorExtensions, detectLanguage } from '../canvas/shared/codemirror-setup'

interface CodeFileEditorProps {
  readonly filePath: string
}

export function CodeFileEditor({ filePath }: CodeFileEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentPathRef = useRef(filePath)

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
      const content = await window.api.fs.readFile(filePath)
      if (cancelled || !containerRef.current) return

      const extensions = await createEditorExtensions(detectLanguage(filePath), {
        readOnly: false,
        onUpdate: (text) => scheduleAutosave(currentPathRef.current, text),
        fontSize: '14px',
        contentPadding: '16px 0'
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

  return (
    <div className="h-full flex flex-col">
      <div
        className="flex items-center px-4 py-2 text-xs shrink-0"
        style={{ color: colors.text.muted, borderBottom: `1px solid ${colors.border.default}` }}
      >
        <span style={{ color: colors.text.primary }}>{filename}</span>
      </div>
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ backgroundColor: colors.bg.base }}
      />
    </div>
  )
}
