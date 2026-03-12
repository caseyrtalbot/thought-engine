import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SplitPane } from '../../src/renderer/src/design/components/SplitPane'

describe('SplitPane', () => {
  it('renders left and right children', () => {
    render(
      <SplitPane
        left={<div data-testid="left">Left</div>}
        right={<div data-testid="right">Right</div>}
        initialLeftWidth={260}
        minLeftWidth={0}
        minRightWidth={200}
      />
    )
    expect(screen.getByTestId('left')).toBeDefined()
    expect(screen.getByTestId('right')).toBeDefined()
  })
})
