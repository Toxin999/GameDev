import { describe, expect, it } from 'vitest'
import { clamp, normalizeValue, ratioToValue, snapToStep, valueToRatio } from '../../src/ui/sliderMath'

describe('sliderMath', () => {
  it('clamps to bounds', () => {
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(15, 0, 10)).toBe(10)
    expect(clamp(5, 0, 10)).toBe(5)
  })

  it('snaps to the nearest step from the minimum', () => {
    expect(snapToStep(13, 0, 5)).toBe(15)
    expect(snapToStep(12, 0, 5)).toBe(10)
    expect(snapToStep(7, 1, 2)).toBe(7)
    expect(snapToStep(6, 1, 2)).toBe(7)
    expect(snapToStep(3, 0, 0)).toBe(3)
  })

  it('normalizes value, bounds and step together', () => {
    expect(normalizeValue(13, 0, 16, 5)).toBe(15)
    expect(normalizeValue(-3, 0, 16, 5)).toBe(0)
    expect(normalizeValue(20, 0, 16, 5)).toBe(15)
    expect(normalizeValue(0.37, 0, 1, 0.1)).toBe(0.4)
  })

  it('maps value to ratio and back', () => {
    expect(valueToRatio(5, 0, 10)).toBe(0.5)
    expect(valueToRatio(-1, 0, 10)).toBe(0)
    expect(valueToRatio(11, 0, 10)).toBe(1)
    expect(valueToRatio(3, 3, 3)).toBe(0)
    expect(ratioToValue(0.5, 0, 10, 1)).toBe(5)
    expect(ratioToValue(1.5, 0, 10, 1)).toBe(10)
    expect(ratioToValue(-0.5, 0, 10, 1)).toBe(0)
    expect(ratioToValue(0.5, 1, 16, 1)).toBe(9)
  })

  it('round-trips every step value without drift', () => {
    for (let value = 0; value <= 100; value += 5) {
      const ratio = valueToRatio(value, 0, 100)
      expect(ratioToValue(ratio, 0, 100, 5)).toBe(value)
    }
  })
})
