# 统一 Host Reject 回执 + 移除 blocked intent + wolf meeting vote 禁投角色（Schema-first, Night-1-only）方案（v2 中文）

> 这是一份「对外可引用」的整理稿（v2）。目标是把规则边界、协议、Host/UI 职责、落地步骤写成单一真相，避免实现方读完后仍产生“到底改哪、先改哪、能不能动 resolver”的歧义。

---

## 0. 目标、红线、非目标

### 0.1 目标（Goals）

- 任何玩家提交被 Host 判定为“不接受（输入不合法）”的操作时：**必须收到可观测的拒绝回执**，UI 不再出现“点了没反应”。
- 统一梦魇封锁等“只能跳过”的逻辑表达：**不靠 UI blocked intent 作为裁判**，而是让 Host authoritative。
- 支持新增规则：**wolf meeting vote 禁投某些角色**（例如 `spiritKnight`、`wolfQueen`），通过 schema-first 的方式配置，Host 必须拒绝并回执。

### 0.2 关键红线（Non-negotiables）

- **Host 是唯一裁判**。Supabase 只做 transport/discovery/identity，不存储/校验任何游戏逻辑。
- **Night-1-only**：不引入跨夜状态/规则。
- **Anti-cheat**：拒绝原因、占卜类 reveal 等个体化结果必须 `toUid` 私信；public broadcast 仅 room-public view-model。
- **Wolf kill 中立规则**：狼刀（`wolfKill`）默认可 target ANY seat（包括自刀/队友/恶灵骑士）。不要把“结算规则”前移成“输入禁选”。
- 单一真相：不引入平行 order 表/双写映射。

### 0.3 非目标（Not in scope）

- 不做跨夜记忆/连续两晚等规则。
- 不把 reject 写入 public broadcast。
- 不把恶灵骑士免疫/反伤等 **结算规则** 下沉成 `wolfKill` 的输入 constraints。

---

## 1. 问题陈述（为什么要改）

现状存在两类“不可观测”问题：

1) Host 入口静默丢弃：`GameStateService` 在大量非法输入时直接 `return/ignore`。
2) resolver 静默 no-op：部分 resolver 遇到封锁/禁用条件时返回 `valid: true, result: {}`。

两者都会导致：

- 用户侧：“点了没反应”
- 测试侧：无法稳定断言“为什么没效果”

本方案建立一个统一 UX/协议契约：

- **输入不合法（Host 不接受）**：必须 `ACTION_REJECTED` 私信回执。
- **输入合法但结算无效**：由结算层决定（例如 `DeathCalculator`），不依赖回执。

---

## 2. 规则分层：Input Legality vs Resolution

为避免把结算规则塞进 schema/constraint/UI（破坏 wolfKill 红线），将规则分为两类：

### 2.1 输入合法性（Input Legality：能不能提交/被 Host 接受）

典型例子：

- 梦魇封锁：被封锁者本回合只能 skip，提交非 skip 必须被拒绝
- 恶灵骑士不能自刀（actor-specific）
- wolf meeting vote 禁投某些角色（target-based）
- wrong phase / wrong role / role mismatch

落点：Host 接收处（`GameStateService` 的入口 gate，或 host-only resolver validation）

### 2.2 结算规则（Resolution：提交后最终如何生效/如何死亡）

典型例子：

- 恶灵骑士免疫夜伤+反伤
- 女巫被封导致救/毒无效

落点：`DeathCalculator` / 结算层

---

## 3. 新增规则：wolf meeting vote 禁投角色（Spec flags, Design A）

需求：在 wolf meeting vote 中，若投票目标 seat 对应的 `roleId` 属于禁投集合（例如 `spiritKnight`、`wolfQueen`），则该投票必须被 Host **refuse**；玩家必须改投其他目标或选择 skip。

### 3.1 Spec flags 字段

在 wolf meeting vote 对应 schema 的 constraints 中新增：

- `flags.immuneToWolfKill (in ROLE_SPECS)`

语义：

- 当玩家提交 wolf vote，若 `targetSeat.roleId` ∈ `immuneToWolfKill`，Host 必须 reject

### 3.2 Host 行为（必须回执）

- 命中 `immuneToWolfKill`：
  - 不写入 `wolfVotes`
  - 发送 `ACTION_REJECTED(action='submitWolfVote')` 私信
  - reason：例如“该目标不可被见面狼投票，请改投其他目标或跳过”（文案以 Host 为准）

### 3.3 与 wolfKill 红线的关系

- 该规则仅适用于 wolf meeting vote 的输入合法性
- **不得**改 `SCHEMAS.wolfKill.constraints`

---

## 4. 协议：ACTION_REJECTED（私信回执）

