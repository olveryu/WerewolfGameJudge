# 🐺 Werewolf Game Judge

[简体中文](./README.md) | **English**

Night-1 automated judge for in-person and remote Werewolf games.

[![Live](https://img.shields.io/badge/Play-werewolfjudge.eu.org-blue?style=flat-square)](https://werewolfjudge.eu.org)
[![CI](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml/badge.svg)](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TS-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo_SDK-55-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![Cloudflare](https://img.shields.io/badge/CF-Workers%20+%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)

> **👉 [werewolfjudge.eu.org](https://werewolfjudge.eu.org)** — Instant play, no registration

---

## Features

- **Auto Voice Narration** — Fully guided Night-1 flow; Host can close eyes too
- **Multi-device Sync** — Create room, share 4-digit code, others join
- **Auto-Recovery** — D1 persistence + WebSocket, zero state loss
- **43 Roles · 27 Preset Boards** — Full role library with special wolves, gods & third-party
- **AI Assistant** — Floating chat bubble for rules & strategy (Gemini 3.1 Flash Lite)
- **8 Themes** — Light / Sand / Jade / Sky / Dark / Midnight / Blood / Forest
- **Cross-platform** — iOS · Android · Web (PWA)

---

## How to Play

| Step | Host                                        | Player                      |
| ---- | ------------------------------------------- | --------------------------- |
| 1    | Create room → pick template & player count  | Join room → enter room code |
| 2    | Share 4-digit room code                     | Tap a seat to sit           |
| 3    | After all view identity → "Start Game"      | View role → confirm         |
| 4    | After night ends → "View Last Night Deaths" | Act based on your role      |

> Daytime discussion & voting happen among players (in-person or via voice chat). App handles Night-1 only.

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│       Cloudflare Worker (Game Logic Authority)    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ REST API │  │ game-engine│  │ Durable Object│  │
│  │ (Auth +  │  │ (pure     │  │  (GameRoom)  │  │
│  │  Game)   │  │  logic)   │  │  WebSocket   │  │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  │
│       │              │               │           │
│       └──────────────┴───────────────┘           │
│                      │                           │
│                 Cloudflare D1                     │
└─────────────────────┬───────────────────────────┘
                      │
          ┌───────────┼───────────┐
          │           │           │
       iOS App    Android App   Web (PWA)
       ──────────────────────────────────
       HTTP submit · WebSocket receive
       Host: audio playback
```

**Core Constraints:**

- Server (Worker + Durable Objects) is the single authority for game logic
- All clients are equal; Host only controls UI visibility & audio playback
- `GameState` is the single source of truth

---

<details>
<summary><strong>🎭 43 Roles at a Glance</strong></summary>

| Faction             | Roles                                                                                                                                                                                                           |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Villager** (3)    | Civilian · Mirror Seer · Drunk Seer                                                                                                                                                                             |
| **God** (18)        | Seer · Witch · Poisoner · Hunter · Guard · Fool · Knight · Magician · Demon Hunter · Psychic · Dream Weaver · Graveyard Keeper · Pure White Maiden · Dancer · Silence Elder · Voteban Elder · Crow · Masked Man |
| **Wolf** (13)       | Werewolf · Wolf Queen · Wolf King · Dark Wolf King · Nightmare · Gargoyle · Awakened Gargoyle · Blood Moon · Mechanical Werewolf · Ghost Knight · Wolf Witch · Masquerade · Warden                              |
| **Third Party** (9) | Hybrid · Wild Child · Piper · Shadow · Avenger · Thief · Cupid · Treasure Master · Cursed Fox                                                                                                                   |

See [Role Alignment Matrix](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md) for detailed abilities.

</details>

---

## Development

```bash
pnpm install          # Install dependencies
pnpm run dev          # Worker + Expo Web concurrently (localhost:8787 + :8081)
pnpm run quality      # typecheck + lint + format + test:all
pnpm run e2e          # Playwright E2E
```

### Project Structure

```
packages/
  api-worker/         Cloudflare Worker — REST API + Auth + Durable Objects (WebSocket)
  game-engine/        Pure game logic shared pkg — models / resolvers / engine (client & server)
src/
  screens/            React Native screens
  services/           facade / transport (WebSocket) / infra / feature
  contexts/           Auth · GameFacade · Network · Service
  theme/              Design tokens + 8 themes
```

### Tech Stack

|             |                                                            |
| ----------- | ---------------------------------------------------------- |
| **Client**  | React Native 0.83 · Expo SDK 55 · TypeScript ~5.9          |
| **Server**  | Cloudflare Workers · D1 · Durable Objects                  |
| **AI**      | Gemini 3.1 Flash Lite (Worker proxy)                       |
| **Test**    | Jest · Testing Library · Playwright                        |
| **Deploy**  | Cloudflare Pages (Web) + Workers (API) · GitHub Actions CI |
| **Monitor** | Sentry                                                     |

---

## Deployment

```bash
pnpm run release            # patch (default) — bump → CHANGELOG → tag → push
pnpm run release -- major   # major release
# git push triggers Cloudflare Pages + Workers deploy automatically
```

See [Deployment Guide](docs/DEPLOYMENT.md) for details.

---

## Docs

- [Offline Game Guide](docs/offline-sop.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Role Alignment Matrix](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Security

See [SECURITY.md](SECURITY.md)

## License

[MIT](LICENSE)
