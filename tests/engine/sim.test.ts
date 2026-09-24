import { describe, expect, it } from 'vitest'
import { content } from '../../src/data/content'
import { allocateSliders } from '../../src/game/allocate'
import {
  availablePlatforms,
  companyValue,
  createSim,
  dateOf,
  emptySliders,
  fixBug,
  projectCost,
  projectProgress,
  projectWeeks,
  releaseGame,
  startProject,
  tick,
} from '../../src/engine/sim'
import type { Content, SimEvent, Sliders } from '../../src/engine/types'
import { STAGE_IDS } from '../../src/engine/types'

function clone(): Content {
  return structuredClone(content)
}

function allocate(content_: Content, genreId: string, budget: number): Sliders {
  return allocateSliders(content_, genreId, budget)
}

function runUntil(sim: ReturnType<typeof createSim>, phases: string[], limit: number): SimEvent[] {
  const events: SimEvent[] = []
  let guard = 0
  while (!phases.includes(sim.state.phase) && guard++ < limit) events.push(...tick(sim))
  return events
}

describe('sim', () => {
  it('starts idle with configured cash and date', () => {
    const sim = createSim({ content: clone(), seed: 'start' })
    expect(sim.state.phase).toBe('idle')
    expect(sim.state.cash).toBe(content.balance.startCash)
    expect(sim.state.week).toBe(0)
    expect(dateOf(sim)).toEqual({ year: content.balance.startYear, month: 1, week: 1 })
    expect(companyValue(sim)).toBe(content.balance.startCash)
  })

  it('advances the calendar correctly', () => {
    const sim = createSim({ content: clone(), seed: 'date' })
    sim.state.week = (content.balance.monthsPerYear + 1) * content.balance.weeksPerMonth
    expect(dateOf(sim)).toEqual({ year: content.balance.startYear + 1, month: 2, week: 1 })
  })

  it('charges weekly running costs', () => {
    const sim = createSim({ content: clone(), seed: 'costs' })
    tick(sim)
    expect(sim.state.cash).toBe(content.balance.startCash - content.balance.weeklyCost)
    expect(sim.state.week).toBe(1)
  })

  it('validates project setup', () => {
    const sim = createSim({ content: clone(), seed: 'validate' })
    const good: Sliders = { engine: 2, gameplay: 4, story: 3, graphics: 4, sound: 3 }

    expect(() => startProject(sim, { topicId: 'nope', genreId: 'rpg', platformId: 'home-pc', sliders: good })).toThrow(/unknown topic/)
    expect(() => startProject(sim, { topicId: 'space', genreId: 'nope', platformId: 'home-pc', sliders: good })).toThrow(/unknown genre/)
    expect(() => startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'nope', sliders: good })).toThrow(/unknown platform/)
    expect(() => startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'cd-station', sliders: good })).toThrow(/not available/)
    expect(() => startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: emptySliders() })).toThrow(/at least one unit/)
    expect(() =>
      startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: { engine: 9, gameplay: 9, story: 9, graphics: 9, sound: 9 } }),
    ).toThrow(/budget exceeded/)
    expect(() =>
      startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: { ...good, engine: -1 } }),
    ).toThrow(/non-negative integer/)
  })

  it('rejects a project that costs more than the studio has', () => {
    const sim = createSim({ content: clone(), seed: 'poor' })
    sim.state.cash = 10
    expect(() =>
      startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: { engine: 2, gameplay: 4, story: 3, graphics: 4, sound: 3 } }),
    ).toThrow(/not enough cash/)
  })

  it('runs one week per slider unit and reports stages in order', () => {
    const sim = createSim({ content: clone(), seed: 'dev' })
    const sliders: Sliders = { engine: 2, gameplay: 4, story: 2, graphics: 2, sound: 2 }
    startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders })
    expect(sim.state.phase).toBe('dev')
    expect(sim.state.project!.cost).toBe(projectCost(content, content.platforms.find((p) => p.id === 'home-pc')!, sliders))

    const events = runUntil(sim, ['release'], 100)
    expect(sim.state.week).toBe(12)
    expect(sim.state.project!.weeksSpent).toBe(12)
    expect(projectProgress(sim.state.project!)).toBe(1)

    const completed = events.filter((e): e is Extract<SimEvent, { type: 'stage-complete' }> => e.type === 'stage-complete')
    expect(completed.map((e) => e.stage)).toEqual([...STAGE_IDS])

    const finished = events.find((e) => e.type === 'dev-complete')
    expect(finished).toBeDefined()
    expect(sim.state.currentReview!.overall).toBeGreaterThanOrEqual(content.balance.minScore)
  })

  it('skips stages with no allocation', () => {
    const sim = createSim({ content: clone(), seed: 'skip' })
    startProject(sim, { topicId: 'space', genreId: 'sim', platformId: 'home-pc', sliders: { engine: 8, gameplay: 8, story: 0, graphics: 0, sound: 0 } })
    const events = runUntil(sim, ['release'], 100)
    const stages = events.filter((e) => e.type === 'stage-complete')
    expect(stages).toHaveLength(STAGE_IDS.length)
    expect(sim.state.week).toBe(16)
  })

  it('lets the studio fix bugs before release at the cost of a week', () => {
    const c = clone()
    c.balance.variance = 0
    const sim = createSim({ content: c, seed: 'bugs' })
    startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: { engine: 2, gameplay: 4, story: 2, graphics: 2, sound: 2 } })
    runUntil(sim, ['release'], 100)
    sim.state.project!.bugs = 3
    const cashBefore = sim.state.cash
    const weekBefore = sim.state.week
    const reviewBefore = sim.state.currentReview!.overall

    fixBug(sim)
    expect(sim.state.project!.bugs).toBe(2)
    expect(sim.state.week).toBe(weekBefore + 1)
    expect(sim.state.cash).toBe(cashBefore - c.balance.fixBugCost - c.balance.weeklyCost)
    expect(sim.state.currentReview!.overall).toBeGreaterThan(reviewBefore)

    expect(() => fixBug(sim)).not.toThrow()
    expect(() => fixBug(sim)).not.toThrow()
    expect(() => fixBug(sim)).toThrow(/no bugs/)
  })

  it('estimates project length from the slider budget', () => {
    const c = clone()
    expect(projectWeeks(c, { engine: 2, gameplay: 4, story: 2, graphics: 2, sound: 2 })).toBe(12)
    expect(projectWeeks(c, emptySliders())).toBe(1)
  })

  it('sells a released game over several weeks then returns to idle', () => {
    const c = clone()
    c.balance.bugChanceBase = 0
    const sim = createSim({ content: c, seed: 'sales' })
    startProject(sim, { topicId: 'fantasy', genreId: 'rpg', platformId: 'home-pc', sliders: allocate(c, 'rpg', c.balance.sliderBudget) })
    runUntil(sim, ['release'], 100)
    const cashBefore = sim.state.cash

    releaseGame(sim)
    expect(sim.state.phase).toBe('sales')
    expect(sim.state.released).toHaveLength(1)

    const events = runUntil(sim, ['idle'], 100)
    const game = sim.state.released[0]!
    expect(sim.state.phase).toBe('idle')
    expect(game.unitsSold).toBeGreaterThan(0)
    expect(game.revenue).toBeGreaterThan(0)
    expect(game.weeksOnSale).toBe(c.balance.salesWeeks)
    expect(sim.state.cash).toBeGreaterThan(cashBefore)
    expect(sim.state.fans).toBe(Math.round(game.unitsSold * c.balance.fanConversion))
    expect(events.filter((e) => e.type === 'sales-week')).toHaveLength(c.balance.salesWeeks)
    expect(events.filter((e) => e.type === 'sales-end')).toHaveLength(1)
  })

  it('goes bankrupt when cash runs out', () => {
    const sim = createSim({ content: clone(), seed: 'bankrupt' })
    sim.state.cash = 100
    const events = tick(sim)
    expect(sim.state.phase).toBe('over')
    expect(sim.state.outcome).toBe('bankrupt')
    expect(events.some((e) => e.type === 'game-over')).toBe(true)
    expect(() => startProject(sim, { topicId: 'space', genreId: 'rpg', platformId: 'home-pc', sliders: { engine: 2, gameplay: 4, story: 3, graphics: 4, sound: 3 } })).toThrow(/phase/)
  })

  it('is deterministic for the same seed and actions', () => {
    const run = (seed: string) => {
      const sim = createSim({ content: clone(), seed })
      startProject(sim, { topicId: 'fantasy', genreId: 'rpg', platformId: 'home-pc', sliders: allocate(content, 'rpg', content.balance.sliderBudget) })
      runUntil(sim, ['release'], 100)
      releaseGame(sim)
      runUntil(sim, ['idle'], 100)
      return JSON.stringify({ state: sim.state, events: sim.state.released })
    }
    expect(run('same')).toBe(run('same'))
    expect(run('same')).not.toBe(run('different'))
  })

  it('keeps the economy viable across ten games', () => {
    const c = clone()
    c.balance.winValue = 1e12
    const sim = createSim({ content: c, seed: 'ten-games' })
    const summary: Array<Record<string, string | number>> = []

    for (let i = 0; i < 10; i++) {
      const platforms = availablePlatforms(sim)
      const platform = platforms[platforms.length - 1]!
      const genre = sim.rng.pick(c.genres)
      const topic = sim.rng.pick(c.topics)
      const sliders = allocate(c, genre.id, c.balance.sliderBudget)
      startProject(sim, { topicId: topic.id, genreId: genre.id, platformId: platform.id, sliders })
      runUntil(sim, ['release', 'over'], 200)
      expect(sim.state.phase).toBe('release')

      const review = sim.state.currentReview!
      releaseGame(sim)
      runUntil(sim, ['idle', 'over'], 100)

      const game = sim.state.released[sim.state.released.length - 1]!
      summary.push({
        '#': i + 1,
        topic: topic.name,
        genre: genre.name,
        platform: platform.name,
        review: review.overall,
        units: game.unitsSold,
        revenue: game.revenue,
        cash: sim.state.cash,
        fans: sim.state.fans,
      })

      for (const category of Object.values(review.categories)) {
        expect(category).toBeGreaterThanOrEqual(c.balance.minScore)
        expect(category).toBeLessThanOrEqual(c.balance.maxScore)
      }
      expect(review.overall).toBeGreaterThanOrEqual(c.balance.minScore)
      expect(review.overall).toBeLessThanOrEqual(c.balance.maxScore)
      expect(game.unitsSold).toBeGreaterThan(0)
      expect(game.revenue).toBeGreaterThan(0)
      expect(Number.isFinite(sim.state.cash)).toBe(true)
    }

    console.table(summary)
    expect(sim.state.released).toHaveLength(10)
    expect(sim.state.outcome).not.toBe('bankrupt')
    expect(new Set(summary.map((row) => row.review)).size).toBeGreaterThan(1)
  })
})
