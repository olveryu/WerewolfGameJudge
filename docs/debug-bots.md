# Debug Bots（填充机器人 + Host 接管代发）方案说明

> 目的：把“fill with bot（占位不行动）+ Host 可一键就绪 + 可接管 bot seat 代发行动 + Host 直接看到 bot 身份”的完整方案写成**单一施工依据**，方便后续交给对面 agent 落地。
>
> 适用范围：本仓库当前玩法边界（Host 权威、离线本地、Night-1-only、`BroadcastGameState` 单一真相、无私聊/无 PRIVATE_EFFECT）。

---

## ✅ 0. 术语与约束（必读）

- **Host 权威**：所有规则校验与状态推进由 Host 执行，Player 端仅 transport。
- **单一真相**：所有必要字段必须在 `BroadcastGameState` 中广播，UI 只做按 `myRole/isHost` 过滤展示。
- **Debug-only**：所有 bot 相关能力必须由显式 debug 开关控制；正常模式下不出现 UI、不会改动任何状态。
- **RoomScreen 交互三层**：Presentational（只渲染上报 intent）→ Policy（纯逻辑）→ Orchestrator（执行副作用）。
- **禁止组件吞点击**：`components/**` 下不得用 `disabled` 阻断 `onPress`，不得在 `onPress` 里用 `if (...) return` 充当业务 gate。

---

## 🎯 1. 目标 / 非目标

### 1.1 目标

1. 在 Host 端（`isHost`）提供 **“填充机器人”** 按钮：补满空座到 12 人（或当前 board 约定人数）。
2. Bot 仅用于占位与调试：
   - `isBot: true`
   - 不会自动提交任何 action
   - Host 可选择接管某个 bot seat 进行代发
3. Host 在 debug bots 模式下：
   - 不需要 view role 12 次
   - **能直接看到 bot 的身份（角色）**
   - 可以一键将所有 bot 标记为 `hasViewedRole=true`（仅 bot 生效）以通过 `assigned → ready` gate
4. 代发行动应复用既有 Action 提交流程与校验（包括 seat/role gate），不引入并行消息协议。

### 1.2 非目标（明确不做）

- 不实现 bot 的 AI 行为（不投票、不选人、不自动确认）。
- 不新增跨夜记忆与状态（Night-1-only）。
- 不改变现有正常模式流程与 UX（debug 关闭时完全不可见）。
- 不绕过现有 role/seat 校验逻辑（必须通过既有 gate）。

---

## 🧱 2. Debug 模式边界（Single switch）

### 2.1 状态字段（BroadcastGameState）

在 `BroadcastGameState` 增加可选字段：

```ts
// BroadcastGameState
export type BroadcastGameState = {
  // ...existing fields...
  debugMode?: {
    botsEnabled: boolean; // 是否启用机器人占位
  };
};
```

### 2.2 开关规则（硬要求）

- 只有当 `debugMode?.botsEnabled === true` 时，才允许：
  - 创建 bot 玩家
  - UI 显示 bot 角色
  - UI 显示接管/解除接管按钮
  - 一键标记 bots `hasViewedRole`
  - `controlledSeat` 体系启用
- `debugMode` 必须是广播状态的一部分（Host/Player shape 一致）。

---

## 🧬 3. Wire 协议 / 数据结构

### 3.1 BroadcastPlayer 增加 isBot（可选）

```ts
export type BroadcastPlayer = {
  // ...existing fields...
  isBot?: boolean;
};
```

#### 兼容性

- `isBot` 与 `debugMode` 均为 optional：老客户端忽略即可。
- 实现时要求：`broadcastToLocalState` 等映射必须透传这些字段（否则 Host UI 读不到）。

---

## 🧭 4. 用户流程（Host debug bots）

### 4.1 未入座（unseated）阶段

- 条件：`isHost && status === 'unseated'`
- UI：显示按钮 **“填充机器人”**
- 点击后：发送 intent/action → Host reducer/handler 执行 `fillWithBots`：
  - 对所有空 seat 创建 bot player
  - `debugMode.botsEnabled = true`