### 4.1 为什么必须走私信（Anti-cheat）

拒绝原因属于个体化判定，不能进入 public broadcast。

### 4.2 Payload（最终约定）

在 `src/services/types/PrivateBroadcast.ts` 的 `PrivatePayload` union 新增：

- `kind: 'ACTION_REJECTED'`
- `reason: string`
- `action: 'submitAction' | 'submitWolfVote'`
- 可选：`schemaId?: SchemaId`
- 可选：`requestId?: string`

约束：

- `action` 值域本阶段**只保留** `'submitAction' | 'submitWolfVote'`，不要自行扩张。

---

## 5. Host 侧：统一 gate 原则（单一真相）

### 5.1 核心原则

- Host 入口必须把“输入不合法”从 silent ignore/no-op 收敛为：`sendPrivate(ACTION_REJECTED)` + return
- resolver 继续保持“纯计算/纯解析”，避免 resolver 直接发消息

### 5.2 需要覆盖的输入不合法场景（Night-1-only）

最少覆盖（先打通链路）：

- 梦魇封锁（blockedSeat）：非 skip 一律 reject

随后逐步扩展：

- `wolfKillDisabled`：非“空刀/跳过”一律 reject
- wrong phase / wrong role / role mismatch：至少覆盖主路径

### 5.3 spiritKnight 不能自刀（actor-specific）

在 `GameStateService.handleWolfVote`：

- `player.role === 'spiritKnight' && targetSeat === actorSeat` → reject + `ACTION_REJECTED(action='submitWolfVote')`

### 5.4 wolf meeting vote 禁投角色（target-based, schema-first）

在 `GameStateService.handleWolfVote`：

- 读取 wolf meeting vote schema constraints 的 `immuneToWolfKill`
- 若命中 `targetSeat.roleId` → reject + `ACTION_REJECTED(action='submitWolfVote')`

---

## 6. UI 侧：统一消费 reject（并消除 blocked intent）

### 6.1 统一 UX Contract

- Host 接受：正常推进/正常等待 reveal
- Host 拒绝：弹窗标题统一“操作无效”，正文来自 `reason`

### 6.2 proceedWithAction 的时序（reject 优先）

在 `RoomScreen.tsx`：

1) 提交 action / vote
2) **先等待 `ACTION_REJECTED`（短 timeout，例如 800ms）**
   - 收到则弹窗 + return
3) 再等待对应 reveal（seer/psychic 等）

理由：避免“已拒绝但仍 waitForReveal 卡住”的 UX bug。

### 6.3 移除 blocked intent

`blocked` intent 不是裁判，只能作为 UX 提示。

- 移除 `useRoomActions.ts` 的 blocked intent 分支
- 移除 `RoomScreen.tsx` 的 `case 'blocked'`
- 仍保留底部按钮 UX：封锁时强制显示“跳过（技能被封锁）”

> 约束：实现过程中**不得出现双写**（同时 UI blocked 弹一次 + Host reject 再弹一次）。一旦 Host 在该路径上发送 `ACTION_REJECTED`，UI 就必须走统一消费逻辑。

---

## 7. 实施切片：3 个 commit（可验收）

### Commit 1：打通 ACTION_REJECTED 端到端（Host gate 优先，不动 resolver）

目标：先让“Host 拒绝可观测”成立。

范围：

- `src/services/types/PrivateBroadcast.ts`：新增 `ACTION_REJECTED`
- `src/services/GameStateService.ts`：inbox 存储 + `waitForActionRejected()`
- `src/screens/RoomScreen/RoomScreen.tsx`：提交后先等 reject，再决定是否等 reveal
- Host gate：先挑 **blockedSeat 非 skip** 这条主路径改成 reject（最小链路验证）

验收：

- 被梦魇封锁者点击任意座位：必出现统一“操作无效”弹窗

> resolver 不动：Commit 1 不要求把 `valid:true, result:{}` 改成 `valid:false`。

### Commit 2：移除 blocked intent（避免双逻辑）

目标：统一逻辑，避免 UI 自己当裁判。

范围：

- `src/screens/RoomScreen/hooks/useRoomActions.ts`：移除 blocked intent
- `src/screens/RoomScreen/RoomScreen.tsx`：移除 `case 'blocked'`

验收：

- 封锁者点击座位：仍会提交到 Host → Host reject → 弹窗（不再走 UI blocked）

### Commit 3：wolf vote 输入合法性（spiritKnight self-vote + 禁投角色 Design A）

范围（规则）：

- `src/models/roles/spec/schemas.ts`：wolf meeting vote schema constraints 新增 `flags.immuneToWolfKill (in ROLE_SPECS)`（至少包含 `spiritKnight`、`wolfQueen`）
- `src/services/GameStateService.ts`：`handleWolfVote` 同时覆盖
  - actor-specific：spiritKnight self-vote reject
  - target-based：命中 `immuneToWolfKill` reject

