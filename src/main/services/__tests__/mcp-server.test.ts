/**
 * Tests for the Thought Engine MCP server.
 *
 * Uses the MCP SDK's in-memory transport for testing server behavior
 * without stdio.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { createMcpServer } from '../mcp-server'
import { PathGuard } from '../path-guard'
import { AuditLogger } from '../audit-logger'
import { VaultQueryFacade } from '../vault-query-facade'
import { SearchEngine } from '@shared/engine/search-engine'
import { VaultIndex } from '@shared/engine/indexer'

function createTestVault(): string {
  const base = join(tmpdir(), `mcp-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(join(base, 'notes'), { recursive: true })
  writeFileSync(
    join(base, 'notes', 'hello.md'),
    '---\nid: hello\ntitle: Hello\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags:\n  - greeting\nconnections:\n  - world\n---\n\n# Hello World\n\nThis is a test note about greetings.\n'
  )
  writeFileSync(
    join(base, 'notes', 'world.md'),
    '---\nid: world\ntitle: World\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags:\n  - place\n---\n\n# World\n\nThe world is vast.\n'
  )
  return realpathSync(base)
}

function buildTestDeps(vaultRoot: string) {
  const guard = new PathGuard(vaultRoot)
  const logger = new AuditLogger(join(vaultRoot, '.te', 'audit'))
  const searchEngine = new SearchEngine()
  const vaultIndex = new VaultIndex()

  // Index files for search and graph
  const helloContent =
    '---\nid: hello\ntitle: Hello\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags:\n  - greeting\nconnections:\n  - world\n---\n\n# Hello World\n\nThis is a test note about greetings.\n'
  const worldContent =
    '---\nid: world\ntitle: World\ntype: note\ncreated: 2026-01-01\nmodified: 2026-01-01\ntags:\n  - place\n---\n\n# World\n\nThe world is vast.\n'

  vaultIndex.addFile('hello.md', helloContent)
  vaultIndex.addFile('world.md', worldContent)

  searchEngine.upsert({
    id: 'hello',
    title: 'Hello',
    tags: ['greeting'],
    body: 'This is a test note about greetings.',
    path: join(vaultRoot, 'notes', 'hello.md')
  })
  searchEngine.upsert({
    id: 'world',
    title: 'World',
    tags: ['place'],
    body: 'The world is vast.',
    path: join(vaultRoot, 'notes', 'world.md')
  })

  const facade = new VaultQueryFacade(guard, logger, vaultRoot, {
    searchEngine,
    vaultIndex
  })

  return { facade, logger, guard }
}

async function createConnectedPair(vaultRoot: string) {
  const { facade, logger } = buildTestDeps(vaultRoot)
  const server = createMcpServer(facade)

  const client = new Client({ name: 'test-client', version: '1.0.0' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

  await server.connect(serverTransport)
  await client.connect(clientTransport)

  return { server, client, logger }
}

describe('MCP Server', () => {
  let vaultRoot: string

  beforeEach(() => {
    vaultRoot = createTestVault()
  })

  afterEach(() => {
    rmSync(vaultRoot, { recursive: true, force: true })
  })

  it('lists 3 registered tools', async () => {
    const { client, server } = await createConnectedPair(vaultRoot)

    const { tools } = await client.listTools()
    const toolNames = tools.map((t) => t.name).sort()

    expect(toolNames).toEqual(['graph.get_neighbors', 'search.query', 'vault.read_file'])

    await client.close()
    await server.close()
  })

  it('vault.read_file returns content wrapped in spotlighting trust envelope', async () => {
    const { client, server } = await createConnectedPair(vaultRoot)

    const result = await client.callTool({
      name: 'vault.read_file',
      arguments: { path: join(vaultRoot, 'notes', 'hello.md') }
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('<tool_result tool="vault.read_file" trust="user_content">')
    expect(text).toContain('<content>')
    expect(text).toContain('# Hello World')
    expect(text).toContain('</content>')
    expect(text).toContain('</tool_result>')
    expect(text).toContain(`path="${join(vaultRoot, 'notes', 'hello.md')}"`)

    await client.close()
    await server.close()
  })

  it('denied vault.read_file produces audit entry', async () => {
    const { facade, logger } = buildTestDeps(vaultRoot)
    const logSpy = vi.spyOn(logger, 'log')
    const server = createMcpServer(facade)

    const client = new Client({ name: 'test-client', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)

    await client.callTool({
      name: 'vault.read_file',
      arguments: { path: '/etc/passwd' }
    })

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: 'vault.read_file',
        decision: 'denied'
      })
    )

    await client.close()
    await server.close()
  })

  it('blocks path traversal at MCP tool level', async () => {
    const { client, server } = await createConnectedPair(vaultRoot)

    const result = await client.callTool({
      name: 'vault.read_file',
      arguments: { path: '/etc/passwd' }
    })

    // MCP tools return isError for failures
    expect(result.isError).toBe(true)
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    expect(text).toContain('Path guard violation')

    await client.close()
    await server.close()
  })

  it('graph.get_neighbors returns nodes and edges', async () => {
    const { client, server } = await createConnectedPair(vaultRoot)

    const result = await client.callTool({
      name: 'graph.get_neighbors',
      arguments: { nodeId: 'hello' }
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const parsed = JSON.parse(text)
    expect(parsed.edges).toHaveLength(1)
    expect(parsed.edges[0]).toEqual(
      expect.objectContaining({ source: 'hello', target: 'world', kind: 'connection' })
    )
    expect(parsed.nodes.map((n: { id: string }) => n.id)).toContain('world')

    await client.close()
    await server.close()
  })

  it('search.query returns ranked results', async () => {
    const { client, server } = await createConnectedPair(vaultRoot)

    const result = await client.callTool({
      name: 'search.query',
      arguments: { query: 'greeting' }
    })

    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const hits = JSON.parse(text)
    expect(hits).toHaveLength(1)
    expect(hits[0].title).toBe('Hello')
    expect(hits[0].score).toBeGreaterThan(0)

    await client.close()
    await server.close()
  })
})
