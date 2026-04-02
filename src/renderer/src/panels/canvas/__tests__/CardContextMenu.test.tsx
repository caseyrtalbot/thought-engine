import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardContextMenu } from '../CardContextMenu'

function renderMenu(overrides: Partial<React.ComponentProps<typeof CardContextMenu>> = {}) {
  const defaults = {
    x: 100,
    y: 200,
    onShowConnections: vi.fn(),
    onOpenInEditor: vi.fn(),
    onCopyPath: vi.fn(),
    onClose: vi.fn(),
    selectedCount: 1
  }
  return render(<CardContextMenu {...defaults} {...overrides} />)
}

describe('CardContextMenu', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders "Run Claude on this note" when onRunClaude is provided', () => {
    renderMenu({ onRunClaude: vi.fn() })

    expect(screen.getByText('Run Claude on this note')).toBeTruthy()
  })

  it('does not render "Run Claude on this note" when onRunClaude is not provided', () => {
    renderMenu()

    expect(screen.queryByText('Run Claude on this note')).toBeNull()
  })

  it('calls onRunClaude and onClose when "Run Claude on this note" is clicked', () => {
    const onRunClaude = vi.fn()
    const onClose = vi.fn()
    renderMenu({ onRunClaude, onClose })

    fireEvent.click(screen.getByText('Run Claude on this note'))

    expect(onRunClaude).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
