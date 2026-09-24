import { describe, expect, it } from 'vitest'
import { content, validateContent } from '../../src/data/content'
import { projectCost } from '../../src/engine/sim'
import { CATEGORY_STAGE, REVIEW_CATEGORIES, STAGE_IDS } from '../../src/engine/types'
import type { Sliders } from '../../src/engine/types'

describe('content data', () => {
  it('passes validation', () => {
    expect(validateContent(content)).toEqual([])
  })

  it('has at least one topic, genre and platform', () => {
    expect(content.topics.length).toBeGreaterThan(0)
    expect(content.genres.length).toBeGreaterThan(0)
    expect(content.platforms.length).toBeGreaterThan(0)
  })

  it('covers every genre in platform affinities and topic affinities fall back gracefully', () => {
    for (const platform of content.platforms) {
      for (const genre of content.genres) {
        expect(platform.genreAffinity[genre.id], `${platform.id}/${genre.id}`).toBeTypeOf('number')
      }
    }
  })

  it('uses every stage exactly once in category mapping', () => {
    for (const category of REVIEW_CATEGORIES) expect(STAGE_IDS).toContain(CATEGORY_STAGE[category])
    expect(new Set(Object.values(CATEGORY_STAGE)).size).toBe(REVIEW_CATEGORIES.length)
  })

  it('lets a starting studio afford a full-budget game on the earliest platform', () => {
    const budget: Sliders = { engine: 3, gameplay: 5, story: 3, graphics: 3, sound: 2 }
    const earliest = content.platforms.reduce((a, b) => (a.releaseYear <= b.releaseYear ? a : b))
    expect(projectCost(content, earliest, budget)).toBeLessThan(content.balance.startCash)
  })

  it('has a first platform available at the starting year', () => {
    expect(content.platforms.some((p) => p.releaseYear <= content.balance.startYear && content.balance.startYear < p.retireYear)).toBe(true)
  })
})
