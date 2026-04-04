import { mkdirSync, writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import { is } from '@electron-toolkit/utils'

// ---------------------------------------------------------------------------
// Session metadata persisted as JSON in the user's home directory.
// Dev builds use a separate directory to avoid cross-contamination.
// ---------------------------------------------------------------------------

export interface SessionMeta {
  readonly shell: string
  readonly cwd: string
  readonly createdAt: string
  readonly label?: string
  readonly vaultPath?: string
}

// ---------------------------------------------------------------------------
// Path constants
// ---------------------------------------------------------------------------

const BASE_DIR = is.dev ? '.machina-dev' : '.machina'
const SESSION_DIR_NAME = 'terminal-sessions'

const electronProcess = process as NodeJS.Process & { resourcesPath?: string }

function isPackagedApp(): boolean {
  return !is.dev && typeof electronProcess.resourcesPath === 'string'
}

export function getSessionDir(): string {
  return join(homedir(), BASE_DIR, SESSION_DIR_NAME)
}

export function getTerminfoDir(): string | undefined {
  if (isPackagedApp()) {
    const bundled = join(electronProcess.resourcesPath!, 'terminfo')
    return existsSync(bundled) ? bundled : undefined
  }

  const devDir = join(process.cwd(), 'resources', 'terminfo')
  return existsSync(devDir) ? devDir : undefined
}

// ---------------------------------------------------------------------------
// Metadata CRUD
// ---------------------------------------------------------------------------

export function ensureSessionDir(): void {
  mkdirSync(getSessionDir(), { recursive: true })
}

function metaPath(sessionId: string): string {
  return join(getSessionDir(), `${sessionId}.json`)
}

export function writeSessionMeta(sessionId: string, meta: SessionMeta): void {
  ensureSessionDir()
  writeFileSync(metaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8')
}

export function readSessionMeta(sessionId: string): SessionMeta | null {
  try {
    const raw = readFileSync(metaPath(sessionId), 'utf-8')
    return JSON.parse(raw) as SessionMeta
  } catch {
    return null
  }
}

export function deleteSessionMeta(sessionId: string): void {
  try {
    unlinkSync(metaPath(sessionId))
  } catch {
    // File already gone
  }
}
