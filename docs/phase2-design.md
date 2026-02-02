# Phase2 设计方案：Night-1 迁移（对齐 Legacy）

> **版本**：v1.3.1
> **日期**：2026-01-21
> **作者**：Copilot

---

## Changelog

| 版本   | 日期       | 变更                                                                                         |
| ------ | ---------- | -------------------------------------------------------------------------------------------- |
| v1.3.1 | 2026-01-21 | 修正 Legacy 行号证据：使用 `nl -ba` 重新校准，每条增加代码片段摘录                           |
| v1.3   | 2026-01-21 | 完全重写：100% 对齐 legacy 行为，新增 Legacy 权威对照表，修正状态机流转，按 legacy 边界切 PR |
| v1.2   | 2026-01-21 | 修复伪 API/迁移护栏/容错契约（已废弃）                                                       |
| v1.1   | 2026-01-21 | 修订红线对齐（已废弃）                                                                       |
| v1.0   | 2026-01-21 | 初稿（已废弃）                                                                               |

---

## 0. 总原则（Non-negotiable）

1. **行为对齐 legacy**：Phase2 的目标不是"合理"，而是"与 legacy 体验/规则一致"（Night-1 only 范围内）。任何行为差异都视为 bug。

2. **Host 是权威，但 Host 设备也是 player**：Host UI 交互必须与 Player 交互一致（只是多了 host-only 的按钮/入口）。Host 和 Player 读取同一份 `BroadcastGameState`。

3. **单一状态源**：所有可见/不可见信息都必须进入 `BroadcastGameState`，UI 按 `myRole` 过滤展示；**禁止 hostOnly state**。

4. **Resolver-first**：行动合法性与计算只能来自 resolver（与 schema constraints 对齐），handler 不得二次推导。

5. **运行时禁止 import legacy**：设计里允许"引用 legacy 作为对照证据"，但实现里不得依赖 legacy。

---

## 1. Legacy 权威对照表

> **证据来源**：`src/services/legacy/GameStateService.ts`
>
> **行号生成方式**：`nl -ba src/services/legacy/GameStateService.ts | sed -n 'X,Yp'`（可复现）

### 1.1 Seating（Phase1 已完成，Phase2 不动）

| 行为                     | 行号范围           | 代码片段摘录                                                                                                                                                                                                  | 对齐状态       |
| ------------------------ | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 入座后 allSeated 检查    | L722-725           | `const allSeated = Array.from(this.state.players.values()).every((p) => p !== null);`<br>`if (allSeated && this.state.status === GameStatus.unseated) {`<br>`  this.state.status = GameStatus.seated;`<br>`}` | ✅ Phase1 完成 |
| 离座后 status 回退       | L740-742           | `if (this.state.status === GameStatus.seated) {`<br>`  this.state.status = GameStatus.unseated;`<br>`}`                                                                                                       | ✅ Phase1 完成 |
| SEAT_ACTION_REQUEST 处理 | L559-561, L616-647 | `case 'SEAT_ACTION_REQUEST':`<br>`  await this.handleSeatActionRequest(msg);`<br>...<br>`await this.broadcastService.broadcastAsHost({ type: 'SEAT_ACTION_ACK', ... });`                                      | ✅ Phase1 完成 |

**Phase2 不动 seating 逻辑，证据引用 Phase1 已锁定的测试。**

---

### 1.2 assignRoles

| 条目         | 行号范围   | 代码片段摘录                                                                                           |
| ------------ | ---------- | ------------------------------------------------------------------------------------------------------ |
| **方法入口** | L1455      | `async assignRoles(): Promise<void> {`                                                                 |
| **前置条件** | L1456-1457 | `if (!this.isHost \|\| !this.state) return;`<br>`if (this.state.status !== GameStatus.seated) return;` |
| **洗牌**     | L1460      | `const shuffledRoles = shuffleArray([...this.state.template.roles]);`                                  |
| **写入字段** | L1466-1467 | `player.role = shuffledRoles[i];`<br>`player.hasViewedRole = false;`                                   |
| **状态变化** | L1472      | `this.state.status = GameStatus.assigned;`                                                             |
| **广播**     | L1474      | `await this.broadcastState();`                                                                         |

**关键语义**：

- `seated → assigned`（不是直接到 ongoing）
- 写入 `players[seat].role` 和 `players[seat].hasViewedRole = false`
- 只广播 `STATE_UPDATE`，不广播 `ROLE_TURN`

---

### 1.3 handlePlayerViewedRole

| 条目               | 行号范围   | 代码片段摘录                                                                                                                                           |
| ------------------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **方法入口**       | L1064      | `private async handlePlayerViewedRole(seat: number): Promise<void> {`                                                                                  |
| **前置条件**       | L1065      | `if (!this.state \|\| this.state.status !== GameStatus.assigned) return;`                                                                              |
| **写入字段**       | L1070      | `player.hasViewedRole = true;`                                                                                                                         |
| **allViewed 检查** | L1073-1075 | `const allViewed = Array.from(this.state.players.values())`<br>`  .filter((p): p is LocalPlayer => p !== null)`<br>`  .every((p) => p.hasViewedRole);` |
| **状态变化**       | L1077-1078 | `if (allViewed) {`<br>`  this.state.status = GameStatus.ready;`<br>`}`                                                                                 |
| **广播**           | L1081      | `await this.broadcastState();`                                                                                                                         |

