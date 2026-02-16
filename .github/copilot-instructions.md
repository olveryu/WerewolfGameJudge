## WerewolfGameJudge Copilot 指令

## Project Overview

React Native (Expo SDK 54) 狼人杀裁判辅助 app。Supabase 负责房间发现、realtime 传输、state 持久化。支持 iOS / Android / Web。

## Tech Stack

- React Native 0.81 + React 19 + Expo SDK 54
- TypeScript ~5.9
- **pnpm workspace monorepo**（`packages/game-engine` + 根项目）
- `@werewolf/game-engine` — 纯游戏逻辑共享包（models / protocol / resolvers / engine），客户端与服务端共用
- Supabase (auth + realtime broadcast + Edge Functions)
- Sentry (crash reporting, production only)
- expo-image (remote avatar caching), expo-splash-screen
- Groq Llama 4 Scout (AI chat via Edge Function proxy)
- Jest 29 (单元/集成测试) | Playwright (E2E)
- ESLint 9 (`eslint.config.mjs`) | Prettier
- Path alias: `@/` → `src/`（仅根项目；game-engine 内使用相对路径）

## Key Directories

### `packages/game-engine/src/` — 纯游戏逻辑共享包（详见 `game-engine.instructions.md`）

### `src/` — 客户端

- `services/facade/` — Facade 编排 + IO（详见 `services.instructions.md`）
- `services/transport/` — Supabase realtime broadcast
- `services/infra/` — AudioService / AuthService / RoomService
- `services/feature/` — SettingsService / AvatarUploadService / AIChatService
- `models/`, `services/engine/`, `services/protocol/`, `services/night/resolvers/` — proxy re-export stubs（源在 game-engine）
- `screens/` — React Native screens（详见 `screens.instructions.md`）
- `theme/` — Design tokens (`tokens.ts`) + themes (`themes.ts`)
- `components/` — 通用 UI 组件
- `hooks/` — 通用 hooks
- `contexts/` — React Context（AuthContext / GameFacadeContext / NetworkContext / ServiceContext）
- `utils/` — logger / alert / random / id（禁止 `Math.random()` 直接调用，必须通过 `random.ts`）
- `config/` — Supabase / version 配置（纯配置值，禁止业务逻辑/副作用）
- `navigation/` — React Navigation 路由

### 质量命令

- `pnpm run test:all` — 单元/集成测试（全 workspace）
- `pnpm exec playwright test --reporter=list` — E2E（必须加 `--reporter=list`）
- `pnpm exec tsc --noEmit` — 类型检查
- `pnpm run quality` — typecheck + lint + format + test 一次全跑

### 发版 & 部署

- `pnpm run release` — bump 版本号 → 更新 CHANGELOG → commit → git tag → push。每次发版必须通过此脚本。
- `git push` 自动触发 **Vercel Git Integration**（执行 `scripts/build.sh`）完成生产部署，同时触发 **GitHub CI**（quality + E2E）。
- `scripts/deploy.sh` — 仅用于 Vercel 自动部署故障时的应急手动部署，日常不使用。

---

## ⚠️⚠️⚠️ 第一原则：社区惯例优先 ⚠️⚠️⚠️

> **在思考、制定方案、写任何一行代码之前，必须先查阅并遵循社区通行做法。**
>
> - 新增依赖/模式/架构决策，优先采用成熟、广泛认可的方案。
> - 发现现有代码不符合社区惯例时，主动指出。
> - 如果不确定社区做法是什么，先搜索/查阅文档，不要凭记忆臆断。
> - **这条规则的优先级高于本文件中的所有其他规则。**

---

## 协作规则（MUST follow）

### 未确认禁止写代码

- ✅ 允许：只读检查（read/search/list/grep）、运行测试/格式化/类型检查。
- ❌ 禁止未经用户确认修改代码。需先列出"文件 + 变更点 + 风险"等待确认。
- 收到修改需求时：分解问题 → 收集上下文 → 制定变更计划 → 验证假设 → 列变更计划等待确认。

### 修改代码时逐符号验证

每个受影响符号必须用 `grep_search` 或 `list_code_usages` 独立验证所有消费者。禁止批量推断"无影响"。修改前列出验证结论（`符号名 → 消费者: 无 / 有 [文件]`）。

### 调试策略

静态分析首选。较多时间仍无法确定根因时，主动加 `[DIAG]` 前缀诊断日志（项目 logger，禁止 `console.*`），让用户测试。修复后必须清除所有 `[DIAG]` 日志。

### 验证流水线

- pre-commit hook（husky + lint-staged）：eslint --fix + prettier --write。
- pre-push hook：`npx tsc --noEmit`。
- 手动完整验证：`pnpm run quality`。任一步骤失败必须修复后重跑。

---

## 不可协商规则

- **服务端是唯一的游戏逻辑权威。** Vercel Serverless 负责读-算-写-广播。客户端完全平等。
- **"Host" 只是 UI 角色标记。** `isHost` 决定按钮可见性和音频播放。Host 设备同时也是玩家。
- **仅 Night-1 范围。** 禁止跨夜状态/规则。
- **`BroadcastGameState` 是单一真相。** 所有信息公开广播，UI 按 `myRole` 过滤显示。禁止双写/drift/PRIVATE_EFFECT。
- **优先使用成熟库。**
- **SRP ~400 行拆分信号**（行数是信号不是判决）。

不清楚就先问再写代码。不要臆造仓库事实。

---

## 架构边界

- **Vercel Serverless** — 游戏逻辑（读 DB → game-engine → 写 DB + 乐观锁 → Realtime 广播）。
- **Supabase** — 房间生命周期、presence、auth、realtime transport、game_state 持久化。
- **客户端** — HTTP API 提交 + Realtime 接收 + `applySnapshot` + 音频播放（Host）。
- 所有客户端完全平等。禁止 P2P 消息。断线恢复统一读 DB。

### 日志

- 统一从 `src/utils/logger.ts` 获取命名 logger（`gameRoomLog`、`roomScreenLog` 等）。状态迁移、action 提交、错误、关键分支决策必须打日志。
- ❌ 禁止 `src/**` 业务代码 `console.*`。
- ❌ 禁止 `__tests__/**`、`e2e/**` 测试代码 `console.*`。
- ✅ 允许：`scripts/**`、`jest.setup.ts`。

### 错误处理

关键 catch 块三层齐备：`log.error()` + `Sentry.captureException()` + `showAlert(中文友好提示)`。可预期错误（用户取消、权限受限）只需 `log.warn()`。面向用户文本一律中文，`showAlert` title 用具体动作（`'创建失败'`），未知错误 fallback `'请稍后重试'`。auth 错误用 `mapAuthError()`。`ErrorBoundary.componentDidCatch` 使用 `Sentry.withScope` 附加 `componentStack`。

Fail fast：handler / reducer / 纯函数保持严格校验，违反前置条件立即报错，禁止防御性兜底或 silent fallback 掩盖上层调用错误。修正应在调用方（跳过无效调用 / 修正参数），而非在被调用方放宽校验。

---

## 编码约定

- **Git Commit**：`<type>(<scope>): <description>`（Conventional Commits，英文小写祈使语气，单 commit 单事）。Scope：`night` / `room` / `config` / `hooks` / `theme` / `e2e` / `models` / `services` / `audio` / `game-engine`。
- **终端**：跑测试禁止 `| grep` / `| head` / `| tail` 截断。Playwright 加 `--reporter=list`。
- **JSDoc**：每个 class/module 必须有名称定位 + 职责 + `✅/❌` 约束。禁止只有约束没有功能介绍，或只有介绍没有约束。
