# RoomScreen 交互架构重构：RoomInteractionPolicy 统一入口（设计文档）

> 状态：Draft（2026-02-01）  
> 范围：**仅涉及 RoomScreen 的交互决策架构**；不改变 Host-only 游戏逻辑权威、Night-1-only、BroadcastGameState 单一真相等既有红线。

## 目标与非目标

### 目标

1. **单一交互决策源（Single source of truth）**：RoomScreen 中所有用户交互（座位点击、底部按钮、查看身份、离开房间、各类确认/ack/gate）都经过同一个决策入口。
2. **纯函数可测**：交互决策必须是纯函数，可用单元测试锁定优先级与路由，防止回归。
3. **组件层不吞点击**：`components/**` 永远上报 intent，不在组件层使用 `disabled={true}` 阻断 onPress，也不在 `onPress` 内 `if (...) return` 作为业务 gate。
4. **优先级可证明**：`isAudioPlaying` gate 在 ongoing 阶段是最高优先级（除“安全出口”如 LEAVE_ROOM）。pending reveal / pending hunter 等 gate 的优先级由 contract tests 锁死。
5. **避免 drift**：任何交互 gate/判断只存在一份，不在 UI/Hook/RoomScreen 多处并行维护。

### 非目标（明确不做）

- 不重写 NightFlow / resolvers / death calculation。
- 不引入私聊/私有消息：仍严格遵守 BroadcastGameState 全公开。
- 不在 Supabase 侧存/校验任何游戏状态。
- 不跨夜：任何交互 policy 不引入跨夜记忆。

## 背景与动机

RoomScreen 的交互入口分散（seat tap、bottom action、host control、view role、leave room、reveal ack、wolfRobot gate 等），容易出现：

- 双 gate：组件层挡一层、RoomScreen/Hook 再挡一层 → 提示不一致/行为漂移。
- 优先级回归：audio gate 被 disabledReason 或其他提示抢先。
- 难测：交互逻辑散落在 hooks + JSX + handler，难用测试锁定。

因此引入“Policy / Orchestrator / Presentational”三层分工，并以 policy 为唯一决策来源。

## 核心概念

### 1) 事件与结果（事件驱动）

- **InteractionEvent**：用户做了什么（输入）
- **InteractionResult**：系统应该做什么（输出）

二者由 `src/screens/RoomScreen/policy/types.ts` 定义。

### 2) 交互上下文（纯数据）

Policy 只接收一个最小的 `InteractionContext`（例如：roomStatus、isAudioPlaying、pendingRevealAck、isHost、imActioner、myRole 等）。

- 必须是纯数据。
- 禁止塞进 callback、service、navigation、hook。

### 3) Gate 优先级（contract）

在 ongoing 阶段的交互优先级（低数字=更高优先级）：

1. **Audio gate**：`isAudioPlaying`（除 LEAVE_ROOM）
2. **No game state**：`hasGameState === false`
3. **Pending reveal ack**（除 LEAVE_ROOM）
4. **Pending hunter gate**（除 LEAVE_ROOM）
5. **Event routing**：按 event.kind 分发

必须用单测锁死（contract tests）。

## 分层架构（必须遵守）

### 1) Policy / Guard（纯逻辑层）

位置：`src/screens/RoomScreen/policy/**`

- ✅ 只做：`(ctx, event) => result`
- ✅ 可单元测试
- ❌ 禁止：showAlert/navigation/service 单例/React hooks/IO

主入口：`getInteractionResult(ctx, event)`

内部允许：复用已存在的纯策略（例如 SeatTapPolicy）。

### 2) Orchestrator（编排层）

位置：`src/screens/RoomScreen/RoomScreen.tsx`

- ✅ 只做：调用 policy → 执行副作用（showAlert / showDialog / submitAction / navigation 等）
- ❌ 禁止：在 orchestrator 再写一套与 policy 并行的 gate 判断

**单一入口**：`dispatchInteraction(event)`

### 3) Presentational UI（展示层）

位置：`src/screens/RoomScreen/components/**`

- ✅ 只做：渲染 + 上报 intent
- ❌ 禁止：组件层 gate/吞点击

要求：即使视觉上“disabled”，也必须上报事件，并把 disabledReason 作为数据上报，由 policy 决定 NOOP/ALERT。

## 当前落地状态（截至 2026-02-01）

### 已完成

- 新增 `RoomInteractionPolicy`（纯函数）与 types：
  - `src/screens/RoomScreen/policy/types.ts`
  - `src/screens/RoomScreen/policy/RoomInteractionPolicy.ts`
  - `src/screens/RoomScreen/policy/index.ts`
  - `src/screens/RoomScreen/policy/__tests__/RoomInteractionPolicy.test.ts`（31 tests，锁优先级）

