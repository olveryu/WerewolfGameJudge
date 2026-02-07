---
applyTo: src/services/**
---

# Service 层规范

## 核心原则

- **单一职责（SRP）**：每个 module/class 只负责一件事。超过 ~400 行必须拆分。
- **纯函数优先**：resolver / calculator / validator 必须是纯函数，无副作用、不碰 IO/UI。
- **Host-only 逻辑**：resolver、reducer、state transition、death calculation、night flow progression 只在 Host 运行，Player 端绝对不执行。

## Player 端禁止运行业务逻辑

Player 客户端绝对不能执行：resolvers、reducers/state transitions、death calculation、night flow progression。
Player 仅作为 transport：发送 `PlayerMessage` → 接收 `HostBroadcast.STATE_UPDATE` → `applySnapshot(broadcastState, revision)`。

## Wire Protocol 稳定性（Transport protocol stability）

- on-wire protocol 必须保持兼容：`HostBroadcast`、`PlayerMessage`、`BroadcastGameState`。
- 可以引入内部 "Intent" 类型，但必须适配到现有 protocol。
- 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。

## Resolver 规范

- Resolver 位于 `src/services/engine/night/resolvers/` 或 `src/services/night/resolvers/`。
- 输入：`ActionInput` + `ResolverContext`（含 `currentNightResults`）。
- 输出：`{ valid, rejectReason?, updates?, result? }`。
- 必须检查 nightmare 阻断：`currentNightResults.blockedSeat === actorSeat`。
- 校验必须与 `SCHEMAS[*].constraints` 完全一致。

## 禁止项

- ❌ 禁止在 service 中 import UI 组件或 React hooks。
- ❌ 禁止 `console.*`（使用 `src/utils/logger.ts` 的命名 logger）。
- ❌ 禁止跨夜状态（`previousActions`、`lastNightTarget` 等）。
- ❌ 禁止在 resolver 中做 IO（网络请求、音频播放、Alert 等）。

## 状态管理

- `BroadcastGameState` 是唯一真相，Host 与 Player 读同一份 state。
- 新增字段必须同步到 `src/services/engine/state/normalize.ts` 的 `normalizeState`。
- 禁止 `HostOnlyState` 或不广播的字段。
