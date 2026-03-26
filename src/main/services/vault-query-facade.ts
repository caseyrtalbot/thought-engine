/**
 * VaultQueryFacade: safe, audited read-only access to vault content.
 *
 * Wraps PathGuard (boundary enforcement) and AuditLogger (security audit trail)
 * to provide read-only query methods for the MCP server.
 */
import { readFile } from 'node:fs/promises'
import { PathGuardError } from '@shared/agent-types'
import type { PathGuard } from './path-guard'
import type { AuditLogger } from './audit-logger'
import type { SearchEngine, SearchHit } from '@shared/engine/search-engine'
import type { VaultIndex } from '@shared/engine/indexer'
import type { GraphNode, GraphEdge } from '@shared/types'

export interface VaultQueryDeps {
  readonly searchEngine?: SearchEngine
  readonly vaultIndex?: VaultIndex
}

export interface NeighborResult {
  readonly nodes: readonly GraphNode[]
  readonly edges: readonly GraphEdge[]
}

export class VaultQueryFacade {
  private readonly searchEngine?: SearchEngine
  private readonly vaultIndex?: VaultIndex

  readonly vaultRoot: string

  constructor(
    private readonly guard: PathGuard,
    private readonly logger: AuditLogger,
    vaultRoot: string,
    deps?: VaultQueryDeps
  ) {
    this.vaultRoot = vaultRoot
    this.searchEngine = deps?.searchEngine
    this.vaultIndex = deps?.vaultIndex
  }

  async readFile(filePath: string): Promise<string> {
    const start = Date.now()
    let resolved: string
    try {
      resolved = this.guard.assertWithinVault(filePath)
    } catch (err) {
      this.logger.log({
        ts: new Date().toISOString(),
        tool: 'vault.read_file',
        args: { path: filePath },
        affectedPaths: [filePath],
        decision: 'denied',
        durationMs: Date.now() - start,
        error: err instanceof PathGuardError ? err.message : String(err)
      })
      throw err
    }
    const content = await readFile(resolved, 'utf-8')
    this.logger.log({
      ts: new Date().toISOString(),
      tool: 'vault.read_file',
      args: { path: filePath },
      affectedPaths: [resolved],
      decision: 'allowed',
      durationMs: Date.now() - start
    })
    return content
  }

  search(query: string, limit?: number): readonly SearchHit[] {
    if (!this.searchEngine) return []
    return this.searchEngine.search(query, limit)
  }

  getNeighbors(nodeId: string): NeighborResult {
    if (!this.vaultIndex) return { nodes: [], edges: [] }
    const graph = this.vaultIndex.getGraph()
    const edges = graph.edges.filter((e) => e.source === nodeId || e.target === nodeId)
    const neighborIds = new Set<string>()
    for (const e of edges) {
      if (e.source !== nodeId) neighborIds.add(e.source)
      if (e.target !== nodeId) neighborIds.add(e.target)
    }
    const nodes = graph.nodes.filter((n) => neighborIds.has(n.id))
    return { nodes, edges }
  }
}
