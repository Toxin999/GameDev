# GameDev

Web-based game-dev studio tycoon — run an indie studio from your garage: pick a topic, genre and platform, develop, release, and survive the market.

Inspired by the genre, not a copy: all content, balance values and art are original.

**Play:** https://indie-studio-sim.wayha-sokxay-technology.workers.dev

## Stack

- Vite + TypeScript
- Phaser 4 (WebGL, pixel art, all-canvas UI)
- Cloudflare Workers + D1 (cloud saves, leaderboard)
- Vitest (engine and helper unit tests)

## Development

```bash
npm install
npm run dev      # game at http://localhost:5173
npm run build    # typecheck + production build
npm test         # unit tests
```

### Cloud API (local)

The game is offline-first: it plays fine without the API and syncs when it is reachable.
For local development run the Worker next to Vite:

```bash
npm run cf:db:local   # create the local D1 schema
npm run cf:dev        # Worker + assets on http://127.0.0.1:8787
npm run dev           # Vite serves the game, API base points at 127.0.0.1:8787 in dev
```

### Deploy

```bash
npm run cf:db:remote  # apply the schema to the remote D1 database
npm run deploy        # build the game and deploy Worker + assets in one shot
```

`wrangler.jsonc` holds the Worker name, asset directory, D1 binding and observability settings.
Run `npm run cf:types` after changing it (generates `worker-configuration.d.ts`).

## API

| Method | Path | Notes |
| ------ | ---- | ----- |
| POST | `/api/save` | Upsert a save. Body: `playerId`, `token`, `name`, `rngState`, `state` |
| GET | `/api/save?playerId=&token=` | Load a save |
| POST | `/api/score` | Submit a leaderboard score |
| GET | `/api/leaderboard?limit=20` | Top studios by company value |
| GET | `/api/health` | Liveness probe |

Identity is anonymous: the client generates a `playerId` (UUID) and a random token, both kept in
localStorage; the Worker stores only a SHA-256 hash of the token. There is no cross-device sync yet
(a pairing code is planned), and leaderboard values are client-reported, so the ranking is
trust-based apart from sanity caps.

## Roadmap

| # | Milestone |
| - | --------- |
| M0 | Scaffold (Vite + TS + Phaser 4) |
| M1 | Game engine (dev loop, scoring, market) + tests |
| M2 | Canvas UI kit + main menu |
| M3 | Office scene + pixel art + characters |
| M4 | Dev flow screens wired to engine |
| M5 | Sales, money, win/lose, local save |
| M6 | Cloud saves + leaderboard (Workers + D1) |
| M7 | Polish, balance, mobile, deploy |
