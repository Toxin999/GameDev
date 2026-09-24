import { weeklyRevenue, weeklySales } from './market'
import { advanceResearch, availableGenres, availableTopics, researchPointsFor } from './research'
import { pointsPerWeekFor, staffBonuses, weeklyCostFor } from './staff'
import { createRng } from './rng'
import type { Rng } from './rng'
import { computeReview } from './score'
import { STAGE_IDS } from './types'
import type { Content, GameDate, GameProject, Genre, Platform, SimEvent, SimState, Sliders, StageId, Topic } from './types'

export interface Sim {
  content: Content
  rng: Rng
  state: SimState
}

export interface StartProjectInput {
  topicId: string
  genreId: string
  platformId: string
  sliders: Sliders
}

export function emptySliders(): Sliders {
  return { engine: 0, gameplay: 0, story: 0, graphics: 0, sound: 0 }
}

export function findTopic(content: Content, id: string): Topic {
  const topic = content.topics.find((t) => t.id === id)
  if (!topic) throw new Error(`unknown topic: ${id}`)
  return topic
}

export function findGenre(content: Content, id: string): Genre {
  const genre = content.genres.find((g) => g.id === id)
  if (!genre) throw new Error(`unknown genre: ${id}`)
  return genre
}

export function findPlatform(content: Content, id: string): Platform {
  const platform = content.platforms.find((p) => p.id === id)
  if (!platform) throw new Error(`unknown platform: ${id}`)
  return platform
}

export function dateOf(sim: Sim): GameDate {
  const { weeksPerMonth, monthsPerYear, startYear } = sim.content.balance
  const totalMonths = Math.floor(sim.state.week / weeksPerMonth)
  return {
    year: startYear + Math.floor(totalMonths / monthsPerYear),
    month: (totalMonths % monthsPerYear) + 1,
    week: (sim.state.week % weeksPerMonth) + 1,
  }
}

export function createSim(options: {
  content: Content
  seed?: string | number
  state?: SimState
  rngState?: number
}): Sim {
  const { content, seed = 'indie-studio', state, rngState } = options
  const rng = createRng(seed)
  if (rngState !== undefined) rng.setState(rngState)
  return {
    content,
    rng,
    state: state ?? {
      week: 0,
      cash: content.balance.startCash,
      fans: 0,
      phase: 'idle',
      outcome: null,
      project: null,
      currentReview: null,
      sales: null,
      released: [],
      researchPoints: 0,
      techLevel: content.research.start.techLevel,
      unlocked: [],
      research: null,
      staff: [],
      officeLevel: 1,
    },
  }
}

export function availablePlatforms(sim: Sim): Platform[] {
  const year = dateOf(sim).year
  return sim.content.platforms
    .filter((platform) => year >= platform.releaseYear && year < platform.retireYear)
    .filter((platform) => platform.tech <= sim.state.techLevel)
    .sort((a, b) => a.releaseYear - b.releaseYear || a.name.localeCompare(b.name))
}

export function lockedPlatformCount(sim: Sim): number {
  const year = dateOf(sim).year
  return sim.content.platforms.filter(
    (platform) => year >= platform.releaseYear && year < platform.retireYear && platform.tech > sim.state.techLevel,
  ).length
}

export function selectableTopics(sim: Sim): Topic[] {
  return availableTopics(sim.content, sim.state)
}

export function selectableGenres(sim: Sim): Genre[] {
  return availableGenres(sim.content, sim.state)
}

export function projectCost(content: Content, platform: Platform, sliders: Sliders): number {
  const units = STAGE_IDS.reduce((sum, stage) => sum + Math.max(0, sliders[stage]), 0)
  return units * content.balance.devCostPerUnit + platform.licenseCost
}

export function totalUnits(sliders: Sliders): number {
  return STAGE_IDS.reduce((sum, stage) => sum + Math.max(0, sliders[stage]), 0)
}

export function projectWeeks(content: Content, sliders: Sliders, pointsPerWeek = content.balance.pointsPerWeek): number {
  const points = totalUnits(sliders) * content.balance.pointsPerUnit
  return Math.max(1, Math.ceil(points / Math.max(1, pointsPerWeek)))
}

export function companyValue(sim: Sim): number {
  const lifetimeRevenue = sim.state.released.reduce((sum, game) => sum + game.revenue, 0)
  return Math.round(sim.state.cash + lifetimeRevenue * sim.content.balance.revenueValuation)
}

