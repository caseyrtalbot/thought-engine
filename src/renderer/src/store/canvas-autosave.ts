/**
 * Canvas auto-save: debounced persistence of canvas state to disk.
 *
 * Mirrors the vault-persist pattern:
 * - 2s debounce after any canvas mutation (isDirty becomes true)
 * - Flush on app quit (via app:will-quit)
 * - Subscribe/unsubscribe lifecycle managed by caller
 */

import { useCanvasStore } from './canvas-store'
import { saveCanvas } from '../panels/canvas/canvas-io'
import { logError, notifyError } from '../utils/error-logger'

const AUTOSAVE_DEBOUNCE_MS = 2000

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

async function performSave(): Promise<void> {
  const { filePath, isDirty } = useCanvasStore.getState()
  if (!filePath || !isDirty) return

  const canvasFile = useCanvasStore.getState().toCanvasFile()
  try {
    await saveCanvas(filePath, canvasFile)
    useCanvasStore.getState().markSaved()
  } catch (err) {
    notifyError('canvas-autosave', err, 'Failed to save canvas')
  }
}

function scheduleAutosave(): void {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    void performSave()
  }, AUTOSAVE_DEBOUNCE_MS)
}

/**
 * Flush canvas to disk immediately (for quit/unload).
 */
export async function flushCanvasSave(): Promise<void> {
  if (autosaveTimer !== null) {
    clearTimeout(autosaveTimer)
    autosaveTimer = null
  }
  try {
    await performSave()
  } catch (err) {
    logError('canvas-flush', err)
  }
}

/**
 * Subscribe to canvas store changes and auto-save when dirty.
 * Returns an unsubscribe function.
 */
export function subscribeCanvasAutosave(): () => void {
  let prevDirty = useCanvasStore.getState().isDirty

  const unsub = useCanvasStore.subscribe((state) => {
    if (state.isDirty && !prevDirty) {
      scheduleAutosave()
    }
    prevDirty = state.isDirty
  })

  return () => {
    unsub()
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
  }
}
