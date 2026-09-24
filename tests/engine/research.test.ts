import { describe, expect, it } from 'vitest'
import { content, validateContent } from '../../src/data/content'
import { deserializeSim } from '../../src/game/save'
import { clone } from './helpers'
import {
  availableGenres as engineGenres,
  availableTopics as engineTopics,
  findResearchNode,
  researchOptions,
  researchPointsFor,
  researchStatus,
  startResearch,
} from '../../src/engine/research'
import { techFitFor } from '../../src/engine/score'
import {
  availablePlatforms,
  createSim,
  dateOf,
  emptySliders,
  lockedPlatformCount,
  releaseGame,
  selectableTopics,
  startProject,
  tick,
} from '../../src/engine/sim'
import type { Content, GameProject, Sliders } from '../../src/engine/types'

function grant(sim: ReturnType<typeof createSim>, rp: number, cash = 200_000): void {
  sim.state.researchPoints += rp
  sim.state.cash += cash
}

function projectWithEnginePoints(c: Content, enginePoints: number): GameProject {
  const sliders = emptySliders()
  sliders.gameplay = 8
  sliders.story = 4
  sliders.graphics = 2
  sliders.sound = 2
  const stagePoints = emptySliders()
  for (const key of Object.keys(stagePoints) as (keyof Sliders)[]) {
    stagePoints[key] = sliders[key] * c.balance.pointsPerUnit
  }
  stagePoints.engine = enginePoints
  return {
    topicId: 'space',
    genreId: 'action',
    platformId: 'home-pc',
    sliders,
    stagePoints,
    spent: { ...stagePoints },
    spentTotal: Object.values(stagePoints).reduce((a, b) => a + b, 0),
    stage: 'sound',
    weeksSpent: 12,
    bugs: 0,
    cost: 0,
  }
}

describe('research content', () => {
  it('passes validation and locks more than half of the catalog', () => {
    expect(validateContent(content)).toEqual([])
    expect(content.research.start.topics.length).toBeLessThan(content.topics.length / 2 + 1)
    expect(content.research.start.genres.length).toBeLessThan(content.genres.length)
  })

  it('covers every tech level above the starting one', () => {
    const levels = content.research.nodes.filter((node) => node.kind === 'tech').map((node) => node.level)
    expect(new Set(levels)).toEqual(new Set([2, 3, 4, 5]))
  })
})

describe('research gating', () => {
  it('starts with only the starting topics and genres available', () => {
    const sim = createSim({ content: clone(), seed: 'gates' })
    expect(selectableTopics(sim).map((topic) => topic.id).sort()).toEqual([...content.research.start.topics].sort())
    expect(engineTopics(content, sim.state).length).toBe(content.research.start.topics.length)
    expect(engineGenres(content, sim.state).length).toBe(content.research.start.genres.length)
    expect(availablePlatforms(sim).every((platform) => platform.tech === 1)).toBe(true)
  })

  it('locks platforms until the engine tech level catches up', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'platforms' })
    sim.state.week = (1989 - c.balance.startYear) * c.balance.monthsPerYear * c.balance.weeksPerMonth
    expect(dateOf(sim).year).toBe(1989)

    const lockedBefore = lockedPlatformCount(sim)
    expect(lockedBefore).toBeGreaterThan(0)

    grant(sim, 100)
    startResearch(sim, 'tech-2')
    while (sim.state.research) tick(sim)
    startResearch(sim, 'tech-3')
    while (sim.state.research) tick(sim)

    expect(sim.state.techLevel).toBe(3)
    expect(lockedPlatformCount(sim)).toBeLessThan(lockedBefore)
    expect(availablePlatforms(sim).some((platform) => platform.id === 'pc-16')).toBe(true)
  })

  it('reports status and affordability for every node', () => {
    const sim = createSim({ content: clone(), seed: 'options' })
    const options = researchOptions(sim.content, sim.state)
    expect(options).toHaveLength(sim.content.research.nodes.length)
    expect(options.find((option) => option.node.id === 'tech-3')?.status).toBe('locked')
    expect(options.find((option) => option.node.id === 'tech-2')?.status).toBe('available')
    expect(options.every((option) => option.affordable === false)).toBe(true)

    grant(sim, 1000)
    const funded = researchOptions(sim.content, sim.state)
    expect(funded.find((option) => option.node.id === 'tech-2')?.affordable).toBe(true)
    expect(funded.find((option) => option.node.id === 'tech-3')?.affordable).toBe(false)
  })
})

