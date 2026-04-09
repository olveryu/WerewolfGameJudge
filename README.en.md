# 🐺 Werewolf Game Judge

[简体中文](./README.md) | **English**

> In every Werewolf game someone has to be the judge — but the judge can't play.
> **This app replaces the judge.** Fully automated Night-1 voice narration so everyone (including the host) can close their eyes and play.

[![Live](https://img.shields.io/badge/▶_Play-werewolfjudge.eu.org-blue?style=for-the-badge)](https://werewolfjudge.eu.org)

[![CI](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml/badge.svg)](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TS-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo_SDK-55-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![Cloudflare](https://img.shields.io/badge/CF-Workers%20+%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/olveryu/WerewolfGameJudge?style=flat-square&logo=github)](https://github.com/olveryu/WerewolfGameJudge/stargazers)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)](https://github.com/olveryu/WerewolfGameJudge/pulls)

---

<details>
<summary><b>📑 Table of Contents</b></summary>

- [Why This Exists](#why-this-exists)
- [Features](#features)
- [How to Play](#how-to-play)
- [Architecture](#architecture)
- [Roles at a Glance](#-43-roles-at-a-glance)
- [Development](#development)
- [Deployment](#deployment)
- [FAQ](#faq)
- [Docs](#docs)
- [Contributing](#contributing)
- [Star History](#star-history)
- [Contributors](#contributors)
- [License](#license)

</details>

---

## Why This Exists

Playing Werewolf in-person has a fundamental problem — **being the judge sucks**:

- 🙅 The judge can't play, only moderate from the sidelines
- 📖 Inexperienced judges mess up the flow, ruining the experience
- 🔇 Verbal narration is error-prone, especially for complex role sets
- 📱 Playing remotely? Good luck coordinating over voice chat alone

**Werewolf Game Judge** turns your phone into the judge — automated voice narration guides every Night-1 step, so everyone (including the room host) can close their eyes and play for real. Share a 4-digit room code, and you're good to go — in-person or remote.

---

## Features

### 🔊 Auto Voice Narration

Full Night-1 voice guidance covering identity reveal, skill actions, and dawn announcements. The host can close their eyes too — no more being a spectator. BGM and sound effects enhance the atmosphere.

### 📱 Multi-device Real-time Sync

Share a 4-digit room code after creating a room. Everyone joins via browser or app. WebSocket pushes game state in real-time with instant sync.

### 🔌 Auto-Recovery on Disconnect

Game state is persisted in Cloudflare D1. Reconnecting after a network drop automatically restores the latest state — zero progress lost.

### 🎭 43 Roles · 27 Preset Boards

Full coverage of classic and expansion roles — Seer, Witch, Hunter, Guard and more gods; Wolf Queen, White Wolf King, Blood Moon and more special wolves; plus Cupid, Thief, Piper and more third-party roles. 27 preset templates for 6–18 players, plus custom board creation.

### 🤖 AI Assistant

Unsure about a rule? Tap the AI bubble on any role card for instant skill details and strategy tips. Powered by Gemini 3.1 Flash Lite via a Worker proxy.

### 🎨 8 Themes

Light / Sand / Jade / Sky / Dark / Midnight / Blood / Forest — light and dark options for every atmosphere.

### 🌐 Cross-platform

iOS · Android · Web (PWA). The web version works instantly with no install. PWA mode supports offline launch and add-to-home-screen.

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

- Server (Worker + Durable Objects) is the single authority for game logic; clients make no logic decisions
- All clients are equal; Host only controls UI visibility & audio playback
- `GameState` is the single source of truth; server reads-computes-writes-broadcasts

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

## FAQ

<details>
<summary><b>Do I need to register?</b></summary>

No. Just open the website to create or join a room. If you want to save custom templates, you can opt for anonymous or email sign-in.

</details>

<details>
<summary><b>What platforms are supported?</b></summary>

iOS, Android, and any modern browser (Chrome, Safari, Firefox, Edge). The web version supports PWA — add it to your home screen and use it like a native app.

</details>

<details>
<summary><b>Where is game data stored?</b></summary>

All game state is stored in Cloudflare D1 (edge SQLite). Your data is never sent to any third party. Rooms are automatically cleaned up after 24 hours of inactivity.

</details>

<details>
<summary><b>Does the app only handle Night-1? What about daytime?</b></summary>

Yes, the app automates Night-1 — identity reveals, skill actions, and dawn resolution. Daytime discussion, voting, and elimination are done by the players themselves, which is the most fun social part of Werewolf.

</details>

<details>
<summary><b>Can I create custom boards?</b></summary>

Absolutely. Beyond the 27 preset templates, you can freely combine roles to create custom templates and save them for future use.

</details>

---

## Docs

- [Offline Game Guide](docs/offline-sop.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Role Alignment Matrix](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)

## Contributing

Contributions are welcome! Whether it's bug reports, feature suggestions, or code PRs — we appreciate them all.

See [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## Security

See [SECURITY.md](SECURITY.md)

---

## Star History

<a href="https://star-history.com/#olveryu/WerewolfGameJudge&Date">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=olveryu/WerewolfGameJudge&type=Date&theme=dark" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=olveryu/WerewolfGameJudge&type=Date" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=olveryu/WerewolfGameJudge&type=Date" width="100%" />
 </picture>
</a>

## Contributors

<a href="https://github.com/olveryu/WerewolfGameJudge/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=olveryu/WerewolfGameJudge" />
</a>

---

## License

[MIT](LICENSE) © 2024-present
