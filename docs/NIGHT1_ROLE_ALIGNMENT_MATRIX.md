# Night-1 角色对齐矩阵

> 生成日期: 2026-01-22
> 版本: Handler→Facade→UI 架构

## 概述

本文档记录 Night-1 所有角色/步骤/行动的完整行为对齐。

## NIGHT_STEPS 顺序（权威）

| 序号 | stepId                | roleId         | audioKey       | audioEndKey |
| ---- | --------------------- | -------------- | -------------- | ----------- |
| 0    | `magicianSwap`        | `magician`     | `magician`     | (同)        |
| 1    | `slackerChooseIdol`   | `slacker`      | `slacker`      | (同)        |
| 2    | `nightmareBlock`      | `nightmare`    | `nightmare`    | (同)        |
| 3    | `dreamcatcherDream`   | `dreamcatcher` | `dreamcatcher` | (同)        |
| 4    | `guardProtect`        | `guard`        | `guard`        | (同)        |
| 5    | `wolfKill`            | `wolf`         | `wolf`         | (同)        |
| 6    | `wolfQueenCharm`      | `wolfQueen`    | `wolfQueen`    | (同)        |
| 7    | `witchAction`         | `witch`        | `witch`        | (同)        |
| 8    | `hunterConfirm`       | `hunter`       | `hunter`       | (同)        |
| 9    | `darkWolfKingConfirm` | `darkWolfKing` | `darkWolfKing` | (同)        |
| 10   | `wolfRobotLearn`      | `wolfRobot`    | `wolfRobot`    | (同)        |
| 11   | `seerCheck`           | `seer`         | `seer`         | (同)        |
| 12   | `gargoyleCheck`       | `gargoyle`     | `gargoyle`     | (同)        |
| 13   | `psychicCheck`        | `psychic`      | `psychic`      | (同)        |

**合约保证**：

- `audioKey === roleId` (由 nightSteps.contract.test.ts 保证)
- stepId 唯一且顺序稳定 (snapshot 测试)

---

## 全角色行为对齐矩阵

### 1. magicianSwap (魔术师)

| 属性               | 值                                            | 说明                                      |
| ------------------ | --------------------------------------------- | ----------------------------------------- |
| **schemaId**       | `magicianSwap`                                |                                           |
| **kind**           | `swap`                                        | 选择两个座位交换身份                      |
| **constraints**    | `[]`                                          | 无约束，可选任意两人                      |
| **canSkip**        | `true`                                        | 可以不使用技能                            |
| **prompt**         | "请选择要交换的两名玩家"                      |                                           |
| **revealKind**     | 无                                            | 无 reveal 弹窗                            |
| **nightmare 阻断** | ✅ 支持                                       | resolver 检查 `blockedSeat === actorSeat` |
| **结果落点**       | `currentNightResults.swappedSeats`            | `[seatA, seatB]`                          |
| **UI 目标限制**    | 任意两个不同座位                              |                                           |
| **失败原因**       | `必须选择两名交换对象` / `不能选择同一个玩家` |                                           |

### 2. slackerChooseIdol (懒惰者)

| 属性               | 值                               | 说明                |
| ------------------ | -------------------------------- | ------------------- |
| **schemaId**       | `slackerChooseIdol`              |                     |
| **kind**           | `chooseSeat`                     |                     |
| **constraints**    | `['notSelf']`                    | 不能选自己          |
| **canSkip**        | `false`                          | **必须选择**        |
| **prompt**         | "请选择你的榜样"                 |                     |
| **revealKind**     | 无                               |                     |
| **nightmare 阻断** | ✅ 支持                          | 阻断后 `result: {}` |
| **结果落点**       | `result.idolTarget` (无 updates) |                     |
| **UI 目标限制**    | 排除自己                         |                     |
| **失败原因**       | `必须选择榜样` / `不能选择自己`  |                     |

### 3. wolfRobotLearn (机器狼)

