import { useCallback, useState } from 'react'
import { CanvasSurface } from './CanvasSurface'
import { useCanvasStore } from '../../store/canvas-store'
import { createCanvasNode } from '@shared/canvas-types'
import { CanvasContextMenu } from './CanvasContextMenu'
import { TextCard } from './TextCard'

export function CanvasView() {
  const nodes = useCanvasStore((s) => s.nodes)
  const clearSelection = useCanvasStore((s) => s.clearSelection)
  const addNode = useCanvasStore((s) => s.addNode)

  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    canvasX: number
    canvasY: number
  } | null>(null)

  const handleDoubleClick = useCallback(
    (canvasX: number, canvasY: number, screenX: number, screenY: number) => {
      setContextMenu({ x: screenX, y: screenY, canvasX, canvasY })
    },
    []
  )

  const handleBackgroundClick = useCallback(() => {
    clearSelection()
    setContextMenu(null)
  }, [clearSelection])

  const handleAddCard = useCallback(
    (type: 'text' | 'note' | 'terminal') => {
      if (!contextMenu) return
      const node = createCanvasNode(type, {
        x: contextMenu.canvasX,
        y: contextMenu.canvasY
      })
      addNode(node)
      setContextMenu(null)
    },
    [contextMenu, addNode]
  )

  return (
    <div className="h-full relative">
      <CanvasSurface onDoubleClick={handleDoubleClick} onBackgroundClick={handleBackgroundClick}>
        {nodes.map((node) => {
          if (node.type === 'text') return <TextCard key={node.id} node={node} />
          // NoteCard and TerminalCard will be added later
          return null
        })}
      </CanvasSurface>

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onAddCard={() => handleAddCard('text')}
          onAddNote={() => handleAddCard('note')}
          onAddTerminal={() => handleAddCard('terminal')}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
