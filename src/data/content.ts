import balanceJson from './balance.json'
import genresJson from './genres.json'
import platformsJson from './platforms.json'
import researchJson from './research.json'
import staffJson from './staff.json'
import topicsJson from './topics.json'
import { REVIEW_CATEGORIES } from '../engine/types'
import type { Content, ResearchConfig, StaffConfig } from '../engine/types'

export const content: Content = {
  topics: topicsJson.topics,
  genres: genresJson.genres,
  platforms: platformsJson.platforms,
  balance: balanceJson.balance,
  research: researchJson as ResearchConfig,
  staff: staffJson as StaffConfig,
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

  for (const id of [...c.research.start.topics, ...c.research.start.genres]) {
    if (!genreIds.includes(id) && !c.topics.some((topic) => topic.id === id)) {
      problems.push(`research start references unknown id: ${id}`)
    }
  }
  if (c.research.start.techLevel < 1) problems.push('research start techLevel must be >= 1')

  problems.push(...findDuplicates(c.research.nodes.map((node) => node.id)).map((id) => `duplicate research node id: ${id}`))

  const nodeIds = new Set(c.research.nodes.map((node) => node.id))
  for (const node of c.research.nodes) {
    if (node.kind === 'topic' && (!node.target || !c.topics.some((topic) => topic.id === node.target))) {
      problems.push(`research ${node.id}: unknown topic target ${node.target}`)
    }
    if (node.kind === 'genre' && (!node.target || !genreIds.includes(node.target))) {
      problems.push(`research ${node.id}: unknown genre target ${node.target}`)
    }
    if (node.kind === 'tech' && (node.level === undefined || node.level < 2)) {
      problems.push(`research ${node.id}: tech node needs a level >= 2`)
    }
    if (node.costRp < 0 || node.costCash < 0) problems.push(`research ${node.id}: costs must not be negative`)
    if (node.weeks < 1) problems.push(`research ${node.id}: weeks must be >= 1`)
    for (const required of node.requires ?? []) {
      if (!nodeIds.has(required)) problems.push(`research ${node.id}: unknown requirement ${required}`)
      if (required === node.id) problems.push(`research ${node.id}: cannot require itself`)
    }
  }

  for (const genre of c.genres) {
    if (c.research.start.genres.includes(genre.id)) continue
    if (!c.research.nodes.some((node) => node.kind === 'genre' && node.target === genre.id)) {
      problems.push(`genre ${genre.id} has no research node and is not a starting genre`)
    }
  }
  for (const topic of c.topics) {
    if (c.research.start.topics.includes(topic.id)) continue
    if (!c.research.nodes.some((node) => node.kind === 'topic' && node.target === topic.id)) {
      problems.push(`topic ${topic.id} has no research node and is not a starting topic`)
    }
  }

  problems.push(...findDuplicates(c.staff.roles.map((role) => role.id)).map((id) => `duplicate staff role id: ${id}`))
  if (c.staff.names.first.length === 0 || c.staff.names.last.length === 0) problems.push('staff name pools must not be empty')
  for (const role of c.staff.roles) {
    if (role.category !== null && !REVIEW_CATEGORIES.includes(role.category)) {
      problems.push(`staff role ${role.id}: unknown category ${role.category}`)
    }
  }

  const tiers = c.balance.officeTiers
  if (tiers.length === 0) problems.push('officeTiers must not be empty')
  tiers.forEach((tier, index) => {
    if (index > 0 && tier.level !== tiers[index - 1]!.level + 1) problems.push(`office tier ${tier.level}: levels must increase by one`)
    if (tier.desks < 1) problems.push(`office tier ${tier.level}: needs at least one desk`)
    if (tier.upgradeCost < 0 || tier.weeklyRent < 0) problems.push(`office tier ${tier.level}: costs must not be negative`)
  })

  const categoryWeightSum = Object.values(c.balance.categoryWeights).reduce((a, b) => a + b, 0)
  if (Math.abs(categoryWeightSum - 1) > 0.001) problems.push(`categoryWeights sum to ${categoryWeightSum}, expected 1`)
  if (c.balance.lifecycle.length === 0) problems.push('lifecycle must not be empty')
  if (c.balance.maxScore <= c.balance.minScore) problems.push('maxScore must be > minScore')

  return problems
}
