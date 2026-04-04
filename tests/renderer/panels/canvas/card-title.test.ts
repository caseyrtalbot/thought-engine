import { describe, it, expect } from 'vitest'
import { getCanvasNodeTitle } from '../../../../src/renderer/src/panels/canvas/card-title'
import type { CanvasNode } from '../../../../src/shared/canvas-types'

function makeNode(overrides: Partial<CanvasNode> = {}): CanvasNode {
  return {
    id: 'test',
    type: 'terminal',
    x: 0,
    y: 0,
    width: 200,
    height: 100,
    ...overrides
  } as CanvasNode
}

describe('getCanvasNodeTitle', () => {
  it('returns action name for action terminal cards', () => {
    const node = makeNode({
      metadata: { actionName: 'Emerge', actionId: 'emerge', initialCommand: 'claude' }
    })
    expect(getCanvasNodeTitle(node)).toBe('Emerge')
  })

  it('returns "Claude Live" for regular claude cards', () => {
    const node = makeNode({ metadata: { initialCommand: 'claude' } })
    expect(getCanvasNodeTitle(node)).toBe('Claude Live')
  })

  it('returns "Terminal" for plain terminal cards', () => {
    const node = makeNode()
    expect(getCanvasNodeTitle(node)).toBe('Terminal')
  })
})
