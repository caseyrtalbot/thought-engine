import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasPromptInput } from '../CanvasPromptInput'

vi.mock('../../../design/tokens', () => ({
  colors: {
    text: { primary: '#fff', secondary: '#aaa', muted: '#555' }
  },
  typography: {
    fontFamily: { mono: 'monospace' }
  }
}))

describe('CanvasPromptInput', () => {
  it('renders the scope hint for selected cards', () => {
    render(<CanvasPromptInput selectedCount={3} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('3 cards selected')).toBeTruthy()
  })

  it('renders vault scope hint when no cards selected', () => {
    render(<CanvasPromptInput selectedCount={0} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('vault scope')).toBeTruthy()
  })

  it('uses default placeholder when none provided', () => {
    render(<CanvasPromptInput selectedCount={2} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    const input = screen.getByPlaceholderText('Ask about 2 selected cards...')
    expect(input).toBeTruthy()
  })

  it('uses custom placeholder when provided', () => {
    render(
      <CanvasPromptInput
        selectedCount={0}
        placeholder="Custom prompt..."
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    const input = screen.getByPlaceholderText('Custom prompt...')
    expect(input).toBeTruthy()
  })

  it('calls onSubmit with trimmed text on Enter', () => {
    const onSubmit = vi.fn()
    render(<CanvasPromptInput selectedCount={0} onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '  hello world  ' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledWith('hello world')
  })

  it('does not call onSubmit on Enter when text is empty', () => {
    const onSubmit = vi.fn()
    render(<CanvasPromptInput selectedCount={0} onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn()
    render(<CanvasPromptInput selectedCount={0} onSubmit={vi.fn()} onCancel={onCancel} />)
    const input = screen.getByRole('textbox')
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onSubmit when /ask button is clicked with text', () => {
    const onSubmit = vi.fn()
    render(<CanvasPromptInput selectedCount={0} onSubmit={onSubmit} onCancel={vi.fn()} />)
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'test prompt' } })
    fireEvent.click(screen.getByText('/ask'))
    expect(onSubmit).toHaveBeenCalledWith('test prompt')
  })

  it('does not call onSubmit when /ask button is clicked with empty text', () => {
    const onSubmit = vi.fn()
    render(<CanvasPromptInput selectedCount={0} onSubmit={onSubmit} onCancel={vi.fn()} />)
    fireEvent.click(screen.getByText('/ask'))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('renders the /ask button', () => {
    render(<CanvasPromptInput selectedCount={0} onSubmit={vi.fn()} onCancel={vi.fn()} />)
    expect(screen.getByText('/ask')).toBeTruthy()
  })
})