- RoomScreen 已集成（迁移到 dispatchInteraction）
  - 已迁移：`SEAT_TAP` / `BOTTOM_ACTION` / `VIEW_ROLE` / `LEAVE_ROOM`
  - 未迁移：`HOST_CONTROL`（目前仍由 `HostControlButtons` props 直连执行；dispatchInteraction 对 HOST_CONTROL 仅 warn）

- Quality gates：`npm run typecheck` + `npm test --silent` 全绿（141 suites / 2206 tests）。

### 已知保留项（后续 PR）

- `HOST_CONTROL` 完整纳入 event → policy → dispatchInteraction 单一路径（消灭 props 直连副作用的平行路径）。
- Confirm/Skip/Ack/Gate 等更多交互入口统一纳入 policy。

## PR 分阶段计划（建议）

下面把每个 PR 拆成「目标 / 改什么 / 不改什么 / 测试门禁 / 验收标准」，确保可执行、可交接。

### PR2：核心入口迁移（当前这轮）

#### 目标

- 把**已迁移范围**的交互统一为**单入口**：`dispatchInteraction(event)`。

#### 改什么（必须）

- `src/screens/RoomScreen/RoomScreen.tsx`
  - 新增/完善 `interactionContext: InteractionContext`（useMemo）。
  - 新增 `dispatchInteraction(event: InteractionEvent)`：调用 `getInteractionResult(ctx, event)` 并 `switch(result.kind)` 执行副作用。
  - 将以下入口全部替换为 dispatch：
    - seat tap：`dispatchInteraction({ kind:'SEAT_TAP', ... })`
    - bottom action：`dispatchInteraction({ kind:'BOTTOM_ACTION', intent })`
    - view role：`dispatchInteraction({ kind:'VIEW_ROLE' })`
    - leave room：`dispatchInteraction({ kind:'LEAVE_ROOM' })`
  - `HOST_CONTROL`：**不得**通过 dispatch 执行业务逻辑（本 PR 仅允许 warn 防误用）。

- `src/screens/RoomScreen/policy/**`
  - 确保 policy 是纯函数：只 import types / 纯策略（例如 SeatTapPolicy）。
  - 确保 contract tests 锁死优先级。

#### 不改什么（必须保持）

- `HostControlButtons` 仍走 props 直连（暂不统一）。
- 不修改游戏逻辑（Host-only 权威不动）。

#### 测试门禁（必须）

- `npm run typecheck`
- `npm test --silent`

#### 验收标准（review checklist）

- RoomScreen 中这 4 类入口不再直接调用旧 handler，而是统一走 `dispatchInteraction`。
- `components/**` 没有新增 `disabled={...}` 吞点击或 `if (...) return` gate。
- policy tests 仍锁死：audio gate > 其他 gate > routing（并保留 LEAVE_ROOM 安全出口）。

---

### PR3：纳入 HOST_CONTROL（强烈建议尽快做）

#### 目标

- 消灭 Host 控制“props 直连副作用”的**平行路径**，让 HOST 控制也由 policy 做 gate 决策。

#### 改什么（必须）

- `src/screens/RoomScreen/RoomScreen.tsx`
  - `dispatchInteraction` 开启 `HOST_CONTROL` 的执行分支（由 policy 产出 `HOST_CONTROL` result 决定要执行什么）。

- `src/screens/RoomScreen/HostControlButtons.tsx`（或其调用点）
  - 从“直接传 props 执行副作用” → 改成“只上报 intent”。
  - 典型形态：
    - 以前：`onStartGamePress={showStartGameDialog}`
    - 以后：`onStartGamePress={() => dispatchInteraction({ kind:'HOST_CONTROL', action:'startGame' })}`
  - ⚠️ 仍然遵守：按钮不可在组件层吞点击（禁用只做视觉，点击要上报给 orchestrator）。

- `src/screens/RoomScreen/policy/RoomInteractionPolicy.ts`
  - `HOST_CONTROL` event routing + host-only gate：`!ctx.isHost => NOOP('host_only')`
  - audio gate / pending gate 仍必须优先。

#### 不改什么

- 不重构 HostControlButtons 的 UI 样式/布局。

#### 测试门禁（必须）

- policy 单测补齐：
  - `HOST_CONTROL` 在 `!isHost` 下必 NOOP(host_only)
  - `HOST_CONTROL` 在 audio gate / pending gate 下仍被 NOOP（优先级不变）
- `npm run typecheck`
- `npm test --silent`

#### 验收标准

- 代码库里不再存在“Host 控制既能走 props 又能走 dispatch”的双路径。
- `dispatchInteraction` 成为 Host 控制的唯一执行点。