| 属性               | 值                                                | 说明                            |
| ------------------ | ------------------------------------------------- | ------------------------------- |
| **schemaId**       | `wolfRobotLearn`                                  |                                 |
| **kind**           | `chooseSeat`                                      |                                 |
| **constraints**    | `['notSelf']`                                     |                                 |
| **canSkip**        | `true`                                            |                                 |
| **prompt**         | "请选择要学习的玩家"                              |                                 |
| **revealKind**     | `wolfRobot`                                       | 弹窗显示目标身份                |
| **nightmare 阻断** | ✅ 支持                                           |                                 |
| **魔术师交换**     | ✅ 支持                                           | 查验交换后的身份                |
| **结果落点**       | `wolfRobotReveal: { targetSeat, result: RoleId }` |                                 |
| **ack 阻塞**       | ✅                                                | `pendingRevealAcks += schemaId` |
| **UI 目标限制**    | 排除自己                                          |                                 |
| **失败原因**       | `不能选择自己` / `目标玩家不存在`                 |                                 |

### 4. dreamcatcherDream (摄梦人)

| 属性               | 值                                 | 说明 |
| ------------------ | ---------------------------------- | ---- |
| **schemaId**       | `dreamcatcherDream`                |      |
| **kind**           | `chooseSeat`                       |      |
| **constraints**    | `['notSelf']`                      |      |
| **canSkip**        | `true`                             |      |
| **prompt**         | "请选择要摄梦的玩家"               |      |
| **revealKind**     | 无                                 |      |
| **nightmare 阻断** | ✅ 支持                            |      |
| **结果落点**       | `currentNightResults.dreamingSeat` |      |
| **UI 目标限制**    | 排除自己                           |      |
| **失败原因**       | `不能选择自己`                     |      |

### 5. gargoyleCheck (石像鬼)

| 属性               | 值                                               | 说明                     |
| ------------------ | ------------------------------------------------ | ------------------------ |
| **schemaId**       | `gargoyleCheck`                                  |                          |
| **kind**           | `chooseSeat`                                     |                          |
| **constraints**    | `[]`                                             | 可查自己（中立裁判规则） |
| **canSkip**        | `true`                                           |                          |
| **prompt**         | "请选择要查验的玩家"                             |                          |
| **revealKind**     | `gargoyle`                                       | 弹窗显示完整身份         |
| **nightmare 阻断** | ✅ 支持                                          |                          |
| **魔术师交换**     | ✅ 支持                                          |                          |
| **结果落点**       | `gargoyleReveal: { targetSeat, result: RoleId }` |                          |
| **ack 阻塞**       | ✅                                               |                          |
| **UI 目标限制**    | 所有座位                                         |                          |
| **失败原因**       | `目标玩家不存在`                                 |                          |

### 6. nightmareBlock (梦魇)

| 属性               | 值                                                    | 说明                     |
| ------------------ | ----------------------------------------------------- | ------------------------ |
| **schemaId**       | `nightmareBlock`                                      |                          |
| **kind**           | `chooseSeat`                                          |                          |
| **constraints**    | `[]`                                                  | 可封自己（中立裁判规则） |
| **canSkip**        | `true`                                                |                          |
| **prompt**         | "请选择要封锁的玩家"                                  |                          |
| **revealKind**     | 无                                                    |                          |
| **nightmare 阻断** | ❌ 不适用                                             | 梦魇本身不能被封         |
| **特殊规则**       | 封锁狼人 → `wolfKillDisabled=true`                    |                          |
| **结果落点**       | `currentNightResults.blockedSeat`, `wolfKillDisabled` |                          |
| **UI 目标限制**    | 所有座位                                              |                          |
| **失败原因**       | `目标玩家不存在`                                      |                          |

### 7. guardProtect (守卫)

| 属性               | 值                                | 说明                     |
| ------------------ | --------------------------------- | ------------------------ |
| **schemaId**       | `guardProtect`                    |                          |
| **kind**           | `chooseSeat`                      |                          |
| **constraints**    | `[]`                              | 可守自己（中立裁判规则） |
| **canSkip**        | `true`                            |                          |
| **prompt**         | "请选择要守护的玩家"              |                          |
| **revealKind**     | 无                                |                          |
| **nightmare 阻断** | ✅ 支持                           |                          |
| **结果落点**       | `currentNightResults.guardedSeat` |                          |
| **UI 目标限制**    | 所有座位                          |                          |
| **失败原因**       | 无（canSkip=true）                |                          |