describe('research progress', () => {
  it('validates and charges for starting research', () => {
    const sim = createSim({ content: clone(), seed: 'start' })

    expect(() => startResearch(sim, 'nope')).toThrow(/unknown research node/)
    expect(() => startResearch(sim, 'topic-horror')).toThrow(/not enough research points/)
    expect(() => startResearch(sim, 'tech-3')).toThrow(/requires ENGINE MK2/)

    grant(sim, 50, 10_000)
    const rpBefore = sim.state.researchPoints
    const cashBefore = sim.state.cash
    startResearch(sim, 'topic-horror')

    const node = findResearchNode(sim.content, 'topic-horror')
    expect(sim.state.research).toEqual({ nodeId: 'topic-horror', weeksLeft: node.weeks })
    expect(sim.state.researchPoints).toBe(rpBefore - node.costRp)
    expect(sim.state.cash).toBe(cashBefore - node.costCash)
    expect(() => startResearch(sim, 'topic-war')).toThrow(/another research project/)
  })

  it('unlocks the target after the research weeks pass', () => {
    const sim = createSim({ content: clone(), seed: 'complete' })
    grant(sim, 50)
    startResearch(sim, 'topic-horror')
    const weeks = sim.state.research!.weeksLeft

    const events = []
    for (let index = 0; index < weeks; index++) events.push(...tick(sim))

    expect(sim.state.research).toBeNull()
    expect(sim.state.unlocked).toContain('topic-horror')
    expect(selectableTopics(sim).some((topic) => topic.id === 'horror')).toBe(true)
    expect(events.some((event) => event.type === 'research-complete')).toBe(true)
  })

  it('runs research in parallel with development', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'parallel' })
    grant(sim, 50)
    startResearch(sim, 'topic-war')
    startProject(sim, {
      topicId: 'space',
      genreId: 'action',
      platformId: 'home-pc',
      sliders: { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 },
    })

    tick(sim)
    expect(sim.state.project!.spentTotal).toBeGreaterThan(0)
    expect(sim.state.research).not.toBeNull()
    while (sim.state.research) tick(sim)
    expect(sim.state.unlocked).toContain('topic-war')
  })

  it('advances research while idle', () => {
    const sim = createSim({ content: clone(), seed: 'idle' })
    grant(sim, 50)
    startResearch(sim, 'topic-cooking')
    const before = sim.state.research!.weeksLeft
    tick(sim)
    expect(sim.state.research!.weeksLeft).toBe(before - 1)
  })

  it('applies tech nodes through the same path', () => {
    const sim = createSim({ content: clone(), seed: 'tech' })
    grant(sim, 50)
    startResearch(sim, 'tech-2')
    while (sim.state.research) tick(sim)
    expect(sim.state.techLevel).toBe(2)
    expect(researchStatus(sim.state, findResearchNode(sim.content, 'tech-2'))).toBe('owned')
    expect(researchStatus(sim.state, findResearchNode(sim.content, 'tech-3'))).toBe('available')
  })

  it('rejects and freezes research once the studio is closed', () => {
    const sim = createSim({ content: clone(), seed: 'closed' })
    expect(() => startResearch(sim, 'topic-horror')).toThrow(/not enough research points/)
    sim.state.phase = 'over'
    expect(() => startResearch(sim, 'topic-horror')).toThrow(/closed/)

    sim.state.research = { nodeId: 'topic-horror', weeksLeft: 3 }
    tick(sim)
    expect(sim.state.research!.weeksLeft).toBe(3)
  })
})

