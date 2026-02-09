# 狼人投票：改票 / 撤回 / 倒计时 / 队友投票 Badge

> 状态：方案定稿，待实现
> 日期：2026-02-08

---

## 一、功能概述

| 功能 | 描述 |
|------|------|
| **改票（revote）** | 已投票狼人可重新点击座位改票，覆盖旧 vote |
| **撤回（withdraw）** | 已投票狼人可取消投票，回到未投状态 |
| **倒计时（countdown）** | 全部狼人投完后 5 秒倒数，改票/撤回重置倒数 |
| **队友投票 Badge** | 狼人视角下，队友座位显示 `→{目标}` 或 `→空刀` |

---

## 二、Wire 协议 — 狼人投票 target 语义

| Wire 值 | 含义 | Resolver 行为 | wolfVotesBySeat 变化 | Evaluator "done"? |
|---------|------|-------------|---------------------|-------------------|
| `>= 0` | 刀人 | 写入 `[seat]: target` | 新增/覆盖 key | ✅ |
| `-1` | 空刀 | 写入 `[seat]: -1` | 新增/覆盖 key | ✅ |
| `-2` | 撤回 | 删除 `[seat]` key | 删除 key | ❌ |

`-2` 全程不转换（不 map 到 `null`），端到端保持 `-2` 直到 resolver 处理。

### 端到端穿透验证

- `handleSubmitWolfVote`（actionHandler.ts L694）：`target === -1 ? null : target` → `-2 ≠ -1`，保持 `-2`
- `buildActionInput`（actionHandler.ts L74）：`target: target ?? undefined` → `-2` 非 null/undefined，保持 `-2`
- Resolver 收到 `input.target = -2`，新分支处理
- `buildSuccessResult`：wolf roles 不触发 reveals，只传 `updates`，安全

---

## 三、倒计时语义

**规则：改票 / 撤回均重置 5 秒。**

| 场景 | allVoted 之前 | allVoted 之后 | Timer 动作 |
|------|-------------|-------------|-----------|
| 最后一人投票 | false | true | **set** deadline + timer |
| 已全投完，某人改票 | true | true | **set**（重置：clear 旧 + 设新） |
| 已全投完，某人撤回 | true | false | **clear** timer + 清 deadline |
| 未全投完，某人改票 | false | false | **noop** |
| 未全投完，某人撤回 | false | false | **noop** |

Timer 是 "best effort" 触发器，`wolfVoteDeadline`（epoch ms）在 `BroadcastGameState` 中是权威时间戳。

### 重复提交防拖延

选定策略 **A（接受重置）**：任何成功 submit 都重置 5 秒。

理由：
- 防拖延的收益低（狼人同阵营，没有对抗动机；且倒数只有 5 秒）
- 策略 B（比较前后 wolfVotesBySeat）增加复杂度但收益不大
- Resolver 对相同目标的重复提交本身就是有效 submit（覆盖写），语义上等同改票

`decideWolfVoteTimerAction` 不做 "投票内容是否变化" 判断，allVoted 时一律 `set`。

---

## 四、变更清单（10 层 × ~15 文件）

### Layer 1: Protocol — BroadcastGameState 新增字段

**文件**: `src/services/protocol/types.ts`

- 新增 `wolfVoteDeadline?: number`（epoch ms，全投完后的倒数截止时间）

### Layer 2: State Normalization — 透传新字段

**文件**: `src/services/engine/state/normalize.ts`

- `normalizeState` return 中新增 `wolfVoteDeadline: raw.wolfVoteDeadline`

**文件**: `src/services/engine/state/__tests__/normalize.contract.test.ts`

- 补充 `wolfVoteDeadline` roundtrip 断言

### Layer 3: Resolver — 撤回分支

**文件**: `src/services/night/resolvers/wolf.ts`

- 在空刀分支之后、`wolfKillDisabled` 检查之前，新增 `target === -2` 分支：

```typescript
if (target === -2) {
  const { [String(actorSeat)]: _, ...rest } = currentNightResults.wolfVotesBySeat ?? {};
  return { valid: true, updates: { wolfVotesBySeat: rest }, result: {} };
}
```

