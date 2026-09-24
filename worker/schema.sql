CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'GARAGE STUDIO',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saves (
  player_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  rng_state INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scores (
  player_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company_value INTEGER NOT NULL,
  weeks INTEGER NOT NULL,
  games_released INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_value ON scores (company_value DESC);
