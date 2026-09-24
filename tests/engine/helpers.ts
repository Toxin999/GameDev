import { content } from '../../src/data/content'
import { allocateSliders } from '../../src/game/allocate'
import type { Sim } from '../../src/engine/sim'
import { availablePlatforms, releaseGame, startProject, tick } from '../../src/engine/sim'
import type { Content, SimEvent } from '../../src/engine/types'

export function clone(): Content {
  return structuredClone(content)
}

export function grant(sim: Sim, rp: number, cash = 200_000): void {
  sim.state.researchPoints += rp
  sim.state.cash += cash
}

export function runUntil(sim: Sim, phases: string[], limit: number): SimEvent[] {
  const events: SimEvent[] = []
  let guard = 0
  while (!phases.includes(sim.state.phase) && guard++ < limit) events.push(...tick(sim))
  return events
}

export interface PlayedGame {
  topic: string
  genre: string
  platform: string
  review: number
  units: number
  revenue: number
}

export function playNaiveGame(sim: Sim, content_: Content = sim.content): PlayedGame {
  const platforms = availablePlatforms(sim)
  const platform = platforms[platforms.length - 1]
  if (!platform) throw new Error('no platform available for the naive player')
  const genre = sim.rng.pick(content_.genres)
  const topic = sim.rng.pick(content_.topics)

  startProject(sim, {
    topicId: topic.id,
    genreId: genre.id,
    platformId: platform.id,
    sliders: allocateSliders(content_, genre.id, content_.balance.sliderBudget),
  })
  runUntil(sim, ['release', 'over'], 200)
  const review = sim.state.currentReview!
  releaseGame(sim)
  runUntil(sim, ['idle', 'over'], 100)
  const game = sim.state.released[sim.state.released.length - 1]!
  return {
    topic: topic.name,
    genre: genre.name,
    platform: platform.name,
    review: review.overall,
    units: game.unitsSold,
    revenue: game.revenue,
  }
}