### 8. wolfKill (狼刀)

| 属性                        | 值                                                                          | 说明                                                                                             |
| --------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **schemaId**                | `wolfKill`                                                                  |                                                                                                  |
| **kind**                    | `wolfVote`                                                                  | 特殊：多狼投票机制                                                                               |
| **constraints**             | `[]`                                                                        | 中立裁判：可刀任意座位                                                                           |
| **meeting.canSeeEachOther** | `true`                                                                      | 狼人互相可见                                                                                     |
| **meeting.resolution**      | `majority`                                                                  | 多数投票生效                                                                                     |
| **meeting.allowEmptyVote**  | `true`                                                                      | 可空刀                                                                                           |
| **prompt**                  | "请选择要猎杀的玩家"                                                        |                                                                                                  |
| **emptyVoteText**           | "空刀"                                                                      |                                                                                                  |
| **revealKind**              | 无                                                                          |                                                                                                  |
| **wolfKillDisabled**        | ✅ 检查                                                                     | 梦魇封狼则无法杀人                                                                               |
| **结果落点**                | `currentNightResults.wolfKillTarget`, `currentNightResults.wolfVotesBySeat` |                                                                                                  |
| **UI 目标限制**             | 所有座位（含狼队友/自己）                                                   |                                                                                                  |
| **Host 权威拒绝**           | ✅                                                                          | 免疫狼刀目标会被 Host/Resolver 拒绝，并通过 `actionRejected` 统一弹“操作无效”提示（UI 不做禁用） |
| **失败原因**                | `目标玩家不存在`                                                            |                                                                                                  |

### 9. wolfQueenCharm (狼美人)

| 属性               | 值                                | 说明 |
| ------------------ | --------------------------------- | ---- |
| **schemaId**       | `wolfQueenCharm`                  |      |
| **kind**           | `chooseSeat`                      |      |
| **constraints**    | `['notSelf']`                     |      |
| **canSkip**        | `true`                            |      |
| **prompt**         | "请选择要魅惑的玩家"              |      |
| **revealKind**     | 无                                |      |
| **nightmare 阻断** | ✅ 支持                           |      |
| **结果落点**       | `result.charmTarget` (无 updates) |      |
| **UI 目标限制**    | 排除自己                          |      |
| **失败原因**       | `不能选择自己` / `目标玩家不存在` |      |

### 10. witchAction (女巫)

| 属性               | 值                                                                         | 说明                    |
| ------------------ | -------------------------------------------------------------------------- | ----------------------- |
| **schemaId**       | `witchAction`                                                              |                         |
| **kind**           | `compound`                                                                 | 复合行动：save + poison |
| **步骤**           |                                                                            |                         |
| - save             | `confirmTarget`, constraints=`['notSelf']`                                 | 不能自救                |
| - poison           | `chooseSeat`, constraints=`[]`                                             | 可毒任意座位            |
| **canSkip**        | 两步都可跳过                                                               |                         |
| **prompt**         | "女巫请行动"                                                               |                         |
| **revealKind**     | 无                                                                         |                         |
| **nightmare 阻断** | ✅ 支持                                                                    |                         |
| **特殊规则**       | 同一晚不能同时使用                                                         |                         |
| **witchContext**   | `{ killedIndex, canSave, canPoison }`                                      | Host 设置               |
| **结果落点**       | `currentNightResults.savedSeat`, `poisonedSeat`                            |                         |
| **UI 目标限制**    | save: 被杀者（非自己）; poison: 任意                                       |                         |
| **失败原因**       | `女巫不能自救` / `只能救被狼人袭击的玩家` / `同一晚不能同时使用解药和毒药` |                         |

### 11. seerCheck (预言家)

| 属性               | 值                                        | 说明                     |
| ------------------ | ----------------------------------------- | ------------------------ | --- |
| **schemaId**       | `seerCheck`                               |                          |
| **kind**           | `chooseSeat`                              |                          |
| **constraints**    | `[]`                                      | 可查自己（中立裁判规则） |
| **canSkip**        | `true`                                    |                          |
| **prompt**         | "请选择要查验的玩家"                      |                          |
| **revealKind**     | `seer`                                    | 弹窗显示阵营             |
| **nightmare 阻断** | ✅ 支持                                   |                          |
| **魔术师交换**     | ✅ 支持                                   |                          |
| **结果落点**       | `seerReveal: { targetSeat, result: '好人' | '狼人' }`                |     |
| **ack 阻塞**       | ✅                                        |                          |
| **UI 目标限制**    | 所有座位                                  |                          |
| **失败原因**       | `目标玩家不存在`                          |                          |

