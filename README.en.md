<div align="center">

# 🐺 Werewolf Game Judge

**The in-person party-game platform that needs no judge**

7 games · one room · one 4-digit code, and the whole table plays

[![Live](https://img.shields.io/badge/▶_Play_Now-werewolfgamer.com-blue?style=for-the-badge)](https://werewolfgamer.com)
[![CI](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml/badge.svg)](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![GitHub stars](https://img.shields.io/github/stars/olveryu/WerewolfGameJudge?style=flat-square&logo=github)](https://github.com/olveryu/WerewolfGameJudge/stargazers)

[简体中文](./README.md) · [Privacy Notice](PRIVACY.md#english) · [Changelog](CHANGELOG.md)

<img src="assets/readme/hero-werewolf.jpg" alt="Werewolf key art: a werewolf under the full moon" width="820">

</div>

---

## ⚡ Playing in 30 Seconds

1. **The host** opens [werewolfgamer.com](https://werewolfgamer.com), picks a game, and creates a room
2. Share the **4-digit room code** with the table
3. Friends enter the code, take a seat, and view their role/word card — the host taps start, and the judge takes it from there

Most players play in the WeChat Mini Program (search "狼人面杀电子裁判助手"): sign in with WeChat and play right away. On the web, the home page and game guides are open without an account; creating a room asks you to sign in first (email, or one-tap anonymous guest). The web version can also be added to your home screen and used like an app; iOS / Android apps work too.

---

## 🎮 Games at a Glance

<table>
  <tr>
    <td width="50%">
      <img src="assets/readme/game-werewolf.jpg" alt="Werewolf key art" width="100%">
      <br><b>🐺 Werewolf</b> · Set by board (presets: 12)
      <br>A fully automated Night-1 judge: voice-guided identity reveal, skill actions, and dawn resolution; daytime discussion and voting stay with the players
    </td>
    <td width="50%">
      <img src="assets/readme/game-avalon.jpg" alt="Avalon key art" width="100%">
      <br><b>🏰 Avalon</b> · 5–10 players
      <br>Good and evil take turns building quest teams: good wins 3 quests first, evil flips it by sabotaging quests, forcing repeated rejections, or assassinating Merlin at the end
    </td>
  </tr>
  <tr>
    <td>
      <img src="assets/readme/game-fibking.jpg" alt="FibKing key art" width="100%">
      <br><b>🤥 FibKing</b> · 4–20 players
      <br>One obscure word per round: the Honest know the real definition, the FibKing bluffs one, and the Brain listens to everyone — then the host taps seats one by one on the Brain's call to sort truth from bluff
    </td>
    <td>
      <img src="assets/readme/game-undercover.jpg" alt="Undercover key art" width="100%">
      <br><b>🕵️ Undercover</b> · 4–12 players (blank slate needs 6+)
      <br>Most players share one word, the undercover gets a related but different word, the blank slate gets nothing; describe and discuss in person, the host reveals eliminations, the system calls the winner
    </td>
  </tr>
  <tr>
    <td>
      <img src="assets/readme/game-pictionary.jpg" alt="Pictionary Relay key art" width="100%">
      <br><b>🎨 Pictionary Relay</b> · 4–20 players
      <br>Everyone writes a prompt, then relays alternate between drawing a phrase and guessing a drawing, ending with a full gallery replay
    </td>
    <td>
      <img src="assets/readme/game-drawguess.jpg" alt="Draw and Guess key art" width="100%">
      <br><b>✏️ Draw & Guess</b> · 4–12 players
      <br>Players take turns drawing while everyone else types guesses in chat; guesses score by speed, the drawer scores per correct guesser, 2 rounds per drawer, ranked by total score
    </td>
  </tr>
  <tr>
    <td>
      <img src="assets/readme/game-storyrelay.jpg" alt="Story Relay key art" width="100%">
      <br><b>📖 Story Relay</b> · 4–20 players
      <br>Everyone starts a story and each next writer sees only the previous segment; once every story is complete, all are revealed segment by segment — no winners, just chaos
    </td>
    <td>
      <br><b>…all in the same room</b>
      <br>Every game shares the same rooms, seats, reconnection, and match history. Switching games never means switching apps or re-inviting everyone.
    </td>
  </tr>
</table>

---

## 📱 App Tour

<table>
  <tr>
    <td align="center"><img src="assets/readme/ui-home.jpg" width="160" alt="Home"><br><sub>Home · create / join a room</sub></td>
    <td align="center"><img src="assets/readme/ui-games.jpg" width="160" alt="Game library"><br><sub>Game library · all 7 games</sub></td>
    <td align="center"><img src="assets/readme/ui-werewolf-guide.jpg" width="160" alt="Werewolf guide"><br><sub>Werewolf guide · 47 roles / 26 boards</sub></td>
    <td align="center"><img src="assets/readme/ui-room.jpg" width="160" alt="Room lobby"><br><sub>Room lobby · take a seat</sub></td>
    <td align="center"><img src="assets/readme/ui-gacha.jpg" width="160" alt="Gacha machine"><br><sub>Gacha · draw tickets, unlock cosmetics</sub></td>
  </tr>
</table>

---

## 🙅 Why No Human Judge?

In-person, these games always need a moderator — and the moderator doesn't get to play:

- 🙅 The judge only watches from the sidelines, game after game
- 📖 Inexperienced moderators mix up the flow and miss win conditions
- 🔇 Verbal pacing is slow, and errors creep in as roles and phases pile up

This app takes over the whole job: dealing identities, advancing phases, calling winners, narrating by voice. **Everyone at the table — host included — is a player.**

---

## ✨ Platform Features

|                            |                                                                                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 📱 **Real-time sync**      | Join with a 4-digit room code; WebSocket pushes game state in real time, actions sync in under a second                                                                                                                                |
| 🔌 **Auto-recovery**       | Game state persists in Cloudflare Durable Objects (edge SQLite); reconnecting restores the latest state with zero progress lost                                                                                                        |
| 🎰 **Gacha & progression** | Earn XP and draw tickets every game; collect **1043 items** — avatars, frames, seat flairs, name styles, role-reveal effects, seat animations — across 5 rarity tiers (Common → Mythic) with a 10-draw pity guarantee; uncapped levels |
| 🌐 **Cross-platform**      | iOS · Android · Web · WeChat Mini Program, all in the same room                                                                                                                                                                        |

---

## 🐺 Werewolf Spotlight (the flagship)

- 🔊 **Fully voiced Night-1**: identity reveal, skill actions, and dawn announcements are narrated end to end, so the host plays with eyes closed too; BGM and sound effects included
- 🎭 **47 roles · 26 preset boards**: gods, special wolves, and third-party roles in full; presets are all 12-player boards, custom boards supported — [Role Alignment Matrix](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md) · [Preset Boards](docs/PRESET_BOARDS.md)
- 🤖 **AI rules assistant**: tap the AI bubble on any role card to ask about skills and strategy (Gemini 3.5 Flash Lite, proxied by the Worker)
- ☀️ Daytime discussion, voting, and elimination stay at the table — the app handles Night-1, the part that actually needs a judge

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────┐
│       Cloudflare Worker (Game Logic Authority)    │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ REST API │  │ game-engine│  │ Durable Object│  │
│  │ (Auth +  │  │ (pure     │  │  (GameRoom)  │  │
│  │  Game)   │  │  logic)   │  │  WebSocket   │  │
│  └────┬─────┘  └─────┬─────┘  └──────┬───────┘  │
│       └──────────────┴───────────────┘           │
│                 Cloudflare D1 · R2                 │
└─────────────────────┬───────────────────────────┘
     iOS · Android · Web · WeChat Mini Program (web-view)
       HTTP submit · WebSocket receive · Host plays audio
```

Three layers: the **platform layer** shares rooms, seats, connections, reconnection, and the broadcast pipeline; the **game layer** gives each game its own state machine and rules (`packages/game-engine/src/games/<game>/` and `src/games/<game>/`); the **catalog layer** composes all games through exactly one exhaustive catalog per runtime (engine, Worker, client), so a missing registration fails at compile time or in contract tests.

Core constraints: the server is the single authority for game logic and clients make no logic decisions; all clients are equal and the host is only a UI/audio role; `GameState` is the single source of truth, read-computed-written-broadcast by the server.

Tech stack: React Native 0.85 · Expo SDK 56 · TypeScript 6 · Cloudflare Workers / D1 / R2 / Durable Objects · Jest · Playwright · Sentry

---

## 🛠 Development

```bash
pnpm install          # Install dependencies
pnpm run dev          # Worker + Expo Web concurrently (localhost:8787 + :8081)
pnpm run quality      # Full gate: types, build, Knip, lint, format, tests
pnpm run e2e          # Playwright E2E

# Local D1 seed — dev user (dev@test.local / dev123) with all items unlocked
pnpm -F @game-judge/api-worker db:migrate:local
pnpm -F @game-judge/api-worker db:seed:local
```

Contributors and AI coding agents: read [AGENTS.md](AGENTS.md) first (build, test, and code conventions). New games can start from the generator scaffold with `pnpm run new-game`; see the multi-game platform design doc for the registration checklist.

---

## 📚 Docs

- [Multi-game Platform Design](docs/multigame-platform-design.md) · [Room Shell Contract](docs/room-shell-contract.md)
- Game designs: [Avalon](docs/avalon-game-design.md) · [FibKing Word Supply](docs/fibking-word-supply.md) · [Undercover](docs/undercover-game-design.md) · [Pictionary Relay](docs/pictionary-game-design.md) · [Draw & Guess](docs/drawguess-game-design.md) · [Story Relay](docs/story-relay-game-design.md)
- [Deployment Guide](docs/DEPLOYMENT.md) · [Design System](docs/DESIGN.md) · [Network Resilience](docs/network-resilience-design.md)
- [Gacha System](docs/gacha-system-design.md) · [Growth System](docs/growth-system-design.md) · [Offline Game Guide](docs/offline-sop.md)

---

## ❓ FAQ

<details>
<summary><b>Do I need to register?</b></summary>

In the WeChat Mini Program you sign in with WeChat — no separate registration. On the web, browsing and the game guides need no account; creating a room asks you to sign in, by email or as a one-tap anonymous guest. Use an email account if you want to keep custom boards and similar data.

</details>

<details>
<summary><b>Is every game auto-judged?</b></summary>

Yes. All 7 games have their phases, rulings, and settlement run by the server, on the same room and reconnection machinery. Steps that belong at the table (Undercover descriptions, Werewolf daytime discussion) stay with the players, with the app prompting each phase.

</details>

<details>
<summary><b>Where is game data stored?</b></summary>

Game state is stored in Cloudflare Durable Objects (edge SQLite), with room metadata in D1. Rooms are automatically cleaned up 24 hours after creation. Features such as AI, error monitoring, email, and feedback use external services; see the [Privacy Notice](PRIVACY.md#english) for the data processed, purposes, and retention rules.

</details>

<details>
<summary><b>Can I create custom Werewolf boards?</b></summary>

Absolutely. Beyond the 26 preset templates, you can freely combine roles to create custom templates and save them for future use.

</details>

---

## Contributing

Bug reports, feature suggestions, and PRs are all welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md); for security issues see [SECURITY.md](SECURITY.md).

## Contributors

<a href="https://github.com/olveryu/WerewolfGameJudge/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=olveryu/WerewolfGameJudge" alt="Contributors" />
</a>

## License

[MIT](LICENSE) © 2024-present
