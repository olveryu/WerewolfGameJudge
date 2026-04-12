# 🐺 狼人杀电子法官

**[English](./README.en.md)** | 简体中文

> 线下狼人杀总要有人当法官，法官却不能参与游戏——**这个 App 替你当法官。**
> 首夜全自动语音引导，所有人（包括房主）都能闭眼参与游戏。

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
<summary><b>📑 目录</b></summary>

- [为什么做这个](#为什么做这个)
- [核心特性](#核心特性)
- [快速开始](#快速开始)
- [架构](#架构)
- [角色一览](#-43-种角色一览)
- [开发](#开发)
- [部署](#部署)
- [常见问题](#常见问题)
- [文档](#文档)
- [贡献](#贡献)
- [Contributors](#contributors)
- [许可证](#许可证)

</details>

---

## 为什么做这个

玩线下狼人杀时，**法官是个苦差事**：

- 🙅 法官不能参与游戏，只能坐在旁边主持
- 📖 新手法官容易记混流程，影响体验
- 🔇 纯线下口述效率低，夜间流程经常出错
- 📱 远程联机更是无从下手

**狼人杀电子法官**让手机替你当法官——自动语音播报首夜流程，每个人（包括创建房间的 Host）都能闭眼正常参与游戏。4 位房间码一分享，线下同桌或远程联机都能玩。

---

## 核心特性

### 🔊 自动语音播报

首夜全流程语音引导，包括身份确认、技能行动、天亮公告。Host 也能闭眼参与，不再是旁观者。支持 BGM 和音效增强沉浸感。

### 📱 多设备实时同步

创建房间后分享 4 位房间码，所有人通过浏览器或 App 加入。WebSocket 实时推送游戏状态，操作秒级同步。

### 🔌 断线自动恢复

游戏状态持久化在 Cloudflare Durable Objects（边缘 SQLite）。网络断开后重连自动恢复到最新状态，不会丢失任何进度。

### 🎭 43 种角色 · 27 套预设板子

覆盖经典和扩展角色——预言家、女巫、猎人、守卫等神职，狼美人、白狼王、血月使徒等特殊狼人，以及丘比特、盗贼、吹笛者等第三方。27 套预设模板覆盖 6-18 人局，也支持自定义板子。

### 🤖 AI 助手

遇到不确定的规则？点击角色卡上的 AI 气泡，随时询问技能细节和策略建议。基于 Gemini 3.1 Flash Lite，通过 Worker 代理安全访问。

### 📊 等级成长 · 头像解锁

每局有效游戏获得 XP，52 级满级。每升级解锁 1 个头像、头像框或座位装饰（Skia 粒子特效）。成就感完全来自游戏参与，无排行榜压力。

### 🎨 8 种主题

月白 / 暖沙 / 青瓷 / 晴岚 / 石墨 / 月蚀 / 血月 / 幽林——明暗皆有，适配不同氛围。

### 🌐 跨平台

iOS · Android · Web (PWA) · 微信小程序 四端支持。Web 版即开即用，无需下载安装。PWA 模式支持离线启动和添加到主屏幕。微信搜索「狼人杀自助电子法官」即可使用。

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
     ┌────────────┬───┼───────────┐
     │            │   │           │
  iOS App   Android  Web (PWA)  微信小程序
  ────────────────────────────  (web-view)
  HTTP 提交 · WebSocket 接收
  Host: 音频播放
```

**核心约束：**

- 服务端（Worker + DO）是唯一游戏逻辑权威，客户端不做逻辑决策
- 所有客户端平等，Host 仅决定 UI 可见性和音频播放
- `GameState` 是单一真相源，服务端读-算-写-广播

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
miniapp/              微信小程序 web-view 壳（AppID: wx7f0c3bea5873908c）
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
| **小程序** | 微信小程序 web-view 壳 · miniprogram-ci 上传               |
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

## 常见问题

<details>
<summary><b>需要注册账号吗？</b></summary>

不需要。打开网页即可创建或加入房间。如果需要保存自定义模板等数据，可以选择匿名登录或邮箱登录。

</details>

<details>
<summary><b>支持哪些平台？</b></summary>

iOS、Android、微信小程序和任何现代浏览器（Chrome、Safari、Firefox、Edge）。Web 版支持 PWA，可以添加到手机主屏幕像原生 App 一样使用。微信搜索「狼人杀自助电子法官」可直接使用。

</details>

<details>
<summary><b>游戏数据存储在哪里？</b></summary>

所有游戏状态存储在 Cloudflare Durable Objects（边缘 SQLite），房间元数据存储在 D1。你的数据不会发送到任何第三方。房间在 24 小时无活动后自动清理。

</details>

<details>
<summary><b>App 只管首夜吗？白天怎么办？</b></summary>

是的，App 自动化的是首夜（Night-1）流程——身份确认、技能行动、天亮结算。白天的发言、投票、放逐环节由玩家自行进行，这也是狼人杀最有趣的社交部分。

</details>

<details>
<summary><b>可以自定义板子吗？</b></summary>

可以。除了 27 套预设模板，你可以自由组合角色创建自定义模板，保存后下次直接使用。

</details>

---

## 文档

- [线下玩法 SOP](docs/offline-sop.md)
- [部署指南](docs/DEPLOYMENT.md)
- [角色技能对照表](docs/NIGHT1_ROLE_ALIGNMENT_MATRIX.md)
- [预设板子参考](docs/PRESET_BOARDS.md)

## 贡献

欢迎贡献！无论是 Bug 报告、功能建议还是代码 PR，我们都非常感谢。

请参阅 [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## 安全

发现安全漏洞？请参阅 [SECURITY.md](SECURITY.md)

## Contributors

<a href="https://github.com/olveryu/WerewolfGameJudge/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=olveryu/WerewolfGameJudge" />
</a>

---

## 许可证

[MIT](LICENSE) © 2024-present