**关键语义**：

- **每个玩家**（包括 Host）必须点击"已查看角色"
- `assigned → ready` 当且仅当 allViewed
- Host 设备也是 player，Host 的座位也必须 hasViewedRole = true

---

### 1.4 startGame / startNight

| 条目                             | 行号范围   | 代码片段摘录                                                                                                                                                                               |
| -------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **方法入口**                     | L1483      | `async startGame(): Promise<void> {`                                                                                                                                                       |
| **前置条件**                     | L1484-1485 | `if (!this.isHost \|\| !this.state) return;`<br>`if (this.state.status !== GameStatus.ready) return;`                                                                                      |
| **构建 NightPlan**               | L1488      | `const nightPlan = buildNightPlan(this.state.template.roles);`                                                                                                                             |
| **创建 NightFlowController**     | L1491      | `this.nightFlow = new NightFlowController(nightPlan);`                                                                                                                                     |
| **Dispatch StartNight**          | L1495      | `this.nightFlow.dispatch(NightEvent.StartNight);`                                                                                                                                          |
| **初始化 night 字段**            | L1507-1523 | `this.state.actions = new Map();`<br>`this.state.wolfVotes = new Map();`<br>`this.state.currentActionerIndex = 0;`<br>`this.state.isAudioPlaying = true;`<br>... (清除所有 reveal/context) |
| **播放夜晚开始音频**             | L1527      | `await this.audioService.playNightBeginAudio();`                                                                                                                                           |
| **等待 5 秒**                    | L1530      | `await new Promise((resolve) => setTimeout(resolve, 5000));`                                                                                                                               |
| **Dispatch NightBeginAudioDone** | L1534      | `this.nightFlow?.dispatch(NightEvent.NightBeginAudioDone);`                                                                                                                                |
| **sync currentActionerIndex**    | L1537      | `this.state.currentActionerIndex = this.nightFlow.currentActionIndex;`                                                                                                                     |
| **状态变化**                     | L1550      | `this.state.status = GameStatus.ongoing;`                                                                                                                                                  |
| **广播**                         | L1552      | `await this.broadcastState();`                                                                                                                                                             |
| **开始第一个角色回合**           | L1556      | `await this.playCurrentRoleAudio();`                                                                                                                                                       |

**关键语义**：

- **前置条件是 `ready`**，不是 `seated` 或 `assigned`
- `ready → ongoing`（不跳过 ready）
- 音频时序：夜晚开始音频 → 等待 5 秒 → NightBeginAudioDone → sync index → ongoing → playCurrentRoleAudio

---

### 1.5 playCurrentRoleAudio

| 条目                            | 行号范围   | 代码片段摘录                                                                                                                                                                                                          |
| ------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **方法入口**                    | L1672      | `private async playCurrentRoleAudio(): Promise<void> {`                                                                                                                                                               |
| **夜晚结束判断**                | L1677-1680 | `if (!currentRole) {`<br>`  await this.endNight();`<br>`  return;`<br>`}`                                                                                                                                             |
| **设置 isAudioPlaying**         | L1683-1685 | `this.state.isAudioPlaying = true;`<br>`await this.broadcastState();`                                                                                                                                                 |
| **播放角色开始音频**            | L1689      | `await this.audioService.playRoleBeginningAudio(currentRole);`                                                                                                                                                        |
| **Dispatch RoleBeginAudioDone** | L1693      | `this.nightFlow?.dispatch(NightEvent.RoleBeginAudioDone);`                                                                                                                                                            |
| **清除 isAudioPlaying**         | L1704      | `this.state.isAudioPlaying = false;`                                                                                                                                                                                  |
| **stepId 来源**                 | L1717-1718 | `const [step] = getStepsByRoleStrict(currentRole);`<br>`stepId = step?.id;`                                                                                                                                           |
| **witchContext 设置**           | L1726-1739 | `if (currentRole === 'witch') {`<br>`  ...`<br>`  if (isWitchBlocked) { ... } else {`<br>`    const killedIndex = getActionTargetSeat(wolfAction) ?? -1;`<br>`    this.setWitchContext(killedIndex);`<br>`  }`<br>`}` |
| **confirmStatus 设置**          | L1744-1745 | `if (currentRole === 'hunter' \|\| currentRole === 'darkWolfKing') {`<br>`  this.setConfirmStatus(currentRole);`<br>`}`                                                                                               |
| **广播 ROLE_TURN**              | L1749-1754 | `await this.broadcastService.broadcastAsHost({`<br>`  type: 'ROLE_TURN',`<br>`  role: currentRole,`<br>`  pendingSeats,`<br>`  stepId,`<br>`});`                                                                      |
| **更新 currentStepId**          | L1757-1758 | `if (stepId && this.state) {`<br>`  this.state.currentStepId = stepId;`<br>`}`                                                                                                                                        |

**关键语义**：

- stepId 来源是 `getStepsByRoleStrict(currentRole)[0].id`（派生自 `NIGHT_STEPS`）
- `ROLE_TURN` 广播在 `RoleBeginAudioDone` 之后、`isAudioPlaying = false` 之后
- witchContext 只在非 blocked 时设置

