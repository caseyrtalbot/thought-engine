import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CanvasNode } from '@shared/canvas-types'

// Mock CardShell to a simple pass-through that renders title + children
vi.mock('../CardShell', () => ({
  CardShell: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div data-testid="card-shell">
      <div data-testid="card-title">{title}</div>
      <div data-testid="card-content">{children}</div>
    </div>
  )
}))

// Mock canvas store
vi.mock('../../../store/canvas-store', () => ({
  useCanvasStore: Object.assign(
    (selector: (s: Record<string, unknown>) => unknown) =>
      selector({
        removeNode: vi.fn()
      }),
    {
      getState: () => ({
        removeNode: vi.fn()
      })
    }
  )
}))

function makeAgentSessionNode(metaOverrides?: Partial<Record<string, unknown>>): CanvasNode {
  return {
    id: 'test-agent-card-1',
    type: 'agent-session' as CanvasNode['type'],
    position: { x: 0, y: 0 },
    size: { width: 320, height: 240 },
    content: '',
    metadata: {
      sessionId: 'session-abc-123',
      status: 'active',
      filesTouched: ['/src/foo.ts', '/src/bar.ts'],
      startedAt: Date.now() - 60000,
      lastActivity: Date.now(),
      ...metaOverrides
    }
  }
}

describe('AgentSessionCard', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the session ID as title', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode()
    render(<AgentSessionCard node={node} />)

    expect(screen.getByTestId('card-title').textContent).toBe('session-abc-123')
  })

  it('shows active status indicator', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({ status: 'active' })
    render(<AgentSessionCard node={node} />)

    const statusEl = screen.getByTestId('agent-status')
    expect(statusEl.textContent).toContain('active')
  })

  it('shows completed status indicator', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({ status: 'completed' })
    render(<AgentSessionCard node={node} />)

    const statusEl = screen.getByTestId('agent-status')
    expect(statusEl.textContent).toContain('completed')
  })

  it('shows idle status indicator', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({ status: 'idle' })
    render(<AgentSessionCard node={node} />)

    const statusEl = screen.getByTestId('agent-status')
    expect(statusEl.textContent).toContain('idle')
  })

  it('lists files touched', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({
      filesTouched: ['/src/foo.ts', '/src/bar.ts', '/src/baz.ts']
    })
    render(<AgentSessionCard node={node} />)

    const fileList = screen.getByTestId('agent-files')
    expect(fileList.textContent).toContain('foo.ts')
    expect(fileList.textContent).toContain('bar.ts')
    expect(fileList.textContent).toContain('baz.ts')
  })

  it('shows file count', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({
      filesTouched: ['/src/a.ts', '/src/b.ts']
    })
    render(<AgentSessionCard node={node} />)

    const fileList = screen.getByTestId('agent-files')
    expect(fileList.textContent).toContain('2')
  })

  it('shows elapsed time since session start', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    // Session started 5 minutes ago
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const node = makeAgentSessionNode({ startedAt: fiveMinutesAgo })
    render(<AgentSessionCard node={node} />)

    const elapsed = screen.getByTestId('agent-elapsed')
    // Should contain "5m" or similar time format
    expect(elapsed.textContent).toContain('5m')
  })

  it('shows elapsed time in hours when over 60 min', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    // Session started 90 minutes ago
    const ninetyMinAgo = Date.now() - 90 * 60 * 1000
    const node = makeAgentSessionNode({ startedAt: ninetyMinAgo })
    render(<AgentSessionCard node={node} />)

    const elapsed = screen.getByTestId('agent-elapsed')
    expect(elapsed.textContent).toContain('1h')
    expect(elapsed.textContent).toContain('30m')
  })

  it('renders without crashing when metadata is empty', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node: CanvasNode = {
      id: 'test-empty-1',
      type: 'agent-session' as CanvasNode['type'],
      position: { x: 0, y: 0 },
      size: { width: 320, height: 240 },
      content: '',
      metadata: {}
    }
    render(<AgentSessionCard node={node} />)

    // Should fall back to defaults
    expect(screen.getByTestId('card-title').textContent).toBe('Unknown Session')
    expect(screen.getByTestId('agent-status').textContent).toContain('idle')
    expect(screen.getByTestId('agent-files').textContent).toContain('0')
  })

  it('renders without crashing when filesTouched is undefined', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const node = makeAgentSessionNode({
      filesTouched: undefined
    })
    render(<AgentSessionCard node={node} />)

    expect(screen.getByTestId('agent-files').textContent).toContain('0')
  })

  it('shows last activity timestamp', async () => {
    const { AgentSessionCard } = await import('../AgentSessionCard')
    const now = Date.now()
    const node = makeAgentSessionNode({ lastActivity: now })
    render(<AgentSessionCard node={node} />)

    const lastActivity = screen.getByTestId('agent-last-activity')
    // Should show some formatted time
    expect(lastActivity.textContent).toBeTruthy()
  })
})
