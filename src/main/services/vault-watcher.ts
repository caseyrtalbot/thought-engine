import { watch, type FSWatcher } from 'chokidar'
import { EventBatcher, type BatchedEvent } from './event-batcher'
import { loadGitignoreFilter, shouldIgnore } from './gitignore-filter'
import { TE_DIR } from '@shared/constants'
import type { Ignore } from 'ignore'

type FileEvent = 'add' | 'change' | 'unlink'
type BatchChangeCallback = (events: BatchedEvent[]) => void

export const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  TE_DIR,
  'dist',
  'build',
  'out',
  '.git',
  '.DS_Store',
  '.*'
] as const

const BATCH_INTERVAL_MS = 50

export class VaultWatcher {
  private watcher: FSWatcher | null = null
  private batcher: EventBatcher | null = null
  private ready = false
  private lastEventAt = 0
  private lastError: { error: string; at: number } | null = null

  async start(
    vaultPath: string,
    onBatch: BatchChangeCallback,
    customIgnorePatterns: readonly string[] = []
  ): Promise<void> {
    await this.stop()

    this.batcher = new EventBatcher(onBatch, BATCH_INTERVAL_MS)

    const ig = await loadGitignoreFilter(vaultPath, DEFAULT_IGNORE_PATTERNS, customIgnorePatterns)

    this.watcher = watch(vaultPath, {
      ignored: (path: string) => shouldIgnore(ig, vaultPath, path),
      persistent: true,
      ignoreInitial: true,
      followSymlinks: false,
      atomic: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 }
    })

    this.watcher.on('ready', () => {
      this.ready = true
    })

    const enqueue = (event: FileEvent) => (path: string) => {
      this.lastEventAt = Date.now()
      this.batcher?.enqueue(path, event)
    }

    this.watcher
      .on('add', enqueue('add'))
      .on('change', enqueue('change'))
      .on('unlink', enqueue('unlink'))
      .on('error', (err) => {
        this.lastError = { error: String(err), at: Date.now() }
      })
  }

  async stop(): Promise<void> {
    if (this.batcher) {
      this.batcher.stop()
      this.batcher = null
    }
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.ready = false
    this.lastEventAt = 0
    this.lastError = null
  }

  getHealthSnapshot(): {
    ready: boolean
    lastEventAt: number
    lastError: { error: string; at: number } | null
  } {
    return { ready: this.ready, lastEventAt: this.lastEventAt, lastError: this.lastError }
  }
}

/**
 * Creates a gitignore-aware filter for use outside the watcher (e.g. file listing).
 * Returns an Ignore instance that can be used with shouldIgnore().
 */
export async function createVaultIgnoreFilter(
  vaultPath: string,
  customIgnorePatterns: readonly string[] = []
): Promise<Ignore> {
  return loadGitignoreFilter(vaultPath, DEFAULT_IGNORE_PATTERNS, customIgnorePatterns)
}
