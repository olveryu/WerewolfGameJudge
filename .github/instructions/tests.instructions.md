---
applyTo: '**/*.test.ts,**/*.test.tsx,**/__tests__/**,e2e/**'
---

# 测试规范

## 核心原则

- ✅ Jest 测试文件中允许 `console.*`。
- ❌ E2E spec（`e2e/**`）禁止 `console.log` —— 用 `test.step()` + `testInfo.attach()` 替代。
- ✅ 测试文件中允许 `as` 构造 mock 数据。
- ✅ 允许 mock `src/utils/alert.ts` 的 `showAlert`。
- ✅ 测试断言基于 `BroadcastGameState` 单一真相。
- ✅ Integration board tests 跑真实 NightFlow（按 `NIGHT_STEPS` 顺序逐步执行）。
- ✅ Resolver unit tests 使用纯函数调用。
- ❌ 禁止 `it.skip` / `test.skip` / `describe.skip`。
- ❌ 禁止直接改 state / 注入 host-only 状态。
- ❌ 禁止 snapshot/Storybook 截图替代交互覆盖。
- ❌ 禁止"跳过 step / 直达 step"工具（`advanceToStep` / `skipToStep`）。
- ❌ 禁止 helper 自动清除 gate 或自动发送确认消息。
- ❌ 禁止跑测试时用 `| grep` / `| head` / `| tail` 截断输出。

## game-engine 相关测试规则

- ✅ `jest.mock()` 路径使用 `@werewolf/game-engine/...` 而非相对路径（如 `@werewolf/game-engine/resolvers`）。
- ✅ 静态分析测试读取源文件内容时，从 `packages/game-engine/src/` 读取（不从存根读取）。
- ❌ 禁止用相对路径 mock 存根文件（存根只做 re-export，mock 应指向 game-engine 包路径）。
- ❌ 禁止无证据宣称"已修复"。

## 通用规则

- 禁止 `it.skip` / `test.skip` / `describe.skip`（CI 会检测到并 fail）。
- 测试断言必须基于 `BroadcastGameState` 单一真相，禁止直接改 state / 注入 host-only 状态。
- 禁止用 snapshot/Storybook 截图替代交互覆盖。
- Jest 测试文件中允许 `console.*`；E2E spec 禁止（见下方 E2E 日志规范）。

## Integration Board Tests（`src/services/__tests__/boards/**`）

- 必须跑真实 NightFlow（按 `NIGHT_STEPS` 顺序逐步执行）。
- 禁止"跳过 step / 直达 step"的工具（`advanceToStep/skipToStep/fastForward`）。
- 禁止 helper 自动清除 gate（`pendingRevealAcks`、`wolfRobotHunterStatusViewed`、`isAudioPlaying` 等）。
- 禁止 helper 自动发送确认类消息（`REVEAL_ACK`、`WOLF_ROBOT_HUNTER_STATUS_VIEWED` 等），必须由测试用例显式发送。
- 必须 fail-fast：`sendPlayerMessage()` / `advanceNight()` 失败立刻抛错（含 stepId、seat、reason），禁止 warn / 吞失败 / 继续推进。
- 需要验证拒绝（reject）就显式断言 `{ success:false, reason }` 或抛错，不要把输入改成 skip 来绕开规则。

## Board UI Tests（`src/screens/RoomScreen/__tests__/boards-ui/**`）

### RoomScreenTestHarness（MUST）

- 必须实现并使用 `RoomScreenTestHarness`：拦截并记录所有 `showAlert/showDialog`（title/message/buttons/type）。
- 允许在测试环境 mock `src/utils/alert.ts` 的 `showAlert` 入口。
- 测试末尾必须做覆盖清单断言：缺任意弹窗类型/互动分支必须 fail。

### 最低覆盖

- Night-1 全流程涉及的 prompt / confirm / reveal / skip 等互动。
- 每新增/修改一个 Night-1 行动角色，至少覆盖：prompt / confirm /（如有）reveal + `REVEAL_ACK`。
- 额外 gate（如 `wolfRobotHunterStatusViewed`）必须在 UI test 中显式点击/发送并断言解除，禁止自动清 gate。
- nightmare 必须覆盖 blocked 的弹窗/拒绝路径，并断言对后续 UI 的影响（如 `wolfKillDisabled`）。

### 反作弊硬红线（不可协商 / MUST）

- **禁止跳过**：`src/screens/RoomScreen/__tests__/boards/**` 下禁止 `it.skip` / `test.skip` / `describe.skip`。CI 检测到 `\.skip\b` 直接 fail。
- **覆盖断言必须用字面量数组**：
  - ✅ `harness.assertCoverage(['actionPrompt', 'wolfVote', ...])`
  - ❌ `harness.assertCoverage(getRequired*DialogTypes(...))`
  - ❌ `harness.assertCoverage(requiredTypes)`（任何非字面量数组都视为可作弊）
- **难测分支不得移出 required 清单**：`confirmTrigger`、`skipConfirm`、`actionConfirm`、`wolfRobotHunterStatus`、`wolfRobotHunterStatusViewed` 等不可降级/移层，只能增强 mock/harness。

### Contract gate 防漏测

