import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AuditLogger } from '../../main/services/audit-logger'
import type { AuditEntry } from '../agent-types'

function createTempDir(): string {
  const base = join(tmpdir(), `audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(base, { recursive: true })
  return base
}

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ts: new Date().toISOString(),
    tool: 'vault:read-file',
    args: { filePath: '/vault/notes/hello.md' },
    affectedPaths: ['/vault/notes/hello.md'],
    decision: 'allowed',
    ...overrides
  }
}

/** Wait briefly for fire-and-forget writes to flush. */
function waitForWrite(ms = 100): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('AuditLogger', () => {
  let tempDir: string
  let logDir: string

  beforeEach(() => {
    tempDir = createTempDir()
    logDir = join(tempDir, 'audit')
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('creates log directory if it does not exist', async () => {
    expect(existsSync(logDir)).toBe(false)

    const logger = new AuditLogger(logDir)
    logger.log(makeEntry())

    await waitForWrite()
    expect(existsSync(logDir)).toBe(true)
  })

  it('writes valid NDJSON', async () => {
    const logger = new AuditLogger(logDir)
    const entry = makeEntry({ tool: 'vault:read-file', decision: 'allowed' })

    logger.log(entry)
    await waitForWrite()

    const files = readDir(logDir)
    expect(files.length).toBe(1)

    const content = readFileSync(join(logDir, files[0]), 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(1)

    const parsed = JSON.parse(lines[0])
    expect(parsed.tool).toBe('vault:read-file')
    expect(parsed.decision).toBe('allowed')
    expect(parsed.ts).toBeTruthy()
  })

  it('appends multiple entries to the same file', async () => {
    const logger = new AuditLogger(logDir)

    logger.log(makeEntry({ tool: 'vault:read-file' }))
    logger.log(makeEntry({ tool: 'vault:write-file' }))
    logger.log(makeEntry({ tool: 'mcp:vault.read_file', decision: 'denied' }))

    await waitForWrite(200)

    const files = readDir(logDir)
    expect(files.length).toBe(1)

    const content = readFileSync(join(logDir, files[0]), 'utf-8')
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(3)

    // Each line should parse independently (NDJSON)
    const entries = lines.map((line) => JSON.parse(line))

    // Fire-and-forget writes may not preserve strict ordering,
    // so check by set membership rather than index
    const tools = new Set(entries.map((e: AuditEntry) => e.tool))
    expect(tools.has('vault:read-file')).toBe(true)
    expect(tools.has('vault:write-file')).toBe(true)
    expect(tools.has('mcp:vault.read_file')).toBe(true)

    const denied = entries.find((e: AuditEntry) => e.tool === 'mcp:vault.read_file')
    expect(denied.decision).toBe('denied')
  })

  it('includes date in filename for daily rotation', async () => {
    const logger = new AuditLogger(logDir)
    logger.log(makeEntry())

    await waitForWrite()

    const files = readDir(logDir)
    expect(files.length).toBe(1)

    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const expectedFilename = `audit-${yyyy}-${mm}-${dd}.ndjson`

    expect(files[0]).toBe(expectedFilename)
  })

  it('handles concurrent writes without data loss', async () => {
    const logger = new AuditLogger(logDir)
    const count = 20

    // Fire all writes concurrently
    for (let i = 0; i < count; i++) {
      logger.log(makeEntry({ tool: `tool-${i}` }))
    }

    await waitForWrite(500)

    const files = readDir(logDir)
    const content = readFileSync(join(logDir, files[0]), 'utf-8')
    const lines = content.trim().split('\n')

    // All entries should be valid JSON
    const entries = lines.map((line) => JSON.parse(line))
    expect(entries.length).toBe(count)

    // All tool names should be present
    const tools = new Set(entries.map((e: AuditEntry) => e.tool))
    for (let i = 0; i < count; i++) {
      expect(tools.has(`tool-${i}`)).toBe(true)
    }
  })

  it('preserves all AuditEntry fields', async () => {
    const logger = new AuditLogger(logDir)
    const entry = makeEntry({
      ts: '2026-03-25T12:00:00.000Z',
      tool: 'mcp:vault.read_file',
      args: { filePath: '/vault/secret.md', format: 'utf-8' },
      affectedPaths: ['/vault/secret.md'],
      decision: 'denied',
      durationMs: 42,
      error: 'Path is outside vault boundary'
    })

    logger.log(entry)
    await waitForWrite()

    const files = readDir(logDir)
    const content = readFileSync(join(logDir, files[0]), 'utf-8')
    const parsed = JSON.parse(content.trim())

    expect(parsed.ts).toBe('2026-03-25T12:00:00.000Z')
    expect(parsed.tool).toBe('mcp:vault.read_file')
    expect(parsed.args).toEqual({ filePath: '/vault/secret.md', format: 'utf-8' })
    expect(parsed.affectedPaths).toEqual(['/vault/secret.md'])
    expect(parsed.decision).toBe('denied')
    expect(parsed.durationMs).toBe(42)
    expect(parsed.error).toBe('Path is outside vault boundary')
  })

  it('does not crash on write errors', async () => {
    // Point to a path that can't be written (read-only parent)
    // On most systems, /proc or similar is read-only
    // If this doesn't work, the test verifies the error handling path
    const badLogger = new AuditLogger('/nonexistent/deeply/nested/audit')

    // Should not throw -- fire-and-forget handles errors silently
    expect(() => badLogger.log(makeEntry())).not.toThrow()

    await waitForWrite()
    // If we get here without crashing, the test passes
  })
})

/** Read directory entries, sorted for deterministic assertions. */
function readDir(dir: string): string[] {
  try {
    return readdirSync(dir).map(String).sort()
  } catch {
    return []
  }
}
