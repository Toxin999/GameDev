import { content } from '../data/content'
import { createSim } from '../engine/sim'
import type { Sim } from '../engine/sim'
import type { SimState } from '../engine/types'

export const SAVE_VERSION = 2
export const SAVE_KEY = 'iss.save'

interface SaveFile {
  version: number
  savedAt: number
  rngState: number
  state: SimState
}

export function serializeSim(sim: Sim): string {
  const file: SaveFile = {
    version: SAVE_VERSION,
    savedAt: Date.now(),
    rngState: sim.rng.getState(),
    state: sim.state,
  }
  return JSON.stringify(file)
}

function referencesKnownContent(state: SimState): boolean {
  const topicIds = new Set(content.topics.map((topic) => topic.id))
  const genreIds = new Set(content.genres.map((genre) => genre.id))
  const platformIds = new Set(content.platforms.map((platform) => platform.id))

  const project = state.project
  if (project) {
    if (!topicIds.has(project.topicId) || !genreIds.has(project.genreId) || !platformIds.has(project.platformId)) return false
  }
  for (const game of state.released) {
    if (!topicIds.has(game.topicId) || !genreIds.has(game.genreId) || !platformIds.has(game.platformId)) return false
  }
  if (state.sales && !platformIds.has(state.sales.platformId)) return false
  return true
}

export function deserializeSim(raw: string): Sim | null {
  let parsed: Partial<SaveFile>
  try {
    parsed = JSON.parse(raw) as Partial<SaveFile>
  } catch {
    return null
  }
  if (parsed.version !== SAVE_VERSION && parsed.version !== SAVE_VERSION - 1) return null
  return simFromStoredState(parsed.state, parsed.rngState)
}

function migrateResearch(state: SimState): SimState {
  const migrated = { ...state }
  if (typeof migrated.researchPoints !== 'number') migrated.researchPoints = 0
  if (typeof migrated.techLevel !== 'number') migrated.techLevel = 5
  if (!Array.isArray(migrated.unlocked)) migrated.unlocked = content.research.nodes.map((node) => node.id)
  if (migrated.research === undefined) migrated.research = null
  migrated.techLevel = Math.max(content.research.start.techLevel, migrated.techLevel)
  return migrated
}

export function simFromStoredState(state: unknown, rngState: unknown): Sim | null {
  if (!state || typeof state !== 'object' || typeof rngState !== 'number' || !Number.isFinite(rngState)) return null
  const candidate = migrateResearch(state as SimState)
  if (candidate.week === undefined || candidate.cash === undefined || !Array.isArray(candidate.released)) return null
  if (!referencesKnownContent(candidate)) return null
  return createSim({ content, state: candidate, rngState })
}

export function saveGame(sim: Sim): void {
  try {
    window.localStorage.setItem(SAVE_KEY, serializeSim(sim))
  } catch {
    return
  }
}

export function loadGame(): Sim | null {
  let raw: string | null = null
  try {
    raw = window.localStorage.getItem(SAVE_KEY)
  } catch {
    return null
  }
  if (!raw) return null
  return deserializeSim(raw)
}

export function deleteSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY)
  } catch {
    return
  }
}
