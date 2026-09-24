import type { Balance, Genre, Platform, Review } from './types'

export interface SalesInput {
  review: Review
  genre: Genre
  platform: Platform
  platformAge: number
  fans: number
  balance: Balance
}

export function platformLifecycle(age: number, balance: Balance): number {
  if (age < 0) return 0
  const curve = balance.lifecycle
  return age >= curve.length ? curve[curve.length - 1]! : curve[age]!
}

export function firstWeekUnits(input: SalesInput): number {
  const { review, genre, platform, platformAge, fans, balance } = input
  const reviewFactor = Math.pow(review.overall / balance.maxScore, balance.salesReviewExponent)
  const fanFactor = 1 + fans / balance.fanFactorDivisor
  const lifecycle = platformLifecycle(platformAge, balance)
  return balance.salesBase * reviewFactor * genre.audience * platform.installBase * lifecycle * fanFactor
}

export function weeklySales(input: SalesInput): number[] {
  const { balance } = input
  const first = firstWeekUnits(input)
  return Array.from({ length: balance.salesWeeks }, (_, i) =>
    Math.max(0, Math.round(first * Math.pow(balance.salesDecay, i))),
  )
}

export function weeklyRevenue(units: number, platform: Platform, balance: Balance): number {
  return Math.round(units * Math.max(0, balance.unitPrice - platform.royalty))
}