describe('research rewards and effects', () => {
  it('awards research points on release, scaled by review quality', () => {
    const c = clone()
    const points = 192
    const low = researchPointsFor(c, points, 4)
    const high = researchPointsFor(c, points, 9)
    expect(low).toBeGreaterThan(0)
    expect(high).toBeGreaterThan(low)

    const sim = createSim({ content: c, seed: 'reward' })
    startProject(sim, {
      topicId: 'space',
      genreId: 'action',
      platformId: 'home-pc',
      sliders: { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 },
    })
    let guard = 0
    while (sim.state.phase !== 'release' && guard++ < 200) tick(sim)
    const before = sim.state.researchPoints
    const events = releaseGame(sim)
    expect(sim.state.researchPoints).toBeGreaterThan(before)
    expect(events.some((event) => event.type === 'research-points')).toBe(true)
  })

  it('adds a capped tech level bonus to the tech score', () => {
    const c = clone()
    const project = projectWithEnginePoints(c, 8)
    const platform = c.platforms.find((entry) => entry.id === 'home-pc')!

    const base = techFitFor(project, platform, c.balance, 1)
    const mid = techFitFor(project, platform, c.balance, 3)
    const top = techFitFor(project, platform, c.balance, 5)

    expect(mid).toBeGreaterThan(base)
    expect(top).toBeGreaterThanOrEqual(mid)
    expect(top).toBeLessThanOrEqual(1)
    expect(techFitFor(project, platform, c.balance, 99)).toBeLessThanOrEqual(1)
  })

  it('keeps at least one research option within reach after a few releases', () => {
    const c = clone()
    c.balance.winValue = 1e12
    const sim = createSim({ content: c, seed: 'affordable' })

    for (let game = 0; game < 3; game++) {
      const platforms = availablePlatforms(sim)
      const platform = platforms[platforms.length - 1]
      if (!platform) break
      startProject(sim, {
        topicId: 'space',
        genreId: 'action',
        platformId: platform.id,
        sliders: { engine: 4, gameplay: 6, story: 2, graphics: 2, sound: 2 },
      })
      let guard = 0
      while (sim.state.phase !== 'release' && guard++ < 200) tick(sim)
      releaseGame(sim)
      guard = 0
      while (['sales', 'release'].includes(sim.state.phase) && guard++ < 200) tick(sim)
    }

    const affordable = researchOptions(sim.content, sim.state).filter((option) => option.affordable && option.status === 'available')
    expect(affordable.length).toBeGreaterThan(0)
  })
})

describe('save migration', () => {
  it('treats legacy saves as fully researched', () => {
    const legacy = JSON.stringify({
      version: 1,
      savedAt: Date.now(),
      rngState: 1234,
      state: {
        week: 12,
        cash: 5000,
        fans: 3,
        phase: 'idle',
        outcome: null,
        project: null,
        currentReview: null,
        sales: null,
        released: [],
      },
    })

    const sim = deserializeSim(legacy)
    expect(sim).not.toBeNull()
    expect(sim!.state.researchPoints).toBe(0)
    expect(sim!.state.techLevel).toBe(5)
    expect(sim!.state.unlocked.length).toBe(content.research.nodes.length)
    expect(selectableTopics(sim!).length).toBe(content.topics.length)
    expect(engineGenres(sim!.content, sim!.state).length).toBe(content.genres.length)
  })
})

describe('tech and scoring integration', () => {
  it('reaches a higher tech platform after researching its level', () => {
    const c = clone()
    const sim = createSim({ content: c, seed: 'integration' })
    sim.state.week = (1989 - c.balance.startYear) * c.balance.monthsPerYear * c.balance.weeksPerMonth
    grant(sim, 200, 300_000)
    startResearch(sim, 'tech-2')
    while (sim.state.research) tick(sim)
    startResearch(sim, 'tech-3')
    while (sim.state.research) tick(sim)
    expect(() =>
      startProject(sim, {
        topicId: 'space',
        genreId: 'action',
        platformId: 'pc-16',
        sliders: { engine: 6, gameplay: 6, story: 2, graphics: 1, sound: 1 },
      }),
    ).not.toThrow()
  })

  it('cannot license a platform above the engine level', () => {
    const sim = createSim({ content: clone(), seed: 'gate-error' })
    expect(() =>
      startProject(sim, {
        topicId: 'space',
        genreId: 'action',
        platformId: 'cd-station',
        sliders: { engine: 6, gameplay: 6, story: 2, graphics: 1, sound: 1 },
      }),
    ).toThrow(/not available|tech level/)
  })

  it('never lets the tech bonus push a score above one', () => {
    const c = clone()
    const project = projectWithEnginePoints(c, 200)
    const platform = c.platforms.find((entry) => entry.id === 'home-pc')!
    expect(techFitFor(project, platform, c.balance, 5)).toBeLessThanOrEqual(1)
    expect(techFitFor(project, platform, c.balance, 5)).toBeGreaterThan(0)
  })
})
