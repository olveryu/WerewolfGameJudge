## WerewolfGameJudge Copilot 指令

## Project Overview

React Native (Expo SDK 55) 狼人杀裁判辅助 app。Cloudflare Worker + Durable Objects（游戏状态）+ D1（房间/用户元数据）负责 API、持久化、realtime 传输。支持 iOS / Android / Web。

## Tech Stack

- React Native 0.83 + React 19 + Expo SDK 55 | TypeScript ~5.9
- **pnpm workspace monorepo**（`packages/game-engine` + `packages/api-worker` + 根项目）
- `@werewolf/game-engine` — 纯游戏逻辑共享包，客户端与服务端共用
- `@werewolf/api-worker` — Game API + Auth API（Cloudflare Worker + DO SQLite + D1 + R2）
- Sentry (production only) | Jest 29 | Playwright (E2E) | ESLint 9 | Prettier
- Path alias: `@/` → `src/`（仅根项目；game-engine 内使用相对路径）

## 质量命令

- `pnpm run test:all` — 单元/集成测试（全 workspace）
- `pnpm run e2e` — E2E 标准入口（`--reporter=list`）
- `pnpm run e2e:core` / `pnpm run e2e:remote` — 调试入口
- `pnpm exec tsc --noEmit` — 类型检查
- `pnpm run quality` — typecheck + lint + format + test 一次全跑
- `npx knip --no-exit-code` — 死代码检测。注意甄别误报：`metro.config.js`、`web/sw.js`、`react-dom` 等会被误报。
- `pnpm run release` — bump 版本号 → CHANGELOG → commit → tag → push

---

## ⚠️ 第一原则：社区惯例优先

> **写任何代码之前，必须先查阅并遵循社区通行做法。此规则优先级最高。**
>
> - 新增依赖/模式/架构决策，优先采用成熟方案。发现现有代码不符合社区惯例时主动指出。
> - 不确定就先查文档/搜索，不要凭记忆臆断。
> - **版本号与命令以可执行配置为唯一权威来源。** `package.json`/锁文件 > instruction/README。
> - **禁止 hardcode 魔法值。** 枚举用引用、常量用命名常量、配置用配置项。仅允许语义自明的单次字面量（`timeout: 3000`）或类型系统保证安全的场景。
> - **禁止臆造事实。** 不确定的 API/库行为/项目结构必须用工具验证。说错不如说"我不确定，需要确认"。
> - **禁止走捷径。** 不得用 `?.` 绕过 required 字段、`as any` 消除类型错误、防御性兜底掩盖 mock 不完整。追求正确且健壮，而非最省力。

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
- **DRY + SRP ~400 行拆分信号。**

不清楚就先问。不要臆造仓库事实。

---

## 架构边界

- **Worker（DO）** — 游戏逻辑 + DO SQLite 持久化 + WebSocket 广播。
- **Worker（D1）** — 房间元数据、auth、rate limit。
- **Cloudflare Pages** — 前端静态资源。
- **客户端** — HTTP 提交 + WebSocket 接收 + `applySnapshot` + 音频（Host）。
- 禁止 P2P 消息。断线恢复统一读 DO（`/room/state` → `stub.getState()`）。

### 日志

统一用 `src/utils/logger.ts` 命名 logger。禁止业务代码和测试代码 `console.*`（`scripts/**`、`jest.setup.ts` 例外，ESLint `no-console: 'error'` 已强制）。

### 错误处理

- 关键 catch 三层齐备：`log.error()` + `Sentry.captureException()` + `showAlert(中文提示)`。
- 可预期错误（`401`/`403`/`429`、用户取消）只 `log.warn()` + UI 反馈，禁止报 Sentry。auth 错误用 `mapAuthError()` / `isExpectedAuthError()`。
- 面向用户文本一律中文，`showAlert` title 用具体动作（`'创建失败'`），fallback `'请稍后重试'`。
- Fail fast：纯函数/handler 严格校验，禁止防御性兜底。修正在调用方。

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
