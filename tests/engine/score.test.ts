import { describe, expect, it } from 'vitest'
import { content } from '../../src/data/content'
import { createRng } from '../../src/engine/rng'
import { computeReview, platformFitFor, scoreProject, techFitFor, topicFitFor } from '../../src/engine/score'
import { emptySliders, findGenre, findPlatform, findTopic } from '../../src/engine/sim'
import type { Content, GameProject, Sliders } from '../../src/engine/types'

function testContent(): Content {
  const clone = structuredClone(content)
  clone.balance.variance = 0
  return clone
}

function projectFor(c: Content, sliders: Sliders, bugs: number): GameProject {
  const stagePoints = emptySliders()
  for (const stage of Object.keys(sliders) as (keyof Sliders)[]) {
    stagePoints[stage] = sliders[stage] * c.balance.pointsPerUnit
  }
  return {
    topicId: 'fantasy',
    genreId: 'rpg',
    platformId: 'home-pc',
    sliders,
    stagePoints,
    spent: { ...stagePoints },
    spentTotal: Object.values(stagePoints).reduce((a, b) => a + b, 0),
    stage: 'sound',
    weeksSpent: 16,
    bugs,
    cost: 0,
  }
}

describe('score', () => {
  const c = testContent()

  it('returns scores inside configured bounds', () => {
    const review = computeReview({
      project: projectFor(c, { engine: 2, gameplay: 5, story: 5, graphics: 2, sound: 2 }, 0),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('bounds'),
    })
    for (const value of Object.values(review.categories)) {
      expect(value).toBeGreaterThanOrEqual(c.balance.minScore)
      expect(value).toBeLessThanOrEqual(c.balance.maxScore)
    }
    expect(review.overall).toBeGreaterThanOrEqual(c.balance.minScore)
    expect(review.overall).toBeLessThanOrEqual(c.balance.maxScore)
  })

  it('scores a well-matched project well above a mismatched one', () => {
    const good = scoreProject({
      project: projectFor(c, { engine: 2, gameplay: 5, story: 5, graphics: 2, sound: 2 }, 0),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('good'),
    })
    const bad = scoreProject({
      project: { ...projectFor(c, { engine: 0, gameplay: 0, story: 0, graphics: 10, sound: 6 }, 10), topicId: 'cooking', genreId: 'strategy', platformId: 'family-console' },
      topic: findTopic(c, 'cooking'),
      genre: findGenre(c, 'strategy'),
      platform: findPlatform(c, 'family-console'),
      balance: c.balance,
      rng: createRng('bad'),
    })
    expect(good.overall).toBeGreaterThan(bad.overall + 3)
    expect(good.techFit).toBeGreaterThan(bad.techFit)
  })

  it('punishes bugs', () => {
    const clean = scoreProject({
      project: projectFor(c, { engine: 2, gameplay: 5, story: 5, graphics: 2, sound: 2 }, 0),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('clean'),
    })
    const buggy = scoreProject({
      project: projectFor(c, { engine: 2, gameplay: 5, story: 5, graphics: 2, sound: 2 }, 12),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('buggy'),
    })
    expect(buggy.bugFactor).toBeLessThan(clean.bugFactor)
    expect(buggy.overall).toBeLessThan(clean.overall)
  })

  it('rewards allocation close to the genre ideal', () => {
    const matched = scoreProject({
      project: projectFor(c, { engine: 2, gameplay: 5, story: 5, graphics: 2, sound: 2 }, 0),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('matched'),
    })
    const mismatched = scoreProject({
      project: projectFor(c, { engine: 8, gameplay: 0, story: 0, graphics: 8, sound: 0 }, 0),
      topic: findTopic(c, 'fantasy'),
      genre: findGenre(c, 'rpg'),
      platform: findPlatform(c, 'home-pc'),
      balance: c.balance,
      rng: createRng('mismatched'),
    })
    expect(mismatched.sliderFit.gameplay).toBeLessThan(matched.sliderFit.gameplay)
    expect(mismatched.overall).toBeLessThan(matched.overall)
  })

  it('normalizes topic and platform affinity into 0..1', () => {
    const high = topicFitFor(findTopic(c, 'fantasy'), 'rpg', c.balance)
    const low = topicFitFor(findTopic(c, 'cooking'), 'rpg', c.balance)
    expect(high).toBe(1)
    expect(low).toBeGreaterThanOrEqual(0)
    expect(high).toBeGreaterThan(low)
    expect(platformFitFor(findPlatform(c, 'family-console'), 'action', c.balance)).toBeGreaterThan(
      platformFitFor(findPlatform(c, 'family-console'), 'sim', c.balance),
    )
  })

  it('requires engine investment for higher tech platforms', () => {
    const weak = techFitFor(
      { ...projectFor(c, emptySliders(), 0), sliders: { engine: 1, gameplay: 3, story: 3, graphics: 3, sound: 3 }, stagePoints: { ...emptySliders(), engine: 12 } },
      findPlatform(c, 'pc-16'),
      c.balance,
    )
    const strong = techFitFor(
      { ...projectFor(c, emptySliders(), 0), sliders: { engine: 8, gameplay: 2, story: 2, graphics: 2, sound: 2 }, stagePoints: { ...emptySliders(), engine: 96 } },
      findPlatform(c, 'pc-16'),
      c.balance,
    )
    expect(strong).toBeGreaterThan(weak)
  })
})