### 4.2 分配角色（assigned）阶段

- 条件：`debugMode?.botsEnabled && status === 'assigned'`
- UI：显示按钮 **“机器人已就绪”**（一键标记 bots 已看牌）
- 点击后：执行 `markAllBotsViewedRole`：
  - 仅对 `player.isBot === true` 的玩家写入 `hasViewedRole = true`
  - human 玩家不变

### 4.3 接管 seat（controlledSeat）

- 条件：`isHost && debugMode?.botsEnabled && player.isBot`
- UI（SeatTile）：显示 **“接管/解除接管”** 按钮
- 接管后：Host 的本地 UI state `controlledSeat = seatNumber`
- 顶部 banner：显示“正在操控 X 号位（机器人）[回到自己]”

### 4.4 代发行动提交

- 当 `controlledSeat != null` 时：Host 在 RoomScreen 上的所有 action 提交，按 `effectiveSeat = controlledSeat` 发送。
- action payload 的 `role` 也必须来自 `players[effectiveSeat].role`（关键！否则会触发 `role_mismatch` gate）。

---

## 🖥️ 5. UI 展示规范

### 5.1 SeatTile 增加 bot 角色小字（Host-only）

仅当：`isHost && debugMode?.botsEnabled && player.isBot` 时显示：

```
角色：狼人
```

> 注意：这是 debug-only UI 展示。**不改 `hasViewedRole`**，也不改变正常看牌流程。

### 5.2 SeatTile 的接管按钮（走 policy）

- SeatTile 只负责上报 intent：`onPressTakeover(seat)`
- 不允许在 SeatTile 内写 gate（比如 `if (!debug) return`）。
- gate 判断与提示在 policy 层做。

### 5.3 HostControlButtons（debug-only）

- “填充机器人”：仅 `isHost && status === 'unseated'` 可见
- “机器人已就绪”：仅 `isHost && debugMode?.botsEnabled && status === 'assigned'` 可见

---

## 🧩 6. RoomScreen 交互链路（Policy/Orchestrator 合约）

### 6.1 新增 intent / instruction（示意）

- intent：`TAKEOVER_BOT_SEAT(seat)` / `RELEASE_TAKEOVER()`
- policy 输出 instruction：
  - `NOOP`
  - `ALERT({ title, message })`
  - `TAKEOVER_BOT_SEAT({ seat })`
  - `RELEASE_TAKEOVER()`

### 6.2 Policy 必须包含的 guard

1. debug 未开启 → `ALERT/NOOP`
2. seat 不存在玩家 / 玩家不是 bot → `ALERT`
3. 当前已接管该 seat → 输出 `RELEASE_TAKEOVER`（toggle 语义）

---

## 🧠 7. controlledSeat 规则（Local UI state）

### 7.1 状态定义

- `controlledSeat: number | null`
  - `null` 表示操控自己（默认）
  - 非 null 表示操控对应 seat（必须是 bot）

### 7.2 关键 guard

- controlledSeat 只能指向 `player.isBot === true` 的 seat。
- 若目标 seat 变成 human（极少见，调试态变更）应自动释放或提示。

---

## ✅ 8. Action 提交契约（必须锁死）

### 8.1 为什么必须“seat 和 role 一起跟随 effectiveSeat”

仓库中存在校验（示例位置仅说明思路）：

```ts
if (player.role !== role) {
  return { valid: false, result: { success: false, reason: 'role_mismatch', actions: [] } };
}
```

因此当 Host 代发 bot 行动时：

- action payload 必须使用：
  - `seat = effectiveSeat`
  - `role = players[effectiveSeat].role`

> 只改 seat 不改 role 会稳定触发 `role_mismatch` 被拒绝。

### 8.2 提交行为的 “最小改动”建议

