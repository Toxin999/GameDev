export const STAGE_IDS = ['engine', 'gameplay', 'story', 'graphics', 'sound'] as const
export type StageId = (typeof STAGE_IDS)[number]

export const REVIEW_CATEGORIES = ['gameplay', 'graphics', 'sound', 'story', 'tech'] as const
export type ReviewCategory = (typeof REVIEW_CATEGORIES)[number]

export const STAGE_CATEGORY: Record<StageId, ReviewCategory> = {
  engine: 'tech',
  gameplay: 'gameplay',
  story: 'story',
  graphics: 'graphics',
  sound: 'sound',
}

export const CATEGORY_STAGE: Record<ReviewCategory, StageId> = {
  tech: 'engine',
  gameplay: 'gameplay',
  story: 'story',
  graphics: 'graphics',
  sound: 'sound',
}

export interface Topic {
  id: string
  name: string
  affinity: Record<string, number>
}

export interface Genre {
  id: string
  name: string
  audience: number
  ideal: Record<StageId, number>
}

export interface Platform {
  id: string
  name: string
  releaseYear: number
  retireYear: number
  tech: number
  installBase: number
  licenseCost: number
  royalty: number
  genreAffinity: Record<string, number>
}

export interface Balance {
  startCash: number
  startYear: number
  weeksPerMonth: number
  monthsPerYear: number
  weeklyCost: number
  sliderBudget: number
  pointsPerUnit: number
  pointsPerWeek: number
  devCostPerUnit: number
  enginePointsPerTechLevel: number
  overTechPenalty: number
  bugChanceBase: number
  bugChancePerPoint: number
  bugPenaltyPerBug: number
  bugPenaltyMin: number
  fixBugCost: number
  variance: number
  minScore: number
  maxScore: number
  affinityFloor: number
  affinitySpan: number
  topicWeight: number
  platformWeight: number
  sliderWeight: number
  contextWeight: number
  categoryWeights: Record<ReviewCategory, number>
  distPenalty: number
  lifecycle: number[]
  salesBase: number
  salesReviewExponent: number
  salesWeeks: number
  salesDecay: number
  unitPrice: number
  fanConversion: number
  fanFactorDivisor: number
  revenueValuation: number
  winValue: number
  rpBase: number
  rpPerPoint: number
  techFitBonusPerLevel: number
}

export type ResearchKind = 'topic' | 'genre' | 'tech'

export interface ResearchNode {
  id: string
  name: string
  kind: ResearchKind
  target?: string
  level?: number
  costRp: number
  costCash: number
  weeks: number
  requires?: string[]
}

export interface ResearchConfig {
  start: {
    topics: string[]
    genres: string[]
    techLevel: number
  }
  nodes: ResearchNode[]
}

export interface ResearchTask {
  nodeId: string
  weeksLeft: number
}

export interface Content {
  topics: Topic[]
  genres: Genre[]
  platforms: Platform[]
  balance: Balance
  research: ResearchConfig
}

export type Sliders = Record<StageId, number>

export interface GameProject {
  topicId: string
  genreId: string
  platformId: string
  sliders: Sliders
  stagePoints: Sliders
  spent: Sliders
  spentTotal: number
  stage: StageId
  weeksSpent: number
  bugs: number
  cost: number
}

export interface Review {
  categories: Record<ReviewCategory, number>
  overall: number
}

export interface ReleasedGame {
  topicId: string
  genreId: string
  platformId: string
  review: Review
  unitsSold: number
  revenue: number
  releaseWeek: number
  weeksOnSale: number
  weeklyUnits: number[]
}

export interface SalesRun {
  platformId: string
  weeklyUnits: number[]
  week: number
  totalUnits: number
  totalRevenue: number
}

export type Phase = 'idle' | 'dev' | 'release' | 'sales' | 'over'
export type Outcome = 'bankrupt' | 'win'

export interface GameDate {
  year: number
  month: number
  week: number
}

export interface SimState {
  week: number
  cash: number
  fans: number
  phase: Phase
  outcome: Outcome | null
  project: GameProject | null
  currentReview: Review | null
  sales: SalesRun | null
  released: ReleasedGame[]
  researchPoints: number
  techLevel: number
  unlocked: string[]
  research: ResearchTask | null
}

export type SimEvent =
  | { type: 'week'; date: GameDate }
  | { type: 'stage-complete'; stage: StageId }
  | { type: 'dev-complete'; review: Review }
  | { type: 'bug'; bugs: number }
  | { type: 'bug-fixed'; bugs: number; cost: number }
  | { type: 'review'; review: Review }
  | { type: 'sales-week'; units: number; revenue: number }
  | { type: 'sales-end'; game: ReleasedGame }
  | { type: 'research-started'; nodeId: string }
  | { type: 'research-complete'; nodeId: string }
  | { type: 'research-points'; amount: number; total: number }
  | { type: 'game-over'; outcome: Outcome }
