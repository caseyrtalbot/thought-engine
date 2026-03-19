import { describe, it, expect } from 'vitest'
import {
  getGraphLod,
  shouldShowLabel,
  nodeRadius,
  edgeWidth
} from '@renderer/panels/graph/graph-lod'

describe('graph-lod', () => {
  it('returns macro for very low zoom', () => {
    expect(getGraphLod(0.05)).toBe('macro')
    expect(getGraphLod(0.1)).toBe('macro')
  })

  it('returns meso for medium zoom', () => {
    expect(getGraphLod(0.5)).toBe('meso')
    expect(getGraphLod(0.8)).toBe('meso')
  })

  it('returns micro for high zoom', () => {
    expect(getGraphLod(1.5)).toBe('micro')
    expect(getGraphLod(3.0)).toBe('micro')
  })

  it('handles LOD boundary values correctly', () => {
    // Macro boundary: < 0.15 is macro, >= 0.15 is meso
    expect(getGraphLod(0.149)).toBe('macro')
    expect(getGraphLod(0.15)).toBe('meso')
    // Micro boundary: < 1.5 is meso, >= 1.5 is micro
    expect(getGraphLod(1.499)).toBe('meso')
    expect(getGraphLod(1.5)).toBe('micro')
  })

  it('never shows labels at macro', () => {
    expect(shouldShowLabel('macro', true)).toBe(false)
    expect(shouldShowLabel('macro', false)).toBe(false)
  })

  it('shows labels at meso only for active (hovered/neighbor) nodes', () => {
    expect(shouldShowLabel('meso', true)).toBe(true)
    expect(shouldShowLabel('meso', false)).toBe(false)
  })

  it('shows all labels at micro regardless of active state', () => {
    expect(shouldShowLabel('micro', false)).toBe(true)
    expect(shouldShowLabel('micro', true)).toBe(true)
  })

  it('scales node radius by connection count', () => {
    const small = nodeRadius(0)
    const large = nodeRadius(20)
    expect(large).toBeGreaterThan(small)
    expect(small).toBeGreaterThanOrEqual(6)
    expect(large).toBeLessThanOrEqual(28)
  })

  it('scales edge width by zoom', () => {
    const thin = edgeWidth(0.3)
    const thick = edgeWidth(2.0)
    expect(thick).toBeGreaterThanOrEqual(thin)
  })
})