export function startProject(sim: Sim, input: StartProjectInput): void {
  const { content, state } = sim
  const { balance } = content

  if (state.phase !== 'idle') throw new Error(`cannot start project in phase: ${state.phase}`)

  findTopic(content, input.topicId)
  findGenre(content, input.genreId)
  const platform = findPlatform(content, input.platformId)
  const year = dateOf(sim).year
  if (year < platform.releaseYear || year >= platform.retireYear) {
    throw new Error(`platform ${platform.id} is not available in ${year}`)
  }
  if (platform.tech > state.techLevel) {
    throw new Error(`platform ${platform.id} needs engine tech level ${platform.tech}`)
  }

  for (const stage of STAGE_IDS) {
    const value = input.sliders[stage]
    if (!Number.isInteger(value) || value < 0) throw new Error(`slider ${stage} must be a non-negative integer`)
  }

  const units = totalUnits(input.sliders)
  if (units === 0) throw new Error('sliders must allocate at least one unit')
  if (units > balance.sliderBudget) throw new Error(`slider budget exceeded: ${units} > ${balance.sliderBudget}`)

  const cost = projectCost(content, platform, input.sliders)
  if (state.cash < cost) throw new Error(`not enough cash: need ${cost}, have ${state.cash}`)

  const stagePoints = emptySliders()
  for (const stage of STAGE_IDS) stagePoints[stage] = input.sliders[stage] * balance.pointsPerUnit

  state.cash -= cost
  state.project = {
    topicId: input.topicId,
    genreId: input.genreId,
    platformId: input.platformId,
    sliders: { ...input.sliders },
    stagePoints,
    spent: emptySliders(),
    spentTotal: 0,
    stage: 'engine',
    weeksSpent: 0,
    bugs: 0,
    cost,
  }
  state.phase = 'dev'
}

export function stageAtSpent(project: GameProject): StageId {
  let boundary = 0
  for (const stage of STAGE_IDS) {
    boundary += project.stagePoints[stage]
    if (project.spentTotal < boundary) return stage
  }
  return STAGE_IDS[STAGE_IDS.length - 1]!
}

function syncSpent(project: GameProject): void {
  let boundary = 0
  for (const stage of STAGE_IDS) {
    const total = project.stagePoints[stage]
    project.spent[stage] = Math.min(total, Math.max(0, project.spentTotal - boundary))
    boundary += total
  }
}

function completeDev(sim: Sim, events: SimEvent[]): void {
  const { state, content, rng } = sim
  const project = state.project!
  const review = computeReview({
    project,
    topic: findTopic(content, project.topicId),
    genre: findGenre(content, project.genreId),
    platform: findPlatform(content, project.platformId),
    balance: content.balance,
    rng,
    techLevel: state.techLevel,
    staffBonuses: staffBonuses(content, state),
  })
  state.currentReview = review
  state.phase = 'release'
  events.push({ type: 'dev-complete', review })
}

function advanceDev(sim: Sim, events: SimEvent[]): void {
  const { state, content } = sim
  const { balance } = content
  const project = state.project!

  const plannedPoints = STAGE_IDS.reduce((sum, stage) => sum + project.stagePoints[stage], 0)
  const before = project.spentTotal
  project.spentTotal = Math.min(plannedPoints, before + pointsPerWeekFor(content, state))
  syncSpent(project)

  let boundary = 0
  for (const stage of STAGE_IDS) {
    boundary += project.stagePoints[stage]
    if (before < boundary && boundary <= project.spentTotal) events.push({ type: 'stage-complete', stage })
  }
  project.stage = stageAtSpent(project)
  project.weeksSpent += 1

  const bugChance = (balance.bugChanceBase + plannedPoints * balance.bugChancePerPoint) * staffBonuses(content, state).bugChanceMultiplier
  if (sim.rng.next() < bugChance) {
    project.bugs += 1
    events.push({ type: 'bug', bugs: project.bugs })
  }

  if (project.spentTotal >= plannedPoints) completeDev(sim, events)
}