- 必须存在 contract test：强制"板子 × 必需弹窗类型"覆盖清单全部满足，漏任意一个直接 fail。
- required 清单必须 schema/steps 驱动（来自 `SCHEMAS` / `NIGHT_STEPS`），禁止手写散落硬编码。

## Resolver Unit Tests

- 必须覆盖：happy path、nightmare 阻断、schema 约束拒绝、边界条件。
- 使用纯函数调用，禁止 mock service 或 IO。

## 终端输出规范（MUST follow）

- **跑测试（Jest / Playwright / tsc 等）时，禁止用 `| grep`、`| head`、`| tail` 截断输出。** 必须看完整结果，避免遗漏错误或误判通过。
- 只有在非测试场景（如查看日志、搜索代码）中，才允许使用 `grep` 过滤。
- **跑 Playwright 时必须加 `--reporter=list`**（例如 `npx playwright test ... --reporter=list 2>&1`）。项目 `playwright.config.ts` 默认 reporter 是 `html`，跑完后会启动 HTTP server 展示报告并阻塞终端，导致命令永远不会退出。

## 质量门禁（Quality gates）

- 格式化/静态检查：修改代码后必须跑 ESLint/Prettier，确保 0 errors。
- 合约测试必须覆盖：`NIGHT_STEPS` 引用有效性（`roleId`、`SchemaId`）、Step ids 顺序确定性（snapshot）与唯一性、Night-1-only 红线、`audioKey` 非空。
- E2E 仅 smoke：核心 e2e 必须 `workers=1`，房间就绪必须用 `waitForRoomScreenReady()`。

## E2E 测试规范（Playwright）

### Artifacts & 调试（社区标准）

调试失败测试依赖 Playwright 内建机制，**不转发浏览器 console 到 stdout**：

- `trace: 'retain-on-failure'` — 失败时自动生成 trace（含完整 console / 网络 / DOM 快照），用 `npx playwright show-trace` 查看。
- `screenshot: 'only-on-failure'` — 失败时自动截图。
- `testInfo.attach(name, { body, contentType })` — 在 test body 中附加截图/文本/JSON 到 HTML report。
- `setupDiagnostics()` 只转发 `[DIAG]` 和 `error` 级别的浏览器日志，其余静默收集到 `DiagnosticData`。
- ❌ 禁止维护 log prefix 过滤列表。
- ❌ 禁止在 diagnostics helper 中加 quiet/verbose 开关。

### 日志规范（社区标准）

E2E spec 中 **禁止 `console.log`**，用 Playwright 内建方式替代：

| 场景       | ❌ 禁止                                      | ✅ 替代                                                                                                  |
| ---------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 流程标记   | `console.log('[rejoin] Host reloading...')`  | `await test.step('Host reloading page', async () => { ... })`                                            |
| 数据输出   | `console.log('[NightRoles] roleMap:', data)` | `await testInfo.attach('roleMap.json', { body: JSON.stringify(data), contentType: 'application/json' })` |
| 关键值记录 | `console.log('Seer reveal:', text)`          | `await testInfo.attach('seer-reveal.txt', { body: text, contentType: 'text/plain' })`                    |

- `test.step()` 自动出现在 HTML report 和 trace viewer 中，失败时可精确定位。
- `testInfo.attach()` 的内容在 HTML report 中可直接查看。
- E2E helpers（`e2e/helpers/**`、`e2e/pages/**`）中的 `console.log` 同样禁止，改用 `testInfo.attach` 或去掉。

### 禁止 `waitForTimeout`（Hard rule）

社区最佳实践：E2E 测试必须用事件驱动的等待，**禁止硬编码延时**。

- ❌ **禁止 `page.waitForTimeout(N)`**。
  - 硬编码延时导致"慢机 flaky / 快机浪费时间"。
  - ✅ 替代：`await expect(locator).toBeVisible({ timeout })` / `await locator.waitFor({ state: 'visible', timeout })` / `await expect(locator).toHaveText(expected)`。
  - ✅ **唯一例外：轮询间隔**（在 `while`/`for` retry loop 内做 poll cadence，**≤300ms**）。
  - ❌ 禁止在 retry loop 外使用 `waitForTimeout` 做"等一下再检查"。
  - ❌ 禁止用 `waitForTimeout` 等动画完成 / UI 去抖 / React re-render —— 改用 `expect(locator).toHaveText()` 或 `locator.waitFor()` 等事件驱动方式。

- ❌ **禁止 `.isVisible({ timeout: N })`（N > 0）**。
  - Playwright 的 `locator.isVisible()` **不接受 timeout 参数**——即使传了也会被静默忽略，立即返回当前可见性。
  - 这是一个常见误用：代码看起来像"等待 N 毫秒看是否出现"，实际瞬间返回。
  - ✅ 替代（需要等待）：`await locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)`。
  - ✅ 替代（瞬间检查）：`await locator.isVisible()`（不传参数）。
  - ✅ 在轮询循环内做快速检查时，`isVisible()` 不传参数是合理的。

## 修复与审计规范

- 修 bug 优先根因修复；修复后回滚基于错误假设的过时 patch，避免补丁叠补丁。
- 禁止无证据宣称"已修复"：非 trivial 必须给 commit hash、修改文件、关键符号、行为变化、验证结果（typecheck/Jest/e2e）。
