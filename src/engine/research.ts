import type { Content, Genre, ResearchNode, SimEvent, SimState, Topic } from './types'

export type ResearchStatus = 'owned' | 'available' | 'locked'

export interface ResearchOption {
  node: ResearchNode
  status: ResearchStatus
  affordable: boolean
  missing: string[]
}

export function findResearchNode(content: Content, nodeId: string): ResearchNode {
  const node = content.research.nodes.find((entry) => entry.id === nodeId)
  if (!node) throw new Error(`unknown research node: ${nodeId}`)
  return node
}

export function isResearched(state: SimState, nodeId: string): boolean {
  return state.unlocked.includes(nodeId)
}

export function researchStatus(state: SimState, node: ResearchNode): ResearchStatus {
  if (isResearched(state, node.id)) return 'owned'
  const requires = node.requires ?? []
  return requires.every((required) => isResearched(state, required)) ? 'available' : 'locked'
}

export function availableTopics(content: Content, state: SimState): Topic[] {
  const start = new Set(content.research.start.topics)
  const researched = new Set(state.unlocked)
  return content.topics.filter(
    (topic) =>
      start.has(topic.id) ||
      content.research.nodes.some((node) => node.kind === 'topic' && node.target === topic.id && researched.has(node.id)),
  )
}

export function availableGenres(content: Content, state: SimState): Genre[] {
  const start = new Set(content.research.start.genres)
  const researched = new Set(state.unlocked)
  return content.genres.filter(
    (genre) =>
      start.has(genre.id) ||
      content.research.nodes.some((node) => node.kind === 'genre' && node.target === genre.id && researched.has(node.id)),
  )
}

export function lockedTopicCount(content: Content, state: SimState): number {
  return content.topics.length - availableTopics(content, state).length
}

export function lockedGenreCount(content: Content, state: SimState): number {
  return content.genres.length - availableGenres(content, state).length
}

export function researchOptions(content: Content, state: SimState): ResearchOption[] {
  return content.research.nodes.map((node) => {
    const status = researchStatus(state, node)
    const missing: string[] = []
    if (status === 'locked') {
      for (const required of node.requires ?? []) {
        if (!isResearched(state, required)) missing.push(findResearchNode(content, required).name)
      }
    }
    if (state.researchPoints < node.costRp) missing.push(`${node.costRp - state.researchPoints} RP`)
    if (state.cash < node.costCash) missing.push(`$${(node.costCash - Math.round(state.cash)).toLocaleString('en-US')}`)
    if (state.research) missing.push('BUSY')
    return { node, status, affordable: missing.length === 0, missing }
  })
}

export function startResearch(sim: { content: Content; state: SimState }, nodeId: string): void {
  const { content, state } = sim
  if (state.phase === 'over') throw new Error('the studio is closed')

  const node = findResearchNode(content, nodeId)
  if (isResearched(state, nodeId)) throw new Error(`${node.name} is already researched`)
  if (state.research) throw new Error('another research project is running')
  if (researchStatus(state, node) === 'locked') {
    const requires = (node.requires ?? []).map((required) => findResearchNode(content, required).name).join(', ')
    throw new Error(`requires ${requires}`)
  }
  if (state.researchPoints < node.costRp) throw new Error(`not enough research points: need ${node.costRp}`)
  if (state.cash < node.costCash) throw new Error(`not enough cash: need ${node.costCash}`)

  state.researchPoints -= node.costRp
  state.cash -= node.costCash
  state.research = { nodeId: node.id, weeksLeft: node.weeks }
}

export function researchPointsFor(content: Content, points: number, reviewOverall: number): number {
  const { rpBase, rpPerPoint } = content.balance
  const quality = Math.max(0, Math.min(1, reviewOverall / content.balance.maxScore))
  return Math.max(1, Math.round(rpBase + points * rpPerPoint * quality))
}

export function applyResearchNode(sim: { content: Content; state: SimState }, node: ResearchNode): void {
  if (!sim.state.unlocked.includes(node.id)) sim.state.unlocked.push(node.id)
  if (node.kind === 'tech') {
    sim.state.techLevel = Math.max(sim.state.techLevel, node.level ?? sim.state.techLevel)
  }
}

export function advanceResearch(sim: { content: Content; state: SimState }, events: SimEvent[]): void {
  const task = sim.state.research
  if (!task) return

  task.weeksLeft -= 1
  if (task.weeksLeft > 0) return

  const node = findResearchNode(sim.content, task.nodeId)
  applyResearchNode(sim, node)
  sim.state.research = null
  events.push({ type: 'research-complete', nodeId: node.id })
}
