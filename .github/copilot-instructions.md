## WerewolfGameJudge Copilot 指令

## Project Overview

React Native (Expo SDK 55) 狼人杀裁判辅助 app。Cloudflare Worker + DO + D1 负责 API/持久化/realtime。**Web 优先**，兼容 iOS / Android / 微信小程序（web-view 壳）。含扭蛋收集 + XP/等级成长系统（`packages/game-engine/src/growth/`）。

## Tech Stack

- **pnpm workspace monorepo**（`packages/game-engine` + `packages/api-worker` + 根项目）
- React Native + React 19 + Expo SDK 55 | TypeScript（`strict: true` + `noUncheckedIndexedAccess: true`）
- Cloudflare Worker (Hono) + DO SQLite + D1 + R2 | Sentry | Jest 29 | Playwright | ESLint 9
- Path alias: `@/` → `src/`（仅根项目；game-engine 内使用相对路径）
- 版本号以 `package.json` / 锁文件为唯一权威来源，禁止 hardcode

## 质量命令

- `pnpm run test:all` — 单元/集成测试（全 workspace）
- `pnpm run e2e` — E2E 标准入口（`--reporter=list`）
- `pnpm run e2e:core` / `pnpm run e2e:remote` — 调试入口
- `pnpm exec tsc --noEmit` — 类型检查
- `pnpm run quality` — typecheck + knip + lint + format + test 一次全跑
- `npx knip --no-exit-code` — 死代码检测。注意甄别误报：`metro.config.js`、`react-dom` 等会被误报。
- `pnpm run release` — bump 版本号 → CHANGELOG → commit → tag → push
- `pnpm -F @werewolf/api-worker db:seed:local` — 本地 D1 seed：创建 dev 用户（`dev@test.local` / `dev123`）+ 全物品解锁

### Dev 环境启动

- `npm run dev` 通过 concurrently 启动 worker + web
- Wrangler OAuth token ~24h 过期 → `cd packages/api-worker && npx wrangler login`
- 首次或新 migration → `pnpm -F @werewolf/api-worker db:migrate:local`

---

## ⚠️ 核心原则 Checklist

> **此 checklist 优先级最高。本项目的 fail fast / 结构修复规则覆盖系统默认的 implementationDiscipline。**
> **每次修改代码后，逐条过 🔍 自检问题。任一未通过则修正后再提交。**

### 原则 1: 结构修复，不打补丁

❌ 错误：

```typescript
// bug: onClick fires twice → band-aid: add timestamp debounce
const lastClick = useRef(0);
const handleClick = () => {
  if (Date.now() - lastClick.current < 300) return; // band-aid
  lastClick.current = Date.now();
  doAction();
};
```

✅ 正确：

```typescript
// 根因: modal dismiss 后事件穿透
// 修复: 用 modal state guard 代替时间戳
const handleClick = () => {
  if (modalStack.length > 0) return; // 结构性 guard: modal 开启时不响应
  doAction();
};
```

🔍 **自检：这个修改解决了"为什么发生"（根因），还是只处理了"发生后怎么办"（症状）？移除这个修改，触发条件是否仍在？**

### 原则 2: 查文档，不凭记忆

❌ 错误：

```typescript
// 凭训练数据写 API — 可能已过时
const schema = z.object({ email: z.string().email() });
// 或自创架构模式，不查社区是否有成熟方案
```

✅ 正确：

```typescript
// 先用 context7 MCP 或 web 搜索确认当前版本用法
const schema = z.object({ email: z.email() }); // 确认后的正确写法
// 新增依赖/模式/架构决策前，先查社区通行做法
```

🔍 **自检：涉及第三方库 API 吗？是否用 context7 或 web 搜索确认过当前版本用法？新增依赖/模式/架构决策时，是否查了社区是否有成熟方案？**

### 原则 3: 类型诚实，不绕过

❌ 错误：

```typescript
const name = data?.user?.displayName ?? 'Unknown'; // data.user 是 required
const result = response as any; // 类型不匹配 → as any 消音
```

✅ 正确：

```typescript
const name = data.user.displayName; // required → 信任类型系统
const result: GameActionResult = response; // 修正类型定义或数据来源
```