### Layer 4: Evaluator — 新增导出纯函数 + Countdown Gate

**文件**: `src/services/engine/handlers/progressionEvaluator.ts`

#### 4a. `isWolfVoteAllComplete(state)` — 从 `isCurrentStepComplete` 提取

> **⚠️ 行为变更（fail-closed 修复）**
>
> 现有 `isCurrentStepComplete` 中 wolfKill 的完成判定遇到 `!player?.role` 时执行 `continue`（跳过该座位）。
> 这意味着如果某个座位 player 存在但 role 缺失，该座位会被静默忽略，可能导致误判 allVoted 提前推进。
>
> 新函数改为 **fail-closed**：
> - `!player?.role` → 立即 `return false`（无法确定角色 → 无法确定是否全完成）
> - `participatingWolfSeats.length === 0` → `return false`（wolfKill step 下无狼人是异常，不应推进）
>
> 这是防御性修复，正常游戏流程中 wolfKill step 下所有 player 都有 role。

```typescript
export function isWolfVoteAllComplete(state: BroadcastGameState): boolean {
  const wolfVotes = state.currentNightResults?.wolfVotesBySeat ?? {};
  const participatingWolfSeats: number[] = [];
  for (const [seatStr, player] of Object.entries(state.players)) {
    const seat = Number.parseInt(seatStr, 10);
    if (!Number.isFinite(seat)) continue;
    if (!player?.role) return false;  // fail-closed：role 缺失 → 不确定 → false
    if (doesRoleParticipateInWolfVote(player.role)) {
      participatingWolfSeats.push(seat);
    }
  }
  if (participatingWolfSeats.length === 0) return false;  // fail-closed：0 狼人 → 异常 → false
  return participatingWolfSeats.every((seat) => {
    const v = wolfVotes[String(seat)];
    return typeof v === 'number' && (v >= 0 || v === -1);
  });
}
```

`isCurrentStepComplete` 的 wolfKill 分支改为调用 `isWolfVoteAllComplete(state)`。

#### 4b. `shouldTriggerWolfVoteRecovery(state, now)` — 前台恢复判断

```typescript
export function shouldTriggerWolfVoteRecovery(
  state: BroadcastGameState,
  now: number,
): boolean {
  return (
    state.currentStepId === 'wolfKill' &&
    state.wolfVoteDeadline != null &&
    now >= state.wolfVoteDeadline
  );
}
```

#### 4c. `decideWolfVoteTimerAction(allVoted, hasTimer, now)` — Timer 决策

```typescript
export const WOLF_VOTE_COUNTDOWN_MS = 5000;

export type WolfVoteTimerAction =
  | { type: 'set'; deadline: number }
  | { type: 'clear' }
  | { type: 'noop' };

export function decideWolfVoteTimerAction(
  allVoted: boolean,
  hasExistingTimer: boolean,
  now: number,
  countdownMs: number = WOLF_VOTE_COUNTDOWN_MS,
): WolfVoteTimerAction {
  if (allVoted) return { type: 'set', deadline: now + countdownMs };
  if (hasExistingTimer) return { type: 'clear' };
  return { type: 'noop' };
}
```

#### 4d. Countdown Gate — `evaluateNightProgression` 中

在 `isCurrentStepComplete(state)` 之后、返回 `advance` 之前：

```typescript
if (
  state.currentStepId === 'wolfKill' &&
  state.wolfVoteDeadline &&
  Date.now() < state.wolfVoteDeadline
) {
  return { action: 'none', reason: 'wolf_vote_countdown' };
}
```

### Layer 5: Facade — Timer 生命周期

**文件**: `src/services/facade/hostActions.ts`

- `HostActionsContext` 新增：`wolfVoteTimer?: ReturnType<typeof setTimeout>`
- `submitWolfVote` 成功后，使用 `decideWolfVoteTimerAction` 纯函数决策：

