import balanceJson from './balance.json'
import genresJson from './genres.json'
import platformsJson from './platforms.json'
import topicsJson from './topics.json'
import type { Content } from '../engine/types'

export const content: Content = {
  topics: topicsJson.topics,
  genres: genresJson.genres,
  platforms: platformsJson.platforms,
  balance: balanceJson.balance,
}

function findDuplicates(ids: string[]): string[] {
  const seen = new Set<string>()
  const dupes = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id)
    seen.add(id)
  }
  return [...dupes]
}

export function validateContent(c: Content): string[] {
  const problems: string[] = []
  const genreIds = c.genres.map((g) => g.id)

  problems.push(...findDuplicates(genreIds).map((id) => `duplicate genre id: ${id}`))
  problems.push(...findDuplicates(c.topics.map((t) => t.id)).map((id) => `duplicate topic id: ${id}`))
  problems.push(...findDuplicates(c.platforms.map((p) => p.id)).map((id) => `duplicate platform id: ${id}`))

  for (const genre of c.genres) {
    const sum = Object.values(genre.ideal).reduce((a, b) => a + b, 0)
    if (Math.abs(sum - 1) > 0.001) problems.push(`genre ${genre.id}: ideal shares sum to ${sum}, expected 1`)
    if (genre.audience <= 0) problems.push(`genre ${genre.id}: audience must be > 0`)
  }

  for (const topic of c.topics) {
    for (const [genreId, value] of Object.entries(topic.affinity)) {
      if (!genreIds.includes(genreId)) problems.push(`topic ${topic.id}: unknown genre ${genreId}`)
      if (value <= 0) problems.push(`topic ${topic.id}/${genreId}: affinity must be > 0`)
    }
  }

  for (const platform of c.platforms) {
    if (platform.retireYear <= platform.releaseYear) problems.push(`platform ${platform.id}: retireYear <= releaseYear`)
    for (const [genreId, value] of Object.entries(platform.genreAffinity)) {
      if (!genreIds.includes(genreId)) problems.push(`platform ${platform.id}: unknown genre ${genreId}`)
      if (value <= 0) problems.push(`platform ${platform.id}/${genreId}: affinity must be > 0`)
    }
    if (platform.tech < 1) problems.push(`platform ${platform.id}: tech must be >= 1`)
    if (platform.installBase <= 0) problems.push(`platform ${platform.id}: installBase must be > 0`)
  }

  const categoryWeightSum = Object.values(c.balance.categoryWeights).reduce((a, b) => a + b, 0)
  if (Math.abs(categoryWeightSum - 1) > 0.001) problems.push(`categoryWeights sum to ${categoryWeightSum}, expected 1`)
  if (c.balance.lifecycle.length === 0) problems.push('lifecycle must not be empty')
  if (c.balance.maxScore <= c.balance.minScore) problems.push('maxScore must be > minScore')

  return problems
}
