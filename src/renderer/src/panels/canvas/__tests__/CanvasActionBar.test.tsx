import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../store/vault-store', () => ({
  useVaultStore: vi.fn((selector) => {
    const state = {
      artifacts: [{ id: 'a1', origin: 'source' }],
      graph: { edges: [] }
    }
    return selector(state)
  })
}))

vi.mock('../../../store/canvas-store', () => ({
  useCanvasStore: vi.fn((selector) => {
    const state = { selectedNodeIds: new Set<string>() }
    return selector(state)
  })
}))

vi.mock('../../../design/tokens', () => ({
  colors: {
    text: { primary: '#fff', secondary: '#aaa', muted: '#555' },
    accent: { default: '#00f', hover: '#00e', muted: '#009' }
  },
  floatingPanel: {
    glass: {
      bg: 'rgba(4, 4, 8, 0.90)',
      blur: 'blur(24px) saturate(1.4)'
    }
  }
}))

import { CanvasActionBar } from '../CanvasActionBar'
import type { AgentActionName } from '@shared/agent-action-types'

describe('CanvasActionBar', () => {
  afterEach(cleanup)

  const baseProps = {
    onTriggerAction: vi.fn(),
    onStop: vi.fn(),
    activeAction: null as AgentActionName | null,
    phase: 'idle' as const,
    onAskPrompt: vi.fn()
  }

  it('renders the /ask button when vault has content', () => {
    render(<CanvasActionBar {...baseProps} />)
    expect(screen.getByText('/ask')).toBeTruthy()
  })

  it('calls onAskPrompt when /ask button is clicked', () => {
    const onAskPrompt = vi.fn()
    render(<CanvasActionBar {...baseProps} onAskPrompt={onAskPrompt} />)
    fireEvent.click(screen.getByText('/ask'))
    expect(onAskPrompt).toHaveBeenCalledOnce()
  })

  it('does not call onAskPrompt when computing', () => {
    const onAskPrompt = vi.fn()
    render(
      <CanvasActionBar
        {...baseProps}
        onAskPrompt={onAskPrompt}
        phase="computing"
        activeAction="compile"
      />
    )
    fireEvent.click(screen.getByText('/ask'))
    expect(onAskPrompt).not.toHaveBeenCalled()
  })

  it('applies glass background style to container', () => {
    const { container } = render(<CanvasActionBar {...baseProps} />)
    const outerDiv = container.firstChild as HTMLElement
    expect(outerDiv.style.backgroundColor).toBe('rgba(4, 4, 8, 0.90)')
  })

  it('renders divider between Think and /ask', () => {
    const { container } = render(<CanvasActionBar {...baseProps} />)
    const dividers = container.querySelectorAll('div')
    const dividerElements = Array.from(dividers).filter(
      (el) => el.style.width === '1px' && el.style.height === '16px'
    )
    expect(dividerElements.length).toBeGreaterThanOrEqual(1)
  })
})
