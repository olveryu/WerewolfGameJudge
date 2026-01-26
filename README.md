# 🐺 Werewolf Game Judge

**狼人杀第一晚电子法官** | **Night-1 Electronic Judge for Werewolf**

专为线下同桌狼人杀设计的自动化裁判 App  
*An automated judge app designed for in-person Werewolf games*

[![Live Demo](https://img.shields.io/badge/Live-werewolf--judge.vercel.app-blue?style=flat-square)](https://werewolf-judge.vercel.app)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-purple?style=flat-square&logo=expo)](https://expo.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-Realtime-green?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Tests-1922%20passed-brightgreen?style=flat-square)](.)
[![Version](https://img.shields.io/badge/Version-1.0.24-orange?style=flat-square)](.)

---

## ✨ 核心特性 | Features

| 中文 | English |
|------|---------|
| 🎙️ **自动语音播报** - 第一晚全流程自动引导，Host 也能闭眼参与 | 🎙️ **Auto Voice Narration** - Fully guided Night-1 flow, Host can close eyes too |
| 📱 **多设备同步** - 一人建房，多人扫码加入，实时同步 | 📱 **Multi-device Sync** - One host creates room, others join via 4-digit code |
| 🎭 **22 种角色** - 完整狼人杀角色库，含多种特殊狼人和神职 | 🎭 **22 Roles** - Complete role library with special wolves and gods |
| 🤖 **AI 狼人杀助手** - 悬浮聊天泡泡，随时咨询规则和策略 | 🤖 **AI Werewolf Assistant** - Floating chat bubble for rules and strategy help |
| ⚡ **即开即用** - 匿名登录，无需注册，4位房间码快速加入 | ⚡ **Instant Play** - Anonymous login, no registration, quick join |
| 🌐 **跨平台** - iOS / Android / Web 全平台支持 | 🌐 **Cross-platform** - iOS / Android / Web supported |
| 🎨 **多主题** - 6 种主题风格可选（暗黑/浅色/午夜/血月/紫霞/极简）| 🎨 **Themes** - 6 theme styles (Dark/Light/Midnight/Blood/Purple/Minimal) |
| 🧪 **高测试覆盖** - 1922 个单元测试 + UI 测试 + E2E 测试 | 🧪 **High Test Coverage** - 1922 unit tests + UI tests + E2E tests |

---

## 🎮 快速开始 | Quick Start

### 线上体验 | Live Demo

👉 **[werewolf-judge.vercel.app](https://werewolf-judge.vercel.app)**

### 玩家使用 | How to Play

| 步骤 Step | Host（房主）| 玩家 Player |
| ---- | ---------------------------------------- | ---------------- |
| 1 | 点击「创建房间」，选择板子和人数<br/>*Click "Create Room", select template and player count* | 点击「进入房间」<br/>*Click "Join Room"* |
| 2 | 分享 4 位房间号给其他玩家<br/>*Share 4-digit room code with others* | 输入房间号加入<br/>*Enter room code to join* |
| 3 | 等待所有人入座，点击「准备看牌」<br/>*Wait for all to sit, click "Ready to View Cards"* | 点击座位入座<br/>*Click a seat to sit* |
| 4 | 所有人看牌后，点击「开始游戏」<br/>*After all viewed cards, click "Start Game"* | 查看身份，确认<br/>*View your role, confirm* |
| 5 | 夜晚结束后，点击「查看昨晚信息」宣布结果<br/>*After night ends, click "View Last Night" to announce results* | 根据身份执行行动<br/>*Perform actions based on your role* |

> 💡 白天发言与投票在线下进行，App 只负责第一晚。  
> *Daytime discussion and voting happen offline. App handles Night-1 only.*

---

## 🤖 AI 狼人杀助手 | AI Werewolf Assistant

屏幕右下角的 🐺 悬浮按钮是你的专属狼人杀顾问！  
*The 🐺 floating button at the bottom-right is your personal Werewolf consultant!*

### 功能 | Features

| 中文 | English |
|------|---------|
| 📚 **规则咨询** - 询问任何角色的技能和规则 | 📚 **Rules Help** - Ask about any role's skills and rules |
| 🎯 **策略建议** - 获取针对不同角色的打法建议 | 🎯 **Strategy Tips** - Get gameplay advice for different roles |
| 🔍 **技能对决** - 查询技能结算顺序和冲突规则 | 🔍 **Skill Conflicts** - Check skill resolution order and conflicts |
| 💬 **自然对话** - 支持中英文自由提问 | 💬 **Natural Chat** - Ask freely in Chinese or English |

### 使用示例 | Example Questions

- "女巫的毒药和解药怎么用？" / *"How does the Witch use poison and antidote?"*
- "守卫和女巫同守一人会怎样？" / *"What happens if Guard and Witch both protect the same player?"*
- "狼美人的魅惑有什么用？" / *"What's the use of Wolf Queen's charm?"*
- "第一晚预言家应该查谁？" / *"Who should the Seer check on Night-1?"*

> 💡 点击悬浮按钮打开聊天，可拖动调整位置，聊天记录会自动保存。  
> *Click the floating button to chat, drag to reposition, chat history auto-saves.*

---

## 🎭 支持角色 | Supported Roles (22)

### 神职阵营 | God Faction (11)

| 中文 | English | 描述 Description |
|------|---------|------------------|
| 预言家 | Seer | 每晚查验一名玩家阵营<br/>*Check one player's faction each night* |
| 女巫 | Witch | 一瓶解药一瓶毒药<br/>*One antidote and one poison* |
| 猎人 | Hunter | 被狼杀时可开枪带人<br/>*Shoot when killed by wolves* |
| 守卫 | Guard | 每晚守护一名玩家<br/>*Protect one player each night* |
| 白痴 | Idiot | 被投票时翻牌免死<br/>*Reveal to survive vote exile* |
| 骑士 | Knight | 白天可与人决斗<br/>*Duel during day* |
| 魔术师 | Magician | 每晚交换两人号码牌<br/>*Swap two seats each night* |
| 猎魔人 | Witcher | 第二晚起可狩猎玩家<br/>*Hunt players from Night-2* |
| 通灵师 | Psychic | 每晚查验具体身份牌<br/>*Check exact role each night* |
| 摄梦人 | Dreamcatcher | 每晚选择梦游者<br/>*Choose a sleepwalker each night* |
| 守墓人 | Graveyard Keeper | 得知被放逐者阵营<br/>*Know exiled player's faction* |

### 狼人阵营 | Wolf Faction (9)

| 中文 | English | 描述 Description |
|------|---------|------------------|
| 狼人 | Werewolf | 每晚与队友共同猎杀<br/>*Hunt with teammates each night* |
| 狼美人 | Wolf Queen | 狼刀后可魅惑一人<br/>*Charm one player after wolf kill* |
| 白狼王 | Wolf King | 白天可自爆带人<br/>*Self-destruct to take someone* |
| 黑狼王 | Dark Wolf King | 被刀杀时可开枪<br/>*Shoot when knife-killed* |
| 梦魇 | Nightmare | 每晚恐惧一人使其失能<br/>*Block one player's skill each night* |
| 石像鬼 | Gargoyle | 查验具体身份，不参与狼刀<br/>*Check exact role, no wolf vote* |
| 血月使徒 | Blood Moon | 自爆后封印好人技能<br/>*Seal good skills after self-destruct* |
| 机械狼 | Wolf Robot | 学习一人技能，隐身狼<br/>*Learn one skill, hidden wolf* |
| 恶灵骑士 | Spirit Knight | 免疫夜间伤害，反伤神职<br/>*Immune to night damage, reflect to gods* |

### 其他阵营 | Other Factions (2)

| 中文 | English | 描述 Description |
|------|---------|------------------|
| 普通村民 | Villager | 依靠推理投票<br/>*Rely on deduction and voting* |
| 混子 | Slacker | 第一晚选择榜样，与其同阵营<br/>*Choose idol on Night-1, share their faction* |

---

## 🏗️ 架构设计 | Architecture

### 核心原则 | Core Principles

| 原则 | Principle |
|------|-----------|
| ✅ Host 是唯一游戏逻辑权威 | Host is the single authority for game logic |
| ✅ Supabase 只负责传输/发现/身份 | Supabase handles transport/discovery/identity only |
| ✅ `BroadcastGameState` 是单一真相 | `BroadcastGameState` is the single source of truth |
| ✅ UI 层按 `myRole` 过滤显示 | UI filters display based on `myRole` |

### 系统架构 | System Architecture

```
Host 设备 (GameStateService)          Host Device (GameStateService)
    │                                     │
    │ Realtime Broadcast                  │ Realtime Broadcast
    │ (BroadcastGameState)                │ (BroadcastGameState)
    ▼                                     ▼
Supabase (传输层)                     Supabase (Transport Layer)
    │                                     │
    ▼                                     ▼
玩家设备 (N个)                        Player Devices (N)
UI 根据 myRole 过滤显示               UI filters by myRole
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

| 层级 Layer | 职责 Responsibility | 文件 File |
|------------|---------------------|-----------|
| `ROLE_SPECS` | 角色固有属性（阵营、能力标志）<br/>*Role properties (faction, ability flags)* | `specs.ts` |
| `SCHEMAS` | 行动输入协议（UI 提示、约束）<br/>*Action protocols (UI prompts, constraints)* | `schemas.ts` |
| `NIGHT_STEPS` | 步骤序列（顺序、音频键）<br/>*Step sequence (order, audio keys)* | `nightSteps.ts` |

---

## 🧪 测试覆盖 | Test Coverage

| 类型 Type | 数量 Count | 说明 Description |
|-----------|------------|------------------|
| **Unit Tests** | 1922 | 134 test suites |
| **UI Board Tests** | 10 boards | 覆盖所有预设板子<br/>*Cover all preset boards* |
| **Integration Tests** | 25+ | 夜晚流程全链路<br/>*Full night flow chains* |
| **Contract Tests** | 15+ | Schema/Resolver 对齐<br/>*Schema/Resolver alignment* |
| **E2E Tests** | 3 | Playwright 端到端<br/>*Playwright end-to-end* |

### 测试门禁 | Test Gates

- ✅ 所有 board UI tests 禁止 `.skip` | All board UI tests forbid `.skip`
- ✅ `assertCoverage([...])` 必须使用字面量数组 | Must use literal arrays
- ✅ Contract tests 强制 schema/resolver 对齐 | Enforce schema/resolver alignment
- ✅ Night-1-only 红线检测 | Night-1-only boundary check

---

## 🛠️ 开发指南 | Development Guide

### 环境要求 | Requirements

- Node.js >= 20
- npm 或 yarn
- Expo CLI
- Supabase CLI (可选 optional)

### 本地开发 | Local Development

```bash
# 1. 安装依赖 | Install dependencies
npm install

# 2. 启动本地 Supabase (可选) | Start local Supabase (optional)
supabase start

# 3. 配置环境变量 | Configure environment
cp .env.example .env

# 4. 启动开发服务器 | Start dev server
npm start

# 5. 运行测试 | Run tests
npm test                    # Unit tests (Jest)
npm run e2e:core            # E2E tests (Playwright)
npm run typecheck           # TypeScript check
npm run lint                # ESLint
```

### 项目结构 | Project Structure

```
src/
├── models/roles/spec/          # 角色定义 (声明式) | Role definitions (declarative)
│   ├── specs.ts                # ROLE_SPECS - 角色属性 | Role properties
│   ├── schemas.ts              # SCHEMAS - 行动协议 | Action protocols
│   └── nightSteps.ts           # NIGHT_STEPS - 步骤序列 | Step sequence
├── services/
│   ├── engine/                 # 游戏引擎 | Game engine
│   │   ├── handlers/           # 状态处理器 | State handlers
│   │   ├── reducer/            # 状态归约器 | State reducers
│   │   └── store/              # 状态存储 | State store
│   ├── night/resolvers/        # 夜晚行动解析器 | Night action resolvers
│   ├── facade/                 # Host 操作门面 | Host action facade
│   └── DeathCalculator.ts      # 死亡结算 | Death calculation
├── screens/
│   └── RoomScreen/             # 游戏房间页面 | Game room screen
│       ├── components/         # UI 组件 | UI components
│       ├── hooks/              # React Hooks
│       └── __tests__/
│           ├── boards/         # 板子 UI 测试 | Board UI tests
│           ├── harness/        # 测试工具 | Test harness
│           └── contracts/      # 契约测试 | Contract tests
└── hooks/                      # 全局 Hooks | Global hooks
```

---

## 🚀 部署 | Deployment

### 1. 配置远程 Supabase | Configure Remote Supabase

```bash
supabase link --project-ref <your-project-ref>
supabase db push
supabase projects api-keys --project-ref <your-project-ref>
```

### 2. 更新环境变量 | Update Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
```

### 3. 构建 & 部署 Web | Build & Deploy Web

```bash
npx expo export --platform web
vercel deploy dist --prod
```

**当前生产环境 | Production:** https://werewolf-judge.vercel.app

---

## 📖 更多文档 | Documentation

| 文档 Document | 说明 Description |
|---------------|------------------|
| [线下玩法 SOP](docs/offline-sop.md) | 完整的线下游戏流程指南<br/>*Complete offline game flow guide* |
| [部署指南](docs/DEPLOYMENT.md) | Supabase + Vercel 完整部署流程<br/>*Full deployment with Supabase + Vercel* |
| [角色对齐矩阵](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md) | Night-1 角色/Schema/Resolver 对齐<br/>*Night-1 role/schema/resolver alignment* |
| [服务设计](docs/services-design.md) | 服务层架构设计<br/>*Service layer architecture* |

---

## 📊 技术栈 | Tech Stack

| 类别 Category | 技术 Technology |
|---------------|-----------------|
| **Frontend** | React Native + Expo |
| **Language** | TypeScript 5.3 |
| **Backend** | Supabase (Realtime, Auth) |
| **Testing** | Jest + Testing Library + Playwright |
| **Deployment** | Vercel (Web) |
| **State** | Custom GameStateService (Host-only) |

---

## 📄 License

MIT
