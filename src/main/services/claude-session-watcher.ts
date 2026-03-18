import { watch, type FSWatcher } from 'chokidar'
import { basename, relative } from 'path'
import { stat, open } from 'fs/promises'
import type { ClaudeActivityEvent, ClaudeActivityKind } from '@shared/ipc-channels'

export type ActivityCallback = (event: ClaudeActivityEvent) => void

const IGNORED_NAMES = new Set(['.DS_Store', '.thought-engine-canvas.json'])

const IGNORED_DIRS = ['cache', 'debug', 'paste-cache', 'file-history', 'backups', 'image-cache']

function shouldIgnore(filePath: string, configPath: string): boolean {
  const name = basename(filePath)
  if (IGNORED_NAMES.has(name)) return true

  const rel = relative(configPath, filePath)
  for (const dir of IGNORED_DIRS) {
    if (rel.startsWith(dir + '/') || rel === dir) return true
  }
  return false
}

export class ClaudeSessionWatcher {
  private watcher: FSWatcher | null = null
  private lastHistorySize = 0
  private configPath = ''

  async start(configPath: string, onActivity: ActivityCallback): Promise<void> {
    await this.stop()
    this.configPath = configPath

    // Get initial history file size so we only read new appends
    try {
      const historyStat = await stat(configPath + '/history.jsonl')
      this.lastHistorySize = historyStat.size
    } catch {
      this.lastHistorySize = 0
    }

    this.watcher = watch(configPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      ignored: /(^|[/\\])\../
    })

    this.watcher
      .on('add', (path) => this.handleFileEvent(path, 'add', onActivity))
      .on('change', (path) => this.handleFileEvent(path, 'change', onActivity))
      .on('unlink', (path) => this.handleFileEvent(path, 'unlink', onActivity))
      .on('error', (err) => console.error('Claude watcher error:', err))
  }

  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
    }
    this.lastHistorySize = 0
  }

  private handleFileEvent(
    filePath: string,
    event: 'add' | 'change' | 'unlink',
    onActivity: ActivityCallback
  ): void {
    if (shouldIgnore(filePath, this.configPath)) return

    const rel = relative(this.configPath, filePath)

    // history.jsonl tailing
    if (rel === 'history.jsonl' && event === 'change') {
      this.tailHistory(filePath, onActivity)
      return
    }

    // Session PID files
    if (rel.startsWith('sessions/')) {
      const kind: ClaudeActivityKind = event === 'unlink' ? 'session-end' : 'session-start'
      const sessionId = basename(filePath, '.pid')
      onActivity({
        kind,
        timestamp: Date.now(),
        sessionId,
        filePath
      })
      return
    }

    // Config file changes (.md, .json, .ts files)
    if (/\.(md|json|ts)$/.test(filePath)) {
      onActivity({
        kind: 'config-changed',
        timestamp: Date.now(),
        filePath
      })
    }
  }

  private async tailHistory(filePath: string, onActivity: ActivityCallback): Promise<void> {
    try {
      const fileStat = await stat(filePath)
      const newSize = fileStat.size
      if (newSize <= this.lastHistorySize) {
        this.lastHistorySize = newSize
        return
      }

      const bytesToRead = newSize - this.lastHistorySize
      const buffer = Buffer.alloc(bytesToRead)
      const fd = await open(filePath, 'r')
      try {
        await fd.read(buffer, 0, bytesToRead, this.lastHistorySize)
      } finally {
        await fd.close()
      }
      this.lastHistorySize = newSize

      // Parse the last complete JSONL line
      const text = buffer.toString('utf-8').trim()
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length === 0) return

      const lastLine = lines[lines.length - 1]
      try {
        const parsed = JSON.parse(lastLine)
        onActivity({
          kind: 'prompt',
          timestamp: Date.now(),
          promptText: parsed.message ?? parsed.prompt ?? '',
          sessionId: parsed.sessionId
        })
      } catch {
        // Malformed JSONL line, skip
      }
    } catch {
      // File may have been truncated or deleted
    }
  }
}
