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
- ✅ 被阻断时返回 `{ valid: true, result: {} }`（有效但无效果）。
- ✅ 校验必须与 `SCHEMAS[*].constraints` 完全一致（双向）：schema 规定 `notSelf` → resolver 必须拒绝；schema 允许 → resolver 不得拒绝。
- ✅ `wolfKillDisabled` 单一真相：在 `handlePlayerAction` 中 nightmare 阻断狼时设置，`toBroadcastState` 直接读取。
- ❌ 禁止 resolver 中做 IO（网络请求、音频播放、Alert 等）。

## 状态管理

- ✅ `BroadcastGameState` 是唯一真相，Host 与 Player 读同一份 state。
- ✅ 新增字段必须同步到 `src/services/engine/state/normalize.ts` 的 `normalizeState`。
- ❌ 禁止 `HostOnlyState` 或不广播的字段。

---

## Resolver 集成架构（Resolver Integration Architecture）

```
ACTION (UI submit)
    │
    ▼
GameStateService.handlePlayerAction()
    │
    ├─ 1. buildActionInput() — 从 wire protocol 构建 ActionInput
    │
    ├─ 2. invokeResolver() — 调用 Resolver 纯函数
    │      └─▶ 返回 { valid, rejectReason?, updates?, result? }
    │
    ├─ 3. 如果 !valid → 拒绝，广播 actionRejected
    │
    └─ 4. 如果 valid → applyResolverResult()
           ├─ 合并 updates → state.currentNightResults
           ├─ 设置 reveal 结果 (seerReveal, psychicReveal, etc.)
           └─ 记录 action → state.actions
    │
    ▼
advanceToNextAction()
```

**关键原则：**

- Resolver 是唯一验证与计算逻辑来源：Host 不允许做业务逻辑"二次计算"。
- `currentNightResults` 在步骤间传递并累积结果（例如 nightmare block → `wolfKillDisabled`）。
- reveal 结果必须从 resolver 返回值读取：Host 不允许自行推导/重复计算。

---

## 夜晚流程（Night Flow）

### Night Flow Handler 不变量（invariants）

- `nightFlowHandler` / `stepTransitionHandler` 是夜晚推进的单一真相。
- 当 `isHost === true` 且 `state.status === ongoing` 时，夜晚流程必须处于活跃状态（违反则 fail-fast）。
- 禁止手动推进 index（`++` 兜底策略是禁止的）。
- phase 不匹配事件必须是幂等 no-op（仅 debug）。

### 自动推进（auto-advance）硬性护栏

- ❌ 禁止在 Facade / UI / submit 成功回调里做"自动推进夜晚"决策 — 会导致推进权威分裂、重入、Host/Player drift。
- ✅ 自动推进必须集中在 Host-only 的 night flow handler，基于 `BroadcastGameState` 判断。
- ✅ 必须幂等：同一 `{revision, currentStepId}` 最多推进一次；重复触发 safe no-op。
- Facade 仅限"发起 intent / request"，不得自行计算"should advance"。

### NightPlan 表驱动单一真相

- Night-1 推进顺序来自 `NIGHT_STEPS`（`src/models/roles/spec/nightSteps.ts`）。
- 数组顺序是权威顺序，step id 必须是稳定 `SchemaId`。
- 禁止重新引入 `night1.order` 或平行 `ACTION_ORDER`。
- Plan builder 遇到非法 `roleId` / `schemaId` 时必须 fail-fast。

---

## 音频时序（Audio Sequencing）

### 音频时序单一真相

- Night-1 的 `audioKey` / `audioEndKey` 必须来自 `NIGHT_STEPS`。
- 禁止在 specs/steps 双写 audio key。

### 音频时序分层架构

单一编排来源：**Handler 声明 → Facade 执行 → UI 只读**。

- **Handler**（Host-only 业务状态机）：声明"何时播何音频"，通过 `SideEffect: { type: 'PLAY_AUDIO' }` 返回。禁止音频 IO、禁止碰 UI。
- **Facade**（Host-only 编排/IO）：执行 `PLAY_AUDIO` 副作用 — `setAudioPlaying(true)` → 播放 → `finally { setAudioPlaying(false) }`。只允许 Facade 调用 `setAudioPlaying`。
- **UI**（RoomScreen）：只读 `isAudioPlaying` 禁用交互。
  - ❌ 禁止 `useEffect` 主动播放音频。
  - ❌ 禁止 UI toggle `setAudioPlaying`。

### 音频 Gate（`isAudioPlaying`）硬性护栏

- `isAudioPlaying` 是事实状态，不是推导状态。
- 唯一允许修改的 action：`SET_AUDIO_PLAYING`。
  - ✅ `handleSetAudioPlaying`（Host-only）→ reducer 处理。
  - ❌ 禁止在其他 action 中"顺便"设置 `isAudioPlaying`（会导致 drift/卡死）。
- Player 端绝对不能写 Gate。
- Fail-fast：若 `isAudioPlaying===true` 持续不释放导致行动被拒绝 → 优先修复 Host 兜底链路，补 E2E/contract fail-fast。

---

## Anti-drift 护栏

### `normalizeState` 同步规则

- Host 需要某字段 → 该字段必须属于 `BroadcastGameState`。隐私是 UI 层问题（按 `myRole`/`isHost` 过滤），不是数据模型问题。
- 派生字段必须从同一份 state 计算，或只写入 `BroadcastGameState` 一次（禁止双写/漂移）。

当向 `BroadcastGameState`（或其子结构）新增字段时：

1. **必须检查 `src/services/engine/state/normalize.ts`** — `normalizeState` 显式列出所有要保留的字段，遗漏会被静默丢弃。
2. **必须把新字段加到 `normalizeState` 返回值**。
3. **测试门禁**：新增字段后，验证 Host→Player 广播后字段仍存在。

> 高频 bug 源：reducer 正确设置了字段，但 `normalizeState` 没透传 → 广播后变 `undefined`。