---

### 1.6 advanceToNextAction

| 条目                        | 行号范围   | 代码片段摘录                                                                                                                                                                                                                                                                      |
| --------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **方法入口**                | L1765      | `private async advanceToNextAction(): Promise<void> {`                                                                                                                                                                                                                            |
| **nightFlow 存在校验**      | L1770-1776 | `if (this.state.status === GameStatus.ongoing && !this.nightFlow) {`<br>`  throw new Error('advanceToNextAction: nightFlow is null - strict invariant violation');`<br>`}`                                                                                                        |
| **获取 currentRole**        | L1784      | `const currentRole = this.getCurrentActionRole();`                                                                                                                                                                                                                                |
| **播放结束音频**            | L1789-1794 | `this.state.isAudioPlaying = true;`<br>`await this.broadcastState();`<br>`...`<br>`await this.audioService.playRoleEndingAudio(currentRole).catch(() => {});`                                                                                                                     |
| **清除 isAudioPlaying**     | L1797      | `this.state.isAudioPlaying = false;`                                                                                                                                                                                                                                              |
| **RoleEndAudioDone gating** | L1804-1816 | `if (this.nightFlow.phase === NightPhase.RoleEndAudio) {`<br>`  this.nightFlow.dispatch(NightEvent.RoleEndAudioDone);`<br>`  this.state.currentActionerIndex = this.nightFlow.currentActionIndex;`<br>`} else {`<br>`  ... // ignore silently (idempotent)`<br>`  return;`<br>`}` |
| **清空 wolfVotes**          | L1819      | `this.state.wolfVotes = new Map();`                                                                                                                                                                                                                                               |
| **递归调用**                | L1822      | `await this.playCurrentRoleAudio();`                                                                                                                                                                                                                                              |

**关键语义**：

- **RoleEndAudioDone gating**：只有在 `phase === RoleEndAudio` 时才 dispatch，否则 idempotent 返回
- `currentActionerIndex` 唯一写入点：L1807（从 nightFlow sync）
- 清空 wolfVotes 在推进前执行

---

### 1.7 endNight

| 条目                           | 行号范围   | 代码片段摘录                                                                                                                                                                                                                           |
| ------------------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **方法入口**                   | L1825      | `private async endNight(): Promise<void> {`                                                                                                                                                                                            |
| **触发条件**                   | L1677-1680 | `if (!currentRole) { await this.endNight(); return; }` (在 playCurrentRoleAudio 中)                                                                                                                                                    |
| **nightFlow 存在校验**         | L1830-1836 | `if (this.state.status === GameStatus.ongoing && !this.nightFlow) {`<br>`  throw new Error('endNight: nightFlow is null - strict invariant violation');`<br>`}`                                                                        |
| **播放结束音频**               | L1846      | `await this.audioService.playNightEndAudio();`                                                                                                                                                                                         |
| **NightEndAudio phase gating** | L1851-1862 | `if (this.nightFlow.phase === NightPhase.NightEndAudio) {`<br>`  this.nightFlow.dispatch(NightEvent.NightEndAudioDone);`<br>`} else {`<br>`  hostLog.debug('endNight() ignored (strict no-op): phase is', ...);`<br>`  return;`<br>`}` |
| **计算死亡**                   | L1866      | `const deaths = this.doCalculateDeaths();`                                                                                                                                                                                             |
| **记录死亡**                   | L1867      | `this.state.lastNightDeaths = deaths;`                                                                                                                                                                                                 |
| **状态变化**                   | L1868      | `this.state.status = GameStatus.ended;`                                                                                                                                                                                                |
| **广播 NIGHT_END**             | L1871-1874 | `await this.broadcastService.broadcastAsHost({`<br>`  type: 'NIGHT_END',`<br>`  deaths,`<br>`});`                                                                                                                                      |
| **广播 state**                 | L1876      | `await this.broadcastState();`                                                                                                                                                                                                         |

**关键语义**：

- **NightEndAudio phase gating**：只有在 `phase === NightEndAudio` 时才执行死亡计算和状态变更，否则 strict no-op
- 广播两条消息顺序：先 `NIGHT_END`，后 `STATE_UPDATE`
- 死亡计算由 `doCalculateDeaths()` 执行（L2603 定义）

---

### 1.8 handlePlayerAction（非狼人 submitAction）

| 条目                     | 行号范围 | 代码片段摘录                                                                             |
| ------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| **前置条件**             | L754     | `if (!this.state \|\| this.state.status !== GameStatus.ongoing) return;`                 |
| **nightFlow phase 校验** | L776     | `if (this.nightFlow.phase !== NightPhase.WaitingForAction) return;`                      |
| **role 校验**            | L771     | `if (currentRole !== role) return;`                                                      |
| **nightmare block**      | L788-809 | 被封锁的座位只能 skip，否则 reject                                                       |
| **resolver 调用**        | L820     | `const resolverResult = this.invokeResolver(schemaId, seat, role, actionInput);`         |
| **reveal role 处理**     | L916-923 | 等待 `REVEAL_ACK` 后才 advance                                                           |
| **advance**              | L926-939 | `this.nightFlow.dispatch(NightEvent.ActionSubmitted); await this.advanceToNextAction();` |

