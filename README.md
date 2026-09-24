# GameDev

Web-based game-dev studio tycoon — run an indie studio from your garage: pick a topic, genre and platform, develop, release, and survive the market.

Inspired by the genre, not a copy: all content, balance values and art are original.

**Play:** https://indie-studio-sim.wayha-sokxay-technology.workers.dev

## Stack

- Vite + TypeScript
- Phaser 4 (WebGL, pixel art, all-canvas UI)
- Cloudflare Workers + D1 (cloud saves, leaderboard)
- Vitest (engine and helper unit tests)

## How to play

1. `NEW GAME` starts a solo studio in a garage in 1981.
2. `NEW PROJECT` → pick a topic, genre and platform (platforms unlock and retire over the years).
3. Allocate 16 weeks of work across engine, gameplay, story, graphics and sound — matching the genre
   helps, and high tech platforms need engine time.
4. Watch the clock: the dev types, bugs pile up, and a review lands when the project is done.
5. Fix bugs for $500 and a week each, then ship. Sales run for 12 weeks, then you get a report.
6. Every release pays **research points** (more points for bigger, better reviewed games).
7. `RESEARCH` spends points, cash and weeks to unlock topics, genres and engine tech levels.
   Higher engine tech unlocks newer platforms, and it runs in parallel with development.
8. Grow the studio value to $500,000 without running out of cash.

Mouse or touch both work; `T` ticks a week and `R` releases in short bursts (dev convenience).
`?scene=Office|DevSandbox|AssetInspector|ProjectSetup|Review|Report|GameOver|Leaderboard` jumps
straight to a scene when developing.

## Notes

- Mobile: the canvas fits any screen (portrait included) and touch input works; text gets small on
  phones, and a dedicated small-screen layout is future work.
- Audio: Web Audio starts after the first click, so the first click of a session may be silent.
- Saves live in localStorage and are backed up to the cloud; without a network the game is fully
  playable and syncs later.
- Saves made before the research update keep every topic, genre and tech level unlocked.

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
| M7 | Polish, balance, audio, mobile, deploy |
| M8 | Research system (unlock topics, genres and engine tech levels) |

Next ideas: staff hiring and studio expansion, cross-device sync codes, marketing campaigns,
post-release patches and a small-screen layout.
