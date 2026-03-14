import { describe, it, expect } from 'vitest'
import {
  serializeCanvas,
  deserializeCanvas,
  defaultCanvasFilename
} from '../../src/renderer/src/panels/canvas/canvas-io'
import { createCanvasFile, createCanvasNode, createCanvasEdge } from '../../src/shared/canvas-types'

describe('canvas-io', () => {
  describe('serializeCanvas', () => {
    it('serializes an empty canvas to pretty JSON', () => {
      const file = createCanvasFile()
      const json = serializeCanvas(file)
      const parsed = JSON.parse(json)
      expect(parsed.nodes).toEqual([])
      expect(parsed.edges).toEqual([])
      expect(parsed.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    })

    it('round-trips nodes and edges', () => {
      const node1 = createCanvasNode('text', { x: 10, y: 20 }, { content: 'Hello' })
      const node2 = createCanvasNode('note', { x: 300, y: 20 }, { content: '/notes/foo.md' })
      const edge = createCanvasEdge(node1.id, node2.id, 'right', 'left')
      const file = { nodes: [node1, node2], edges: [edge], viewport: { x: 0, y: 0, zoom: 1 } }

      const json = serializeCanvas(file)
      const restored = deserializeCanvas(json)

      expect(restored.nodes).toHaveLength(2)
      expect(restored.nodes[0].content).toBe('Hello')
      expect(restored.edges).toHaveLength(1)
      expect(restored.edges[0].fromNode).toBe(node1.id)
    })
  })

  describe('deserializeCanvas', () => {
    it('returns default canvas for empty/invalid input', () => {
      expect(deserializeCanvas('')).toEqual(createCanvasFile())
      expect(deserializeCanvas('not json')).toEqual(createCanvasFile())
    })

    it('fills missing viewport with defaults', () => {
      const json = JSON.stringify({ nodes: [], edges: [] })
      const result = deserializeCanvas(json)
      expect(result.viewport).toEqual({ x: 0, y: 0, zoom: 1 })
    })
  })

  describe('defaultCanvasFilename', () => {
    it('generates Untitled.canvas', () => {
      expect(defaultCanvasFilename([])).toBe('Untitled.canvas')
    })

    it('increments when name exists', () => {
      expect(defaultCanvasFilename(['Untitled.canvas'])).toBe('Untitled 1.canvas')
      expect(defaultCanvasFilename(['Untitled.canvas', 'Untitled 1.canvas'])).toBe(
        'Untitled 2.canvas'
      )
    })
  })
})
