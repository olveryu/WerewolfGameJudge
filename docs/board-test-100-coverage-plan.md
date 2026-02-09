# Board Test 100% Dialog Coverage Plan

> 生成日期：2026-02-09
> 基于 commit `1f4deae` 分析

---

## 1. 现状概要

### 1.1 测试矩阵

| 板子 | 测试文件 | 已覆盖 dialog 类型 |
|---|---|---|
| 标准板12人 | `standard.12p.board.ui.test.tsx` | actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger |
| 狼美守卫12人 | `wolfQueen.12p.board.ui.test.tsx` | actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm |
| 狼王守卫12人 | `darkWolfKing.12p.board.ui.test.tsx` | actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt, skipConfirm |
| 石像鬼守墓人12人 | `gargoyle.12p.board.ui.test.tsx` | actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger |
| 梦魇守卫12人 | `nightmare.12p.board.ui.test.tsx` | actionPrompt, wolfVote, actionRejected, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm |
| 血月猎魔12人 | `bloodMoon.12p.board.ui.test.tsx` | actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt |
| 狼王摄梦人12人 | `dreamcatcher.12p.board.ui.test.tsx` | actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt |
| 狼王魔术师12人 | `magician.12p.board.ui.test.tsx` | actionPrompt, wolfVote, confirmTrigger, witchSavePrompt, witchPoisonPrompt, magicianFirst, actionConfirm |
| 机械狼通灵师12人 | `wolfRobot.12p.board.ui.test.tsx` | actionPrompt, wolfVote, wolfRobotHunterStatus, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm |
| 恶灵骑士12人 | `spiritKnight.12p.board.ui.test.tsx` | actionPrompt, wolfVote, witchSavePrompt, witchPoisonPrompt, confirmTrigger, skipConfirm |

### 1.2 补充测试文件

| 文件 | 已覆盖 |
|---|---|
| `nonActioner.perspective.ui.test.tsx` | 5 negative tests (非行动者无 dialog) |
| `verticalSlice.integration.ui.test.tsx` | 2 integration tests (real BroadcastGameState) |

---

## 2. Bug 报告：4 个死函数

在 `useRoomActionDialogs.ts` 中发现 **4 个永远不会被调用** 的函数。

### 2.1 验证方法

```bash
# 在 src/ 下搜索实际调用点（排除定义和 mock）
grep -rn '\.showWitchSaveDialog(' src/ --include='*.ts' --include='*.tsx' | grep -v 'useRoomActionDialogs.ts' | grep -v '__tests__'
# 结果：0 匹配

grep -rn '\.showWitchPoisonPrompt(' src/ --include='*.ts' --include='*.tsx' | grep -v 'useRoomActionDialogs.ts' | grep -v '__tests__'
# 结果：0 匹配

grep -rn '\.showWitchPoisonConfirm(' src/ --include='*.ts' --include='*.tsx' | grep -v 'useRoomActionDialogs.ts' | grep -v '__tests__'
# 结果：0 匹配

grep -rn '\.showBlockedAlert(' src/ --include='*.ts' --include='*.tsx' | grep -v 'useRoomActionDialogs.ts' | grep -v '__tests__'
# 结果：0 匹配
```

### 2.2 死函数清单

| 死函数 | 行号 | 原始用途 | 为什么没被调用 |
|---|---|---|---|
| `showWitchSaveDialog` | L169 | 救人确认/无法自救/无人倒台 三分支 | Orchestrator 用 `showWitchInfoPrompt` + `showConfirmDialog` 代替 |
| `showWitchPoisonPrompt` | L198 | 毒药提示弹窗 | Orchestrator 没有引用 |
| `showWitchPoisonConfirm` | L210 | `确定要毒杀X号玩家吗？` 确认弹窗 | Orchestrator 用通用 `showConfirmDialog` 代替 |
| `showBlockedAlert` | L107 | `技能被封锁` 提示弹窗 | 梦魇阻断走的是 `showActionRejectedAlert`（Host 主动 reject） |

