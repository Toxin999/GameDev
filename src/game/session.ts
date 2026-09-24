import { content } from '../data/content'
import { createSim } from '../engine/sim'
import type { Sim } from '../engine/sim'
import { SAVE_KEY, deleteSave, loadGame, saveGame } from './save'

export interface Settings {
  masterVolume: number
  sfxVolume: number
}

const SETTINGS_KEY = 'iss.settings'

export const DEFAULT_SETTINGS: Settings = { masterVolume: 0.8, sfxVolume: 0.8 }

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    return
  }
}

export function loadSettings(): Settings {
  const raw = readStorage(SETTINGS_KEY)
  if (!raw) return { ...DEFAULT_SETTINGS }
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>
    return {
      masterVolume: clamp01(parsed.masterVolume ?? DEFAULT_SETTINGS.masterVolume),
      sfxVolume: clamp01(parsed.sfxVolume ?? DEFAULT_SETTINGS.sfxVolume),
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: Settings): void {
  writeStorage(SETTINGS_KEY, JSON.stringify(settings))
}

export function hasSave(): boolean {
  return readStorage(SAVE_KEY) !== null
}

let session: Sim | null = null

export function hasSession(): boolean {
  return session !== null
}

export function getSession(): Sim | null {
  return session
}

export function startNewSession(seed?: string | number): Sim {
  deleteSave()
  session = createSim({ content, seed: seed ?? `studio-${Date.now()}` })
  return session
}

export function resumeSession(): Sim | null {
  if (session) return session
  session = loadGame()
  return session
}

export function saveSession(): void {
  if (session) saveGame(session)
}

export function clearSession(): void {
  session = null
  deleteSave()
}
