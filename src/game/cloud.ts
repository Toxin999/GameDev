import type { Sim } from '../engine/sim'
import { companyValue } from '../engine/sim'
import { simFromStoredState } from './save'

const IDENTITY_KEY = 'iss.player'
const NAME_KEY = 'iss.studio'
const PUSH_INTERVAL_MS = 30_000
const REQUEST_TIMEOUT_MS = 6_000

const ADJECTIVES = [
  'PIXEL',
  'TURBO',
  'NEON',
  'COSMIC',
  'RETRO',
  'CHROME',
  'QUANTUM',
  'MIGHTY',
  'SLEEPY',
  'GOLDEN',
  'WILD',
  'TINY',
] as const

const NOUNS = [
  'FOX',
  'OTTER',
  'COMET',
  'DRAGON',
  'MONKEY',
  'PENGUIN',
  'ROBOT',
  'WIZARD',
  'TIGER',
  'FALCON',
  'PANDA',
  'GOBLIN',
] as const

export interface Identity {
  playerId: string
  token: string
}

export interface LeaderboardEntry {
  rank: number
  name: string
  companyValue: number
  weeks: number
  gamesReleased: number
}

let lastPushAt = 0

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

function randomHex(bytes: number): string {
  const values = new Uint8Array(bytes)
  crypto.getRandomValues(values)
  return [...values].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export function pickStudioName(random: () => number = Math.random): string {
  const adjective = ADJECTIVES[Math.floor(random() * ADJECTIVES.length) % ADJECTIVES.length]!
  const noun = NOUNS[Math.floor(random() * NOUNS.length) % NOUNS.length]!
  return `${adjective} ${noun}`
}

export function normalizeStudioName(value: string): string {
  const cleaned = value
    .replace(/\s+/g, ' ')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16)
    .trim()
  return cleaned.length > 0 ? cleaned : 'GARAGE STUDIO'
}

export function getStudioName(): string {
  const stored = readStorage(NAME_KEY)
  if (stored) return normalizeStudioName(stored)
  const generated = pickStudioName()
  writeStorage(NAME_KEY, generated)
  return generated
}

export function setStudioName(value: string): string {
  const normalized = normalizeStudioName(value)
  writeStorage(NAME_KEY, normalized)
  return normalized
}

export function getIdentity(): Identity {
  const stored = readStorage(IDENTITY_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as Partial<Identity>
      if (parsed.playerId && parsed.token) return { playerId: parsed.playerId, token: parsed.token }
    } catch {
      writeStorage(IDENTITY_KEY, '')
    }
  }
  const identity: Identity = { playerId: crypto.randomUUID(), token: randomHex(24) }
  writeStorage(IDENTITY_KEY, JSON.stringify(identity))
  return identity
}

export function hasIdentity(): boolean {
  return readStorage(IDENTITY_KEY) !== null
}

export function apiBase(): string {
  if (!import.meta.env.DEV) return ''
  return (import.meta.env.VITE_API_BASE as string | undefined) ?? 'http://127.0.0.1:8787'
}

export function cloudAvailable(): boolean {
  return typeof fetch === 'function' && typeof crypto?.randomUUID === 'function'
}

async function request<T>(path: string, init?: RequestInit): Promise<T | null> {
  if (!cloudAvailable()) return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${apiBase()}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
    })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function pushCloudSave(sim: Sim): Promise<boolean> {
  const identity = getIdentity()
  const payload = {
    playerId: identity.playerId,
    token: identity.token,
    name: getStudioName(),
    rngState: sim.rng.getState(),
    state: sim.state,
  }
  const result = await request<{ ok: boolean }>('/api/save', { method: 'POST', body: JSON.stringify(payload) })
  if (result?.ok) lastPushAt = Date.now()
  return Boolean(result?.ok)
}

export function maybePushCloudSave(sim: Sim): void {
  if (Date.now() - lastPushAt < PUSH_INTERVAL_MS) return
  lastPushAt = Date.now()
  void pushCloudSave(sim)
}

export async function pullCloudSave(): Promise<Sim | null> {
  const identity = getIdentity()
  const query = new URLSearchParams({ playerId: identity.playerId, token: identity.token })
  const result = await request<{ state: unknown; rngState: number }>(`/api/save?${query.toString()}`)
  if (!result) return null
  return simFromStoredState(result.state, result.rngState)
}

export async function submitScore(sim: Sim): Promise<number | null> {
  const identity = getIdentity()
  const result = await request<{ ok: boolean; rank: number }>('/api/score', {
    method: 'POST',
    body: JSON.stringify({
      playerId: identity.playerId,
      token: identity.token,
      name: getStudioName(),
      companyValue: companyValue(sim),
      weeks: sim.state.week,
      gamesReleased: sim.state.released.length,
    }),
  })
  void pushCloudSave(sim)
  return result?.rank ?? null
}

export async function fetchLeaderboard(limit = 20): Promise<LeaderboardEntry[] | null> {
  const result = await request<{ entries: LeaderboardEntry[] }>(`/api/leaderboard?limit=${limit}`)
  return result?.entries ?? null
}