function advanceSales(sim: Sim, events: SimEvent[]): void {
  const { state, content } = sim
  const { balance } = content
  const sales = state.sales!
  const platform = findPlatform(content, sales.platformId)

  const units = sales.weeklyUnits[sales.week] ?? 0
  const revenue = weeklyRevenue(units, platform, balance)
  state.cash += revenue
  sales.totalUnits += units
  sales.totalRevenue += revenue
  sales.week += 1
  events.push({ type: 'sales-week', units, revenue })

  const game = state.released[state.released.length - 1]
  if (game) {
    game.unitsSold = sales.totalUnits
    game.revenue = sales.totalRevenue
    game.weeksOnSale = sales.week
  }

  if (sales.week >= sales.weeklyUnits.length) {
    state.fans += Math.round(sales.totalUnits * balance.fanConversion)
    state.sales = null
    state.project = null
    state.currentReview = null
    state.phase = 'idle'
    if (game) events.push({ type: 'sales-end', game })
  }
}

function checkOutcome(sim: Sim, events: SimEvent[]): void {
  const { state, content } = sim
  if (state.phase === 'over') return
  if (state.cash < 0) {
    state.phase = 'over'
    state.outcome = 'bankrupt'
    events.push({ type: 'game-over', outcome: 'bankrupt' })
    return
  }
  if (companyValue(sim) >= content.balance.winValue) {
    state.phase = 'over'
    state.outcome = 'win'
    events.push({ type: 'game-over', outcome: 'win' })
  }
}

export function tick(sim: Sim): SimEvent[] {
  const events: SimEvent[] = []
  if (sim.state.phase === 'over') return events

  sim.state.week += 1
  sim.state.cash -= weeklyCostFor(sim.content, sim.state)
  events.push({ type: 'week', date: dateOf(sim) })

  if (sim.state.phase === 'dev') advanceDev(sim, events)
  else if (sim.state.phase === 'sales') advanceSales(sim, events)

  advanceResearch(sim, events)
  checkOutcome(sim, events)
  return events
}

export function fixBug(sim: Sim): SimEvent[] {
  const { state, content } = sim
  if (state.phase !== 'release' || !state.project) throw new Error('no project waiting for release')
  if (state.project.bugs <= 0) throw new Error('no bugs to fix')

  const events: SimEvent[] = []
  const cost = content.balance.fixBugCost
  if (state.cash < cost) throw new Error(`not enough cash to fix bugs: need ${cost}`)

  state.project.bugs -= 1
  state.cash -= cost + weeklyCostFor(content, state)
  state.week += 1
  events.push({ type: 'bug-fixed', bugs: state.project.bugs, cost })
  events.push({ type: 'week', date: dateOf(sim) })

  if (state.currentReview) {
    const review = computeReview({
      project: state.project,
      topic: findTopic(content, state.project.topicId),
      genre: findGenre(content, state.project.genreId),
      platform: findPlatform(content, state.project.platformId),
      balance: content.balance,
      rng: sim.rng,
      techLevel: state.techLevel,
      staffBonuses: staffBonuses(content, state),
    })
    state.currentReview = review
    events.push({ type: 'review', review })
  }

  checkOutcome(sim, events)
  return events
}

export function releaseGame(sim: Sim): SimEvent[] {
  const { state, content } = sim
  const { balance } = content
  const project = state.project
  const review = state.currentReview
  if (state.phase !== 'release' || !project || !review) throw new Error('no finished project to release')

  const platform = findPlatform(content, project.platformId)
  const genre = findGenre(content, project.genreId)
  const platformAge = dateOf(sim).year - platform.releaseYear

  const weeklyUnits = weeklySales({ review, genre, platform, platformAge, fans: state.fans, balance })
  state.sales = {
    platformId: platform.id,
    weeklyUnits,
    week: 0,
    totalUnits: 0,
    totalRevenue: 0,
  }
  state.released.push({
    topicId: project.topicId,
    genreId: project.genreId,
    platformId: project.platformId,
    review,
    unitsSold: 0,
    revenue: 0,
    releaseWeek: state.week,
    weeksOnSale: 0,
    weeklyUnits,
  })
  state.phase = 'sales'

  const points = STAGE_IDS.reduce((sum, stage) => sum + project.stagePoints[stage], 0)
  const reward = researchPointsFor(content, points, review.overall)
  state.researchPoints += reward
  return [{ type: 'research-points', amount: reward, total: state.researchPoints }]
}

export function projectProgress(project: GameProject): number {
  const total = STAGE_IDS.reduce((sum, stage) => sum + project.stagePoints[stage], 0)
  return total > 0 ? Math.min(1, project.spentTotal / total) : 1
}
