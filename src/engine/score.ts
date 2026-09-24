import type { Rng } from './rng'
import { CATEGORY_STAGE, REVIEW_CATEGORIES, STAGE_CATEGORY, STAGE_IDS } from './types'
import type { Balance, GameProject, Genre, Platform, Review, ReviewCategory, StageId, Topic } from './types'

export interface ScoreInput {
  project: GameProject
  topic: Topic
  genre: Genre
  platform: Platform
  balance: Balance
  rng: Rng
  techLevel?: number
}

export interface ScoreBreakdown {
  topicFit: number
  platformFit: number
  techFit: number
  sliderFit: Record<ReviewCategory, number>
  contextFit: Record<ReviewCategory, number>
  bugFactor: number
  categories: Record<ReviewCategory, number>
  overall: number
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function normalize(value: number, floor: number, span: number): number {
  return clamp01((value - floor) / span)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function topicFitFor(topic: Topic, genreId: string, balance: Balance): number {
  const affinity = topic.affinity[genreId] ?? balance.affinityFloor
  return normalize(affinity, balance.affinityFloor, balance.affinitySpan)
}

export function platformFitFor(platform: Platform, genreId: string, balance: Balance): number {
  const affinity = platform.genreAffinity[genreId] ?? balance.affinityFloor
  return normalize(affinity, balance.affinityFloor, balance.affinitySpan)
}

export function techFitFor(project: GameProject, platform: Platform, balance: Balance, techLevel = 1): number {
  const enginePoints = project.stagePoints.engine
  const required = platform.tech * balance.enginePointsPerTechLevel
  const ratio = enginePoints / required
  const base = ratio < 1 ? clamp01(ratio) : Math.max(0.6, 1 - (ratio - 1) * balance.overTechPenalty)
  const bonus = Math.max(0, techLevel - 1) * balance.techFitBonusPerLevel
  return clamp01(base + bonus)
}

export function scoreProject(input: ScoreInput): ScoreBreakdown {
  const { project, topic, genre, platform, balance, rng, techLevel = 1 } = input

  const totalUnits = STAGE_IDS.reduce((sum, stage) => sum + project.sliders[stage], 0)
  const topicFit = topicFitFor(topic, project.genreId, balance)
  const platformFit = platformFitFor(platform, project.genreId, balance)
  const techFit = techFitFor(project, platform, balance, techLevel)

  const sliderFit = {} as Record<ReviewCategory, number>
  for (const stage of STAGE_IDS) {
    const actual = totalUnits > 0 ? project.sliders[stage] / totalUnits : 0
    const deviation = Math.abs(actual - genre.ideal[stage])
    sliderFit[STAGE_CATEGORY[stage]] = clamp01(1 - deviation * balance.distPenalty)
  }

  const contextFit: Record<ReviewCategory, number> = {
    gameplay: 0.5 * topicFit + 0.5 * platformFit,
    graphics: 0.7 * techFit + 0.3 * platformFit,
    sound: 0.8 * techFit + 0.2 * platformFit,
    story: 0.8 * topicFit + 0.2 * platformFit,
    tech: techFit,
  }

  const bugFactor = Math.max(balance.bugPenaltyMin, 1 - project.bugs * balance.bugPenaltyPerBug)
  const categories = {} as Record<ReviewCategory, number>

  for (const category of REVIEW_CATEGORIES) {
    const raw = balance.sliderWeight * sliderFit[category] + balance.contextWeight * contextFit[category]
    const jittered = raw * bugFactor * (1 + rng.range(-balance.variance, balance.variance))
    categories[category] = round1(balance.minScore + clamp01(jittered) * (balance.maxScore - balance.minScore))
  }

  const overallRaw = REVIEW_CATEGORIES.reduce(
    (sum, category) => sum + categories[category] * balance.categoryWeights[category],
    0,
  )

  return {
    topicFit,
    platformFit,
    techFit,
    sliderFit,
    contextFit,
    bugFactor,
    categories,
    overall: round1(Math.min(balance.maxScore, Math.max(balance.minScore, overallRaw))),
  }
}

export function computeReview(input: ScoreInput): Review {
  const { categories, overall } = scoreProject(input)
  return { categories, overall }
}

export function stageOfCategory(category: ReviewCategory): StageId {
  return CATEGORY_STAGE[category]
}
