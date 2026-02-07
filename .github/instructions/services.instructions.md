---
applyTo: src/services/**
---

# Service 层规范

## 核心原则

- ✅ 纯函数 resolver / calculator / validator（无副作用、不碰 IO/UI）。
- ✅ Host-only 业务逻辑（night flow / death calc / state transition / reducer）。
- ✅ 使用 `src/utils/logger.ts` 的命名 logger 打日志。
- ✅ Infra service 允许 import 平台 API（`AsyncStorage`、`Platform`、`expo-audio` 等）。
- ✅ 纯类型文件（`src/services/types/**`）可被任意层 `import type`。
- ❌ 禁止在 resolver / calculator / validator 中做 IO（网络请求、音频、Alert 等）。
- ❌ 禁止 import UI 组件或 React hooks（infra service 中 `Platform` 等平台 API 除外）。
- ❌ 禁止 `console.*`（使用命名 logger）。
- ❌ 禁止跨夜状态（`previousActions`、`lastNightTarget` 等）。
- **单一职责（SRP）**：每个 module/class 只负责一件事。超过 ~400 行必须拆分。
  - **但行数是信号，不是判决。** 超过阈值时，先评估：(1) 文件内部是否已有清晰的分区和职责边界？(2) 拆出的模块是否有独立的复用/测试/修改场景？(3) 拆分后跨文件跳转成本是否超过收益？若三项都不成立，应保持现状并注释说明为何不拆。禁止机械套用行数规则无条件输出拆分方案。

## Player 端禁止运行业务逻辑

Player 客户端绝对不能执行：resolvers、reducers/state transitions、death calculation、night flow progression。
Player 仅作为 transport：发送 `PlayerMessage` → 接收 `HostBroadcast.STATE_UPDATE` → `applySnapshot(broadcastState, revision)`。

## Wire Protocol 稳定性（Transport protocol stability）

- on-wire protocol 必须保持兼容：`HostBroadcast`、`PlayerMessage`、`BroadcastGameState`。
- 可以引入内部 "Intent" 类型，但必须适配到现有 protocol。
- 除非同时提供兼容层 + 合约测试，否则禁止发明平行的消息协议。

## Resolver 规范

- ✅ 位于 `src/services/engine/night/resolvers/` 或 `src/services/night/resolvers/`。
- ✅ 输入：`ActionInput` + `ResolverContext`（含 `currentNightResults`）。
- ✅ 输出：`{ valid, rejectReason?, updates?, result? }`。
- ✅ 必须检查 nightmare 阻断：`currentNightResults.blockedSeat === actorSeat`。
- ✅ 校验必须与 `SCHEMAS[*].constraints` 完全一致。
- ❌ 禁止 resolver 中做 IO（网络请求、音频播放、Alert 等）。

## 状态管理

- ✅ `BroadcastGameState` 是唯一真相，Host 与 Player 读同一份 state。
- ✅ 新增字段必须同步到 `src/services/engine/state/normalize.ts` 的 `normalizeState`。
- ❌ 禁止 `HostOnlyState` 或不广播的字段。
