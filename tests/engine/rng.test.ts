import { describe, expect, it } from 'vitest'
import { createRng } from '../../src/engine/rng'

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng('studio')
    const b = createRng('studio')
    const sequenceA = Array.from({ length: 20 }, () => a.next())
    const sequenceB = Array.from({ length: 20 }, () => b.next())
    expect(sequenceA).toEqual(sequenceB)
  })

  it('produces different sequences for different seeds', () => {
    const rngA = createRng('one')
    const rngB = createRng('two')
    const a = Array.from({ length: 20 }, () => rngA.next())
    const b = Array.from({ length: 20 }, () => rngB.next())
    expect(a).not.toEqual(b)
  })

  it('stays within range', () => {
    const rng = createRng(42)
    for (let i = 0; i < 500; i++) {
      const value = rng.next()
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
      expect(rng.int(2, 5)).toBeGreaterThanOrEqual(2)
      expect(rng.int(2, 5)).toBeLessThanOrEqual(5)
      expect(rng.range(-1, 1)).toBeGreaterThanOrEqual(-1)
      expect(rng.range(-1, 1)).toBeLessThan(1)
    }
  })

  it('picks items from a list', () => {
    const rng = createRng('pick')
    const items = ['a', 'b', 'c'] as const
    for (let i = 0; i < 50; i++) expect(items).toContain(rng.pick(items))
  })
})