### 2.3 后果

1. **3 个 DialogType 永远不可达**：
   - `witchCannotSave` — 只有死函数 `showWitchSaveDialog(killedSeat, canSave=false, ...)` 能产出标题 `昨夜倒台玩家为X号（你自己）`
   - `witchSaveConfirm` — 只有死函数 `showWitchSaveDialog(killedSeat, canSave=true, ...)` 能产出标题 `昨夜倒台玩家为X号` + message `是否救助?`
   - `witchPoisonConfirm` — 只有死函数 `showWitchPoisonConfirm` 能产出标题包含 `毒杀` 且包含 `号`

2. **潜在 UX 问题**：女巫被狼杀时（killedSeat = 自己, canSave=false），当前只看到通用 `昨夜X号玩家死亡` info。原设计有 `女巫无法自救` 明确提示，但死函数未被接入。**功能逻辑不受影响**（save 按钮由 Host `canSave=false` 控制，不会出现）。

### 2.4 处理方案（独立 commit）

删除 4 个死函数 + interface/return 对应字段。从 RoomScreenTestHarness DialogType 中移除 `witchCannotSave`、`witchSaveConfirm`、`witchPoisonConfirm`、`blocked`。

---

## 3. 可达 DialogType 与 UI Path 完整矩阵

### 3.1 所有可达的 DialogType

根据 `useActionOrchestrator.ts` 中 `handleActionIntent` 的 big switch + `useRoomActionDialogs.ts` 中实际被调用的函数，以下是所有可达的 dialog type：

| DialogType | 触发方式 | 对应 dialog 函数 |
|---|---|---|
| `actionPrompt` | Auto-trigger on mount (每个角色自己的回合) | `showRoleActionPrompt` / `showWitchInfoPrompt` |
| `wolfVote` | Seat tap during wolfKill step | `showWolfVoteDialog(target ≥ 0)` |
| `wolfVoteEmpty` | Bottom button "空刀" | `showWolfVoteDialog(target = -1)` |
| `witchSavePrompt` | Auto-trigger + witchContext (killedSeat ≥ 0) | `showWitchInfoPrompt` → title 包含 `玩家死亡` |
| `witchNoKill` | Auto-trigger + witchContext (killedSeat = -1) | `showWitchInfoPrompt` → title = `昨夜无人倒台` |
| `witchPoisonPrompt` | Seat tap during witchAction | `showConfirmDialog` → title 包含 `确认` |
| `actionConfirm` | Seat tap on chooseSeat (no revealKind) / compound /swap 2nd | `showConfirmDialog` / `confirmThenAct` |
| `skipConfirm` | Bottom button "不使用技能" | `showConfirmDialog(title='确认跳过')` |
| `confirmTrigger` | Bottom button "查看发动状态" | `showRoleActionPrompt(title=schema.statusDialogTitle)` |
| `actionRejected` | Host ACTION_REJECTED payload | `showActionRejectedAlert(title='操作无效')` |
| `magicianFirst` | Seat tap on swap (1st selection) | `showMagicianFirstAlert` |
| `wolfRobotHunterStatus` | Bottom button "查看技能状态" | `showRoleActionPrompt(title=hunterGateDialogTitle)` |
| `seerReveal` | Seat tap → reveal flow → Host data | `showRevealDialog(title 包含 '预言家'/'查验结果')` |
| `psychicReveal` | 同上 | `showRevealDialog(title 包含 '通灵师')` |
| `gargoyleReveal` | 同上 | `showRevealDialog(title 包含 '石像鬼')` |
| `wolfRobotReveal` | 同上 | `showRevealDialog(title 包含 '机械狼'/'你学习了')` |

**注意：** `witchPoisonPrompt` 在 board test 中通过 seat tap 触发，实际 dialog 标题是 `确认行动` 或 schema confirmText，harness 分类规则将其匹配到 `actionConfirm`。但现有测试未出问题是因为 witchPoisonPrompt 测试实际验证的是 `harness.hasSeen('witchPoisonPrompt') || harness.hasSeen('witchPoisonConfirm') || harness.hasSeen('actionConfirm')`（OR 断言）。

