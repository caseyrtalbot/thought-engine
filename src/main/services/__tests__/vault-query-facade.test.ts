/**
 * Tests for VaultQueryFacade: wraps VaultIndex + PathGuard + AuditLogger
 * to provide safe, audited read-only access to vault content.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { VaultQueryFacade } from '../vault-query-facade'
import { PathGuard } from '../path-guard'
import { AuditLogger } from '../audit-logger'
import { PathGuardError } from '@shared/agent-types'
import { SearchEngine } from '@shared/engine/search-engine'
import { VaultIndex } from '@shared/engine/indexer'

function createTestVault(): string {
  const base = join(tmpdir(), `vqf-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(base, 'notes'), { recursive: true })
  writeFileSync(
    join(base, 'notes', 'hello.md'),
    '---\nid: hello\ntitle: Hello\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags: []\n---\n\n# Hello World\n'
  )
  return realpathSync(base)
}

describe('VaultQueryFacade', () => {
  let vaultRoot: string
  let facade: VaultQueryFacade

  beforeEach(() => {
    vaultRoot = createTestVault()
    const guard = new PathGuard(vaultRoot)
    const logger = new AuditLogger(join(vaultRoot, '.te', 'audit'))
    facade = new VaultQueryFacade(guard, logger, vaultRoot)
  })

  afterEach(() => {
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  it('readFile returns content for a valid vault path', async () => {
    const content = await facade.readFile(join(vaultRoot, 'notes', 'hello.md'))
    expect(content).toContain('# Hello World')
  })

  it('readFile rejects path outside vault', async () => {
    await expect(facade.readFile('/etc/passwd')).rejects.toThrow(PathGuardError)
  })

  it('search returns results matching query', () => {
    const searchEngine = new SearchEngine()
    searchEngine.upsert({
      id: 'hello',
      title: 'Hello',
      tags: [],
      body: 'Hello World',
      path: join(vaultRoot, 'notes', 'hello.md')
    })
    const guard = new PathGuard(vaultRoot)
    const logger = new AuditLogger(join(vaultRoot, '.te', 'audit'))
    const index = new VaultIndex()
    const searchFacade = new VaultQueryFacade(guard, logger, vaultRoot, {
      searchEngine,
      vaultIndex: index
    })

    const results = searchFacade.search('Hello')
    expect(results).toHaveLength(1)
    expect(results[0].title).toBe('Hello')
  })

  it('getNeighbors returns edges for a node', () => {
    const index = new VaultIndex()
    index.addFile(
      'hello.md',
      '---\nid: hello\ntitle: Hello\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags: []\nconnections:\n  - world\n---\n\nHello body\n'
    )
    index.addFile(
      'world.md',
      '---\nid: world\ntitle: World\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags: []\n---\n\nWorld body\n'
    )
    const guard = new PathGuard(vaultRoot)
    const logger = new AuditLogger(join(vaultRoot, '.te', 'audit'))
    const neighborFacade = new VaultQueryFacade(guard, logger, vaultRoot, {
      vaultIndex: index
    })

    const result = neighborFacade.getNeighbors('hello')
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]).toEqual(
      expect.objectContaining({ source: 'hello', target: 'world', kind: 'connection' })
    )
    expect(result.nodes.map((n) => n.id)).toContain('world')
  })

  it('readFile logs an audit entry on success', async () => {
    const logger = new AuditLogger(join(vaultRoot, '.te', 'audit'))
    const logSpy = vi.spyOn(logger, 'log')
    const guard = new PathGuard(vaultRoot)
    const spiedFacade = new VaultQueryFacade(guard, logger, vaultRoot)

    await spiedFacade.readFile(join(vaultRoot, 'notes', 'hello.md'))

    expect(logSpy).toHaveBeenCalledOnce()
    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'vault.read_file',
        decision: 'allowed'
      })
    )
  })
})
