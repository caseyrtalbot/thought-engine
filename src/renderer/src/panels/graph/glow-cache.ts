// Capability detection (runs once at import)
const HAS_OFFSCREEN_CANVAS = typeof OffscreenCanvas !== 'undefined'
const HAS_IMAGE_BITMAP = typeof ImageBitmap !== 'undefined' && HAS_OFFSCREEN_CANVAS

export type GlowSprite = {
  source: CanvasImageSource
  width: number
  height: number
}

export function glowCacheKey(color: string, radius: number, blur: number): string {
  return `${color}:${radius}:${blur}`
}

function createSprite(color: string, radius: number, blur: number): GlowSprite {
  const size = (radius + blur + 2) * 2
  const center = size / 2

  let canvas: OffscreenCanvas | HTMLCanvasElement
  if (HAS_OFFSCREEN_CANVAS) {
    canvas = new OffscreenCanvas(size, size)
  } else {
    canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
  }

  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

  if (ctx !== null) {
    // Glow layer: soft halo around the node
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = blur
    ctx.globalAlpha = 0.3
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Solid core: full-opacity filled circle
    ctx.save()
    ctx.shadowBlur = 0
    ctx.globalAlpha = 1
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(center, center, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }

  // Try to promote to ImageBitmap for GPU-side caching
  if (HAS_IMAGE_BITMAP && canvas instanceof OffscreenCanvas) {
    try {
      const bitmap = canvas.transferToImageBitmap()
      return { source: bitmap, width: size, height: size }
    } catch {
      // Fall through and return the canvas itself
    }
  }

  return { source: canvas as CanvasImageSource, width: size, height: size }
}

export class GlowCache {
  private cache = new Map<string, GlowSprite>()

  get(color: string, radius: number, blur: number): GlowSprite {
    const key = glowCacheKey(color, radius, blur)
    const existing = this.cache.get(key)
    if (existing !== undefined) {
      return existing
    }
    const sprite = createSprite(color, radius, blur)
    this.cache.set(key, sprite)
    return sprite
  }

  dispose(): void {
    for (const sprite of this.cache.values()) {
      if (HAS_IMAGE_BITMAP && sprite.source instanceof ImageBitmap) {
        sprite.source.close()
      }
    }
    this.cache.clear()
  }
}