### 3.2 每个角色完整 UI Path

#### Seer（预言家）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `reveal` → `actionConfirm` → (Host 返回) → `seerReveal` |
| 跳过 | Bottom "不使用技能" | `skip` → `skipConfirm` |

#### Witch（女巫）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤（有人死） | Auto-trigger + witchContext(killedSeat ≥ 0) | `actionPrompt` → `witchSavePrompt` |
| 进入步骤（无人死） | Auto-trigger + witchContext(killedSeat = -1) | `actionPrompt` → `witchNoKill` |
| 点座位（毒） | Seat tap | `actionConfirm`(stepKey=poison) → `actionConfirm` |
| 救人按钮 | Bottom "save" (when canSave) | `actionConfirm`(stepKey=save) → `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skip`(stepKey=skipAll) → `skipConfirm` |

**注意**：`witchCannotSave` 和 `witchSaveConfirm` 是死代码路径（见 §2），实际通过 Host 的 canSave=false 来控制 save 按钮是否出现。

#### Hunter（猎人）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 查看发动状态 | Bottom button | `confirmTrigger`(canShoot=true or false) |

#### DarkWolfKing（黑狼王）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 查看发动状态 | Bottom button | `confirmTrigger`(canShoot=true or false) |

#### Guard（守卫）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Nightmare（梦魇）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Wolf（狼人）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `wolfVote` |
| 空刀 | Bottom "空刀" | `wolfVoteEmpty` (target = -1) |

#### WolfQueen（狼美人）

