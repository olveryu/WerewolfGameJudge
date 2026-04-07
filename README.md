# 🐺 Werewolf Game Judge

**狼人杀首夜电子法官** | **Night-1 Electronic Judge for Werewolf**

支持线下同桌 & 远程联机的自动化裁判 App  
_An automated judge app for both in-person and remote Werewolf games_

[![Live Demo](https://img.shields.io/badge/Live-werewolfgamejudge.pages.dev-blue?style=flat-square)](https://werewolfgamejudge.pages.dev)
[![CI](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml/badge.svg)](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-purple?style=flat-square&logo=expo)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-green?style=flat-square&logo=supabase)](https://supabase.com/)

---

## ✨ 核心特性 | Features

| 中文                                                                        | English                                                                             |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 🎙️ **自动语音播报** - 首夜全流程自动引导，Host 也能闭眼参与                 | 🎙️ **Auto Voice Narration** - Fully guided Night-1 flow, Host can close eyes too    |
| 📱 **多设备同步** - 一人建房，多人加入，支持线下同桌或远程联机              | 📱 **Multi-device Sync** - One host creates, others join; works locally or remotely |
| 🔄 **断线自动重连** - DB 双通道备份，断线自动恢复，状态不丢失               | 🔄 **Auto-Recovery** - DB-backed dual channel, auto-reconnect, zero state loss      |
| 🎭 **36 种角色** - 完整狼人杀角色库，含多种特殊狼人和神职                   | 🎭 **36 Roles** - Complete role library with special wolves and gods                |
| 🤖 **AI 狼人杀助手** - 悬浮聊天泡泡，随时咨询规则和策略                     | 🤖 **AI Werewolf Assistant** - Floating chat bubble for rules and strategy help     |
| ⚡ **即开即用** - 匿名登录，无需注册，4位房间码快速加入                     | ⚡ **Instant Play** - Anonymous login, no registration, quick join                  |
| 🌐 **跨平台** - iOS / Android / Web 全平台支持                              | 🌐 **Cross-platform** - iOS / Android / Web supported                               |
| 🎨 **多主题** - 8 种主题风格可选（月白/暖沙/青瓷/晴岚/石墨/月蚀/血月/幽林） | 🎨 **Themes** - 8 theme styles (Light/Sand/Jade/Sky/Dark/Midnight/Blood/Forest)     |
| 🧪 **高测试覆盖** - 完整的单元/集成/E2E 测试                                | 🧪 **High Test Coverage** - Comprehensive unit / integration / E2E tests            |

---

## 🎮 快速开始 | Quick Start

### 线上体验 | Live Demo

👉 **[werewolfgamejudge.pages.dev](https://werewolfgamejudge.pages.dev)**

### 玩家使用 | How to Play

| 步骤 Step | Host（房主）                                                                                                            | 玩家 Player                                               |
| --------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| 1         | 点击「创建房间」，选择板子配置和玩家人数<br/>_Click "Create Room", select template and player count_                    | 点击「进入房间」<br/>_Click "Join Room"_                  |
| 2         | 分享 4 位房间号给其他玩家<br/>_Share 4-digit room code with others_                                                     | 输入房间号加入<br/>_Enter room code to join_              |
| 3         | 等待所有人就座，点击「准备查看身份」<br/>_Wait for all to sit, click "Ready to View Identity"_                          | 点击座位就座<br/>_Click a seat to sit_                    |
| 4         | 所有人查看身份后，点击「开始游戏」<br/>_After all viewed identity, click "Start Game"_                                  | 查看身份，确认<br/>_View your role, confirm_              |
| 5         | 夜间结束后，点击「查看昨夜死亡信息」宣布结果<br/>_After night ends, click "View Last Night Deaths" to announce results_ | 根据身份执行行动<br/>_Perform actions based on your role_ |

> 💡 白天发言与投票由玩家自行进行（线下面对面 or 远程语音），App 只负责首夜。  
> _Daytime discussion and voting happen among players (in-person or via voice chat). App handles Night-1 only._

---

## 🤖 AI 狼人杀助手 | AI Werewolf Assistant

屏幕右下角的 🐺 悬浮按钮是你的专属狼人杀顾问！  
_The 🐺 floating button at the bottom-right is your personal Werewolf consultant!_

### 功能 | Features

| 中文                                           | English                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------- |
| 📚 **规则咨询** - 询问任何角色的技能和规则     | 📚 **Rules Help** - Ask about any role's skills and rules                    |
| 🎯 **策略建议** - 获取针对不同角色的打法建议   | 🎯 **Strategy Tips** - Get gameplay advice for different roles               |
| 🔍 **技能结算** - 查询技能结算优先级与冲突规则 | 🔍 **Skill Resolution** - Check skill resolution priority and conflict rules |
| 💬 **自然对话** - 支持中英文自由提问           | 💬 **Natural Chat** - Ask freely in Chinese or English                       |

> 💡 点击悬浮按钮打开聊天，可拖动调整位置，聊天记录会自动保存。  
> _Click the floating button to chat, drag to reposition, chat history auto-saves._

---

## 🎭 支持角色 | Supported Roles (36)

| 阵营 Faction               | 角色 Roles                                                                                                                                                                                                                                                                              |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **好人 Good** — 村民 (3)   | 平民 Civilian · 灯影预言家 Mirror Seer · 酒鬼预言家 Drunk Seer                                                                                                                                                                                                                          |
| **好人 Good** — 神职 (15)  | 预言家 Seer · 女巫 Witch · 猎人 Hunter · 守卫 Warden · 愚者 Fool · 骑士 Knight · 魔术师 Magician · 猎魔人 Demon Hunter · 通灵师 Psychic · 摄梦人 Dream Weaver · 守墓人 Graveyard Keeper · 纯白之女 Pure White Maiden · 舞者 Dancer · 禁言长老 Silence Elder · 禁票长老 Voteban Elder    |
| **狼人 Wolf** (13)         | 狼人 Werewolf · 狼美人 Wolf Queen · 白狼王 Wolf King · 狼王 Wolf King · 噩梦之影 Nightmare · 石像鬼 Gargoyle · 觉醒石像鬼 Awakened Gargoyle · 血月使徒 Apostle of Blood Moon · 机械狼人 Mechanical Werewolf · 恶灵骑士 Ghost Knight · 狼巫 Wolf Witch · 假面 Masquerade · 典狱长 Warden |
| **第三方 Third Party** (5) | 混血儿 Hybrid · 野孩子 Wild Child · 吹笛者 Piper · 影子 Shadow · 复仇者 Avenger                                                                                                                                                                                                         |

> 详细角色技能说明见 [角色技能对照表](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)  
> _See [Role Reference Table](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md) for detailed role abilities_

---

## 🏗️ 架构设计 | Architecture

### 核心原则 | Core Principles

| 原则                                                   | Principle                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------- |
| ✅ 服务端（Supabase Edge Functions）是唯一游戏逻辑权威 | Server (Supabase Edge Functions) is the single authority for game logic |
| ✅ 所有客户端完全平等，Host 只是 UI 角色标记           | All clients are equal; Host is a UI role only                           |
| ✅ Supabase 负责传输/发现/身份/状态持久化              | Supabase handles transport/discovery/identity/state persistence         |
| ✅ `GameState` 是单一真相                              | `GameState` is the single source of truth                               |
| ✅ UI 层按 `myRole` 过滤显示                           | UI filters display based on `myRole`                                    |

### 系统架构 | System Architecture

```
Supabase Edge Functions (游戏逻辑权威)  Supabase Edge Functions (Game Logic Authority)
    │                                     │
    ├─ 读 DB + game-engine 计算           ├─ Read DB + game-engine compute
    ├─ 写 DB (乐观锁)                    ├─ Write DB (optimistic lock)
    └─ Realtime Broadcast                └─ Realtime Broadcast
       (GameState)                           (GameState)
    ▼                                     ▼
Supabase (传输 + 持久化)              Supabase (Transport + Persistence)
    │                                     │
    ├─ Broadcast (实时推送)               ├─ Broadcast (real-time push)
    └─ postgres_changes (DB 变更通知)     └─ postgres_changes (DB change notify)
    ▼                                     ▼
客户端设备 (N个, 包含 Host)          Client Devices (N, incl. Host)
  ├ HTTP API 提交                         ├ Submit via HTTP API
  ├ Realtime 接收 + applySnapshot        ├ Receive via Realtime + applySnapshot
  ├ Host: 音频播放                      ├ Host: audio playback
  └ 断线: 重连后自动从 DB 恢复             └ Offline: auto-recover from DB
```

### 三层架构 | Three-Layer Architecture

```
ROLE_SPECS (角色固有属性)             Role intrinsic properties
    │ specs.ts                           │
    ▼                                    ▼
SCHEMAS (行动输入协议)                Action input protocols
    │ schemas.ts                         │
    ▼                                    ▼
NIGHT_STEPS (步骤序列)                Step sequence
    nightSteps.ts                        (order & audio)
```

| 层级 Layer    | 职责 Responsibility                                                            | 文件 File       |
| ------------- | ------------------------------------------------------------------------------ | --------------- |
| `ROLE_SPECS`  | 角色固有属性（阵营、能力标志）<br/>_Role properties (faction, ability flags)_  | `specs.ts`      |
| `SCHEMAS`     | 行动输入协议（UI 提示、约束）<br/>_Action protocols (UI prompts, constraints)_ | `schemas.ts`    |
| `NIGHT_STEPS` | 步骤序列（顺序、音频键）<br/>_Step sequence (order, audio keys)_               | `nightSteps.ts` |

---

## 🧪 测试覆盖 | Test Coverage

| 类型 Type              | 说明 Description                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Unit / Integration** | game-engine + app，覆盖角色解析、夜晚流程全链路<br/>_game-engine + app, covering resolvers & full night flows_ |
| **Contract Tests**     | Schema/Resolver/NightStep 三层对齐<br/>_Schema/Resolver/NightStep alignment_                                   |
| **Board UI Tests**     | 18 种预设板子全覆盖<br/>_All 18 preset boards covered_                                                         |
| **E2E Tests**          | Playwright 端到端（含断线恢复、重连）<br/>_Playwright end-to-end (incl. DB recovery & rejoin)_                 |

---

## 🛠️ 开发指南 | Development Guide

### 环境要求 | Requirements

- Node.js >= 20.20.1
- pnpm (项目使用 pnpm 管理依赖 | project uses pnpm)
- Supabase CLI (可选 optional)

### 本地开发 | Local Development

```bash
# 1. 安装依赖 | Install dependencies
pnpm install

# 2. 启动本地 Supabase (可选) | Start local Supabase (optional)
supabase start
bash scripts/setup-local-env.sh   # 生成 .env.local 覆盖

# 3. 启动开发服务器 | Start dev server
pnpm start

# 4. 运行测试 | Run tests
pnpm test                    # Unit tests (Jest)
pnpm run test:all            # Workspace unit/integration tests
pnpm run e2e                 # E2E tests (Playwright, --reporter=list)
pnpm run e2e:remote          # E2E against remote env
pnpm run typecheck           # TypeScript check
pnpm run lint                # ESLint
pnpm run quality             # typecheck + lint + format + test:all
```

### 项目结构 | Project Structure

```
packages/game-engine/src/       # 纯游戏逻辑共享包 | Pure game logic shared package
├── models/                     # 角色定义 (specs / schemas / nightSteps) | Role definitions
├── protocol/                   # 行动协议 (schemas) | Action protocols
├── resolvers/                  # 夜晚行动解析器 | Night action resolvers
├── engine/                     # 游戏引擎 (reducer / handlers / store) | Game engine
└── utils/                      # 引擎工具 | Engine utilities

src/                            # 客户端 | Client app
├── services/
│   ├── facade/                 # Facade 编排 + IO | Facade orchestration
│   ├── transport/              # Supabase realtime 传输 | Realtime transport
│   ├── infra/                  # 基础设施服务 | Infrastructure services
│   └── feature/                # 功能服务 | Feature services
├── screens/
│   └── RoomScreen/             # 游戏房间页面 | Game room screen
│       ├── components/         # UI 组件 | UI components
│       ├── hooks/              # React Hooks
│       └── __tests__/          # boards / harness / contracts
├── contexts/                   # React Context (Auth / GameFacade / Network / Service)
├── theme/                      # Design tokens + themes
├── utils/                      # 工具函数 | Utility functions
└── hooks/                      # 全局 Hooks | Global hooks
```

---

## 🚀 部署 | Deployment

```bash
# 发版 | Release (version bump + CHANGELOG + commit + tag + push)
pnpm run release              # patch (default)
pnpm run release -- minor     # minor / major

# 部署 | Deploy
# git push 自动触发 Cloudflare Pages 部署 + GitHub CI
# 无需手动操作
```

**当前生产环境 | Production:** https://werewolfgamejudge.pages.dev

> 详见 [部署指南](docs/DEPLOYMENT.md) | See [Deployment Guide](docs/DEPLOYMENT.md)

---

## 📖 更多文档 | Documentation

| 文档 Document                                          | 说明 Description                                                                     |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [线下玩法 SOP](docs/offline-sop.md)                    | 完整的线下游戏流程指南<br/>_Complete offline game flow guide_                        |
| [部署指南](docs/DEPLOYMENT.md)                         | 发版与部署流程（release + git push 自动部署）<br/>_Release & deployment workflow_    |
| [角色技能对照表](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md) | Night-1 角色/Schema/Resolver 对齐<br/>_Night-1 role/schema/resolver alignment_       |
| [服务器迁移](docs/server-authoritative-migration.md)   | 服务器权威架构迁移方案（历史参考）<br/>_Server authoritative migration (historical)_ |

---

## 📊 技术栈 | Tech Stack

| 类别 Category  | 技术 Technology                                    |
| -------------- | -------------------------------------------------- |
| **Frontend**   | React Native + Expo                                |
| **Language**   | TypeScript ~5.9                                    |
| **Backend**    | Supabase (Realtime, Auth, Edge Functions)          |
| **AI**         | Gemini (3.1 Flash Lite) via Edge Function proxy    |
| **Monitoring** | Sentry (crash reporting)                           |
| **Images**     | expo-image (disk cache + transitions)              |
| **Testing**    | Jest + Testing Library + Playwright                |
| **Game API**   | Supabase Edge Functions (game logic authority)     |
| **Deployment** | Cloudflare Pages (Web static hosting, auto-deploy) |
| **State**      | @werewolf/game-engine (monorepo shared pkg)        |

---

## 🤝 Contributing

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md)。  
_Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md)._

## 🔒 Security

发现安全漏洞？请参阅 [SECURITY.md](SECURITY.md) 了解上报流程。  
_Found a vulnerability? See [SECURITY.md](SECURITY.md) for reporting guidelines._

## 📄 License

MIT
