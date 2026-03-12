import { useRef, useState, useCallback, type ReactNode } from 'react'

interface SplitPaneProps {
  left: ReactNode
  right: ReactNode
  initialLeftWidth: number
  minLeftWidth: number
  minRightWidth: number
  onResize?: (leftWidth: number) => void
}

export function SplitPane({
  left,
  right,
  initialLeftWidth,
  minLeftWidth,
  minRightWidth,
  onResize
}: SplitPaneProps) {
  const [leftWidth, setLeftWidth] = useState(initialLeftWidth)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const handleMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const newLeft = Math.max(
        minLeftWidth,
        Math.min(e.clientX - rect.left, rect.width - minRightWidth)
      )
      setLeftWidth(newLeft)
      onResize?.(newLeft)
    }

    const handleMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [minLeftWidth, minRightWidth, onResize])

  return (
    <div ref={containerRef} className="flex h-full w-full overflow-hidden">
      <div style={{ width: leftWidth, flexShrink: 0 }} className="overflow-hidden">
        {left}
      </div>
      <div
        onMouseDown={handleMouseDown}
        className="w-[4px] cursor-col-resize bg-transparent hover:bg-[#6C63FF]/30 transition-colors flex-shrink-0"
      />
      <div className="flex-1 overflow-hidden">{right}</div>
    </div>
  )
}
