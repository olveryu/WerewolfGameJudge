```instructions
---
applyTo: src/services/**
---

# Service 层规范

## 源代码位置

游戏逻辑源代码在 `@werewolf/game-engine`（详见 `game-engine.instructions.md`）。`src/services/engine/`、`protocol/`、`night/resolvers/` 为 proxy stubs（仅一行 re-export）。`facade/`、`transport/`、`infra/`、`feature/` 仍在 `src/`。

## 核心规则

- Resolver / calculator / validator 是纯函数，禁止 IO/UI。
- 服务端业务逻辑（night flow / death calc / state transition / reducer）由 Vercel Serverless 执行。
- 客户端 facade 负责：HTTP API 提交 + Realtime 接收 + 音频编排。客户端禁止运行 resolvers / reducers / death calculation。
- Infra service 允许平台 API（AsyncStorage / Platform / expo-audio 等）。
- 纯类型文件（`src/services/types/**`）可被任意层 `import type`。
- 禁止 `console.*`（使用命名 logger），禁止跨夜状态（`previousActions` / `lastNightTarget` 等）。
- SRP ~400 行拆分信号。超阈值先评估是否有独立复用/测试/修改场景，不机械套用。
- Wire protocol（`HostBroadcast` / `PlayerMessage` / `BroadcastGameState`）必须保持兼容。

## Resolver 规范

- 输入 `ActionInput` + `ResolverContext`（含 `currentNightResults`），输出 `{ valid, rejectReason?, updates?, result? }`。
- 必须检查 nightmare 阻断：`blockedSeat === actorSeat` → `{ valid: true, result: {} }`（有效但无效果）。
- 校验必须与 `SCHEMAS[*].constraints` 双向一致：schema 规定 `notSelf` → resolver 拒绝；schema 允许 → resolver 不得拒绝。
- Resolver 是唯一验证与计算逻辑来源，Host 不做"二次计算"，reveal 结果必须从 resolver 返回值读取。

## 状态管理 & Anti-drift

- `BroadcastGameState` 是唯一真相。禁止 `HostOnlyState` 或不广播字段。Host/Player state shape 完全一致。
- 新增字段必须同步 `normalizeState`（`packages/game-engine/src/engine/state/normalize.ts`），遗漏会被静默丢弃。
- 派生字段从同一份 state 计算或只写入一次，禁止双写/drift。

## 乐观更新（Optimistic Update）

- 仅对**客户端可完美预测结果**的操作使用乐观更新（社区标准：only optimistically update what you can perfectly predict）。
- 适用：sit / standup / view-role / set-animation / update-template。
- 不适用：涉及 RNG（assign）、多方聚合（wolfVote）、状态机推进（start / night actions / progression）、副作用链（restart）。
- 机制：`callGameControlApi` / `callSeatApi` 接受可选 `optimisticFn`，fetch 前 `store.applyOptimistic()`，服务端响应后 `applySnapshot` 覆盖，失败时 `rollbackOptimistic()`。
- 新增操作时必须评估是否适合乐观更新，不确定则不加。

## 夜晚流程

- `nightFlowHandler` / `stepTransitionHandler` 是推进的单一真相。禁止手动推进 index。
- Night-1 顺序来自 `NIGHT_STEPS`（表驱动），step id = 稳定 `SchemaId`。禁止重新引入 `night1.order` 或平行 `ACTION_ORDER`。
- 自动推进集中在 night flow handler（服务端），必须幂等（同一 `{revision, currentStepId}` 最多推进一次）。Facade 仅发起 intent，禁止自行计算 "should advance"。
- phase 不匹配事件必须是幂等 no-op。Plan builder 遇到非法 `roleId` / `schemaId` 时 fail-fast。

## 音频编排

单一编排来源：Handler 声明 → Facade 执行 → UI 只读。

- **Handler**（服务端）：写入 `pendingAudioEffects`，`audioKey` / `audioEndKey` 来自 `NIGHT_STEPS`，禁止 specs/steps 双写。禁止音频 IO。
- **Facade**（客户端）：reactive 监听 store 中 `pendingAudioEffects` → 播放 → `postAudioAck` 释放 gate。Wolf vote deadline 到期后 `postProgression` 触发推进（一次性 guard 防重入）。
- **UI**：只读 `isAudioPlaying`。禁止 useEffect 播放音频、禁止 UI toggle `setAudioPlaying`。
- `isAudioPlaying` 是事实状态，唯一修改途径：`SET_AUDIO_PLAYING` action。禁止其他 action "顺便"设置。
- **Rejoin 恢复**：`joinRoom(isHost=true)` 从 DB 恢复 → `ContinueGameOverlay` 用户手势（Web autoplay 需手势解锁）→ `resumeAfterRejoin()` 重播当前 step 音频 → `postAudioAck`。禁止 useEffect 自动触发。

```
