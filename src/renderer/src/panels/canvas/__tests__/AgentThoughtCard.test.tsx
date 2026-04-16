import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { AgentThoughtCard } from '../AgentThoughtCard'
import { initialStreamState, reduceStream } from '../agent-stream-state'

function anchor() {
  return { x: 400, y: 300 }
}

describe('AgentThoughtCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders starting state with pulse indicator', () => {
    render(
      <AgentThoughtCard
        streamState={initialStreamState()}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/starting/i)).toBeTruthy()
  })

  it('renders thinking text when in thinking phase', () => {
    const s = reduceStream(
      reduceStream(initialStreamState(), { kind: 'phase', phase: 'thinking' }),
      { kind: 'thinking-delta', text: 'Considering contradictions.' }
    )
    render(
      <AgentThoughtCard
        streamState={s}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/considering contradictions/i)).toBeTruthy()
  })

  it('renders drafting text and keeps thinking block visible dimmed', () => {
    let s = initialStreamState()
    s = reduceStream(s, { kind: 'phase', phase: 'thinking' })
    s = reduceStream(s, { kind: 'thinking-delta', text: 'Let me think.' })
    s = reduceStream(s, { kind: 'phase', phase: 'drafting' })
    s = reduceStream(s, { kind: 'text-delta', text: 'Drafting answer.' })
    render(
      <AgentThoughtCard
        streamState={s}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/let me think/i)).toBeTruthy()
    expect(screen.getByText(/drafting answer/i)).toBeTruthy()
  })

  it('hides content matching a JSON fence during drafting', () => {
    let s = initialStreamState()
    s = reduceStream(s, { kind: 'phase', phase: 'drafting' })
    s = reduceStream(s, { kind: 'text-delta', text: 'Plan:\n```json\n{"ops":[]}\n```' })
    render(
      <AgentThoughtCard
        streamState={s}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    expect(screen.queryByText(/```json/)).toBeNull()
    expect(screen.getByText(/plan:/i)).toBeTruthy()
  })

  it('shows materializing header with op count', () => {
    let s = initialStreamState()
    s = reduceStream(s, { kind: 'phase', phase: 'materializing', count: 6 })
    render(
      <AgentThoughtCard
        streamState={s}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    expect(screen.getByText(/materializing/i)).toBeTruthy()
    expect(screen.getByText(/6 ops?/i)).toBeTruthy()
  })

  it('updates elapsed timer every 500ms in M:SS format', () => {
    const started = Date.now()
    render(
      <AgentThoughtCard
        streamState={initialStreamState()}
        actionName="challenge"
        anchor={anchor()}
        startedAt={started}
        onCancel={() => {}}
      />
    )
    act(() => {
      vi.advanceTimersByTime(8_500)
    })
    expect(screen.getByText(/0:08/)).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByText(/1:08/)).toBeTruthy()
  })

  it('invokes onCancel when Esc is pressed', () => {
    const onCancel = vi.fn()
    render(
      <AgentThoughtCard
        streamState={initialStreamState()}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={onCancel}
      />
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('invokes onCancel when close button is clicked', () => {
    const onCancel = vi.fn()
    render(
      <AgentThoughtCard
        streamState={initialStreamState()}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByLabelText(/cancel agent action/i))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('uses aria-live polite on the streaming body', () => {
    render(
      <AgentThoughtCard
        streamState={initialStreamState()}
        actionName="challenge"
        anchor={anchor()}
        startedAt={Date.now()}
        onCancel={() => {}}
      />
    )
    const logs = document.querySelectorAll('[role="log"]')
    expect(logs.length).toBeGreaterThan(0)
    expect(logs[0].getAttribute('aria-live')).toBe('polite')
  })
})