范围（测试）：

- Integration：
  - spiritKnight 投自己 → 必拒绝；可改投/skip
  - 任意狼投 spiritKnight / wolfQueen → 必拒绝；可改投/skip

验收：

- wolf meeting vote 的禁投规则稳定生效且可观测

---

## 8. FAQ（实现方常见疑问，写死口径）

### Q1：Commit 1 要不要同时把 resolver 收敛成 `valid:false + rejectReason`？

不需要。Commit 1 的推荐路径是 **Host 入口 gate**，resolver 保持纯函数风格。

### Q2：reject 和 reveal 的等待要并行 race 吗？

不建议。采用“reject 优先 + 短等待”的顺序，降低串台/取消问题。

### Q3：Commit 1 会不会出现 UI blocked 弹窗 + Host reject 弹窗双写？

不允许。实现过程中必须避免双逻辑；Commit 1 打通 reject 后应尽快进入 Commit 2。

### Q4：Commit 1 的 blockedSeat 检测是否只改 1 个 silent return 即可？

可以。Commit 1 的“最小链路验证”允许只覆盖一条主路径：

- 在 `GameStateService.handlePlayerAction` 里，检测到玩家 seat 被梦魇封锁（blockedSeat），且提交的是非 skip（例如包含 target/extra）时：
  - 将当前的 silent `return/ignore` 改为：`sendPrivate(ACTION_REJECTED)` + return

不要求同时改 resolver；也不要求一次性覆盖所有输入 gate（先打通端到端回执链路即可）。

### Q5：文档里写的 `src/services/types/PrivateBroadcast.ts` 如果仓库里不存在怎么办？

以仓库现状为准：

- `ACTION_REJECTED` 必须加入“现有的 private payload union / PRIVATE_EFFECT 类型定义”的单一真相位置。
- 如果当前不是 `PrivateBroadcast.ts`，就加在项目里实际承载 `PrivatePayload`/inbox 消费的那个 types 文件里。

约束不变：`ACTION_REJECTED` 必须是 `toUid` 私信（anti-cheat），不能进入 public broadcast。

### Q6：`waitForActionRejected()` 应该放在哪一侧？Host 还是 UI？

放在 **UI（客户端）侧**，与现有的 `waitForSeerReveal()` / inbox 机制保持一致。

- Host 侧负责：判定不合法输入 → `sendPrivate(ACTION_REJECTED)`。
- UI 侧负责：提交后短等待 reject（例如 800ms），若收到则弹窗并 return。

> 文档指向的“GameStateService”是“客户端 service/inbox 层”的概念落点；如果你们仓库里 `GameStateService.ts` 是 Host runtime，请不要把 `waitFor*` 误放到 Host。

### Q7：Commit 1 和 Commit 2 必须一起提交吗？

原则是：**任何可运行版本里不得出现双弹窗/双逻辑**（UI blocked 弹一次 + Host reject 再弹一次）。

因此建议：

- Commit 1 打通 `ACTION_REJECTED` 后，应尽快进入 Commit 2 移除 blocked intent。
- 实操上可以在同一 PR 里用两个 commit 连续提交、一起合并，确保不会在中间态暴露“双弹窗”。

---

## 9. 测试建议（防回归）

- Contract test：`ACTION_REJECTED` payload 结构断言（如项目已有对应 contract 层）
- Integration（boards）：覆盖封锁拒绝 + wolf vote 拒绝（自刀与禁投角色）

---

## 10. 文件索引

- 私信协议：`src/services/types/PrivateBroadcast.ts`
- Host 行为：`src/services/GameStateService.ts`
- UI orchestrator：`src/screens/RoomScreen/RoomScreen.tsx`
- UI intent 层：`src/screens/RoomScreen/hooks/useRoomActions.ts`
- Schemas：`src/models/roles/spec/schemas.ts`（红线：`wolfKill` constraints 不得加入禁选）

---

## 12. 相关文件索引

- 私信协议：`src/services/types/PrivateBroadcast.ts`
- Host 行为：`src/services/GameStateService.ts`
- UI orchestrator：`src/screens/RoomScreen/RoomScreen.tsx`
- UI intent 层：`src/screens/RoomScreen/hooks/useRoomActions.ts`
- Schemas（红线：wolfKill constraints 必须为空）：`src/models/roles/spec/schemas.ts`
- wolfKill resolver 注释（中立规则）：`src/services/night/resolvers/wolf.ts`
- SpiritKnight integration：`src/services/__tests__/boards/SpiritKnight12.integration.test.ts`