**wolfKill 步骤**：与 wolf 相同（互知 + 参刀）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入魅惑步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Magician（魔术师）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点第一个座位 | Seat tap | `magicianFirst` |
| 点第二个座位 | Seat tap | `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Dreamcatcher（摄梦人）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `actionConfirm` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Gargoyle（石像鬼）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `reveal` → `actionConfirm` → (Host) → `gargoyleReveal` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Psychic（通灵师）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `reveal` → `actionConfirm` → (Host) → `psychicReveal` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### WolfRobot（机械狼）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `reveal` → `actionConfirm` → (Host) → `wolfRobotReveal` |
| 查到猎人 | Bottom "查看技能状态" | `wolfRobotHunterStatus` |
| 跳过 | Bottom "不使用技能" | `skipConfirm` |

#### Slacker（混子）

| Path | 触发 | Intent → DialogType |
|---|---|---|
| 进入步骤 | Auto-trigger | `actionPrompt` |
| 点座位 | Seat tap | `actionConfirm` |
| **无跳过** | canSkip=false | 底部无按钮 |

**注意**：slacker 不在任何 12P PRESET_TEMPLATES 中，需要独立测试。

---

## 4. 缺口清单

### 4.1 角色 × 路径 缺口

| 角色 | 缺失路径 | 测试文件 | 优先级 |
|---|---|---|---|
| **Seer** | `actionConfirm`（seat tap 确认） | standard.12p | P0 |
| **Seer** | `skipConfirm` | standard.12p | P0 |
| **Seer** | `seerReveal`（需 reactive mock 模拟 Host reveal data） | reveal.integration (新建) | P1 |
| **Witch** | `witchNoKill`（killedSeat=-1 auto-trigger） | standard.12p | P0 |
| **Witch** | `skipConfirm`（skipAll） | standard.12p | P0 |
| **Witch** | Save actionConfirm chain（bottom save → confirm） | standard.12p | P0 |
| **Wolf** | `wolfVoteEmpty`（空刀） | standard.12p | P0 |
| **Guard** | `actionConfirm`（seat tap 选人确认） | nightmare.12p or wolfQueen.12p | P0 |
| **Nightmare** | `actionConfirm`（seat tap 选人确认） | nightmare.12p | P0 |
| **Nightmare** | `skipConfirm` | nightmare.12p | P0 |
| **Nightmare** | Blocked guard → actionRejected | nightmare.12p | P1 |
| **WolfQueen** | charm `actionPrompt` | wolfQueen.12p | P0 |
| **WolfQueen** | charm `actionConfirm` | wolfQueen.12p | P0 |
| **WolfQueen** | charm `skipConfirm` | wolfQueen.12p | P0 |
| **DarkWolfKing** | `confirmTrigger` canShoot=false | darkWolfKing.12p | P0 |
| **Dreamcatcher** | `actionConfirm` | dreamcatcher.12p | P0 |
| **Dreamcatcher** | `skipConfirm` | dreamcatcher.12p | P0 |
| **Gargoyle** | `actionConfirm`（reveal 前的确认） | gargoyle.12p | P0 |
| **Gargoyle** | `skipConfirm` | gargoyle.12p | P0 |
| **Gargoyle** | `gargoyleReveal` | reveal.integration (新建) | P1 |
| **Psychic** | `actionConfirm` | wolfRobot.12p | P0 |
| **Psychic** | `skipConfirm` | wolfRobot.12p | P0 |
| **Psychic** | `psychicReveal` | reveal.integration (新建) | P1 |
| **WolfRobot** | `actionConfirm`（learn 确认） | wolfRobot.12p | P0 |
| **WolfRobot** | `skipConfirm` | wolfRobot.12p | P0 |
| **WolfRobot** | `wolfRobotReveal` | reveal.integration (新建) | P1 |
| **Magician** | `skipConfirm` | magician.12p | P0 |
| **Slacker** | `actionPrompt` + `actionConfirm`（全部） | slacker.standalone (新建) | P0 |
| **SpiritKnight** | guard `actionConfirm` | spiritKnight.12p | P1 |

### 4.2 跨角色互动缺口（非 board test 范围）

以下场景属于 **engine resolver 层** 或 **integration 层**，不在 board UI test 范围内：

| 场景 | 原因 |
|---|---|
| 同守同救必死 | DeathCalculator rule，UI test 不涉及死亡计算 |
| 恶灵骑士反弹致死 | Resolver 级别逻辑 |
| 摄梦人/狼美人连带死亡 | Resolver 级别逻辑 |
| 魔术师换位影响查验 | Resolver 级别逻辑 |

Board test 的职责边界是 **UI dialog 能正确触发和显示**，不覆盖 Host 逻辑。

---

## 5. 实施方案

### 5.1 Layer 1：harness 新增 helpers

**文件：`boardTestUtils.ts`**

新增以下 coverage chain helpers：

```typescript
// 1. chooseSeat actionConfirm chain（通用）
// 适用：seer（reveal前确认）、guard、nightmare、wolfQueen charm、dreamcatcher、gargoyle、psychic、wolfRobot learn
coverageChainActionConfirm(harness, setMock, renderFn, schemaId, actionRole, playerRole, seatNumber, targetSeat)
// → tapSeat(targetSeat) → wait actionConfirm → pressPrimary → assert submitAction called

// 2. wolfVoteEmpty chain
coverageChainWolfVoteEmpty(harness, setMock, renderFn, wolfRole, wolfSeat, wolfAssignments)
// → press bottom "空刀" → wait wolfVoteEmpty → pressPrimary → assert submitWolfVote(-1)

// 3. witch witchNoKill chain
coverageChainWitchNoKill(harness, setMock, renderFn, seatNumber)
// → mock witchContext(killedSeat=-1) → wait for witchNoKill dialog
```

**文件：`boardDialogCoverage.ts`**

扩展 `ROLE_UI_DIALOG_REQUIREMENTS`，为所有 chooseSeat 角色加 `actionConfirm`。

### 5.2 Layer 2：现有板子补全

#### standard.12p（+6 tests）

```
describe('seer actionConfirm coverage')
  it('seer: seat tap shows actionConfirm dialog')