---

### 1.9 handleWolfVote

| 条目                 | 行号范围   | 代码片段摘录                                                                             |
| -------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| **前置条件**         | L943-944   | `if (!this.state \|\| this.state.status !== GameStatus.ongoing)`                         |
| **role 校验**        | L965-968   | `if (currentRole !== 'wolf') return;`                                                    |
| **wolf 身份校验**    | L972-973   | `if (!player?.role \|\| !isWolfRole(player.role)) return;`                               |
| **记录投票**         | L1004      | `this.state.wolfVotes.set(seat, target);`                                                |
| **allVoted 检查**    | L1007-1008 | `allVotingWolfSeats.every((s) => this.state!.wolfVotes.has(s))`                          |
| **once-guard**       | L1011-1017 | `if (this.state.actions.has('wolf')) return;`                                            |
| **resolve 最终目标** | L1020      | `const finalTarget = resolveWolfVotes(this.state.wolfVotes);`                            |
| **record action**    | L1021-1022 | `this.state.actions.set('wolf', makeActionTarget(finalTarget));`                         |
| **advance**          | L1038-1056 | `this.nightFlow.dispatch(NightEvent.ActionSubmitted); await this.advanceToNextAction();` |

**Neutral judge rule**：狼人可以刀任意座位（包括自己或队友）。

---

## 2. 状态机（对齐版）

### 2.1 Status 流转图

```
┌────────────┐   全员入座    ┌────────────┐   Host: assignRoles()   ┌────────────┐
│  unseated  │─────────────▶│   seated   │────────────────────────▶│  assigned  │
└────────────┘               └────────────┘                         └────────────┘
      ▲                            ▲                                      │
      │                            │                                      │
      │ 有人离座                    │ restartGame()                       │ 每人点"已查看"
      │                            │                                      ▼
      │                            │                              ┌────────────┐
      │                            │        全员 hasViewedRole    │   ready    │
      │                            │       ◀──────────────────────┤            │
      │                            │                              └────────────┘
      │                            │                                      │
      │                            │                                      │ Host: startGame()
      │                            │                                      ▼
      │                            │                              ┌────────────┐
      │                            └──────────────────────────────│  ongoing   │
      │                                                           └────────────┘
      │                                                                   │
      │                                                                   │ endNight()
      │                                                                   ▼
      │                                                           ┌────────────┐
      └───────────────────────────────────────────────────────────│   ended    │
                                      restartGame()               └────────────┘
```

### 2.2 每个状态详解

#### `unseated`

- **UI 可用操作**：任意玩家可入座空位
- **Host-only**：无
- **写入 `BroadcastGameState`**：`players[seat]` = player info

#### `seated`

- **UI 可用操作**：任意玩家可入座空位；已入座玩家可离座
- **Host-only**：显示"分配角色"按钮
- **写入 `BroadcastGameState`**：`status`

#### `assigned`

- **UI 可用操作**：每个玩家看自己角色（`players[mySeat].role`）；点击"已查看角色"
- **Host-only**：无（Host 作为玩家也要点"已查看"）
- **写入 `BroadcastGameState`**：`players[seat].role`、`players[seat].hasViewedRole`、`status`

#### `ready`

- **UI 可用操作**：等待 Host 开始
- **Host-only**：显示"开始游戏"按钮
- **写入 `BroadcastGameState`**：`status`

#### `ongoing`

- **UI 可用操作**：当前回合角色提交 action/vote
- **Host-only**：无（夜晚推进由系统自动完成）
- **写入 `BroadcastGameState`**：
  - `currentActionerIndex`
  - `currentNightPhase`（新增）
  - `currentStepId`（新增）
  - `isAudioPlaying`
  - `actions`
  - `currentNightResults`
  - 各种 reveal/context 字段

#### `ended`

- **UI 可用操作**：查看死亡结果
- **Host-only**：显示"重新开始"按钮
- **写入 `BroadcastGameState`**：`lastNightDeaths`、`status`

---

## 3. 角色行动与 UI 交互逐角色对齐表

> 以 `NIGHT_STEPS` 顺序为准（`src/models/roles/spec/nightSteps.ts`）

