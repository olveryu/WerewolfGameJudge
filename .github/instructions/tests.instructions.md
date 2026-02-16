```instructions
---
applyTo: '**/*.test.ts,**/*.test.tsx,**/__tests__/**,e2e/**'
---

# 测试规范

## 通用规则

- 禁止 `console.*`（Jest 断言失败自动输出 diff；E2E 有 trace + testInfo.attach）。如需全局拦截，`jest.setup.ts` 中配置 console spy。
- 禁止 `it.skip` / `test.skip` / `describe.skip`（CI 检测到直接 fail）。
- 测试断言基于 `BroadcastGameState` 单一真相，禁止直接改 state / 注入 host-only 状态。
- 测试文件允许 `as` 构造 mock 数据。允许 mock `src/utils/alert.ts` 的 `showAlert`。
- Jest mock game-engine 模块用包路径 `@werewolf/game-engine/...`，禁止相对路径 mock 存根。静态分析测试从 `packages/game-engine/src/` 读取源文件。
- 跑测试禁止 `| grep` / `| head` / `| tail` 截断输出。Playwright 必须加 `--reporter=list`。
- 修 bug 优先根因修复，回滚过时 patch。禁止无证据宣称"已修复"：需给 commit hash、修改文件、验证结果。

## Integration Board Tests（`boards/**`）

跑真实 NightFlow，按 `NIGHT_STEPS` 顺序逐步执行。禁止 advanceToStep / skipToStep / fastForward。禁止 helper 自动清 gate（`pendingRevealAcks`、`isAudioPlaying` 等）或自动发送确认消息（`REVEAL_ACK` 等），必须由测试用例显式发送。`sendPlayerMessage()` / `advanceNight()` 失败必须 fail-fast（含 stepId、seat、reason），禁止 warn / 吞失败。

## Board UI Tests（`boards-ui/**`）

- 必须使用 `RoomScreenTestHarness` 拦截 showAlert / showDialog。测试末尾覆盖清单断言。
- 覆盖断言必须用字面量数组（`harness.assertCoverage(['actionPrompt', 'wolfVote', ...])`），禁止变量/函数生成。
- 难测分支（`confirmTrigger` / `skipConfirm` / `wolfRobotHunterStatus` 等）不得移出 required 清单。
- Contract test 强制"板子 × 弹窗类型"全覆盖，required 清单 schema/steps 驱动（`SCHEMAS` / `NIGHT_STEPS`），禁止手写硬编码。

## Resolver Unit Tests

覆盖：happy path、nightmare 阻断、schema 约束拒绝、边界条件。纯函数调用，禁止 mock service。

## 质量门禁

合约测试覆盖：`NIGHT_STEPS` 引用有效性（roleId、SchemaId）、step ids 唯一性、Night-1-only 红线、audioKey 非空。格式化/静态检查必须 0 errors。

## E2E（Playwright）

调试依赖内建机制（`trace: 'retain-on-failure'` + `screenshot: 'only-on-failure'`），不转发浏览器 console 到 stdout。

- `setupDiagnostics()` 只转发 `[DIAG]` 和 error 级别浏览器日志。禁止维护 log prefix 过滤列表，禁止 quiet/verbose 开关。
- E2E spec / helpers / pages 中禁止 `console.log`，用 `test.step()` 标记流程，`testInfo.attach()` 附加数据到 HTML report。
- 禁止 `page.waitForTimeout(N)`（唯一例外：轮询循环内 ≤300ms cadence），用 `expect(locator).toBeVisible()` / `locator.waitFor()` 等事件驱动等待替代。
- 禁止 `.isVisible({ timeout: N })`（Playwright 静默忽略 timeout 参数，瞬间返回）。需等待用 `locator.waitFor({ state: 'visible', timeout })`。
- E2E 必须 `workers=1`，房间就绪用 `waitForRoomScreenReady()`。

```
