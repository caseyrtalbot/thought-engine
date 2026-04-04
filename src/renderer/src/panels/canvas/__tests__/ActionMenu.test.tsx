import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionMenu } from '../ActionMenu'
import type { ActionDefinition } from '@shared/action-types'

const mockActions: ActionDefinition[] = [
  { id: 'emerge', name: 'Emerge', description: 'Surface connections', scope: 'any' },
  { id: 'challenge', name: 'Challenge', description: 'Stress-test ideas', scope: 'any' },
  { id: 'steelman', name: 'Steelman', description: 'Build strongest case', scope: 'files' }
]

describe('ActionMenu', () => {
  it('renders all actions', () => {
    render(
      <ActionMenu
        actions={mockActions}
        selectedCount={0}
        scopeLabel="Entire vault (42 notes)"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Emerge')).toBeTruthy()
    expect(screen.getByText('Challenge')).toBeTruthy()
    expect(screen.getByText('Steelman')).toBeTruthy()
  })

  it('shows scope label', () => {
    render(
      <ActionMenu
        actions={mockActions}
        selectedCount={0}
        scopeLabel="Entire vault (42 notes)"
        onSelect={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Entire vault (42 notes)')).toBeTruthy()
  })

  it('calls onSelect with action id when clicked', () => {
    const onSelect = vi.fn()
    render(
      <ActionMenu
        actions={mockActions}
        selectedCount={0}
        scopeLabel="Entire vault"
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Emerge'))
    expect(onSelect).toHaveBeenCalledWith('emerge')
  })

  it('disables files-scoped actions when no files selected', () => {
    const onSelect = vi.fn()
    render(
      <ActionMenu
        actions={mockActions}
        selectedCount={0}
        scopeLabel="Entire vault"
        onSelect={onSelect}
        onClose={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText('Steelman'))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
