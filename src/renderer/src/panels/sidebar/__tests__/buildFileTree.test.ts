import { describe, expect, it } from 'vitest'
import { buildFileTree, buildFileTreeIndex } from '../buildFileTree'

describe('buildFileTree', () => {
  const vaultRoot = '/vault'
  const indexFiles = [
    { path: '/vault/zeta.md', modified: '2026-03-29T08:00:00.000Z' },
    { path: '/vault/alpha.ts', modified: '2026-03-30T09:00:00.000Z' },
    { path: '/vault/notes/beta.md', modified: '2026-03-28T07:00:00.000Z' }
  ]
  const sortFiles = [
    { path: '/vault/zeta.md', modified: '2026-03-29T08:00:00.000Z' },
    { path: '/vault/alpha.ts', modified: '2026-03-30T09:00:00.000Z' },
    { path: '/vault/beta.md', modified: '2026-03-28T07:00:00.000Z' }
  ]

  it('builds a direct child index without repeated full-list scanning', () => {
    const index = buildFileTreeIndex(indexFiles, vaultRoot, (path) => {
      if (path.endsWith('.ts')) return 'code'
      if (path.endsWith('.md')) return 'note'
      return 'file'
    })

    expect(index.childPathsByParent.get(vaultRoot)).toEqual([
      '/vault/notes',
      '/vault/alpha.ts',
      '/vault/zeta.md'
    ])
    expect(index.childPathsByParent.get('/vault/notes')).toEqual(['/vault/notes/beta.md'])
  })

  it('sorts siblings by modified time when requested', () => {
    const nodes = buildFileTree(sortFiles, vaultRoot, {
      sortMode: 'modified',
      getSortType: (path) => (path.endsWith('.ts') ? 'code' : 'note')
    })

    expect(nodes.filter((node) => !node.isDirectory).map((node) => node.name)).toEqual([
      'alpha.ts',
      'zeta.md',
      'beta.md'
    ])
  })

  it('sorts siblings by name when requested', () => {
    const nodes = buildFileTree(sortFiles, vaultRoot, {
      sortMode: 'name',
      getSortType: (path) => (path.endsWith('.ts') ? 'code' : 'note')
    })

    expect(nodes.filter((node) => !node.isDirectory).map((node) => node.name)).toEqual([
      'alpha.ts',
      'beta.md',
      'zeta.md'
    ])
  })

  it('sorts siblings by type when requested', () => {
    const nodes = buildFileTree(sortFiles, vaultRoot, {
      sortMode: 'type',
      getSortType: (path) => (path.endsWith('.ts') ? 'code' : 'note')
    })

    expect(nodes.filter((node) => !node.isDirectory).map((node) => node.name)).toEqual([
      'alpha.ts',
      'beta.md',
      'zeta.md'
    ])
  })
})