| 角色              | UI 显示（myRole 过滤）                  | PlayerMessage                                                             | Handler 输入           | Resolver 输入/输出                                                | 写入 BroadcastGameState                                                                                 | Nightmare block 处理                                                         | Schema constraints                          |
| ----------------- | --------------------------------------- | ------------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------- |
| **magician**      | 选择两个座位交换                        | `ACTION { seat, role:'magician', target: encoded }`                       | `SubmitActionIntent`   | `magicianSwap(ctx, {firstSeat, secondSeat})` → `{valid, updates}` | `actions`, `currentNightResults.swappedSeats`                                                           | `blockedSeat === actorSeat` → valid but no-effect                            | 无                                          |
| **slacker**       | 选择偶像（懒人）                        | `ACTION { seat, role:'slacker', target }`                                 | `SubmitActionIntent`   | `slackerChooseIdol(ctx, {targetSeat})`                            | `actions`, `currentNightResults.slackerIdol`                                                            | valid but no-effect                                                          | `notSelf`                                   |
| **wolfRobot**     | 选择查验目标                            | `ACTION { seat, role:'wolfRobot', target }`                               | `SubmitActionIntent`   | `wolfRobotLearn(ctx, {targetSeat})` → `{result}`                  | `actions`, `wolfRobotReveal`                                                                            | valid but no-effect                                                          | `notSelf`                                   |
| **dreamcatcher**  | 选择守梦目标                            | `ACTION { seat, role:'dreamcatcher', target }`                            | `SubmitActionIntent`   | `dreamcatcherDream(ctx, {targetSeat})`                            | `actions`, `currentNightResults.dreamProtectedSeat`                                                     | valid but no-effect                                                          | `notSelf`                                   |
| **gargoyle**      | 选择查验目标                            | `ACTION { seat, role:'gargoyle', target }`                                | `SubmitActionIntent`   | `gargoyleCheck(ctx, {targetSeat})` → `{result}`                   | `actions`, `gargoyleReveal`                                                                             | valid but no-effect                                                          | `notSelf`                                   |
| **nightmare**     | 选择封锁目标                            | `ACTION { seat, role:'nightmare', target }`                               | `SubmitActionIntent`   | `nightmareBlock(ctx, {targetSeat})`                               | `actions`, `currentNightResults.blockedSeat`, `nightmareBlockedSeat`, 可能 `wolfKillDisabled`           | valid but no-effect                                                          | `notSelf`                                   |
| **guard**         | 选择守护目标                            | `ACTION { seat, role:'guard', target }`                                   | `SubmitActionIntent`   | `guardProtect(ctx, {targetSeat})`                                 | `actions`, `currentNightResults.guardedSeat`                                                            | valid but no-effect                                                          | `notSelf`, `notConsecutive`（Night-1 无效） |
| **wolf** (vote)   | 每个狼人选择刀人目标                    | `WOLF_VOTE { seat, target }`                                              | `SubmitWolfVoteIntent` | `wolfVoteResolver(ctx, {targetSeat})`                             | `currentNightResults.wolfVotesBySeat`；allVoted 后写入 `actions` / `currentNightResults.wolfKillTarget` | 如果当前狼被 block：投票无效（skip）；如果所有狼被 block：`wolfKillDisabled` | neutral judge（允许刀自己/队友）            |
| **wolfQueen**     | 选择魅惑目标                            | `ACTION { seat, role:'wolfQueen', target }`                               | `SubmitActionIntent`   | `wolfQueenCharm(ctx, {targetSeat})`                               | `actions`, `currentNightResults.charmedSeat`                                                            | valid but no-effect                                                          | `notSelf`, `notWolf`                        |
| **witch**         | 看到被刀者；选择救/毒/跳过              | `ACTION { seat, role:'witch', target, extra:{save:true}\|{poison:true} }` | `SubmitActionIntent`   | `witchAction(ctx, {targetSeat, save?, poison?})`                  | `actions`, `currentNightResults.witchSave`/`witchPoison`                                                | valid but no-effect（看不到被刀者）                                          | `notSelf`（毒）                             |
| **witch context** | 只有女巫看到 `witchContext.killedIndex` | -                                                                         | -                      | -                                                                 | `witchContext: {killedIndex, canSave, canPoison}`                                                       | 被 block 时不设置 witchContext                                               | -                                           |
| **seer**          | 选择查验目标                            | `ACTION { seat, role:'seer', target }`                                    | `SubmitActionIntent`   | `seerCheck(ctx, {targetSeat})` → `{result:'好人'\|'狼人'}`        | `actions`, `seerReveal`                                                                                 | valid but no-effect                                                          | `notSelf`                                   |
| **psychic**       | 选择查验目标                            | `ACTION { seat, role:'psychic', target }`                                 | `SubmitActionIntent`   | `psychicCheck(ctx, {targetSeat})` → `{result}`                    | `actions`, `psychicReveal`                                                                              | valid but no-effect                                                          | `notSelf`                                   |
| **hunter**        | 确认是否可开枪                          | `ACTION { seat, role:'hunter', target:null }`                             | `SubmitActionIntent`   | `hunterConfirm(ctx, {})`                                          | `actions`, `confirmStatus`                                                                              | valid but no-effect                                                          | -                                           |
| **darkWolfKing**  | 确认是否可开枪                          | `ACTION { seat, role:'darkWolfKing', target:null }`                       | `SubmitActionIntent`   | `darkWolfKingConfirm(ctx, {})`                                    | `actions`, `confirmStatus`                                                                              | valid but no-effect                                                          | -                                           |

### 3.1 Reveal Role 特殊处理

Legacy（L916-923）中，reveal role（seer/psychic/gargoyle/wolfRobot）提交 action 后：

1. 立即 `broadcastState()` 让 UI 显示结果
2. 添加 `pendingRevealAcks.add(key)`
3. **不 advance**，等待 `REVEAL_ACK`
4. 收到 `REVEAL_ACK` 后：移除 pending → `dispatch(ActionSubmitted)` → `advanceToNextAction()`

**必须对齐此行为**：reveal 后不立即 advance，等待 ACK。

---

## 4. PR 切片（按 Legacy 边界切）

