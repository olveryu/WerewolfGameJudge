---
applyTo: "**/*.test.ts,**/*.test.tsx,**/__tests__/**"
---

# 测试规范

## 通用规则

- 禁止 `it.skip` / `test.skip` / `describe.skip`（CI 会检测到并 fail）。
- 测试断言必须基于 `BroadcastGameState` 单一真相，禁止直接改 state / 注入 host-only 状态。
- 禁止用 snapshot/Storybook 截图替代交互覆盖。

## Integration Board Tests（`src/services/__tests__/boards/**`）

- 必须跑真实 NightFlow（按 `NIGHT_STEPS` 顺序逐步执行）。
- 禁止"跳过 step / 直达 step"的工具（`advanceToStep/skipToStep/fastForward`）。
- 禁止 helper 自动清除 gate（`pendingRevealAcks`、`isAudioPlaying` 等）。
- 必须 fail-fast：`sendPlayerMessage()` / `advanceNight()` 失败立刻抛错。

## Board UI Tests（`src/screens/RoomScreen/__tests__/boards-ui/**`）

- 必须使用 `RoomScreenTestHarness`，拦截并记录所有 `showAlert/showDialog`。
- 最低覆盖：Night-1 全流程的 prompt / confirm / reveal / skip。
- 覆盖断言必须用字面量数组，禁止动态生成。

## Resolver Unit Tests

- 必须覆盖：happy path、nightmare 阻断、schema 约束拒绝、边界条件。
- 使用纯函数调用，禁止 mock service 或 IO。

## 日志

- 测试文件中允许 `console.*`（例外：`__tests__/**`）。