```typescript
if (submitResult.success) {
  const state = ctx.store.getState();
  const timerAction = decideWolfVoteTimerAction(
    state ? isWolfVoteAllComplete(state) : false,
    ctx.wolfVoteTimer != null,
    Date.now(),
  );
  switch (timerAction.type) {
    case 'set':
      // 原子序列：clear → 写 deadline → broadcast → set new timer
      // JS 单线程事件循环保证中间无 interleave
      clearTimeout(ctx.wolfVoteTimer);
      applyActions(ctx.store, state!, [
        { type: 'SET_WOLF_VOTE_DEADLINE', payload: { deadline: timerAction.deadline } },
      ]);
      await ctx.broadcastCurrentState();
      ctx.wolfVoteTimer = setTimeout(async () => {
        ctx.wolfVoteTimer = undefined;
        if (!ctx.isAborted?.()) await callNightProgression(ctx);
      }, WOLF_VOTE_COUNTDOWN_MS);
      break;
    case 'clear':
      // 原子序列：clear timer → 清 deadline → broadcast
      clearTimeout(ctx.wolfVoteTimer);
      ctx.wolfVoteTimer = undefined;
      applyActions(ctx.store, state!, [{ type: 'CLEAR_WOLF_VOTE_DEADLINE' }]);
      await ctx.broadcastCurrentState();
      break;
    // noop: do nothing
  }
  await callNightProgression(ctx);
}
```

### Layer 6: Facade — 前台恢复（双通道兜底）

**文件**: `src/services/facade/GameFacade.ts`

双通道前台恢复，与 AudioService.ts 保持一致模式（Web 用 `document.visibilitychange`，Native 用 `AppState`）：

```typescript
import { Platform, AppState, type AppStateStatus } from 'react-native';

private _foregroundCleanups: Array<() => void> = [];

private _setupForegroundRecovery(): void {
  if (this._foregroundCleanups.length > 0) return;  // 幂等：已注册则跳过

  const onForeground = () => {
    if (!this.isHost || this._aborted) return;
    const state = this.store.getState();
    if (!state || !shouldTriggerWolfVoteRecovery(state, Date.now())) return;
    void callNightProgression(this.getHostActionsContext());
  };

  // Channel 1: Web — document.visibilitychange（已验证模式，见 AudioService.ts）
  if (typeof document !== 'undefined') {
    const handler = () => {
      if (document.visibilityState === 'visible') onForeground();
    };
    document.addEventListener('visibilitychange', handler);
    this._foregroundCleanups.push(() =>
      document.removeEventListener('visibilitychange', handler),
    );
  }

  // Channel 2: Native — AppState（iOS/Android）
  if (Platform.OS !== 'web') {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') onForeground();
    });
    this._foregroundCleanups.push(() => subscription.remove());
  }
}

private _teardownForegroundRecovery(): void {
  for (const cleanup of this._foregroundCleanups) cleanup();
  this._foregroundCleanups = [];
}
```

- `createRoom` / `joinAsHost` 成功后调 `_setupForegroundRecovery()`
- `leaveRoom` 中调 `_teardownForegroundRecovery()`
- Timer 清除也在 `leaveRoom`：`clearTimeout(this._hostActionsCtx.wolfVoteTimer)`

**幂等保证**：
- 注册幂等：`_foregroundCleanups.length > 0` 检查，重复调用 `_setupForegroundRecovery()` 不会注册第二套监听器
- 清理幂等：`_teardownForegroundRecovery` 清空数组后可重新注册
- 推进幂等：`evaluateNightProgression` 有 `ProgressionTracker`（`{revision, currentStepId}` key），同一状态最多推进一次

**Web 上不会双触发**：`Platform.OS !== 'web'` guard 确保 Web 只走 visibilitychange 通道，不会同时注册 AppState。

### Layer 7: Reducer — 新 Action Types

**文件**: `src/services/engine/reducer.ts`（或对应 action 定义文件）

- `SET_WOLF_VOTE_DEADLINE`：写入 `state.wolfVoteDeadline = payload.deadline`
- `CLEAR_WOLF_VOTE_DEADLINE`：删除 `state.wolfVoteDeadline`（设为 `undefined`）

### Layer 8: broadcastToLocalState — 透传 deadline

**文件**: `src/hooks/adapters/broadcastToLocalState.ts`

- return 中新增 `wolfVoteDeadline: broadcast.wolfVoteDeadline`

### Layer 9: UI — Helpers + Seat Badge

#### 9a. RoomScreen.helpers.ts