### 12. psychicCheck (通灵师)

| 属性               | 值                                              | 说明             |
| ------------------ | ----------------------------------------------- | ---------------- |
| **schemaId**       | `psychicCheck`                                  |                  |
| **kind**           | `chooseSeat`                                    |                  |
| **constraints**    | `[]`                                            | 可查自己         |
| **canSkip**        | `true`                                          |                  |
| **prompt**         | "请选择要通灵的玩家"                            |                  |
| **revealKind**     | `psychic`                                       | 弹窗显示完整身份 |
| **nightmare 阻断** | ✅ 支持                                         |                  |
| **魔术师交换**     | ✅ 支持                                         |                  |
| **结果落点**       | `psychicReveal: { targetSeat, result: RoleId }` |                  |
| **ack 阻塞**       | ✅                                              |                  |
| **UI 目标限制**    | 所有座位                                        |                  |
| **失败原因**       | `目标玩家不存在`                                |                  |

### 13. hunterConfirm (猎人)

| 属性                 | 值                                       | 说明                 |
| -------------------- | ---------------------------------------- | -------------------- |
| **schemaId**         | `hunterConfirm`                          |                      |
| **kind**             | `confirm`                                | 只需确认，无目标选择 |
| **prompt**           | "请点击下方按钮查看技能发动状态"         |                      |
| **bottomActionText** | "发动状态"                               |                      |
| **revealKind**       | 无                                       |                      |
| **nightmare 阻断**   | ❌ 不适用                                | confirm 类型无需检查 |
| **结果落点**         | `confirmStatus: { kind: 'hunter', ... }` |                      |
| **UI 行为**          | 点击按钮确认                             |                      |
| **失败原因**         | 无                                       | 始终 valid           |

### 14. darkWolfKingConfirm (黑狼王)

| 属性                 | 值                                             | 说明       |
| -------------------- | ---------------------------------------------- | ---------- |
| **schemaId**         | `darkWolfKingConfirm`                          |            |
| **kind**             | `confirm`                                      |            |
| **prompt**           | "请点击下方按钮查看技能发动状态"               |            |
| **bottomActionText** | "发动状态"                                     |            |
| **revealKind**       | 无                                             |            |
| **nightmare 阻断**   | ❌ 不适用                                      |            |
| **结果落点**         | `confirmStatus: { kind: 'darkWolfKing', ... }` |            |
| **UI 行为**          | 点击按钮确认                                   |            |
| **失败原因**         | 无                                             | 始终 valid |

---

## Gate 机制对齐

### 音频 Gate (`isAudioPlaying`)

| 环节    | 行为                                                                     |
| ------- | ------------------------------------------------------------------------ |
| Handler | 返回 `PLAY_AUDIO` sideEffect                                             |
| Facade  | 执行前 `setAudioPlayingGate(true)`，finally `setAudioPlayingGate(false)` |
| Reducer | `SET_AUDIO_PLAYING` action 更新 `isAudioPlaying`                         |
| UI      | 读取 `isAudioPlaying`，true 时禁用所有提交按钮                           |

### Reveal Ack Gate (`pendingRevealAcks`)

| 环节    | 行为                                                     |
| ------- | -------------------------------------------------------- |
| Handler | 有 `revealKind` 时返回 `ADD_REVEAL_ACK` action           |
| Reducer | `pendingRevealAcks.push(ackKey)`                         |
| UI      | 显示 reveal 弹窗，用户点确认后发送 `REVEAL_ACK` 消息     |
| Host    | 收到 `REVEAL_ACK` 后执行 `CLEAR_REVEAL_ACKS`，然后可推进 |

### Night Advance Gate

| 条件                             | 说明               |
| -------------------------------- | ------------------ |
| `isAudioPlaying === false`       | 音频播放完毕       |
| `pendingRevealAcks.length === 0` | 所有 reveal 已确认 |
| 当前步骤已有行动                 | action 已记录      |

