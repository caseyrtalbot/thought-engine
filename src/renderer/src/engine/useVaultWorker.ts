import { useRef, useCallback, useEffect } from 'react'
import type { WorkerResult } from './types'

interface VaultWorkerActions {
  loadFiles: (files: Array<{ path: string; content: string }>) => void
  appendFiles: (files: Array<{ path: string; content: string }>) => void
  updateFile: (path: string, content: string) => void
  removeFile: (path: string) => void
}

export function useVaultWorker(onResult: (result: WorkerResult) => void): VaultWorkerActions {
  const workerRef = useRef<Worker | null>(null)
  const onResultRef = useRef(onResult)

  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  useEffect(() => {
    const worker = new Worker(new URL('./vault-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent) => onResultRef.current(e.data)
    worker.onerror = (err) => console.error('[VaultWorker] Error:', err)
    workerRef.current = worker
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const loadFiles = useCallback((files: Array<{ path: string; content: string }>) => {
    workerRef.current?.postMessage({ type: 'load', files })
  }, [])

  const appendFiles = useCallback((files: Array<{ path: string; content: string }>) => {
    workerRef.current?.postMessage({ type: 'append', files })
  }, [])

  const updateFile = useCallback((path: string, content: string) => {
    workerRef.current?.postMessage({ type: 'update', path, content })
  }, [])

  const removeFile = useCallback((path: string) => {
    workerRef.current?.postMessage({ type: 'remove', path })
  }, [])

  return { loadFiles, appendFiles, updateFile, removeFile }
}
