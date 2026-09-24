import { describe, expect, it } from 'vitest'
import { content } from '../../src/data/content'
import { firstWeekUnits, platformLifecycle, weeklyRevenue, weeklySales } from '../../src/engine/market'
import { findGenre, findPlatform } from '../../src/engine/sim'
import type { Review } from '../../src/engine/types'

const balance = content.balance
const genre = findGenre(content, 'rpg')
const platform = findPlatform(content, 'home-pc')

function reviewWith(overall: number): Review {
  return { overall, categories: { gameplay: overall, graphics: overall, sound: overall, story: overall, tech: overall } }
}

function input(overall: number, fans = 0, age = 1) {
  return { review: reviewWith(overall), genre, platform, platformAge: age, fans, balance }
}

describe('market', () => {
  it('sells more with better reviews', () => {
    expect(firstWeekUnits(input(9))).toBeGreaterThan(firstWeekUnits(input(4)))
  })

  it('sells more with a bigger fan base', () => {
    expect(firstWeekUnits(input(7, 50000))).toBeGreaterThan(firstWeekUnits(input(7, 0)))
  })

  it('follows the platform lifecycle curve and clamps past the end', () => {
    expect(platformLifecycle(0, balance)).toBe(balance.lifecycle[0])
    expect(platformLifecycle(2, balance)).toBe(balance.lifecycle[2])
    expect(platformLifecycle(99, balance)).toBe(balance.lifecycle[balance.lifecycle.length - 1])
    expect(platformLifecycle(-1, balance)).toBe(0)
  })

  it('produces a non-increasing weekly sales curve of the configured length', () => {
    const weeks = weeklySales(input(7))
    expect(weeks).toHaveLength(balance.salesWeeks)
    for (let i = 0; i < weeks.length; i++) expect(weeks[i]!).toBeGreaterThanOrEqual(0)
    for (let i = 1; i < weeks.length; i++) expect(weeks[i]!).toBeLessThanOrEqual(weeks[i - 1]!)
    expect(weeks[0]!).toBeGreaterThan(0)
  })

  it('subtracts platform royalty from unit price', () => {
    const console_ = findPlatform(content, 'family-console')
    expect(weeklyRevenue(1000, console_, balance)).toBe(1000 * (balance.unitPrice - console_.royalty))
    expect(weeklyRevenue(1000, platform, balance)).toBe(1000 * balance.unitPrice)
  })

  it('never returns negative revenue', () => {
    const greedy = { ...platform, royalty: balance.unitPrice + 10 }
    expect(weeklyRevenue(1000, greedy, balance)).toBe(0)
  })
})