- `SeatViewModel` 新增：`wolfVoteTarget?: number`
- `buildSeatViewModels`：当 `wolfVotesBySeat` 存在时填充 `wolfVoteTarget`

```typescript
wolfVoteTarget: wolfVotesBySeat != null && String(index) in wolfVotesBySeat
  ? wolfVotesBySeat[String(index)]
  : undefined,
```

- `determineActionerState` → `handleMatchingRole` + `handleWolfTeamTurn`：**移除** `wolfVotes.has(actorSeatNumber) → imActioner: false` gate，改为 `imActioner: true`（允许 revote）

**Badge 信息泄漏防护**：已有天然 gate —— `buildSeatViewModels` 中 `wolfVotesBySeat` 只在 `showWolves=true` 时才读取，`showWolves` 仅在 `isWolfMeetingSchema && isWolfRole && doesRoleParticipateInWolfVote` 时为 `true`。非狼玩家永远看不到 badge。

#### 9b. SeatTile.tsx

- `SeatTileProps` 新增：`wolfVoteTarget?: number`
- `arePropsEqual` 新增：`prev.wolfVoteTarget === next.wolfVoteTarget`
- Badge 渲染：当 `wolfVoteTarget != null` 时显示 `→{target+1}`（`target === -1` 时显示 `→空刀`）

#### 9c. PlayerGrid.tsx

- 传递 `wolfVoteTarget={seat.wolfVoteTarget}` 给 `SeatTile`

#### 9d. useRoomActions.ts

- `findVotingWolfSeat`：移除 `!hasWolfVoted(actorSeatNumber)` 条件（允许 revote）
- `getWolfStatusLine`：
  - 未投票 → `"{X}/{Y} 狼人已投票"`
  - 已投票未全投完 → `"{X}/{Y} 狼人已投票（可点击改票或取消）"`
  - 全投完倒数中 → `"{X}/{Y} 狼人已投票（{N}s 后确认）"`
- `getBottomAction` wolfVote 分支：
  - 未投票 → `[空刀]`
  - 已投票 → `[取消投票]`（type=`wolfVote`, targetIndex=`-2`）+ `[空刀]`

#### 9e. RoomScreen.tsx

- 新增 countdown tick（`useEffect` + `setInterval(1000)`）驱动 `getWolfStatusLine` 文案更新
- 将 `wolfVoteDeadline` 传入 `useRoomActions` 的 `GameContext`

---

## 五、架构合规性

| 规则 | 合规 | 说明 |
|------|------|------|
| auto-advance 在 evaluator | ✅ | countdown gate 在 `evaluateNightProgression` |
| facade 透传不决策 | ✅ | facade 只判断 timer set/clear（通过纯函数），不决定推不推进 |
| BroadcastGameState 单一真相 | ✅ | `wolfVoteDeadline` 在 state 中 |
| 新字段必须 normalizeState 透传 | ✅ | 已含 |
| hardGates: facade 不直接调 evaluateNightProgression | ✅ | 通过 `callNightProgression` → `handleNightProgression` |
| allVoted 判断不漂移 | ✅ | `isWolfVoteAllComplete` 单一导出，evaluator + facade 共用 |
| timer 绑定实例 | ✅ | `ctx.wolfVoteTimer` 在 HostActionsContext 上，leaveRoom 清除 |
| 前台恢复幂等 | ✅ | `_setupForegroundRecovery` 幂等注册；evaluator 有 ProgressionTracker |
| Web + Native 双通道 | ✅ | Web: `document.visibilitychange`；Native: `AppState`；`Platform.OS` 互斥 |
| isWolfVoteAllComplete fail-closed | ✅ | role 缺失/0 狼人返回 false，防止异常模板误推进 |
| 倒计时防拖延 | ✅（选 A）| 任何成功 submit 都重置 5 秒，复杂度低、收益匹配 |

---

## 六、风险评估

