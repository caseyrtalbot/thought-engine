// Polyfill Map.getOrInsertComputed — pdfjs-dist 5.5+ uses this TC39 Stage 4
// method internally, but Electron 39's Chromium doesn't ship it yet.
// Safe to remove once Electron upgrades past Chrome 134.
if (!Map.prototype.getOrInsertComputed) {
  Map.prototype.getOrInsertComputed = function <K, V>(key: K, callbackFn: (key: K) => V): V {
    if (this.has(key)) return this.get(key) as V
    const value = callbackFn(key)
    this.set(key, value)
    return value
  }
}

import * as pdfjs from 'pdfjs-dist'

// Configure the pdfjs web worker. Vite's ?url import emits the worker
// as a static asset and returns its URL, working in both dev and prod.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

export { pdfjs }