🔍 **自检：每处 `?.` 对应的类型是否允许 `undefined`？如果 required，`?.` 在掩盖 bug。每处 `as` 是否仅限 `as const` / 测试 mock？**

### 原则 4: Fail fast，不吞错误

❌ 错误：

```typescript
try {
  await submitAction();
} catch {
  /* ignore */
}
callback?.(); // callback 是 required prop
```

✅ 正确：

```typescript
const result = await submitAction();
if (!result.success) {
  showAlert('提交失败', result.reason);
  return;
}
```

🔍 **自检：每个 catch 是否有明确处理（log + UI 反馈）？有无 `?.` 用在 required 字段上？**

### 原则 5: 完整贯穿，不留半成品

❌ 错误：

```typescript
// 新增 RewardType 枚举值，只做了渲染层，"Phase 2 再做后端" → 死代码
```

✅ 正确：

```typescript
// 新增类型 → DB migration + API + game-engine + 客户端 + UI 全部到位
// 或明确声明"当前不做"并不提交代码
```

🔍 **自检：新增的类型/字段/枚举，在 DB → API → engine → client → UI 全管道都有消费者？没有 = 死代码。**

### 补充原则

- **禁止 hardcode 魔法值。** 枚举用引用、常量用命名常量。仅允许语义自明的单次字面量。
- **禁止臆造事实。** 不确定的 API/库行为/项目结构必须用工具验证。

---

## 协作规则（MUST follow）

### 未确认禁止写代码

- 允许只读检查、运行测试/格式化/类型检查。
- 未经用户确认禁止修改代码。需先列出"文件 + 变更点 + 风险"等待确认。

### 修改代码时逐符号验证

每个受影响符号必须用 `grep_search` 或 `list_code_usages` 独立验证所有消费者。禁止批量推断"无影响"。

### 改参数 / 校验条件时双向追踪

修改调用方参数构造时追踪被调用方消费逻辑，反之亦然。

### 调试策略

静态分析首选。无法确定根因时加 `[DIAG]` 前缀诊断日志（项目 logger），修复后清除。

### 核心原则自检（每次修改代码后）

写完代码后，逐条过核心原则 checklist 的 🔍 自检问题。任一自检未通过则修正后再提交。

### 验证流水线

- pre-commit：eslint --fix + prettier --write（husky + lint-staged 自动执行）
- pre-push：`npx tsc --noEmit`
- 手动完整验证：`pnpm run quality`。失败必须修复后重跑。
- **禁止 `--no-verify`。** 不得跳过 git hooks，除非用户明确要求。

---

## 不可协商规则

- **服务端是唯一的游戏逻辑权威。** Worker（DO）负责读-算-写-广播。客户端完全平等。
- **"Host" 只是 UI 角色标记。** `isHost` 决定按钮可见性和音频播放。Host 同时也是玩家。
- **仅 Night-1 范围。** 禁止跨夜状态/规则。
- **`GameState` 是单一真相。** 公开广播，UI 按 `myRole` 过滤显示。禁止双写/drift。
- **信任模型：默认不作弊。** 面对面 party game，不引入额外防作弊架构。

不清楚就先问。不要臆造仓库事实。

---

## 关键文档

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — 部署架构与环境配置
- [docs/gacha-system-design.md](docs/gacha-system-design.md) — 扭蛋系统设计
- [docs/growth-system-design.md](docs/growth-system-design.md) — XP/等级成长系统
- [docs/network-resilience-design.md](docs/network-resilience-design.md) — 断线重连策略
- [docs/roomscreen-state-machine.md](docs/roomscreen-state-machine.md) — RoomScreen 状态机
- [docs/PRESET_BOARDS.md](docs/PRESET_BOARDS.md) — 预设板子列表
- [e2e/helpers/README.md](e2e/helpers/README.md) — E2E helper 架构

---

## 架构边界