| 风险 | 等级 | 缓解 |
|------|------|------|
| Revote 后 readyBadge 闪烁 | 低 | Badge 由 `wolfVotesBySeat` 驱动，覆盖 key → 立即更新 |
| Timer 在 App 后台暂停 | 中 | Deadline 在 evaluator 层做权威检查 + AppState 前台恢复兜底 |
| 多狼同时 revote 导致 deadline 反复重设 | 低 | `decideWolfVoteTimerAction` 是幂等纯函数，每次调用原子判断 |
| `-2` 穿透 `RECORD_ACTION` 日志 | 可接受 | targetSeat=-2 明确表示撤回 |
| `isWolfVoteAllComplete` player.role 缺失 | 已缓解 | fail-closed 返回 false，不误推进（行为变更，有回归测试） |
| 重复提交相同目标可重置倒数 | 低 | 策略 A：接受重置；5 秒窗口短、同阵营无对抗动机 |

---

## 七、测试清单（23 个）

### Resolver (2)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 1 | `wolf.resolver.test.ts` | `target=-2 应删除 wolfVotesBySeat key` | `updates` 不含 actorSeat key |
| 2 | `wolf.resolver.test.ts` | `target=-2 后再投票应正常写入` | key 重新出现且值正确 |

### Evaluator — isWolfVoteAllComplete (5)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 3 | `progressionEvaluator.test.ts` | 全投完 → true | `true` |
| 4 | `progressionEvaluator.test.ts` | 有撤回(key 不存在) → false | `false` |
| 5 | `progressionEvaluator.test.ts` | player.role 缺失 → false（回归：旧逻辑 continue 会误判完成） | `false` |
| 6 | `progressionEvaluator.test.ts` | 无参与狼人(0 wolves) → false | `false` |
| 6b | `progressionEvaluator.test.ts` | 重复提交相同目标后 allVoted 仍为 true | `true` |

### Evaluator — shouldTriggerWolfVoteRecovery (4)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 7 | `progressionEvaluator.test.ts` | wolfKill + deadline 已过 → true | `true` |
| 8 | `progressionEvaluator.test.ts` | deadline 未过 → false | `false` |
| 9 | `progressionEvaluator.test.ts` | 非 wolfKill step → false | `false` |
| 10 | `progressionEvaluator.test.ts` | 无 deadline → false | `false` |

### Evaluator — decideWolfVoteTimerAction (5)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 11 | `progressionEvaluator.test.ts` | allVoted+无timer → set | `type=set, deadline=now+5000` |
| 12 | `progressionEvaluator.test.ts` | allVoted+有timer → set (重置) | `type=set` |
| 13 | `progressionEvaluator.test.ts` | !allVoted+有timer → clear | `type=clear` |
| 14 | `progressionEvaluator.test.ts` | !allVoted+无timer → noop | `type=noop` |
| 14b | `progressionEvaluator.test.ts` | allVoted+有timer+内容未变 → set（策略 A：仍重置） | `type=set` |

### Evaluator — evaluateNightProgression countdown gate (3)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 15 | `progressionEvaluator.test.ts` | 全投完 + deadline 未过 → none | `action=none, reason=wolf_vote_countdown` |
| 16 | `progressionEvaluator.test.ts` | 全投完 + deadline 已过 → advance | `action=advance` |
| 17 | `progressionEvaluator.test.ts` | 全投完 + 无 deadline → advance（向后兼容） | `action=advance` |

### UI — RoomScreen.helpers (3)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 18 | `RoomScreen.helpers.test.ts` | showWolves=true 时 SeatVM 含 wolfVoteTarget | `wolfVoteTarget === target` |
| 19 | `RoomScreen.helpers.test.ts` | showWolves=false 时 SeatVM 无 wolfVoteTarget | `wolfVoteTarget === undefined` |
| 20 | `RoomScreen.helpers.test.ts` | revote: 已投票狼人 imActioner 仍为 true | `imActioner === true` |

### Normalize (1)

| # | 文件 | 用例 | 断言 |
|---|------|------|------|
| 21 | `normalize.contract.test.ts` | wolfVoteDeadline 透传 | roundtrip 通过 |

### 总计

- Resolver: 2
- Evaluator (isWolfVoteAllComplete): 5
- Evaluator (shouldTriggerRecovery): 4
- Evaluator (decideTimerAction): 5
- Evaluator (countdown gate): 3
- UI (helpers): 3
- Normalize: 1
- **合计: 23**