### PR1: `ASSIGN_ROLES`（`seated → assigned`）

**目标**：Host 点击分配角色 → 洗牌分配 → status = assigned → 广播

**改动文件**：

| 文件路径                                             | 改动符号              | 说明                                                                     |
| ---------------------------------------------------- | --------------------- | ------------------------------------------------------------------------ |
| `src/services/facade/GameFacade.ts`                  | `assignRoles()`       | 新增方法：构造 intent → 调 handler → apply actions → broadcast           |
| `src/services/engine/handlers/gameControlHandler.ts` | `handleAssignRoles()` | 新增（或拆分原 handleStartGame）：校验 seated → 生成 ASSIGN_ROLES action |
| `src/services/engine/intents/types.ts`               | `AssignRolesIntent`   | 新增 intent 类型                                                         |

**新增/修改 `BroadcastGameState` 字段**：无（`players[seat].role` 已存在）

**测试门禁**：

| 测试文件                     | 测试用例                                      | 类型 |
| ---------------------------- | --------------------------------------------- | ---- |
| `gameControlHandler.test.ts` | `handleAssignRoles` happy: seated → assigned  | Jest |
| `gameControlHandler.test.ts` | `handleAssignRoles` edge: 非 seated → 拒绝    | Jest |
| `gameControlHandler.test.ts` | `handleAssignRoles` edge: 非 Host → host_only | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR2: `VIEWED_ROLE`（`assigned → ready`）

**目标**：每个玩家点"已查看" → hasViewedRole = true → allViewed 后 status = ready

**改动文件**：

| 文件路径                                        | 改动符号                    | 说明                                                             |
| ----------------------------------------------- | --------------------------- | ---------------------------------------------------------------- |
| `src/services/facade/GameFacade.ts`             | `viewedRole()`              | 新增方法（Player 端发 PlayerMessage）                            |
| `src/services/facade/GameFacade.ts`             | `hostHandlePlayerMessage()` | 新增 case `'VIEWED_ROLE'`                                        |
| `src/services/engine/handlers/actionHandler.ts` | `handleViewedRole()`        | 校验 assigned → 设置 hasViewedRole → 检查 allViewed → 可能 ready |
| `src/services/engine/reducer/gameReducer.ts`    | `handlePlayerViewedRole()`  | 已存在，需确保 allViewed → ready 逻辑                            |

**新增/修改 `BroadcastGameState` 字段**：无

**测试门禁**：

| 测试文件                | 测试用例                                     | 类型 |
| ----------------------- | -------------------------------------------- | ---- |
| `actionHandler.test.ts` | `handleViewedRole` happy: 标记成功           | Jest |
| `actionHandler.test.ts` | `handleViewedRole` edge: 非 assigned → 拒绝  | Jest |
| `actionHandler.test.ts` | `handleViewedRole` edge: 全员 viewed → ready | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR3: `START_NIGHT`（`ready → ongoing` + 夜晚字段初始化）

**目标**：Host 点击开始游戏 → 初始化夜晚 → status = ongoing → 播放音频 → 广播

**改动文件**：

| 文件路径                                             | 改动符号             | 说明                                                                   |
| ---------------------------------------------------- | -------------------- | ---------------------------------------------------------------------- |
| `src/services/facade/GameFacade.ts`                  | `startGame()`        | 新增方法：校验 ready → 调 handler → apply → broadcast → 播放音频       |
| `src/services/engine/handlers/gameControlHandler.ts` | `handleStartGame()`  | 修改：前置条件改为 `ready`（不是 seated）；生成 START_NIGHT action     |
| `src/services/engine/reducer/gameReducer.ts`         | `handleStartNight()` | 修改：设置 `currentNightPhase` / `currentStepId`                       |
| `src/services/protocol/types.ts`                     | `BroadcastGameState` | 新增 `currentNightPhase?: NightPhaseType` / `currentStepId?: SchemaId` |
| `src/services/engine/reducer/types.ts`               | `StartNightAction`   | payload 新增 `currentNightPhase` / `currentStepId`                     |

**新增 `BroadcastGameState` 字段**：

| 字段                | 类型             | 必须 `?` | 说明                 |
| ------------------- | ---------------- | -------- | -------------------- |
| `currentNightPhase` | `NightPhaseType` | ✅ 可选  | 夜晚 phase（迁移期） |
| `currentStepId`     | `SchemaId`       | ✅ 可选  | 当前步骤 ID          |

**测试门禁**：

| 测试文件                     | 测试用例                                                     | 类型 |
| ---------------------------- | ------------------------------------------------------------ | ---- |
| `gameControlHandler.test.ts` | `handleStartGame` happy: ready → ongoing                     | Jest |
| `gameControlHandler.test.ts` | `handleStartGame` edge: 非 ready → 拒绝                      | Jest |
| `gameReducer.test.ts`        | `START_NIGHT` 设置 `currentNightPhase` = `'NightBeginAudio'` | Jest |
| `gameReducer.test.ts`        | `START_NIGHT` 设置 `currentStepId` = `NIGHT_STEPS[0].id`     | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR4: `SUBMIT_ACTION`（非狼人角色）

**目标**：Player 提交夜晚行动 → Host 验证 → resolver 计算 → 广播结果

