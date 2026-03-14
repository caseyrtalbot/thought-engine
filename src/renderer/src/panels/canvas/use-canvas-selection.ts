import { useState, useCallback, useRef } from 'react'
import { useCanvasStore } from '../../store/canvas-store'

interface SelectionRect {
  startX: number
  startY: number
  endX: number
  endY: number
}

export function useCanvasSelection() {
  const [rect, setRect] = useState<SelectionRect | null>(null)
  const isDragging = useRef(false)

  const onSelectionStart = useCallback((e: React.PointerEvent) => {
    // Only left-click on background, no space (that's panning)
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-canvas-node]')) return

    isDragging.current = true
    const startX = e.clientX
    const startY = e.clientY
    setRect({ startX, startY, endX: startX, endY: startY })

    const onMove = (me: PointerEvent) => {
      if (!isDragging.current) return
      setRect((prev) => (prev ? { ...prev, endX: me.clientX, endY: me.clientY } : null))
    }

    const onUp = (me: PointerEvent) => {
      isDragging.current = false
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)

      // Calculate which nodes intersect the rect
      const { nodes, viewport, setSelection } = useCanvasStore.getState()
      const container = document.querySelector('[data-canvas-surface]')
      if (!container) {
        setRect(null)
        return
      }

      const containerRect = container.getBoundingClientRect()
      const minX = Math.min(startX, me.clientX)
      const maxX = Math.max(startX, me.clientX)
      const minY = Math.min(startY, me.clientY)
      const maxY = Math.max(startY, me.clientY)

      // Convert screen rect to canvas coords
      const cMinX = (minX - containerRect.left - viewport.x) / viewport.zoom
      const cMaxX = (maxX - containerRect.left - viewport.x) / viewport.zoom
      const cMinY = (minY - containerRect.top - viewport.y) / viewport.zoom
      const cMaxY = (maxY - containerRect.top - viewport.y) / viewport.zoom

      const selected = new Set<string>()
      for (const node of nodes) {
        const nx = node.position.x
        const ny = node.position.y
        const nw = node.size.width
        const nh = node.size.height

        // Check AABB intersection
        if (nx + nw > cMinX && nx < cMaxX && ny + nh > cMinY && ny < cMaxY) {
          selected.add(node.id)
        }
      }

      setSelection(selected)
      setRect(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  return { rect, onSelectionStart }
}
