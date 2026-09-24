const MAX_BODY_BYTES = 128 * 1024
const MAX_COMPANY_VALUE = 1_000_000_000
const MAX_WEEKS = 1_000_000
const MAX_GAMES = 100_000
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const ALLOWED_ORIGIN_PATTERNS = [
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.workers\.dev$/,
  /^http:\/\/localhost:5173$/,
  /^http:\/\/127\.0\.0\.1:5173$/,
]

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('Origin')
  const headers: Record<string, string> = {
    Vary: 'Origin',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
  }
  if (origin && ALLOWED_ORIGIN_PATTERNS.some((pattern) => pattern.test(origin))) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function jsonResponse(request: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(request) },
  })
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let index = 0; index < a.length; index++) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return mismatch === 0
}

export function sanitizeStudioName(value: unknown): string {
  if (typeof value !== 'string') return 'GARAGE STUDIO'
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

export function clampNumber(value: unknown, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(max, Math.max(0, Math.round(value)))
}

interface Identity {
  playerId: string
  token: string
}

function parseIdentity(payload: Record<string, unknown>): Identity | null {
  const playerId = payload.playerId
  const token = payload.token
  if (typeof playerId !== 'string' || typeof token !== 'string') return null
  if (!/^[a-zA-Z0-9-]{8,64}$/.test(playerId)) return null
  if (token.length < 16 || token.length > 128) return null
  return { playerId, token }
}

async function authorize(env: Env, identity: Identity, name: string): Promise<boolean> {
  const tokenHash = await sha256Hex(identity.token)
  await env.DB.prepare(
    'INSERT INTO players (id, token_hash, name, created_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
  )
    .bind(identity.playerId, tokenHash, name, Date.now())
    .run()

  const row = await env.DB.prepare('SELECT token_hash FROM players WHERE id = ?')
    .bind(identity.playerId)
    .first<{ token_hash: string }>()
  if (!row || !timingSafeEqual(row.token_hash, tokenHash)) return false

  await env.DB.prepare('UPDATE players SET name = ? WHERE id = ?').bind(name, identity.playerId).run()
  return true
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const declaredLength = Number(request.headers.get('content-length') ?? '0')
  if (declaredLength > MAX_BODY_BYTES) return null
  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function handleSavePut(request: Request, env: Env): Promise<Response> {
  const payload = await readJson(request)
  if (!payload) return jsonResponse(request, { error: 'invalid body' }, 400)

  const identity = parseIdentity(payload)
  if (!identity) return jsonResponse(request, { error: 'invalid identity' }, 400)

  const state = payload.state
  const rngState = clampNumber(payload.rngState, Number.MAX_SAFE_INTEGER)
  if (state === undefined || rngState === null) return jsonResponse(request, { error: 'invalid save' }, 400)

  const name = sanitizeStudioName(payload.name)
  const serialized = JSON.stringify(state)
  if (serialized.length > MAX_BODY_BYTES) return jsonResponse(request, { error: 'save too large' }, 413)

  if (!(await authorize(env, identity, name))) return jsonResponse(request, { error: 'unauthorized' }, 401)

  await env.DB.prepare(
    `INSERT INTO saves (player_id, data, rng_state, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET data = excluded.data, rng_state = excluded.rng_state, updated_at = excluded.updated_at`,
  )
    .bind(identity.playerId, serialized, rngState, Date.now())
    .run()

  return jsonResponse(request, { ok: true })
}

async function handleSaveGet(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const identity = parseIdentity({
    playerId: url.searchParams.get('playerId'),
    token: url.searchParams.get('token'),
  })
  if (!identity) return jsonResponse(request, { error: 'invalid identity' }, 400)

  const tokenHash = await sha256Hex(identity.token)
  const player = await env.DB.prepare('SELECT token_hash, name FROM players WHERE id = ?')
    .bind(identity.playerId)
    .first<{ token_hash: string; name: string }>()
  if (!player || !timingSafeEqual(player.token_hash, tokenHash)) return jsonResponse(request, { error: 'unauthorized' }, 401)

  const save = await env.DB.prepare('SELECT data, rng_state, updated_at FROM saves WHERE player_id = ?')
    .bind(identity.playerId)
    .first<{ data: string; rng_state: number; updated_at: number }>()
  if (!save) return jsonResponse(request, { error: 'no save' }, 404)

  return jsonResponse(request, {
    name: player.name,
    rngState: save.rng_state,
    updatedAt: save.updated_at,
    state: JSON.parse(save.data) as unknown,
  })
}

async function handleScore(request: Request, env: Env): Promise<Response> {
  const payload = await readJson(request)
  if (!payload) return jsonResponse(request, { error: 'invalid body' }, 400)

  const identity = parseIdentity(payload)
  if (!identity) return jsonResponse(request, { error: 'invalid identity' }, 400)

  const companyValue = clampNumber(payload.companyValue, MAX_COMPANY_VALUE)
  const weeks = clampNumber(payload.weeks, MAX_WEEKS)
  const gamesReleased = clampNumber(payload.gamesReleased, MAX_GAMES)
  if (companyValue === null || weeks === null || gamesReleased === null) {
    return jsonResponse(request, { error: 'invalid score' }, 400)
  }

  const name = sanitizeStudioName(payload.name)
  if (!(await authorize(env, identity, name))) return jsonResponse(request, { error: 'unauthorized' }, 401)

  await env.DB.prepare(
    `INSERT INTO scores (player_id, name, company_value, weeks, games_released, updated_at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(player_id) DO UPDATE SET
       name = excluded.name,
       weeks = CASE WHEN excluded.company_value > scores.company_value THEN excluded.weeks ELSE scores.weeks END,
       games_released = CASE WHEN excluded.company_value > scores.company_value THEN excluded.games_released ELSE scores.games_released END,
       company_value = MAX(scores.company_value, excluded.company_value),
       updated_at = excluded.updated_at`,
  )
    .bind(identity.playerId, name, companyValue, weeks, gamesReleased, Date.now())
    .run()

  const rank = await env.DB.prepare('SELECT COUNT(*) AS better FROM scores WHERE company_value > ?')
    .bind(companyValue)
    .first<{ better: number }>()

  return jsonResponse(request, { ok: true, rank: (rank?.better ?? 0) + 1 })
}

async function handleLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const requested = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT)
  const limit = Number.isFinite(requested) ? Math.min(MAX_LIMIT, Math.max(1, Math.round(requested))) : DEFAULT_LIMIT

  const rows = await env.DB.prepare(
    'SELECT name, company_value, weeks, games_released, updated_at FROM scores ORDER BY company_value DESC, updated_at ASC LIMIT ?',
  )
    .bind(limit)
    .all<{ name: string; company_value: number; weeks: number; games_released: number; updated_at: number }>()

  return jsonResponse(request, {
    entries: (rows.results ?? []).map((row, index) => ({
      rank: index + 1,
      name: row.name,
      companyValue: row.company_value,
      weeks: row.weeks,
      gamesReleased: row.games_released,
      updatedAt: row.updated_at,
    })),
  })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) })
    }

    try {
      if (url.pathname === '/api/health') return jsonResponse(request, { ok: true })
      if (url.pathname === '/api/save' && request.method === 'POST') return await handleSavePut(request, env)
      if (url.pathname === '/api/save' && request.method === 'GET') return await handleSaveGet(request, env)
      if (url.pathname === '/api/score' && request.method === 'POST') return await handleScore(request, env)
      if (url.pathname === '/api/leaderboard' && request.method === 'GET') return await handleLeaderboard(request, env)
      return jsonResponse(request, { error: 'not found' }, 404)
    } catch (error) {
      console.error('api failure', { path: url.pathname, message: error instanceof Error ? error.message : String(error) })
      return jsonResponse(request, { error: 'internal error' }, 500)
    }
  },
} satisfies ExportedHandler<Env>
