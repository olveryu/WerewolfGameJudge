## WerewolfGameJudge Copilot 指令

## Project Overview

React Native (Expo SDK 54) 狼人杀裁判辅助 app。本地/离线为主，Supabase 仅做房间发现与 realtime 传输。支持 iOS / Android / Web。

## Tech Stack

- React Native 0.81 + React 19 + Expo SDK 54
- TypeScript ~5.9
- Supabase (auth + realtime broadcast + Edge Functions)
- Sentry (crash reporting, production only)
- expo-image (remote avatar caching)
- expo-splash-screen
- Groq Llama 4 Scout (AI chat via Edge Function proxy)
- Jest 29 (单元/集成测试) | Playwright (E2E)
- ESLint 9 (`eslint.config.mjs`) | Prettier
- Path alias: `@/` → `src/`

## Key Directories

- `src/models/roles/` — 角色 spec / schema / nightSteps（声明式，无副作用）
- `src/services/engine/` — Host-only 游戏引擎（reducer + handlers + resolvers）
- `src/services/facade/` — UI 层 facade（编排 + IO）
- `src/services/transport/` — Supabase realtime broadcast
- `src/services/infra/` — 基础设施（AudioService / AuthService / RoomService）
- `src/services/feature/` — 功能服务（SettingsService / AvatarUploadService / AIChatService）
- `src/screens/` — React Native screens（Home / Config / Room / Settings）
- `src/theme/` — Design tokens (`tokens.ts`) + themes (`themes.ts`)
- `src/components/` — 通用 UI 组件
- `src/hooks/` — 通用 hooks
- `src/contexts/` — React Context（AuthContext / GameFacadeContext / ThemeProvider）
- `src/utils/` — 工具函数（logger / alert / random / id）
- `src/config/` — 配置（Supabase / version）
- `src/navigation/` — React Navigation 路由

## Common Commands

- `npm run web` — 启动 Web 开发服务器
- `npx jest --no-coverage --forceExit` — 跑全部单元/集成测试（165 suites / 2613 tests）
- `npx playwright test --reporter=list` — 跑 E2E（必须加 `--reporter=list`，否则会阻塞终端）
- `npx tsc --noEmit` — 类型检查
- `npm run lint` — ESLint
- `npm run quality` — typecheck + lint + format + test 一次全跑

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

- 代码修改完成后，commit 前**必须**依次运行以下三步，全部通过才可提交：
  1. `npx tsc --noEmit` — 类型检查
  2. `npm run lint` — ESLint
  3. `npx jest --no-coverage --forceExit` — 单元/集成测试
- 快捷替代：`npm run quality`（一次执行 typecheck + lint + format + test）。
- 任一步骤失败必须修复后重跑，禁止跳过。

---

## 不可协商规则

- **Host 是唯一的游戏逻辑权威。** Supabase 只负责 transport/discovery/identity。
- **离线本地玩法。** Host 设备同时也是玩家，不是单独裁判机。
- **仅 Night-1 范围。** 绝对不要加入跨夜状态/规则。
- **`BroadcastGameState` 是单一真相。** 所有信息公开广播，UI 按 `myRole` 过滤显示。禁止双写/drift。
- **优先使用成熟库。** 新增能力先找成熟 npm 库。
- **SRP。** ~400 行拆分信号（但行数是信号不是判决）。

不清楚就先问再写代码。不要臆造仓库事实。

---

## 架构边界

### Host vs Supabase

- Host 负责：night flow、validation、resolver、death calculation、audio sequencing。
- Supabase 负责：房间生命周期（4 位房间号）、presence、auth、realtime transport。
- Supabase **绝对不能**存储/校验游戏状态。

### 代码归属

- `src/models/roles/**` — 声明式内容。→ 详见 `models.instructions.md`
- `src/services/engine/**` — Host-only 引擎逻辑。→ 详见 `services.instructions.md`
- `src/screens/**/components/**` — 仅 UI。→ 详见 `components.instructions.md`

### 日志

- 统一从 `src/utils/logger.ts` 获取（`gameRoomLog`、`roomScreenLog` 等）。
- ❌ 禁止 `src/**` 业务代码 `console.*`。
- ✅ 允许：`__tests__/**`、`e2e/**`、`scripts/**`。
- 状态迁移、action 提交、错误、关键分支决策必须打日志（带 context + 关键数据）。
- 级别：`.debug()`（正常）/ `.warn()`（可恢复）/ `.error()`（失败）。

---

## 领域规则（核心原则，详细规则见 path-specific instructions）

### 夜晚流程与音频

> 详细规则（Night Flow invariants、auto-advance 护栏、NightPlan 表驱动、音频时序分层、音频 Gate 护栏）→ `services.instructions.md`

- `nightFlowHandler` / `stepTransitionHandler` 是夜晚推进的单一真相。
- Night-1 推进顺序来自 `NIGHT_STEPS`（表驱动），step id = 稳定 `SchemaId`。
- 音频编排：Handler 声明 → Facade 执行 → UI 只读 Gate。
- `isAudioPlaying` 是事实状态，唯一通过 `SET_AUDIO_PLAYING` 修改。

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

| Type | 用途 |
|------|------|
| `feat` | 新功能 | `fix` | Bug 修复 | `refactor` | 重构 |
| `perf` | 性能优化 | `style` | 格式化 | `chore` | 杂务 |
| `test` | 测试 | `docs` | 文档 | | |

- Scope：`night` / `room` / `config` / `hooks` / `theme` / `e2e` / `models` / `services` / `audio`
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