---

## 与 Legacy 的差异

| 差异点               | 当前行为                      | Legacy 行为              | 决定                                 |
| -------------------- | ----------------------------- | ------------------------ | ------------------------------------ |
| ackKey               | 使用 `schemaId`               | 使用 `revealKind` 字符串 | **按当前架构**：schemaId 更稳定      |
| audioKey             | 使用 `RoleId` 格式            | 使用 snake_case          | **按当前架构**：与 AudioService 对齐 |
| 音频触发             | Handler 声明，Facade 执行     | UI 直接调用              | **按当前架构**：架构更清晰           |
| witchContext.canSave | 综合考虑 killedIndex、notSelf | 部分逻辑分散             | **按当前架构**：schema-first         |
| guardProtect 自守    | schema `[]` + resolver 允许   | UI 层限制                | **按当前架构**：schema-first 对齐    |

---

## 合约测试覆盖

| 测试文件                                   | 覆盖范围                               |
| ------------------------------------------ | -------------------------------------- |
| `nightSteps.contract.test.ts`              | stepId 唯一、顺序稳定、audioKey=roleId |
| `schemaResolverAlignment.contract.test.ts` | canSkip、notSelf 对齐                  |
| `constraints.contract.test.ts`             | 所有 constraint 验证                   |
| `night1Only.contract.test.ts`              | 无跨夜字段                             |
| `night1RoleCoverage.contract.test.ts`      | 全角色覆盖                             |
| `night1FullAlignment.contract.test.ts`     | **全量对齐**：60 个测试                |

---

## 测试通过证据

> 下方数字为初版对齐时的快照，实际测试数量已随后续迭代增长。当前最新数据请运行 `pnpm run test:all`。

```
Test Suites: 23 passed, 23 total
Tests:       485 passed, 485 total
Snapshots:   1 passed, 1 total

=== Night-1 Role Coverage Report ===
Total Steps: 14
With Schema: 14/14 (100%)
With Resolver: 14/14 (100%)
With Audio: 14/14 (100%)
```

---

## 设计决定

### guardProtect 允许自守（Night-1）

- **Schema**: `constraints: []`（无约束）
- **Resolver**: 允许自守（`valid: true`）
- **设计原因**: Night-1 场景下守卫首夜可自守是合法策略（中立裁判规则）
- **Schema-Resolver 对齐**: ✅ 完全对齐

---

## UX-only 限制说明

> **原则**: UI 层原则上不得添加 schema 未定义的业务约束。若确有 UX-only 限制，必须在此显式记录并有测试覆盖。

### 当前 Night-1 的 UX-only 例外（必须测试覆盖）

| 角色                 | Schema 约束         | UI 行为                | UX-only 限制                                                                    |
| -------------------- | ------------------- | ---------------------- | ------------------------------------------------------------------------------- |
| nightmare            | `[]`                | 可选任意座位（含自己） | ❌ 无                                                                           |
| dreamcatcher         | `['notSelf']`       | 自己座位禁用           | ❌ 无（来自 schema）                                                            |
| guard                | `[]`                | 可选任意座位（含自己） | ❌ 无                                                                           |
| seer                 | `[]`                | 可选任意座位（含自己） | ❌ 无                                                                           |
| psychic              | `[]`                | 可选任意座位（含自己） | ❌ 无                                                                           |
| gargoyle             | `[]`                | 可选任意座位（含自己） | ❌ 无                                                                           |
| wolf（狼刀）         | `[]`                | UI 不禁用任何目标      | ❌ 无（改为 Host/Resolver 权威拒绝免疫目标，UI 统一用 `actionRejected` 弹提示） |
| witch（save/poison） | save: `['notSelf']` | 自己座位禁用           | ❌ 无（来自 schema）                                                            |
| slacker              | `['notSelf']`       | 自己座位禁用           | ❌ 无（来自 schema）                                                            |
| wolfQueen            | `['notSelf']`       | 自己座位禁用           | ❌ 无（来自 schema）                                                            |
| wolfRobot            | `['notSelf']`       | 自己座位禁用           | ❌ 无（来自 schema）                                                            |