**改动文件**：

| 文件路径                                        | 改动符号                    | 说明                                         |
| ----------------------------------------------- | --------------------------- | -------------------------------------------- |
| `src/services/facade/GameFacade.ts`             | `submitAction()`            | 新增方法（Player 端发 PlayerMessage）        |
| `src/services/facade/GameFacade.ts`             | `hostHandlePlayerMessage()` | 新增 case `'ACTION'`                         |
| `src/services/engine/handlers/actionHandler.ts` | `handleSubmitAction()`      | 校验 phase/role → 调 resolver → apply result |

**新增/修改 `BroadcastGameState` 字段**：无（reveal 字段已存在）

**测试门禁**：

| 测试文件                | 测试用例                                                           | 类型 |
| ----------------------- | ------------------------------------------------------------------ | ---- |
| `actionHandler.test.ts` | `handleSubmitAction` happy: seer 查验 → seerReveal                 | Jest |
| `actionHandler.test.ts` | `handleSubmitAction` edge: 非 ongoing → 拒绝                       | Jest |
| `actionHandler.test.ts` | `handleSubmitAction` edge: nightmare blockedSeat → valid no-effect | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR5: `SUBMIT_WOLF_VOTE`（含 allVoted resolve）

**目标**：狼人投票 → 收集 → allVoted → resolve 最终目标 → record action

**改动文件**：

| 文件路径                                        | 改动符号                    | 说明                                                      |
| ----------------------------------------------- | --------------------------- | --------------------------------------------------------- |
| `src/services/facade/GameFacade.ts`             | `submitWolfVote()`          | 新增方法                                                  |
| `src/services/facade/GameFacade.ts`             | `hostHandlePlayerMessage()` | 新增 case `'WOLF_VOTE'`                                   |
| `src/services/engine/handlers/actionHandler.ts` | `handleSubmitWolfVote()`    | 新增：校验 wolf role → 记录投票 → 检查 allVoted → resolve |

**新增/修改 `BroadcastGameState` 字段**：无

**测试门禁**：

| 测试文件                | 测试用例                                                       | 类型 |
| ----------------------- | -------------------------------------------------------------- | ---- |
| `actionHandler.test.ts` | `handleSubmitWolfVote` happy: 3 狼投同一目标                   | Jest |
| `actionHandler.test.ts` | `handleSubmitWolfVote` edge: 狼刀自己 → 允许（neutral judge）  | Jest |
| `actionHandler.test.ts` | `handleSubmitWolfVote` edge: nightmare 封狼 → wolfKillDisabled | Jest |

**回滚策略**：`git revert` 整个 PR

---

### PR6: `ADVANCE / AUDIO / END_NIGHT`（Night-1 完整流程）

**目标**：步骤推进 → 音频播放 → endNight → 死亡计算 → ended

**改动文件**：

| 文件路径                                     | 改动符号                      | 说明                                   |
| -------------------------------------------- | ----------------------------- | -------------------------------------- |
| `src/services/facade/GameFacade.ts`          | `advanceToNextAction()`       | 新增：推进步骤 + 播放音频              |
| `src/services/facade/GameFacade.ts`          | `endNight()`                  | 新增：计算死亡 + 广播                  |
| `src/services/facade/GameFacade.ts`          | `playCurrentRoleAudio()`      | 新增：根据 step 播放音频               |
| `src/services/engine/reducer/gameReducer.ts` | `handleAdvanceToNextAction()` | 更新 phase/stepId/currentActionerIndex |
| `src/services/engine/reducer/gameReducer.ts` | `handleEndNight()`            | 已存在                                 |

**新增/修改 `BroadcastGameState` 字段**：无（PR3 已加）

**测试门禁**：

| 测试文件                       | 测试用例                                          | 类型                   |
| ------------------------------ | ------------------------------------------------- | ---------------------- |
| `GameFacade.nightFlow.test.ts` | 完整 Night-1 流程                                 | Jest                   |
| `e2e/night1.basic.spec.ts`     | 创建 → 入座 → 分配 → 查看 → 开始 → action → ended | Playwright (workers=1) |

**回滚策略**：`git revert` 整个 PR

---

## 5. 验收门禁 Checklist

### 5.1 Jest 单测

| 测试类别                     | 覆盖内容                                        | 最低要求                               |
| ---------------------------- | ----------------------------------------------- | -------------------------------------- |
| `gameControlHandler.test.ts` | `handleAssignRoles`                             | 1 happy + 2 edge                       |
| `gameControlHandler.test.ts` | `handleStartGame` (ready → ongoing)             | 1 happy + 1 edge                       |
| `actionHandler.test.ts`      | `handleViewedRole`                              | 1 happy + 2 edge                       |
| `actionHandler.test.ts`      | `handleSubmitAction`                            | 1 happy + 2 edge（含 nightmare block） |
| `actionHandler.test.ts`      | `handleSubmitWolfVote`                          | 1 happy + 2 edge（含 neutral judge）   |
| `gameReducer.test.ts`        | `ASSIGN_ROLES` → status = assigned              | 1                                      |
| `gameReducer.test.ts`        | `START_NIGHT` → currentNightPhase/currentStepId | 2                                      |
| 每个 resolver                | happy + nightmare block                         | 各 2                                   |

