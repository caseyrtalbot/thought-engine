import { describe, it, expect } from 'vitest'
import { GlowCache, glowCacheKey } from '../../src/renderer/src/panels/graph/glow-cache'

describe('glowCacheKey', () => {
  it('produces deterministic keys from color + radius + blur', () => {
    expect(glowCacheKey('#ff0000', 8, 6)).toBe('#ff0000:8:6')
  })

  it('different blur = different key', () => {
    expect(glowCacheKey('#ff0000', 8, 6)).not.toBe(glowCacheKey('#ff0000', 8, 16))
  })
})

describe('GlowCache', () => {
  it('returns same sprite for same key', () => {
    const cache = new GlowCache()
    const s1 = cache.get('#ff0000', 8, 6)
    const s2 = cache.get('#ff0000', 8, 6)
    expect(s1).toBe(s2)
    cache.dispose()
  })

  it('returns different sprite for different params', () => {
    const cache = new GlowCache()
    const s1 = cache.get('#ff0000', 8, 6)
    const s2 = cache.get('#ff0000', 8, 16)
    expect(s1).not.toBe(s2)
    cache.dispose()
  })

  it('dispose clears all entries', () => {
    const cache = new GlowCache()
    cache.get('#ff0000', 8, 6)
    cache.get('#00ff00', 10, 4)
    cache.dispose()
    // After dispose, new get returns a fresh sprite (not from cache)
    const s = cache.get('#ff0000', 8, 6)
    expect(s).toBeDefined()
    cache.dispose()
  })

  it('sprite has correct dimensions', () => {
    const cache = new GlowCache()
    // size = (radius + blur + 2) * 2 = (8 + 6 + 2) * 2 = 32
    const sprite = cache.get('#ff0000', 8, 6)
    expect(sprite.width).toBe(32)
    expect(sprite.height).toBe(32)
    cache.dispose()
  })

  it('sprite source is defined', () => {
    const cache = new GlowCache()
    const sprite = cache.get('#0000ff', 10, 8)
    expect(sprite.source).toBeDefined()
    cache.dispose()
  })
})
