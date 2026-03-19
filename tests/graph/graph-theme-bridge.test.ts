import { describe, it, expect } from 'vitest'
import { hexToPixi, buildEdgeColor } from '@renderer/panels/graph/graph-theme-bridge'

describe('graph-theme-bridge', () => {
  describe('hexToPixi', () => {
    it('converts #ffffff to 0xffffff', () => {
      expect(hexToPixi('#ffffff')).toBe(0xffffff)
    })

    it('converts #000000 to 0x000000', () => {
      expect(hexToPixi('#000000')).toBe(0x000000)
    })

    it('converts #22d3ee to correct value', () => {
      expect(hexToPixi('#22d3ee')).toBe(0x22d3ee)
    })

    it('handles 3-digit hex', () => {
      expect(hexToPixi('#fff')).toBe(0xffffff)
    })
  })

  describe('buildEdgeColor', () => {
    it('returns cluster color for cluster kind', () => {
      const c = buildEdgeColor('cluster')
      expect(typeof c).toBe('number')
    })

    it('returns tension color for tension kind', () => {
      const c = buildEdgeColor('tension')
      expect(typeof c).toBe('number')
    })

    it('returns default color for connection kind', () => {
      const c = buildEdgeColor('connection')
      expect(typeof c).toBe('number')
    })
  })
})
