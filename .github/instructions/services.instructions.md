```instructions
---
applyTo: src/services/**
---

# Service 层规范

## 源代码位置

游戏逻辑：`@werewolf/game-engine`（详见 `game-engine.instructions.md`）。客户端服务：`facade/`、`transport/`、`infra/`、`feature/`。

## 核心规则

- Resolver / calculator / validator 是纯函数，禁止 IO/UI。
- 服务端业务逻辑（night flow / death calc / state transition / reducer）由 Supabase Edge Functions 执行。
- 客户端 facade 负责：HTTP API 提交 + Realtime 接收 + 音频编排。客户端禁止运行 resolvers / reducers / death calculation。
- Infra service 允许平台 API（AsyncStorage / Platform / expo-audio 等）。
- 纯类型文件（`src/services/types/**`）可被任意层 `import type`。
- 禁止 `console.*`（使用命名 logger），禁止跨夜状态（`previousActions` / `lastNightTarget` 等）。
- SRP ~400 行拆分信号。超阈值先评估是否有独立复用/测试/修改场景，不机械套用。
- Wire protocol（`PlayerMessage` / `GameState`）必须保持兼容。

## Resolver 规范

- 输入 `ActionInput` + `ResolverContext`（含 `currentNightResults`），输出 `{ valid, rejectReason?, updates?, result? }`。
- 必须检查 nightmare 阻断：`blockedSeat === actorSeat` → `{ valid: true, result: {} }`（有效但无效果）。
- 校验必须与 `SCHEMAS[*].constraints` 双向一致：schema 规定 `notSelf` → resolver 拒绝；schema 允许 → resolver 不得拒绝。
- Resolver 是唯一验证与计算逻辑来源，Host 不做"二次计算"，reveal 结果必须从 resolver 返回值读取。

## 状态管理 & Anti-drift

- `GameState` 是唯一真相。禁止 `HostOnlyState` 或不广播字段。Host/Player state shape 完全一致。
- 新增字段必须同步 `normalizeState`（`packages/game-engine/src/engine/state/normalize.ts`），遗漏会被静默丢弃。
- 派生字段从同一份 state 计算或只写入一次，禁止双写/drift。

## 乐观更新（Optimistic Update）

- 仅对**客户端可完美预测结果**的操作使用乐观更新（社区标准：only optimistically update what you can perfectly predict）。
- 适用：view-role / set-animation / update-template。
- 不适用：sit / standup（低频操作，靠 HTTP 响应 applySnapshot 即时渲染；乐观更新曾因广播竞态导致 state 脱轨）、涉及 RNG（assign）、多方聚合（wolfVote）、状态机推进（start / night actions / progression）、副作用链（restart）。
- 机制：`callGameControlApi` / `callSeatApi` 接受可选 `optimisticFn`，fetch 前 `store.applyOptimistic()`，服务端响应后 `applySnapshot` 覆盖，失败时 `rollbackOptimistic()`。座位操作（sit / standup）不传 `optimisticFn`。
- 新增操作时必须评估是否适合乐观更新，不确定则不加。

## 夜晚流程

- `nightFlowHandler` / `stepTransitionHandler` 是推进的单一真相。禁止手动推进 index。
- Night-1 顺序来自 `NIGHT_STEPS`（表驱动），step id = 稳定 `SchemaId`。禁止重新引入 `night1.order` 或平行 `ACTION_ORDER`。
- 自动推进集中在 night flow handler（服务端），必须幂等（同一 `{revision, currentStepId}` 最多推进一次）。Facade 仅发起 intent，禁止自行计算 "should advance"。
- phase 不匹配事件必须是幂等 no-op。Plan builder 遇到非法 `roleId` / `schemaId` 时 fail-fast。

## Room Transition Cleanup

持有可变状态的 service（flags / players / subscriptions）必须在 `createRoom` / `joinRoom` / `leaveRoom` 重置**全部**可变字段。AudioService 必须先 `stop()` 再 `clearPreloaded()`。遗漏 = 上一局状态泄漏到下一局。

## HTTP 响应防御

`fetch` 后必须先检查 `res.ok` + `content-type` 含 `application/json`，再调 `.json()`。非 JSON 响应（502/503 HTML）返回结构化错误（`{ success: false, reason: 'SERVER_ERROR' }`），不让 `SyntaxError` 传播到 Sentry。

## Native 资源生命周期

expo-audio `AudioPlayer` 等原生资源被替换时必须 track 旧实例，在 `cleanup()` / `clearPreloaded()` 集中 `remove()`。仅 `pause()` 不释放原生内存。Web `HTMLAudioElement` 由浏览器 GC 回收，清引用即可。

## Promise 必达

`new Promise()` 构造器必须保证所有路径（成功/错误/取消/stop）都 `resolve` 或 `reject`。`stopCurrentPlayer()` 等中断操作必须 settle 正在进行的 playback promise，禁止 dangling promise。

## 音频编排

单一编排来源：Handler 声明 → Facade 执行 → UI 只读。

- **Handler**（服务端）：写入 `pendingAudioEffects`，`audioKey` / `audioEndKey` 来自 `NIGHT_STEPS`，禁止 specs/steps 双写。禁止音频 IO。
- **Facade**（客户端）：reactive 监听 store 中 `pendingAudioEffects` → 播放 → `postAudioAck` 释放 gate。Wolf vote deadline 到期后 `postProgression` 触发推进（一次性 guard 防重入）。
- **UI**：只读 `isAudioPlaying`。禁止 useEffect 播放音频、禁止 UI toggle `setAudioPlaying`。
- `isAudioPlaying` 是事实状态，唯一修改途径：`SET_AUDIO_PLAYING` action。禁止其他 action "顺便"设置。
- **Rejoin 恢复**：`joinRoom(isHost=true)` 从 DB 恢复 → `ContinueGameOverlay` 用户手势（Web autoplay 需手势解锁）→ `resumeAfterRejoin()` 重播当前 step 音频 → `postAudioAck`。禁止 useEffect 自动触发。
- **Audio-ack 断线重试**（两层互斥）：
  - **L1: Status listener** — WebSocket 真正断开后 SDK 重连 → `ConnectionStatus.Live` → 重试 `postAudioAck`。覆盖真实网络断开。
  - **L2: Browser `online` event** — `window.addEventListener('online', ...)` 零延迟感知网络恢复 → 重试 `postAudioAck`。覆盖 WebSocket 未断但 HTTP 断了的场景（如 Playwright `setOffline`、短暂 DNS 故障）。仅 Web 平台（`typeof globalThis.window?.addEventListener === 'function'` 能力检查），原生端由 L1 覆盖。
  - 两层谁先触发清除对方，`leaveRoom` / `createRoom` / `joinRoom` 统一清理。

```