- **Worker（DO）** — 游戏逻辑 + DO SQLite 持久化 + WebSocket 广播。
- **Worker（D1）** — 房间元数据、auth、rate limit。
- **Cloudflare Pages** — 前端静态资源。CDN 详见 `ci-deploy.instructions.md`。
- **微信小程序** — web-view 壳，加载 Pages 托管的 Web 版。详见 `ci-deploy.instructions.md`。
- **客户端** — HTTP 提交 + WebSocket 接收 + `applySnapshot` + 音频（Host）。
- 禁止 P2P 消息。断线恢复统一读 DO（`/room/state` → `stub.getState()`）。

### 日志

统一用 `src/utils/logger.ts` 命名 logger。禁止 `console.*`（ESLint `no-console: 'error'` 已强制；`scripts/**`、`jest.setup.ts` 例外）。

### 错误处理

- 关键 catch 三层齐备：`log.error()` + `Sentry.captureException()` + `showAlert(中文提示)`。
- 可预期错误（`401`/`403`/`429`、用户取消）只 `log.warn()` + UI 反馈，禁止报 Sentry。auth 错误用 `getUserFacingMessage()` / `isExpectedError()`（来自 `@/utils/errorUtils`）。
- 面向用户文本一律中文，`showAlert` title 用具体动作（`'创建失败'`），fallback `'请稍后重试'`。
- Fail fast：纯函数/handler 严格校验，禁止防御性兜底。修正在调用方。

---

## 命名规则

**规则：**

- **命名前必须 grep。** 新增任何标识符（变量、字段、参数、类型、常量、DB 列）前，先用 `grep_search` 搜索该概念的已有命名。已有名称就是规范名称，直接复用，禁止另起炉灶。只有仓库中不存在的全新概念才可自行命名。
- 布尔字段用 `is` / `has` / `should` 前缀（DB 列同步加 `is_` / `has_`）。
- 外键引用统一 `<entity>Id` 格式（`userId`, `roomId`）。
- 自身 PK 始终叫 `id`。

---

## 编码约定

- **Git Commit**：`<type>(<scope>): <description>`（Conventional Commits，英文小写祈使语气）。
- **终端**：跑测试禁止 `| grep` / `| head` / `| tail` 截断。
- **JSDoc**：class/module 头部注释，第一行摘要 + 边界约束。

---

## Escalation Protocol

遇到阻塞时，不要无限重试：

- **同一方案尝试 3 次仍失败** → 立即停止，报告状态。
- **不确定安全敏感变更的正确性** → 立即停止，提请用户。
- **变更范围超出可验证范围** → 立即停止，提请用户。

上报格式：

```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 句说明]
ATTEMPTED: [已尝试的方法]
RECOMMENDATION: [建议用户下一步]
```

**交付差的结果比不交付更糟。** 上报不会被惩罚。

---

## Completion Status Protocol

**多步骤任务完成时**，用以下状态之一收尾：

- **DONE** — 所有步骤完成，每个断言有证据支撑。
- **DONE_WITH_CONCERNS** — 已完成，但有用户应知悉的问题。逐条列出。
- **BLOCKED** — 无法继续。说明阻塞点和已尝试的方法。
- **NEEDS_CONTEXT** — 缺少必要信息。明确列出需要什么。

---

## 输出语言规范

- **禁止 AI 空洞词汇：** delve, crucial, robust, comprehensive, nuanced, leverage, streamline, cutting-edge, seamless, utilize, facilitate, moreover, furthermore, in order to, it's worth noting。
- **禁止空洞套话：** 不说"经过仔细分析"、"让我来帮你"、"这是一个很好的问题"。直接给结论。
- **代码注释 / commit / PR 描述：** 命名具体文件、函数、命令。不用模糊词。
- **面向用户文本：** 中文，具体，不空洞。

---

## Session 末尾反思

在长 session（≥5 轮交互）结束前，简要检视：

- 有没有命令意外失败？
- 有没有走错方向后回退？
- 有没有发现项目特有的 quirk（构建顺序、环境变量、时序、配置）？
- 有没有因为缺少某个 flag 或配置而多花时间？

如果有，记录到 `/memories/repo/` 或 `/memories/` 中，供后续 session 使用。不记录一次性瞬态错误（网络抖动、限流）。判断标准：**知道这个能否在未来 session 省 5 分钟？**