describe('seer skipConfirm coverage')
  it('seer: skip button shows skipConfirm dialog')

describe('witchNoKill coverage')
  it('witch: shows witchNoKill when killedSeat=-1')

describe('witch skipAll coverage')
  it('witch: skip button shows skipConfirm dialog')

describe('wolfVoteEmpty coverage')
  it('wolf: empty knife button shows wolfVoteEmpty dialog')

// Coverage assertion 更新: +actionConfirm, +skipConfirm (seer), +witchNoKill, +wolfVoteEmpty
```

#### wolfQueen.12p（+3 tests）

```
describe('wolfQueenCharm coverage')
  it('wolfQueen charm step: shows actionPrompt')
  it('wolfQueen charm: seat tap shows actionConfirm')
  it('wolfQueen charm: skip shows skipConfirm')

// Coverage assertion 更新: 分两段 — wolfKill 阶段 + wolfQueenCharm 阶段
```

#### darkWolfKing.12p（+1 test）

```
describe('confirmTrigger coverage')
  it('darkWolfKing poisoned: confirmTrigger shows cannotShoot message')
    // gameStateOverrides: { confirmStatus: { role: 'darkWolfKing', canShoot: false } }
```

#### nightmare.12p（+3 tests）

```
describe('nightmare actionConfirm coverage')
  it('nightmare: seat tap shows actionConfirm dialog')

describe('nightmare skipConfirm coverage')
  it('nightmare: skip button shows skipConfirm')

describe('blocked guard actionRejected coverage')
  it('blocked guard: tapSeat → Host rejects → actionRejected')
    // 使用 coverageChainNightmareBlocked(..., 'guardProtect', 'guard', guardSeat, ...)
```

#### dreamcatcher.12p（+2 tests）

```
describe('dreamcatcher actionConfirm coverage')
  it('dreamcatcher: seat tap shows actionConfirm dialog')

describe('dreamcatcher skipConfirm coverage')
  it('dreamcatcher: skip button shows skipConfirm')
```

#### magician.12p（+1 test）

```
describe('magician skipConfirm coverage')
  it('magician: skip button shows skipConfirm dialog')
```

#### wolfRobot.12p（+4 tests）

```
describe('wolfRobot learn actionConfirm coverage')
  it('wolfRobot: seat tap shows actionConfirm for learn')

describe('wolfRobot learn skipConfirm coverage')
  it('wolfRobot: skip button shows skipConfirm')

describe('psychic actionConfirm coverage')
  it('psychic: seat tap shows actionConfirm for check')

describe('psychic skipConfirm coverage')
  it('psychic: skip button shows skipConfirm')
```

#### gargoyle.12p（+2 tests）

```
describe('gargoyle actionConfirm coverage')
  it('gargoyle: seat tap shows actionConfirm for check')

describe('gargoyle skipConfirm coverage')
  it('gargoyle: skip button shows skipConfirm')
```

#### spiritKnight.12p（+1 test）

```
describe('guard actionConfirm coverage')
  it('guard: seat tap shows actionConfirm')
```

### 5.3 Layer 3：新文件

#### `reveal.integration.ui.test.tsx`（4 tests）

用 reactive mock 模拟 Host 返回 reveal data：

```
describe('Reveal dialog integration')
  it('seer reveal: shows seerReveal after Host data arrives')
  it('psychic reveal: shows psychicReveal after Host data arrives')
  it('gargoyle reveal: shows gargoyleReveal after Host data arrives')
  it('wolfRobot reveal: shows wolfRobotReveal after Host data arrives')
```

**实现要点**：
- 使用 `createReactiveGameRoomMock` + `jest.useFakeTimers()`
- Seat tap → actionConfirm → pressPrimary（triggerConfirm/act） → `simulateStateUpdate({ seerReveal: ... })` → advance timers → wait for revealDialog

#### `slacker.standalone.board.ui.test.tsx`（2 tests）

```
describe('Slacker standalone')
  it('slacker: shows actionPrompt')
  it('slacker: seat tap shows actionConfirm (canSkip=false, no skip button)')
