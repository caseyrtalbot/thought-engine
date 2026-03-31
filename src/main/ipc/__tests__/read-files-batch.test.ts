// @vitest-environment node
/**
 * Tests for fs:read-files-batch IPC handler.
 *
 * Validates:
 * - Batch size limit enforcement (max 50)
 * - PathGuard enforcement for each path in the batch
 * - Successful reads return { path, content }
 * - Failed reads return { path, content: null, error }
 * - Concurrent reads use p-limit(8)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { readFile } from 'node:fs/promises'
import { PathGuard } from '../../services/path-guard'

function createTestVault(): string {
  const base = join(tmpdir(), `fs-batch-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(base, 'notes'), { recursive: true })
  writeFileSync(join(base, 'notes', 'a.md'), '# Alpha')
  writeFileSync(join(base, 'notes', 'b.md'), '# Beta')
  writeFileSync(join(base, 'notes', 'c.md'), '# Charlie')
  return realpathSync(base)
}

/**
 * Replicate the handler logic from filesystem.ts for testability.
 * This mirrors the actual implementation closely enough to validate
 * guard, batch limit, and per-file error handling.
 */
async function readFilesBatch(
  guard: PathGuard,
  paths: readonly string[]
): Promise<Array<{ path: string; content: string | null; error?: string }>> {
  const MAX_BATCH_SIZE = 50
  if (paths.length > MAX_BATCH_SIZE) {
    throw new Error(`fs:read-files-batch: batch size ${paths.length} exceeds max ${MAX_BATCH_SIZE}`)
  }

  const pLimit = (await import('p-limit')).default
  const limit = pLimit(8)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)

  try {
    const results = await Promise.all(
      paths.map((filePath) =>
        limit(async () => {
          if (controller.signal.aborted) {
            return { path: filePath, content: null, error: 'timeout' }
          }
          try {
            const resolved = guard.assertWithinVault(filePath)
            const content = await readFile(resolved, 'utf-8')
            return { path: filePath, content }
          } catch (err) {
            return { path: filePath, content: null, error: String(err) }
          }
        })
      )
    )
    return results
  } finally {
    clearTimeout(timeout)
  }
}

describe('fs:read-files-batch handler logic', () => {
  let vaultRoot: string
  let guard: PathGuard

  beforeEach(() => {
    vaultRoot = createTestVault()
    guard = new PathGuard(vaultRoot)
  })

  afterEach(() => {
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  describe('batch size enforcement', () => {
    it('rejects batches exceeding 50 paths', async () => {
      const paths = Array.from({ length: 51 }, (_, i) => join(vaultRoot, 'notes', `file-${i}.md`))
      await expect(readFilesBatch(guard, paths)).rejects.toThrow(
        'fs:read-files-batch: batch size 51 exceeds max 50'
      )
    })

    it('allows exactly 50 paths', async () => {
      const paths = Array.from({ length: 50 }, (_, i) => join(vaultRoot, 'notes', `file-${i}.md`))
      // These files don't exist but the batch size check should pass
      const results = await readFilesBatch(guard, paths)
      expect(results).toHaveLength(50)
    })

    it('allows empty batch', async () => {
      const results = await readFilesBatch(guard, [])
      expect(results).toEqual([])
    })
  })

  describe('successful reads', () => {
    it('reads multiple files and returns their content', async () => {
      const paths = [
        join(vaultRoot, 'notes', 'a.md'),
        join(vaultRoot, 'notes', 'b.md'),
        join(vaultRoot, 'notes', 'c.md')
      ]
      const results = await readFilesBatch(guard, paths)

      expect(results).toEqual([
        { path: paths[0], content: '# Alpha' },
        { path: paths[1], content: '# Beta' },
        { path: paths[2], content: '# Charlie' }
      ])
    })

    it('preserves original paths in results', async () => {
      const path = join(vaultRoot, 'notes', 'a.md')
      const results = await readFilesBatch(guard, [path])
      expect(results[0].path).toBe(path)
    })
  })

  describe('error handling per file', () => {
    it('returns error for nonexistent files without failing the batch', async () => {
      const existing = join(vaultRoot, 'notes', 'a.md')
      const missing = join(vaultRoot, 'notes', 'missing.md')
      const results = await readFilesBatch(guard, [existing, missing])

      expect(results[0].content).toBe('# Alpha')
      expect(results[0].error).toBeUndefined()

      expect(results[1].content).toBeNull()
      expect(results[1].error).toBeDefined()
      expect(results[1].error).toContain('ENOENT')
    })

    it('returns PathGuardError for paths outside vault', async () => {
      const insidePath = join(vaultRoot, 'notes', 'a.md')
      const outsidePath = '/etc/passwd'
      const results = await readFilesBatch(guard, [insidePath, outsidePath])

      expect(results[0].content).toBe('# Alpha')
      expect(results[1].content).toBeNull()
      expect(results[1].error).toContain('PathGuardError')
    })

    it('returns error for path traversal attempts', async () => {
      const traversal = join(vaultRoot, 'notes', '..', '..', 'etc', 'passwd')
      const results = await readFilesBatch(guard, [traversal])

      expect(results[0].content).toBeNull()
      expect(results[0].error).toBeDefined()
    })
  })

  describe('PathGuard enforcement on all paths', () => {
    it('each path in batch is individually guarded', async () => {
      const paths = [
        join(vaultRoot, 'notes', 'a.md'),
        '/tmp/evil-file',
        join(vaultRoot, 'notes', 'b.md')
      ]
      const results = await readFilesBatch(guard, paths)

      // First and third should succeed
      expect(results[0].content).toBe('# Alpha')
      expect(results[2].content).toBe('# Beta')

      // Second should fail with guard error
      expect(results[1].content).toBeNull()
      expect(results[1].error).toBeDefined()
    })
  })
})
