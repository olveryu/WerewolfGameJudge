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
- expo-image (remote avatar caching)
- expo-splash-screen
- Groq Llama 4 Scout (AI chat via Edge Function proxy)
- Jest 29 (单元/集成测试) | Playwright (E2E)
- ESLint 9 (`eslint.config.mjs`) | Prettier
- Path alias: `@/` → `src/`（仅根项目；game-engine 内使用相对路径）

## Key Directories

### `packages/game-engine/src/` — 纯游戏逻辑共享包（`@werewolf/game-engine`）

- `models/` — 角色 spec / schema / nightSteps（声明式，无副作用）
- `protocol/` — 协议类型（BroadcastGameState / ProtocolAction / reasonCodes）
- `resolvers/` — Night resolver 纯函数（校验 + 计算）
- `engine/` — 服务端引擎（handlers / reducer / store / state / DeathCalculator），由 Vercel Serverless 执行
- `types/` — 共享类型（RoleRevealAnimation）
- `utils/` — 平台无关工具（id / logger / random / shuffle）

### `src/` — 客户端根项目

- `src/models/`, `src/services/engine/`, `src/services/protocol/`, `src/services/night/resolvers/` — **proxy re-export stubs**（源文件在 game-engine，此处仅 `export * from '@werewolf/game-engine/...'`）
- `src/services/facade/` — UI 层 facade（编排 + IO）
- `src/services/transport/` — Supabase realtime broadcast
- `src/services/infra/` — 基础设施（AudioService / AuthService / RoomService）
- `src/services/feature/` — 功能服务（SettingsService / AvatarUploadService / AIChatService）
- `src/screens/` — React Native screens（Home / Config / Room / Settings）
- `src/theme/` — Design tokens (`tokens.ts`) + themes (`themes.ts`)
- `src/components/` — 通用 UI 组件
- `src/hooks/` — 通用 hooks
- `src/contexts/` — React Context（AuthContext / GameFacadeContext / NetworkContext / ServiceContext）
- `src/utils/` — 工具函数（logger / alert / random / id）
- `src/config/` — 配置（Supabase / version）
- `src/navigation/` — React Navigation 路由

## Common Commands

### 本地开发（两进程模式，推荐）

Metro 前端 (:8081) 和 API 服务 (:3000) 分离运行，避免 `vercel dev` 代理损坏静态资源（字体/图片/音频）。

```bash
# Terminal 1 — Metro 前端（热更新，icons/avatars/audio 正常）
pnpm run web          # → localhost:8081

# Terminal 2 — API 服务（自动写入 .env.local，含 EXPO_PUBLIC_API_URL）
pnpm run dev:api      # → localhost:3000
```

- `dev:api` 自动从 `env/e2e.local.json` 加载 Supabase 配置，写入 `.env.local`（含 `EXPO_PUBLIC_API_URL=http://localhost:3000`）
- Metro 读取 `.env.local`，所有 API 调用跨域到 `:3000`，API 路由已配置 CORS（允许 `:8081` origin）
- 需先 `supabase start` 启动本地 Supabase

### 单进程模式（E2E / CI 用）

- `pnpm run dev` — 启动 `vercel dev`（同时服务 Expo 前端 + `/api/**`，但静态资源可能损坏）
  - `E2E_ENV=local`（默认）使用本地 Supabase（`127.0.0.1:54321`）
  - `E2E_ENV=remote` 使用远端 Supabase

### 测试 & 质量

- `pnpm exec jest --no-coverage --forceExit` — 跑全部单元/集成测试（171 suites / 2657 tests）
- `pnpm exec playwright test --reporter=list` — 跑 E2E（必须加 `--reporter=list`，否则会阻塞终端）
- `pnpm exec tsc --noEmit` — 类型检查
- `pnpm run lint` — ESLint
- `pnpm run quality` — typecheck + lint + format + test 一次全跑

---

## 协作规则（MUST follow）

### 社区惯例优先

- 思考/制定方案/写代码前，必须先考虑社区和生态系统的通行做法。
- 新增依赖/模式优先选择社区广泛采用的成熟方案。
- 发现不符社区惯例时主动指出，但仍需遵守"未确认禁止写代码"规则。

### 未确认禁止写代码

- ✅ 允许：只读检查（read/search/list/grep）、运行测试/格式化/类型检查。
- ❌ 禁止未经用户确认修改代码。需先列出"文件 + 变更点 + 风险"等待确认。
- 收到修改需求时必须先做完整分析（分解问题 → 收集上下文 → 制定变更计划 → 验证假设），再列变更计划等待确认。

### 修改代码时逐符号验证

- 每个受影响符号必须用 `grep_search` 或 `list_code_usages` 独立验证所有消费者。
- 禁止批量推断"无影响"。
- 修改前列出每个符号验证结论（`符号名 → 消费者: 无 / 有 [文件]`），纳入变更计划。

### 调试策略