```

**注意**：slacker 不在任何 12P preset 中，不受 `boardDialogCoverage.ts` 的 10 板约束。独立测试。

### 5.4 Layer 4：死代码清理

**独立 commit，不影响覆盖率。**

#### `useRoomActionDialogs.ts`

删除：
- `showWitchSaveDialog`（定义 L169-195 + interface L63-68 + return L261）
- `showWitchPoisonPrompt`（定义 L198-204 + interface L71 + return L262）
- `showWitchPoisonConfirm`（定义 L210-221 + interface L74-79 + return L263）
- `showBlockedAlert`（定义 L107-112 + interface L38 + return L256）

#### `RoomScreenTestHarness.ts`

从 `DialogType` union 中移除：
- `witchCannotSave`
- `witchSaveConfirm`
- `witchPoisonConfirm`
- `blocked`

从 `CLASSIFICATION_RULES` 中移除对应的 match 规则。

#### 旧 UI test mock 文件

以下文件中的 mock 对象（`showWitchSaveDialog`, `showWitchPoisonPrompt`, `showWitchPoisonConfirm`）需清理：
- `witchPoison.ui.test.tsx`
- `wolfVote.ui.test.tsx`
- `schemas.smoke.ui.test.tsx`
- `magicianSwap.ui.test.tsx`

---

## 6. 执行顺序

```
Commit 1: test(boards): add missing dialog coverage for all roles
  - Layer 1: harness helpers
  - Layer 2: 现有板子补全（23 tests）
  - Layer 3: 新文件（6 tests）
  - 总计: +29 tests
  - 跑 jest 确认全绿

Commit 2: refactor(dialogs): remove dead witch/blocked functions
  - Layer 4: 死代码清理
  - 跑 jest 确认全绿
```

---

## 7. 完成后覆盖率

| DialogType | 测试状态 |
|---|---|
| `actionPrompt` | ✅ 所有角色所有板子 |
| `wolfVote` | ✅ 所有有狼的板子 |
| `wolfVoteEmpty` | ✅ standard.12p |
| `witchSavePrompt` | ✅ 所有有女巫的板子 |
| `witchNoKill` | ✅ standard.12p |
| `witchPoisonPrompt` | ✅ 所有有女巫的板子 |
| `actionConfirm` | ✅ 所有 chooseSeat/compound/swap 角色 |
| `skipConfirm` | ✅ 所有 canSkip=true 角色 |
| `confirmTrigger` | ✅ hunter + darkWolfKing (canShoot true/false) |
| `actionRejected` | ✅ nightmare blocked (seer + witch + guard) |
| `magicianFirst` | ✅ magician.12p |
| `wolfRobotHunterStatus` | ✅ wolfRobot.12p (7 tests) |
| `seerReveal` | ✅ reveal.integration |
| `psychicReveal` | ✅ reveal.integration |
| `gargoyleReveal` | ✅ reveal.integration |
| `wolfRobotReveal` | ✅ reveal.integration |

**所有 16 个可达 DialogType × 全部角色路径 = 100% 覆盖。**

---

## 8. 不在范围内的场景

| 场景 | 原因 | 在哪里测 |
|---|---|---|
| 同守同救必死 | DeathCalculator | engine resolver tests |
| 恶灵骑士反弹 | Resolver | engine resolver tests |
| 摄梦人连带死亡 | Resolver | engine resolver tests |
| 狼美人连带死亡 | Resolver | engine resolver tests |
| 魔术师换位影响查验 | Resolver | engine resolver tests |
| notSelf 约束拒绝 | Host validation | engine handler tests |
| 连续守同一人约束 | Night-2+ | 仅 Night-1 范围 |

Board UI test 的职责边界：**验证每个角色的每个 UI 操作能正确触发对应的 showAlert dialog 并调用正确的 hook callback**。Host 逻辑验证由 engine tests 负责。
