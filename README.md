# GameDev

Web-based game-dev studio tycoon — run an indie studio from your garage: pick a topic, genre and platform, develop, release, and survive the market.

Inspired by the genre, not a copy: all content, balance values and art are original.

## Stack

- Vite + TypeScript
- Phaser 4 (WebGL, pixel art)
- Cloudflare Pages + Workers + D1 (cloud saves, leaderboard) — M6
- Vitest (engine unit tests)

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm test         # engine tests
```

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