---

### PR4：统一 Confirm / Skip / Ack / Gate（高价值，减少未来 bug）

#### 目标

- 把“对话框按钮 / ack / gate 解除”也纳入同一个 policy 入口，避免交互逻辑散落。

#### 改什么（建议按小步拆子 PR；但逻辑上同一阶段）

- `src/screens/RoomScreen/policy/types.ts`
  - 扩展 `InteractionEvent`：
    - `REVEAL_ACK`（按角色或按 schemaId）
    - `WOLF_ROBOT_HUNTER_STATUS_VIEWED`
    - （可选）`DIALOG_CONFIRM` / `DIALOG_CANCEL` / `SKIP_CONFIRM` 等
  - 扩展 `InteractionResult`：
    - 若需要新的 `SHOW_DIALOG` dialogType（例如 revealAck、hunterStatus 等）

- `src/screens/RoomScreen/policy/RoomInteractionPolicy.ts`
  - 将这些 event 纳入 routing。
  - gate 规则保持：audio > pending > routing。

- `src/screens/RoomScreen/RoomScreen.tsx`
  - 所有“确认/关闭/ack”按钮的 onPress 改为 `dispatchInteraction({ kind:'...' })`。
  - pending gate 的事实来源必须仍来自 `BroadcastGameState` 或 RoomScreen 的“UI 是否正在展示某 modal”的单一标志（避免双写）。

#### 测试门禁（必须，按 copilot-instructions）

- policy contract tests：新增事件也必须覆盖优先级。
- 如涉及 RoomScreen 弹窗/互动路径变化：必须保证 board UI tests + contract tests 全绿。

#### 验收标准

- RoomScreen 中不再有“某个 modal 的 confirm/skip/ack 在 local handler 里写 gate 判断”。
- pending reveal / pending hunter 等 gate 的触发与解除路径可测试、可推理。

---

### PR5：语义/命名/收尾清理（低风险）

#### 目标

- 把遗留的命名/语义不清处收敛，删掉旧路径残留，提升可维护性。

#### 改什么（可选）

- 若 `handleLeaveRoom()` 实际是“展示确认弹窗”，可改名为 `showLeaveRoomDialog()`（或在 policy/result 层更名对齐）。
- 清理不再使用的旧 handler / import / dead code。

#### 测试门禁

- `npm run typecheck`
- `npm test --silent`

#### 验收标准

- 没有行为改变（纯整理），测试全绿。
- 文档与代码一致。

## Contract：dispatchInteraction 的输入/输出约定

### 输入

- `InteractionEvent`：必须是纯数据。
- `InteractionContext`：只含决定所需的最小 state。

### 输出

- `InteractionResult`：
  - `NOOP { reason }`：不做任何副作用
  - `ALERT { title, message }`：弹窗
  - `SHOW_DIALOG { dialogType, seatIndex? }`：展示某种 dialog
  - `SEATING_FLOW { seatIndex }`
  - `ACTION_FLOW { intent? / seatIndex? }`
  - `HOST_CONTROL { action }`（当纳入 PR3 后）

## 风险与防回归策略

### 风险 1：产生双路径（drift）

- 例：HostControlButtons 继续走 props，同时 dispatchInteraction 也能触发 HOST_CONTROL。

对策：
- PR3 完成后：HostControlButtons 只发 event；props 直连删掉。
- policy + orchestrator 单测/约束锁定。

### 风险 2：组件层吞点击回归

对策：
- 代码 review 明确检查 `disabled={...}` + `if(...) return`。
- 未来可加 lint/contract test（可选）：扫描 RoomScreen components 里是否出现 `.skip`/disabled gate（按 copilot-instructions 的思路）。

### 风险 3：优先级回归

对策：
- policy contract tests 必须覆盖“audio gate 优先于 disabledReason / 其它 gate”。

## 与 `copilot-instructions.md` 的一致性

本方案与 `.github/copilot-instructions.md` 中“RoomScreen UI 交互架构（MUST follow）”一致：

- Policy / Orchestrator / Presentational 三层
- 禁组件层吞点击
- audio gate 优先级 contract tests

---

## 附：文件清单

- `src/screens/RoomScreen/policy/types.ts`：InteractionEvent/Result/Context + 优先级常量
- `src/screens/RoomScreen/policy/RoomInteractionPolicy.ts`：纯策略函数 `getInteractionResult`
- `src/screens/RoomScreen/policy/__tests__/RoomInteractionPolicy.test.ts`：优先级 contract tests
- `src/screens/RoomScreen/RoomScreen.tsx`：`dispatchInteraction(event)` 编排执行副作用

