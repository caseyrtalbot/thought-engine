import type { BrowserWindow } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { readdir, stat, open } from 'fs/promises'
import { join, basename } from 'path'
import { homedir } from 'os'
import { randomUUID } from 'crypto'
import { toDirKey, extractToolEvents } from './session-utils'
import { groupEventsIntoMilestones } from './session-milestone-grouper'
import { typedSend } from '../typed-ipc'
import type { SessionMilestone } from '@shared/workbench-types'

const SESSION_CHECK_INTERVAL_MS = 5000

/** Derive a stable sessionId from a .jsonl filename (matches ProjectSessionParser). */
export function sessionIdFromFile(filePath: string): string {
  return basename(filePath, '.jsonl')
}

interface TailedSession {
  readonly sessionId: string
  readonly filePath: string
  watcher: FSWatcher
  fileOffset: number
  lineBuffer: string
}

export class SessionTailer {
  private readonly mainWindow: BrowserWindow
  private dirWatcher: FSWatcher | null = null
  private readonly sessions = new Map<string, TailedSession>()
  private checkInterval: ReturnType<typeof setInterval> | null = null
  private claudeDir = ''

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  async start(projectPath: string): Promise<void> {
    await this.stop()

    const dirKey = toDirKey(projectPath)
    this.claudeDir = join(homedir(), '.claude', 'projects', dirKey)

    // Discover existing .jsonl files and start tailing all of them
    const files = await this.listSessionFiles()
    for (const filePath of files) {
      await this.startTailingSession(filePath)
    }

    // Watch the directory for new/removed .jsonl files
    this.startDirectoryWatch()

    // Periodic scan as a fallback (chokidar may miss events in some cases)
    this.checkInterval = setInterval(async () => {
      await this.reconcileSessions()
    }, SESSION_CHECK_INTERVAL_MS)
  }

  async stop(): Promise<void> {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    if (this.dirWatcher) {
      await this.dirWatcher.close()
      this.dirWatcher = null
    }

    // Close all per-session watchers
    const closePromises = Array.from(this.sessions.values()).map(async (session) => {
      await session.watcher.close()
    })
    await Promise.all(closePromises)
    this.sessions.clear()
    this.claudeDir = ''
  }

  /** Exposed for testing: returns the set of currently tracked session IDs. */
  getTrackedSessionIds(): ReadonlySet<string> {
    return new Set(this.sessions.keys())
  }

  private async listSessionFiles(): Promise<string[]> {
    try {
      const entries = await readdir(this.claudeDir)
      return entries.filter((f) => f.endsWith('.jsonl')).map((f) => join(this.claudeDir, f))
    } catch {
      return []
    }
  }

  private startDirectoryWatch(): void {
    try {
      this.dirWatcher = watch(this.claudeDir, {
        persistent: true,
        ignoreInitial: true,
        depth: 0,
        usePolling: true,
        interval: 500
      })

      this.dirWatcher.on('add', (filePath: string) => {
        if (typeof filePath === 'string' && filePath.endsWith('.jsonl')) {
          void this.startTailingSession(filePath)
        }
      })

      this.dirWatcher.on('unlink', (filePath: string) => {
        if (typeof filePath === 'string' && filePath.endsWith('.jsonl')) {
          void this.stopTailingSession(filePath)
        }
      })
    } catch {
      // Directory may not exist yet; reconcile loop will pick up new files
    }
  }

  /** Reconcile tracked sessions with what is actually on disk. */
  private async reconcileSessions(): Promise<void> {
    const currentFiles = await this.listSessionFiles()
    const currentPaths = new Set(currentFiles)

    // Start tailing any new files
    for (const filePath of currentFiles) {
      const sid = sessionIdFromFile(filePath)
      if (!this.sessions.has(sid)) {
        await this.startTailingSession(filePath)
      }
    }

    // Stop tailing removed files
    for (const [_sid, session] of this.sessions) {
      if (!currentPaths.has(session.filePath)) {
        await this.stopTailingSession(session.filePath)
      }
    }
  }

  private async startTailingSession(filePath: string): Promise<void> {
    const sessionId = sessionIdFromFile(filePath)

    // Already tracking this session
    if (this.sessions.has(sessionId)) return

    // Seek to end so existing content is not replayed
    let fileOffset = 0
    try {
      const s = await stat(filePath)
      fileOffset = s.size
    } catch {
      fileOffset = 0
    }

    const sessionWatcher = watch(filePath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 25 },
      usePolling: true,
      interval: 100
    })

    const session: TailedSession = {
      sessionId,
      filePath,
      watcher: sessionWatcher,
      fileOffset,
      lineBuffer: ''
    }

    this.sessions.set(sessionId, session)

    sessionWatcher.on('change', () => {
      void this.readNewContent(sessionId)
    })

    // Emit session detected event
    typedSend(this.mainWindow, 'session:detected', {
      active: true,
      sessionId
    })

    // Emit a session-switched milestone so the renderer knows about the new session
    const milestone: SessionMilestone = {
      id: randomUUID(),
      sessionId,
      type: 'session-switched',
      timestamp: Date.now(),
      summary: `Session started: ${sessionId.slice(0, 8)}`,
      files: [],
      events: []
    }
    typedSend(this.mainWindow, 'session:milestone', milestone)
  }

  private async stopTailingSession(filePath: string): Promise<void> {
    const sessionId = sessionIdFromFile(filePath)
    const session = this.sessions.get(sessionId)
    if (!session) return

    await session.watcher.close()
    this.sessions.delete(sessionId)

    typedSend(this.mainWindow, 'session:detected', {
      active: false,
      sessionId
    })
  }

  private async readNewContent(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    try {
      const fh = await open(session.filePath, 'r')
      try {
        const s = await fh.stat()
        if (s.size <= session.fileOffset) return

        const bytesToRead = s.size - session.fileOffset
        const buffer = Buffer.alloc(bytesToRead)
        await fh.read(buffer, 0, bytesToRead, session.fileOffset)
        session.fileOffset = s.size

        const text = session.lineBuffer + buffer.toString('utf-8')
        const lines = text.split('\n')

        // Last element is either empty (ended with \n) or incomplete line
        session.lineBuffer = lines.pop() ?? ''

        const allEvents = lines.filter((l) => l.trim()).flatMap((l) => extractToolEvents(l))

        if (allEvents.length > 0) {
          const milestones = groupEventsIntoMilestones(allEvents, sessionId)
          for (const milestone of milestones) {
            typedSend(this.mainWindow, 'session:milestone', milestone)
          }
        }
      } finally {
        await fh.close()
      }
    } catch {
      // File read error - will retry on next change event
    }
  }
}