- 静态分析（read/grep/搜调用链）是首选。但如果花了较多时间仍无法确定运行时时序/闭包/状态流问题的根因，应主动加诊断日志让用户测试，而不是继续猜。
- 诊断日志使用 `[DIAG]` 前缀 + 项目 logger（`gameRoomLog` / `roomScreenLog` 等），禁止 `console.*`。
- 日志内容必须包含关键上下文（当前值 vs 预期值、调用栈片段等），争取一轮测试就定位。
- 定位完成并修复后，必须清除所有 `[DIAG]` 日志。

### 修改后验证流水线（Hard rule）

- **pre-commit hook**（husky + lint-staged）自动对暂存文件跑 eslint --fix + prettier --write，保证格式/lint 不脏。
- **pre-push hook**（husky）自动跑 `npx tsc --noEmit`（快速类型检查），拦截跨文件类型错误。
- **GitHub Actions CI**（push/PR to main）自动跑 typecheck → lint → format check → test，服务端兜底。
- **完整验证**也可手动跑，lint-staged 不覆盖跨文件类型检查和测试：
  1. `pnpm exec tsc --noEmit` — 类型检查
  2. `pnpm run lint` — ESLint
  3. `pnpm run format` — Prettier 格式检查
  4. `pnpm exec jest --no-coverage --forceExit` — 单元/集成测试
- 快捷替代：`pnpm run quality`（先自动 fix 格式/lint，再依次跑 typecheck → lint → test，一条命令全搞定）。
- 任一步骤失败必须修复后重跑，禁止跳过。

---

## 不可协商规则

- **服务端是唯一的游戏逻辑权威。** Vercel Serverless Functions 负责读-算-写-广播，Supabase 负责 transport/discovery/identity/state persistence。客户端完全平等。
- **“Host” 只是 UI 角色标记。** `isHost` 决定哪些按钮可见、谁播放音频。服务端校验 `hostUid`。客户端代码里不需要 Host 专用逻辑路径。
- **Host 设备同时也是玩家，不是单独裁判机。**
- **仅 Night-1 范围。** 绝对不要加入跨夜状态/规则。
- **`BroadcastGameState` 是单一真相。** 所有信息公开广播，UI 按 `myRole` 过滤显示。禁止双写/drift。
- **优先使用成熟库。** 新增能力先找成熟 npm 库。
- **SRP。** ~400 行拆分信号（但行数是信号不是判决）。

不清楚就先问再写代码。不要臆造仓库事实。

---

## 架构边界

### Server vs Client 架构边界

- **Vercel Serverless** 负责：游戏逻辑计算（读 DB → game-engine 纯函数 → 写 DB + 乐观锁 → Realtime 广播）。
- **Supabase** 负责：房间生命周期（4 位房间号）、presence、auth、realtime transport、game_state 持久化。
- **客户端** 负责：HTTP API 提交操作，Realtime broadcast 接收状态，`applySnapshot` 更新本地 store，音频播放（Host UI 角色）。
- **所有客户端完全平等。** Host 和 Player 走相同的状态接收路径，不存在 Host 专用逻辑路径。
- **禁止 P2P 消息。** 无 `sendToHost`、无 `broadcastAsHost`、无 `REQUEST_STATE`。所有操作走 HTTP API → 服务端广播。
- **断线恢复统一读 DB。** Host 和 Player 都从 `rooms.game_state` 读取最新状态。

### 代码归属

- `packages/game-engine/src/**` — 纯游戏逻辑（models / protocol / resolvers / engine）。→ 详见 `game-engine.instructions.md`
- `src/models/`, `src/services/engine/`, `src/services/protocol/`, `src/services/night/resolvers/` — **proxy re-export stubs**（源在 game-engine）。→ 详见 `game-engine.instructions.md`
- `src/services/facade/**` — Facade 编排 + IO。→ 详见 `services.instructions.md`
- `src/screens/**/components/**` — 仅 UI。→ 详见 `components.instructions.md`

### 日志与错误处理

- 统一从 `src/utils/logger.ts` 获取（`gameRoomLog`、`roomScreenLog` 等）。
- ❌ 禁止 `src/**` 业务代码 `console.*`。
- ✅ 允许：`__tests__/**`、`e2e/**`、`scripts/**`。
- 状态迁移、action 提交、错误、关键分支决策必须打日志（带 context + 关键数据）。
- 级别：`.debug()`（正常）/ `.warn()`（可恢复）/ `.error()`（失败）。

#### 三层错误处理（catch 块必遵）

| 层       | 目的     | 方式                                      |
| -------- | -------- | ----------------------------------------- |
| 本地日志 | 开发调试 | `log.error('context', err)`               |
| 远端上报 | 生产监控 | `Sentry.captureException(err)`            |
| 用户提示 | 友好反馈 | `showAlert(title, msg)` / `setError(msg)` |