- 在 `useGameRoom.submitAction/submitWolfVote` 里统一计算：
  - `effectiveSeat = controlledSeat ?? mySeatNumber`
  - `effectiveRole = gameState.players[effectiveSeat]?.role`

如果 `effectiveRole` 缺失：直接 policy/guard 拒绝（否则会变成 undefined 行为）。

---

## 🛠️ 9. Host 状态变更（Reducer/Handler）

### 9.1 fillWithBots

**输入**：无（或可选目标人数）
**输出**：更新 `players[]`、设置 `debugMode.botsEnabled=true`

规则：

- 只允许 `isHost && status === 'unseated'` 时执行（否则 reject/no-op + 可观测 reason）
- 只填充空位，不覆盖已有 human
- 新建 bot player 最少字段：
  - `isBot: true`
  - `name`（例如 `Bot-1`）
  - 任何 reducer 已要求的字段（保持 player shape 完整）

### 9.2 markAllBotsViewedRole

规则：

- 只允许当 `debugMode?.botsEnabled === true && status === 'assigned'`
- 仅对 `isBot === true` 的玩家：`hasViewedRole = true`
- human 玩家不变

---

## 🧪 10. 测试计划（最低交付门禁）

> 目标：锁死 debug-only 边界，确保不会污染正常模式，确保 bot viewedRole 只影响 bot。

### 10.1 Contract tests（必须）

新增：`src/services/engine/handlers/__tests__/debugBots.contract.test.ts`

必须覆盖：

1. `fillWithBots` 后：
   - `debugMode.botsEnabled === true`
   - 新增的 player 均 `isBot: true`
   - 原有 human 不被覆盖
2. `markAllBotsViewedRole`：
   - bot 的 `hasViewedRole` 变为 true
   - human 的 `hasViewedRole` 不变
3. debug 未开启/状态不对时调用 `markAllBotsViewedRole`：必须 reject（fail-fast），并且 reject reason 可断言

### 10.2 UI-level tests（建议最小集）

若你改动 RoomScreen UI：至少补 1 个 UI test 确保：

- debug 按钮只在 host + 对应 status 出现
- 未开启 debug 不显示“角色：xxx/接管按钮”

---

## ⚠️ 11. 风险与回滚

### 11.1 风险

- **状态污染风险**：误把 human 的 `hasViewedRole` 改成 true，会改变正常流程 gate。
- **role_mismatch 风险**：只改 seat 不改 role 会导致代发 action 全部被拒。
- **UI drift 风险**：若 SeatTile 里直接 gate/disabled，会与 policy 决策漂移，难测。

### 11.2 回滚策略

- 所有 debug 行为必须以 `debugMode?.botsEnabled` 为前置；回滚时可通过移除该开关入口保证能力不可达。
- 若出现破坏性问题，优先回滚：
  1. `markAllBotsViewedRole` 写 `hasViewedRole` 路径
  2. controlledSeat 代发路径
  3. fillWithBots（最后）

---

## 🚧 12. 实施顺序建议（给对面 agent 的施工 checklist）

1. 先加类型与 contract tests（红灯先行）
2. 实现 handler/reducer（让 contract 绿）
3. 加 UI：HostControlButtons（fill/ready）
4. 加 SeatTile debug 展示（角色小字 + 接管按钮）
5. 加 policy/orchestrator：controlledSeat toggle
6. 修改 `useGameRoom.submitAction/submitWolfVote`：seat+role 跟随 effectiveSeat
7. 跑全量门禁（format/typecheck/jest，必要时加 e2e smoke）

---

## ✅ 13. 验收标准（Definition of Done）

- Debug 关闭时：完全看不到 bot UI，且状态机/流程与以前一致。
- Debug 开启并 fill bots 后：
  - 空位被 bot 填满，host 能看到 bot 角色小字
  - 一键 bots ready 后，能顺利从 assigned 进入 ready（不要求 human 自动 ready）
  - 接管某 bot seat 后，代发 action 能通过 seat/role gate，不出现 `role_mismatch`
- 合同测试覆盖并全绿。
