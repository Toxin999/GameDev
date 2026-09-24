import { describe, expect, it } from 'vitest'
import { normalizeStudioName, pickStudioName } from '../../src/game/cloud'

describe('cloud helpers', () => {
  it('picks studio names from the word lists deterministically', () => {
    const name = pickStudioName(() => 0)
    expect(name).toBe('PIXEL FOX')
    const other = pickStudioName(() => 0.999999)
    expect(other).toBe('TINY GOBLIN')
  })

  it('always returns a two word studio name', () => {
    for (let step = 0; step <= 1; step += 0.05) {
      const name = pickStudioName(() => step)
      expect(name.split(' ')).toHaveLength(2)
      expect(name).toMatch(/^[A-Z]+ [A-Z]+$/)
    }
  })

  it('normalizes studio names for the leaderboard', () => {
    expect(normalizeStudioName('  pixel   fox  ')).toBe('PIXEL FOX')
    expect(normalizeStudioName('Pixel-Fox!')).toBe('PIXELFOX')
    expect(normalizeStudioName('abcdefghijklmnopqrstuvwxyz')).toBe('ABCDEFGHIJKLMNOP')
    expect(normalizeStudioName('   ')).toBe('GARAGE STUDIO')
    expect(normalizeStudioName('tabs\tand\nwords')).toBe('TABS AND WORDS')
    expect(normalizeStudioName('tabs\tand\nnewlines')).toBe('TABS AND NEWLINE')
  })
})
