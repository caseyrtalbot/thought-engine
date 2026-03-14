import { describe, it, expect } from 'vitest'
import {
  colors,
  ARTIFACT_COLORS,
  getArtifactColor,
  typeScale,
  borderRadius,
  transitions,
  animations,
  visualLanguage
} from '../../src/renderer/src/design/tokens'

describe('design tokens', () => {
  it('has all background layers as CSS variable references', () => {
    expect(colors.bg.base).toBe('var(--color-bg-base)')
    expect(colors.bg.surface).toBe('var(--color-bg-surface)')
    expect(colors.bg.elevated).toBe('var(--color-bg-elevated)')
    expect(colors.border.default).toBe('var(--color-border-default)')
    expect(colors.border.subtle).toBe('var(--border-subtle)')
  })

  it('has artifact type colors for all types', () => {
    expect(ARTIFACT_COLORS.gene).toBe('#22d3ee')
    expect(ARTIFACT_COLORS.constraint).toBe('#ef4444')
    expect(ARTIFACT_COLORS.research).toBe('#a78bfa')
    expect(ARTIFACT_COLORS.output).toBe('#f472b6')
    expect(ARTIFACT_COLORS.note).toBe('#94a3b8')
    expect(ARTIFACT_COLORS.index).toBe('#38bdf8')
  })

  it('has no color collisions between artifact types and semantic colors', () => {
    const semanticColors = [colors.semantic.cluster, colors.semantic.tension]
    const artifactColorValues = Object.values(ARTIFACT_COLORS)
    for (const sc of semanticColors) {
      expect(artifactColorValues).not.toContain(sc)
    }
  })
})

describe('extended design tokens', () => {
  it('has complete type scale with all roles', () => {
    expect(typeScale.display.pageTitle.size).toBe('20px')
    expect(typeScale.display.pageTitle.weight).toBe(600)
    expect(typeScale.display.sectionHeading.size).toBe('15px')
    expect(typeScale.display.body.size).toBe('13px')
    expect(typeScale.display.secondary.size).toBe('12px')
    expect(typeScale.display.label.size).toBe('12px')
    expect(typeScale.display.label.textTransform).toBe('uppercase')
    expect(typeScale.display.label.letterSpacing).toBe('0.05em')
    expect(typeScale.mono.terminal.size).toBe('13px')
    expect(typeScale.mono.source.size).toBe('12px')
    expect(typeScale.mono.inline.size).toBe('12px')
  })

  it('has border-radius constants', () => {
    expect(borderRadius.container).toBe(6)
    expect(borderRadius.inline).toBe(4)
    expect(borderRadius.card).toBe(8)
    expect(borderRadius.round).toBe('50%')
  })

  it('has visual language tokens', () => {
    expect(visualLanguage.panelGap).toBe(4)
    expect(visualLanguage.cardRadius).toBe(8)
    expect(visualLanguage.borderSubtle).toBe('rgba(255, 255, 255, 0.08)')
  })

  it('has transition timing constants', () => {
    expect(transitions.hover).toBe('150ms ease-out')
    expect(transitions.tooltip).toBe('100ms ease-in')
    expect(transitions.focusRing).toBe('100ms ease-out')
    expect(transitions.settingsSlide).toBe('250ms ease-out')
    expect(transitions.modalFade).toBe('200ms ease-in')
    expect(transitions.commandPalette).toBe('150ms ease-out')
  })

  it('has animation timing constants', () => {
    expect(animations.graphNodeHoverGlow).toBe('200ms ease-out')
    expect(animations.graphNetworkReveal).toBe('200ms ease-out')
    expect(animations.graphNetworkDim).toBe('300ms ease-out')
    expect(animations.graphNodeEnter).toBe('400ms ease-out')
    expect(animations.graphNodeExit).toBe('200ms ease-out')
    expect(animations.spatialTransition).toBe('250ms ease-out')
  })

  it('enforces max animation duration of 400ms', () => {
    const allDurations = [...Object.values(transitions), ...Object.values(animations)]
    for (const timing of allDurations) {
      const ms = parseInt(timing, 10)
      expect(ms).toBeLessThanOrEqual(400)
    }
  })
})

describe('getArtifactColor', () => {
  it('returns distinct colors for different custom types', () => {
    const patternColor = getArtifactColor('pattern')
    const doctrineColor = getArtifactColor('doctrine')
    const theoryColor = getArtifactColor('theory')

    const uniqueColors = new Set([patternColor, doctrineColor, theoryColor])
    expect(uniqueColors.size).toBeGreaterThanOrEqual(2)
  })

  it('returns consistent color for the same custom type', () => {
    expect(getArtifactColor('pattern')).toBe(getArtifactColor('pattern'))
  })

  it('still returns built-in colors for known types', () => {
    expect(getArtifactColor('gene')).toBe('#22d3ee')
    expect(getArtifactColor('constraint')).toBe('#ef4444')
  })

  it('custom type colors do not collide with built-in colors', () => {
    const builtInColors = new Set(Object.values(ARTIFACT_COLORS))
    const customColor = getArtifactColor('myCustomType')
    expect(builtInColors.has(customColor)).toBe(false)
  })
})
