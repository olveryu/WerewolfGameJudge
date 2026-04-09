# 🐺 狼人杀电子法官

**[English](./README.en.md)** | 简体中文

首夜全自动裁判，线下同桌 & 远程联机。

[![Live](https://img.shields.io/badge/Play-werewolfjudge.eu.org-blue?style=flat-square)](https://werewolfjudge.eu.org)
[![CI](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml/badge.svg)](https://github.com/olveryu/WerewolfGameJudge/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TS-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Expo](https://img.shields.io/badge/Expo_SDK-55-000020?style=flat-square&logo=expo)](https://expo.dev/)
[![Cloudflare](https://img.shields.io/badge/CF-Workers%20+%20D1-F38020?style=flat-square&logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/workers/)

> **👉 [werewolfjudge.eu.org](https://werewolfjudge.eu.org)** — 即开即用，无需注册

---

## 核心特性

- **自动语音播报** — 首夜全流程引导，Host 也能闭眼参与
- **多设备同步** — 建房 → 分享 4 位房间码 → 多人加入
- **断线自动恢复** — D1 持久化 + WebSocket，状态不丢失
- **43 种角色 · 27 套预设板子** — 完整角色库，含特殊狼人/神职/第三方
- **AI 助手** — 悬浮气泡随时问规则和策略（Gemini 3.1 Flash Lite）
- **8 种主题** — 月白 / 暖沙 / 青瓷 / 晴岚 / 石墨 / 月蚀 / 血月 / 幽林
- **跨平台** — iOS · Android · Web (PWA)

---

## 快速开始

| 步骤 | Host 房主                      | 玩家                  |
| ---- | ------------------------------ | --------------------- |
| 1    | 创建房间 → 选板子和人数        | 进入房间 → 输入房间号 |
| 2    | 分享 4 位房间码                | 点击座位就座          |
| 3    | 所有人查看身份后 →「开始游戏」 | 查看身份 → 确认       |
| 4    | 夜间结束 →「查看昨夜死亡信息」 | 按身份执行行动        |

> 白天发言投票由玩家自行进行，App 只负责首夜自动化。

---

## 架构

```
┌─────────────────────────────────────────────────┐
│          Cloudflare Worker（游戏逻辑权威）         │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │
│  │ REST API │  │ game-engine│  │ Durable Object│  │
│  │ (Auth +  │  │ (纯逻辑)  │  │  (GameRoom)  │  │
│  │  Game)   │  │           │  │  WebSocket   │  │
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
       HTTP 提交 · WebSocket 接收
       Host: 音频播放
```

**核心约束：**

- 服务端（Worker + DO）是唯一游戏逻辑权威
- 所有客户端平等，Host 仅决定 UI 可见性和音频播放
- `GameState` 是单一真相源

---

<details>
<summary><strong>🎭 43 种角色一览</strong></summary>

| 阵营           | 角色                                                                                                                                                  |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **村民** (3)   | 平民 · 灯影预言家 · 酒鬼预言家                                                                                                                        |
| **神职** (18)  | 预言家 · 女巫 · 毒师 · 猎人 · 守卫 · 愚者 · 骑士 · 魔术师 · 猎魔人 · 通灵师 · 摄梦人 · 守墓人 · 纯白之女 · 舞者 · 禁言长老 · 禁票长老 · 乌鸦 · 蒙面人 |
| **狼人** (13)  | 狼人 · 狼美人 · 白狼王 · 狼王 · 噩梦之影 · 石像鬼 · 觉醒石像鬼 · 血月使徒 · 机械狼人 · 恶灵骑士 · 狼巫 · 假面 · 典狱长                                |
| **第三方** (9) | 混血儿 · 野孩子 · 吹笛者 · 影子 · 复仇者 · 盗贼 · 丘比特 · 盗宝大师 · 咒狐                                                                            |

详见 [角色技能对照表](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)

</details>

---

## 开发

```bash
pnpm install          # 安装依赖
pnpm run dev          # Worker + Expo Web 同时启动 (localhost:8787 + :8081)
pnpm run quality      # typecheck + lint + format + test:all
pnpm run e2e          # Playwright E2E
```

### 项目结构

```
packages/
  api-worker/         Cloudflare Worker — REST API + Auth + Durable Objects (WebSocket)
  game-engine/        纯游戏逻辑共享包 — models / resolvers / engine（客户端与服务端共用）
src/
  screens/            React Native 页面
  services/           facade / transport (WebSocket) / infra / feature
  contexts/           Auth · GameFacade · Network · Service
  theme/              Design tokens + 8 套主题
```

### 技术栈

|            |                                                            |
| ---------- | ---------------------------------------------------------- |
| **客户端** | React Native 0.83 · Expo SDK 55 · TypeScript ~5.9          |
| **服务端** | Cloudflare Workers · D1 · Durable Objects                  |
| **AI**     | Gemini 3.1 Flash Lite（Worker 代理）                       |
| **测试**   | Jest · Testing Library · Playwright                        |
| **部署**   | Cloudflare Pages (Web) + Workers (API) · GitHub Actions CI |
| **监控**   | Sentry                                                     |

---

## 部署

```bash
pnpm run release            # patch（默认）— bump → CHANGELOG → tag → push
pnpm run release -- major   # major 发版
# git push 自动触发 Cloudflare Pages + Workers 部署
```

详见 [部署指南](docs/DEPLOYMENT.md)

---

## 文档

- [线下玩法 SOP](docs/offline-sop.md)
- [部署指南](docs/DEPLOYMENT.md)
- [角色技能对照表](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)

## 贡献

欢迎贡献！请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 安全

发现安全漏洞？请参阅 [SECURITY.md](SECURITY.md)

## 许可证

[MIT](LICENSE)