- 关键 catch（auth / room / 游戏逻辑 / screen 兜底）三层齐备。
- 可预期错误（用户取消分享、剪贴板权限受限、AsyncStorage 读写）只需 `log.warn()`，不加 Sentry。
- `ErrorBoundary.componentDidCatch` 使用 `Sentry.withScope` 附加 `componentStack`。

#### 用户友好错误信息

- ❌ 禁止向用户暴露英文原始错误（`error.message`、Supabase 错误码）。
- ✅ 面向用户的文本一律中文，描述操作结果而非技术细节。
- ✅ Supabase auth 错误使用 `mapAuthError(msg)` 映射（`src/utils/logger.ts` 导出）。
- ✅ `showAlert` title 使用具体动作（`'创建失败'`、`'登录失败'`），禁止泛化 `'错误'`。
- ✅ 未知错误 fallback 使用 `'请稍后重试'`，禁止 `'未知错误'`。

---

## 领域规则（核心原则，详细规则见 path-specific instructions）

### 夜晚流程与音频

> 详细规则（Night Flow invariants、auto-advance 护栏、NightPlan 表驱动、音频时序分层、音频 Gate 护栏）→ `services.instructions.md`

- `nightFlowHandler` / `stepTransitionHandler` 是夜晚推进的单一真相。
- Night-1 推进顺序来自 `NIGHT_STEPS`（表驱动），step id = 稳定 `SchemaId`。
- 音频编排：服务端写入 `pendingAudioEffects` → 广播 → Host Facade reactive store subscription 检测 → 播放 → `postAudioAck` 释放 gate。
- `isAudioPlaying` 是事实状态，唯一通过 `SET_AUDIO_PLAYING` 修改。
- Wolf vote deadline 到期后，Host 调用 `postProgression` 触发服务端推进（一次性 guard 防重入）。
- Host rejoin 时 `joinRoom(isHost=true)` 从 DB 恢复后重置 `isAudioPlaying`，Facade 通过 `resumeAfterRejoin()` + `ContinueGameOverlay` 用户手势恢复音频。

### Resolver 集成

> 详细架构图与原则 → `services.instructions.md`

- Resolver 是唯一的验证与计算逻辑来源。Host 不做"二次计算"。
- reveal 结果必须从 resolver 返回值读取。

### 约束与校验

> 详细规则（schema-first、Night-1-only、中立裁判）→ `models.instructions.md`

- 输入合法性写在 `SCHEMAS[*].constraints`（schema-first）。
- 禁止跨夜记忆。狼刀可刀任意座位（中立裁判）。

### 广播架构（无私聊/无私有消息）

- 所有游戏状态公开。UI 按 `myRole` 过滤显示。
- 禁止 `PRIVATE_EFFECT`。Host 与 Player 读取同一份 state。

### Anti-drift 护栏

> 详细规则（`normalizeState` 同步步骤）→ `services.instructions.md`

- 禁止 `HostOnlyState` / `hostOnly` 字段。Host/Player state shape 完全一致。
- 新增 `BroadcastGameState` 字段必须同步 `normalizeState`（遗漏会被静默丢弃）。

---

## 实现清单（新增/修改 Night-1 行动角色时必查）

1. **Schema-first + Resolver 对齐** — schema 约束与 resolver 校验一致。
2. **Nightmare 阻断** — resolver 检查 `blockedSeat === actorSeat`。
3. **上下文/结果写入 `BroadcastGameState`** — UI 从 `gameState.*` 读取，按 `myRole` 过滤。
4. **三层表驱动** — `ROLE_SPECS` + `SCHEMAS` + `NIGHT_STEPS`，step id = `SchemaId`。
5. **狼人 UI（schema 驱动）** — `showWolves` 从 `schema.kind + meeting` 推导，禁止 step-level visibility。

---

## Git Commit 规范（Conventional Commits）

格式：`<type>(<scope>): <description>`

| Type   | 用途     |
| ------ | -------- | ------- | -------- | ---------- | ---- |
| `feat` | 新功能   | `fix`   | Bug 修复 | `refactor` | 重构 |
| `perf` | 性能优化 | `style` | 格式化   | `chore`    | 杂务 |
| `test` | 测试     | `docs`  | 文档     |            |      |

- Scope：`night` / `room` / `config` / `hooks` / `theme` / `e2e` / `models` / `services` / `audio` / `game-engine`
- 英文、小写开头、祈使语气、不加句号。破坏性变更加 `!`。
- body（可选）：空一行后写详细说明。
- 单个 commit 只做一件事，禁止大杂烩 commit。

---

## 终端输出规范

- 跑测试（Jest / Playwright / tsc）禁止 `| grep` / `| head` / `| tail` 截断输出。
- Playwright 必须加 `--reporter=list`。

---

## JSDoc 规范

- 每个 class/module JSDoc 必须有：名称定位 + 职责 + `✅/❌`。
- ❌ 禁止只有 `✅/❌` 而没有功能介绍（先知道"是什么"再知道"能不能做"）。
- ❌ 禁止只有功能介绍而没有 `✅/❌`（缺约束视为不完整）。