### 当前约定（替代 UX-only）：Host/Resolver 权威拒绝 + UI 统一提示

- **UI 行为**：狼刀阶段不在座位上做 `immuneToWolfKill` 的禁用/灰显（避免 UI 维护 schema 外规则导致 drift）。
- **Host 行为**：提交免疫目标时，Host/Resolver 返回拒绝，并写入 `actionRejected` 广播。
- **提示入口**：`RoomScreen` 监听 `gameState.actionRejected`，弹出“操作无效”（reason 为具体原因）。
- **测试覆盖**：
  - Host 侧：`packages/game-engine/src/engine/handlers/actionHandler.ts`（wolf vote gate + ACTION_REJECTED）
  - UI 侧：`src/screens/RoomScreen/RoomScreen.tsx`（state-driven actionRejected effect）与对应 UI 测试

---

## 三层对齐测试覆盖

> **Schema-first 架构**: SCHEMAS 是唯一真相，Resolver 必须按 schema 校验，UI 必须从 schema 读取。

### 新增测试文件

| 测试文件                                     | 覆盖范围                         |
| -------------------------------------------- | -------------------------------- |
| `schemaUIResolverAlignment.contract.test.ts` | **三层对齐**：Schema→Resolver→UI |

### 测试内容

#### 1. Schema WITH notSelf 对齐验证

| SchemaId          | Schema 检查                          | Resolver 检查 |
| ----------------- | ------------------------------------ | ------------- |
| dreamcatcherDream | ✅ `constraints.includes('notSelf')` | ✅ 拒绝自指   |
| wolfQueenCharm    | ✅ `constraints.includes('notSelf')` | ✅ 拒绝自指   |
| wolfRobotLearn    | ✅ `constraints.includes('notSelf')` | ✅ 拒绝自指   |
| slackerChooseIdol | ✅ `constraints.includes('notSelf')` | ✅ 拒绝自指   |

#### 2. Schema WITHOUT notSelf 对齐验证

| SchemaId       | Schema 检查                           | Resolver 检查 |
| -------------- | ------------------------------------- | ------------- |
| seerCheck      | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |
| psychicCheck   | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |
| gargoyleCheck  | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |
| nightmareBlock | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |
| guardProtect   | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |
| wolfKill       | ✅ `!constraints.includes('notSelf')` | ✅ 允许自指   |

#### 3. witchAction 复合步骤验证

| 步骤               | Schema 检查     | 说明           |
| ------------------ | --------------- | -------------- |
| witchAction.save   | ✅ `notSelf`    | 女巫不能自救   |
| witchAction.poison | ✅ 无 `notSelf` | 女巫可以毒自己 |

#### 4. UI 无 Hardcode 验证

| 测试项                              | 验证方式                                        |
| ----------------------------------- | ----------------------------------------------- |
| buildSeatViewModels 无角色 hardcode | 检查源码不包含 `'nightmare'`/`'guard'` 等字符串 |
| 所有 chooseSeat/swap schemas 已覆盖 | 完整性检查                                      |

### 测试证据

```
PASS src/screens/RoomScreen/__tests__/schemaUIResolverAlignment.contract.test.ts
  三层对齐 (Schema → Resolver → UI)
    Schema WITH notSelf → Resolver 必须拒绝自指
      ✓ dreamcatcherDream: schema has notSelf constraint
      ✓ dreamcatcherDream: resolver rejects self-target
      ✓ wolfQueenCharm: schema has notSelf constraint
      ✓ wolfQueenCharm: resolver rejects self-target
      ✓ wolfRobotLearn: schema has notSelf constraint
      ✓ wolfRobotLearn: resolver rejects self-target
      ✓ slackerChooseIdol: schema has notSelf constraint
      ✓ slackerChooseIdol: resolver rejects self-target
    Schema WITHOUT notSelf → Resolver 必须允许自指
      ✓ seerCheck: schema has NO notSelf constraint
      ✓ seerCheck: resolver accepts self-target
      ...
    UI 无 Hardcode 验证
      ✓ buildSeatViewModels has no role-specific hardcode for notSelf
      ✓ All chooseSeat/swap schemas are covered in this test
```