### 5.2 合约测试

| 测试                        | 断言内容                                     |
| --------------------------- | -------------------------------------------- |
| `currentStepId` 来源        | 必须是 `NIGHT_STEPS[idx].id`，不得新增平行表 |
| `currentNightPhase` 值域    | 必须是 `NightPhase` enum 字面量之一          |
| `NIGHT_STEPS` 顺序 snapshot | 防止意外变更                                 |

### 5.3 禁止项扫描

| 扫描项                     | 方法                                     |
| -------------------------- | ---------------------------------------- |
| runtime 不得 import legacy | `grep -r "from '.*legacy" src/services/` |
| 无 hostOnly state          | `grep -r "hostOnly\|HostOnlyState" src/` |
| 无 runtime feature flag    | `grep -r "ENABLE_" src/`                 |

### 5.4 E2E（可选）

| 测试                   | 覆盖路径                                               | 配置        |
| ---------------------- | ------------------------------------------------------ | ----------- |
| `night1.basic.spec.ts` | 创建 → 入座 → 分配 → 查看 → 开始 → 提交 action → ended | `workers=1` |

---

## 6. 禁止出现的内容（出现直接退回）

| 禁止项                                | 说明                                                                |
| ------------------------------------- | ------------------------------------------------------------------- |
| runtime feature flag / fallback       | 不允许 `if (useNew) { ... } else { legacy }`                        |
| hostOnly state / HostLocalState       | 所有状态必须进 `BroadcastGameState`                                 |
| 伪 API                                | 不允许使用 repo 中不存在的函数签名（如自造的 `restoreFromState()`） |
| UI 文案作为逻辑 key                   | 必须使用稳定 id：`SchemaId` / `RoleId`                              |
| 跳过 `ready` 状态                     | 必须 `seated → assigned → ready → ongoing`                          |
| 把 assignRoles 和 startNight 混在一起 | 必须分开：PR1 = assignRoles，PR3 = startNight                       |

---

## 附录 A：NightPhase 与 BroadcastGameState.currentNightPhase 对照

Legacy `NightFlowController.NightPhase` enum（`src/services/NightFlowController.ts` L23-37）：

```typescript
export enum NightPhase {
  Idle = 'Idle',
  NightBeginAudio = 'NightBeginAudio',
  RoleBeginAudio = 'RoleBeginAudio',
  WaitingForAction = 'WaitingForAction',
  RoleEndAudio = 'RoleEndAudio',
  NightEndAudio = 'NightEndAudio',
  Ended = 'Ended',
}
```

`BroadcastGameState.currentNightPhase` 类型定义：

```typescript
export type NightPhaseType =
  | 'Idle'
  | 'NightBeginAudio'
  | 'RoleBeginAudio'
  | 'WaitingForAction'
  | 'RoleEndAudio'
  | 'NightEndAudio'
  | 'Ended';
```

**两者字面量完全一致。**

---

## 附录 B：状态字段 → 派生 UI 显示对照表

（证明没有 hostOnly state，所有 UI 显示都可从 `BroadcastGameState` 派生）

| 字段                                  | UI 显示                        | 可见条件                             |
| ------------------------------------- | ------------------------------ | ------------------------------------ |
| `status`                              | 房间状态/按钮可用性            | 所有玩家                             |
| `players[seat].role`                  | 角色图标                       | `seat === mySeat` 或特定互看规则     |
| `players[seat].hasViewedRole`         | "未看牌"标记                   | Host 全部；Player 只见自己           |
| `currentActionerIndex`                | 当前行动角色                   | 所有玩家                             |
| `currentNightPhase`                   | 夜晚阶段指示器                 | 所有玩家（缺失视为 Idle）            |
| `currentStepId`                       | 当前步骤名称                   | 所有玩家（缺失不显示）               |
| `isAudioPlaying`                      | 音频播放指示器                 | 所有玩家                             |
| `currentNightResults.wolfVotesBySeat` | 狼人投票进度（seat -> target） | `isWolfRole(myRole)`                 |
| `witchContext`                        | 女巫面板                       | `myRole === 'witch'`                 |
| `seerReveal`                          | 预言家结果                     | `myRole === 'seer'`                  |
| `psychicReveal`                       | 通灵师结果                     | `myRole === 'psychic'`               |
| `gargoyleReveal`                      | 石像鬼结果                     | `myRole === 'gargoyle'`              |
| `wolfRobotReveal`                     | 机械狼结果                     | `myRole === 'wolfRobot'`             |
| `confirmStatus`                       | 猎人/狼王确认                  | `myRole === confirmStatus.role`      |
| `actionRejected`                      | 行动被拒绝 toast               | `myUid === actionRejected.targetUid` |
| `nightmareBlockedSeat`                | 被封锁标记                     | 所有玩家                             |
| `wolfKillDisabled`                    | 狼刀失效                       | `isWolfRole(myRole)`                 |
| `lastNightDeaths`                     | 死亡公告                       | 所有玩家                             |

---

**方案状态**：v1.3 待评审

请按 Legacy 权威对照表 + 验收门禁逐条审核，通过后我将按 PR 顺序开始编码。
