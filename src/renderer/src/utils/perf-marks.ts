/**
 * Performance timing utilities for measuring critical interactions.
 *
 * Uses the Performance API (mark/measure) so timings appear in Chrome DevTools
 * Performance tab. Only logs in development mode to avoid production noise.
 */

const isDev = import.meta.env.DEV

export function perfMark(name: string): void {
  if (!isDev) return
  performance.mark(name)
}

export function perfMeasure(name: string, startMark: string): number {
  if (!isDev) return 0
  try {
    const measure = performance.measure(name, startMark)
    const ms = Math.round(measure.duration)
    console.debug(`[perf] ${name}: ${ms}ms`)
    return ms
  } catch {
    return 0
  }
}
