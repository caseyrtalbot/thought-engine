import { describe, it, expect } from 'vitest'
import { buildVaultScopeContext } from '../agent-context'

describe('buildVaultScopeContext', () => {
  it('builds context from artifact summaries, tag tree, and ghosts', () => {
    const artifacts = [
      {
        id: 'note-1',
        title: 'Note 1',
        type: 'note',
        signal: 'emerging',
        tags: ['ai'],
        origin: 'human'
      },
      {
        id: 'paper-a',
        title: 'Paper A',
        type: 'research',
        signal: 'untested',
        tags: ['ai', 'ml'],
        origin: 'source'
      }
    ]

    const tagTree = [{ name: 'ai', fullPath: 'ai', count: 2, children: [] }]

    const ghosts = [{ id: 'Unresolved Concept', referenceCount: 3, references: [] }]

    const context = buildVaultScopeContext('challenge', artifacts, tagTree, ghosts, {
      viewportBounds: { x: 0, y: 0, width: 1000, height: 800 },
      totalCardCount: 5
    })

    expect(context.action).toBe('challenge')
    expect(context.vaultScope).toBe(true)
    expect(context.selectedCards.length).toBe(2)
    expect(context.selectedCards[0].body).toContain('Note 1')
    expect(context.selectedCards[0].body).toContain('tags: ai')
  })

  it('includes tag tree and ghost index as neighbors', () => {
    const artifacts = [
      {
        id: 'note-1',
        title: 'Note 1',
        type: 'note',
        signal: 'emerging',
        tags: ['ai'],
        origin: 'human'
      }
    ]

    const tagTree = [{ name: 'ai', fullPath: 'ai', count: 2, children: [] }]

    const ghosts = [{ id: 'Missing Concept', referenceCount: 5, references: [] }]

    const context = buildVaultScopeContext('emerge', artifacts, tagTree, ghosts, {
      viewportBounds: { x: 0, y: 0, width: 1000, height: 800 },
      totalCardCount: 3
    })

    expect(context.neighbors.length).toBe(2)
    expect(context.neighbors[0].title).toContain('Tag Tree')
    expect(context.neighbors[1].title).toContain('Unresolved References')
  })

  it('handles empty inputs gracefully', () => {
    const context = buildVaultScopeContext('challenge', [], [], [], {
      viewportBounds: { x: 0, y: 0, width: 1000, height: 800 },
      totalCardCount: 0
    })

    expect(context.vaultScope).toBe(true)
    expect(context.selectedCards.length).toBe(0)
    expect(context.neighbors.length).toBe(0)
  })
})
