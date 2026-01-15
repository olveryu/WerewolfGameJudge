# 统一 Host Reject 回执 + 移除 blocked intent + wolf meeting vote 禁投角色（Schema-first, Night-1-only）方案（中文）

> 目的：把“Host 拒绝无提示”“梦魇封锁只能跳过”“见面狼投票禁投角色（如恶灵骑士/狼美人）”这类问题统一收敛到一套可复用的架构里，避免后续上下文丢失。
>
> 关键红线（必须遵守）：
> - **Host 是唯一裁判**。Supabase 只做 transport/discovery/identity，不存储/校验游戏逻辑。
> - **Night-1-only**：不引入跨夜状态/规则。
> - **Anti-cheat**：敏感/个体化结果必须 `toUid` 私信；public broadcast 仅 room-public view-model。
> - **Wolf kill 中立规则**：狼刀（wolfKill）默认可 target ANY seat（包括自刀/队友/恶灵骑士）。不要把“结算规则”前移成“输入禁选”。
> - 单一真相：不引入平行 order 表/双写映射。

---

## 1. 背景与问题清单

### 1.1 Host reject 静默 return（可观测性差）
当前 `GameStateService` 的 `handlePlayerAction/handleWolfVote` 在大量非法输入时直接 `return/ignore`。用户侧表现为“点了没反应”，测试也很难断言。

### 1.2 梦魇封锁（nightmare block）是特例而不是通用机制
当前 UI 有“技能被封锁，只能跳过”的提示，但这条路径是 UI 特判（`blocked` intent）+ Host gate 的混合，缺少统一的 Host→玩家拒绝回执。

### 1.3 恶灵骑士不能自刀（actor-specific 输入合法性）缺失
`ROLE_SPECS.spiritKnight.description` 明确写了“无法自刀”，但当前实现存在允许 wolf vote 指向特殊目标（包含投自己/投特定角色）的路径。

本方案的关键不是“让 UI 禁选”，而是把这类 **输入不合法** 统一收敛为：

- Host 必须 reject（不写入投票/不推进状态）
- Host 必须给出 `ACTION_REJECTED` 私信回执（让 UI 可观测，不再出现“点了没反应”）

> 注意：这条规则是 **actor-specific 输入合法性**，不能改 `SCHEMAS.wolfKill.constraints`，否则会破坏“狼刀中立”红线。

---

## 2. 统一解决思路（核心抽象）

把规则分成两类，避免重蹈“恶灵骑士免疫被塞进 schema/constraint/UI 禁选”的坑：

- **输入合法性（Input Legality）**：能不能提交/被 Host 接受。
  - 例：梦魇封锁者不能放技能只能 skip；恶灵骑士不能自刀；wrong phase/role。
  - ✅ 放在 Host 接收处（`GameStateService` / host-only resolver validation）。

- **结算规则（Resolution/Death Calculation）**：提交后最终算不算生效、如何死亡。
  - 例：恶灵骑士免疫夜伤+反伤；女巫被封导致救/毒无效。
  - ✅ 放在 `DeathCalculator`/结算层。

---

## 2.1 【新增】见面狼投票：Schema-first 禁投某 Role（Design A）

> 需求：在见面狼投票（wolf meeting vote）中，若投票目标的 **role** 属于禁投集合（例如 `spiritKnight`、`wolfQueen`），则该投票必须被 Host **refuse**；玩家必须改投其他目标或选择 skip。

### 2.1.1 原则

- 这是 **输入合法性（Input Legality）**，不是结算规则。
  - 禁投应发生在 Host 接收投票的入口（例如 `handleWolfVote`）并回执。
  - 不允许“写入投票→下游结算时忽略”的 silent no-op（会让 UI 变成“点了没反应”）。

### 2.1.2 Schema-first（Design A）字段形状

> 关键点：禁投维度是“角色（roleId）”，不是 seat，也不是阵营。

建议在 wolf meeting vote 对应的 schema constraints 中新增：

- `forbiddenTargetRoleIds: RoleId[]`

语义：

- 当玩家提交 wolf vote，若 `targetSeat` 对应的 `roleId` ∈ `forbiddenTargetRoleIds`，Host 必须 reject。

### 2.1.3 Host 行为（必须回执）

- 若命中 `forbiddenTargetRoleIds`：
  - 不写入 `wolfVotes`
  - 通过 `toUid` 私信回执 `ACTION_REJECTED`（复用 `PRIVATE_EFFECT`）
    - `action: 'submitWolfVote'`
    - `reason`: 例如 `该目标不可被见面狼投票，请改投其他目标或跳过`（文案以 Host 为准）

### 2.1.4 为什么不做成 wolfKill 的 constraints？

- 本条是“见面狼投票”的输入合法性约束，不是“狼刀结算”。
- 仍然遵守本文档红线：**不改** `SCHEMAS.wolfKill.constraints`，保持 wolfKill 中立规则。

---

## 3. 最终用户体验 Contract

### 3.1 输入
夜晚行动阶段，玩家点击任意座位，或点击“跳过/空刀”。

### 3.2 输出
- Host **接受**：夜晚推进；seer/psychic 收到私信 reveal 并展示。
- Host **拒绝**：玩家 **一定**收到统一弹窗：标题“操作无效”，正文为 Host 提供的 `reason`。
- 取消 `blocked` intent 后：梦魇封锁不再靠 UI 判定，任何点击都可提交，但会被 Host reject 并弹窗；同时底部仍显示“跳过（技能被封锁）”作为 UX。

---

## 4. 关键重构：`ACTION_REJECTED` 私信回执（复用 `PRIVATE_EFFECT`）

### 4.1 为什么用私信（Anti-cheat）
拒绝原因属于“个体化判定”，且可能包含裁判细节。应通过 `toUid` 私信回执发送。

### 4.2 协议：新增 PrivatePayload 种类
文件：`src/services/types/PrivateBroadcast.ts`

新增：
- `kind: 'ACTION_REJECTED'`
- `reason: string`
- `action: 'submitAction' | 'submitWolfVote'`（建议保留）
- 可选：`schemaId?: SchemaId`
- 可选：`requestId?: string`（用于防连点串台；可复用 `makeInboxKey(revision, kind, requestId)`）

### 4.3 GameStateService：存 inbox + wait
文件：`src/services/GameStateService.ts`

- 在 `handlePrivateMessage` 中存储 `ACTION_REJECTED`
- 提供 `getActionRejected()` 与 `waitForActionRejected(timeoutMs=800)`
- Zero-trust：仍需 `toUid === myUid` 才处理

### 4.4 UI：统一消费 reject（不再靠 blocked intent）
文件：`src/screens/RoomScreen/RoomScreen.tsx`

- `proceedWithAction()`：提交后短等待 `ACTION_REJECTED`，如果收到则 `showAlert('操作无效', reason)` 并 return。
- seer/psychic：必须先等待 reject（如 reject 则不再等待 reveal），避免“被拒绝但仍 waitForReveal 卡住”。

---

## 5. 移除 blocked intent（你选择的统一逻辑版本）

### 5.1 改动点
文件：`src/screens/RoomScreen/hooks/useRoomActions.ts`

- 删除 ActionIntentType `blocked`
- 删除：
  - `if (isBlockedByNightmare) return { type: 'blocked', ... }`

文件：`src/screens/RoomScreen/RoomScreen.tsx`

- 删除 `handleActionIntent` 的 `case 'blocked'`

> 仍建议保留底部按钮 UX：当 `isBlockedByNightmare === true` 时强制显示“跳过（技能被封锁）”。

---

## 6. Host 侧输入合法性修复点

### 6.1 梦魇封锁：非 skip 一律 reject（并回执）
文件：`src/services/GameStateService.ts`，函数：`handlePlayerAction`

- 保留现有 gate（blocked 只能 skip）
- 将“静默 return”改为：
  - `sendPrivate(ACTION_REJECTED)` + return

### 6.2 恶灵骑士不能自刀：actor-specific 校验（并回执）
文件：`src/services/GameStateService.ts`，函数：`handleWolfVote`

规则：
- 若 `player.role === 'spiritKnight' && target === seat`：
  - 拒绝该投票（不写入 wolfVotes）
  - `sendPrivate(ACTION_REJECTED, reason='恶灵骑士不能自刀，请重新选择', action='submitWolfVote')`
  - return

> 注意：**不改** `SCHEMAS.wolfKill.constraints`，保持 wolfKill 中立。

> 说明：6.2 属于 **actor-specific**（谁在投）输入合法性；而 2.1/6.2.1 属于 **target-based**（投给谁）输入合法性。两者都使用统一的 `ACTION_REJECTED(action='submitWolfVote')` 回执。

### 6.2.1 【新增】见面狼投票禁投某 Role：schema-first 校验（并回执）

文件：`src/services/GameStateService.ts`，函数：`handleWolfVote`

规则：

- 若 wolf meeting vote 对应的 schema constraints（Design A）包含 `forbiddenTargetRoleIds`，且 `targetSeat` 对应的 `roleId` ∈ `forbiddenTargetRoleIds`：
  - 拒绝该投票（不写入 wolfVotes）
  - 发送 `ACTION_REJECTED` 私信回执（`action='submitWolfVote'`）
  - 要求玩家改投其他目标或 skip

> 备注：这里的目标是让“禁投规则”有单一真相（schema constraints），而不是散落在 host if-else 中。

### 6.3 wrong role/phase 等：统一回执
建议将以下 silent ignore 都逐步改为“回执 + return”（至少覆盖主路径）：
- wrong role acting
- nightFlow phase 不匹配
- nightFlow role mismatch

### 6.4 【新增】把 “blocked/disabled 目前是 valid:true + 空 result” 统一收敛成 reject（并回执）
现状（repo 扫描结论）：Night-1 的多个 resolver 在遇到梦魇封锁（`currentNightResults.blockedSeat === actorSeat`）或类似禁用条件时，返回的通常是：

- `return { valid: true, result: {} }`（silent no-op）

这会导致 2 个问题：

1) **与本方案的最终 UX Contract 冲突**：UI 侧永远等不到 `ACTION_REJECTED`，玩家看到的仍是“点了没反应”。
2) **测试不可观测**：集成测试难以断言“为什么没效果”，只能从最终状态猜。

本方案要求的统一口径：

- 对于 “输入不可被接受” 的场景（典型：被梦魇封锁但提交了非 skip 行为），Host 必须走 **reject + `ACTION_REJECTED`**。

落点选择（两种都可，但必须统一，且不能双写）：

- **推荐（更符合 Host-authority）**：在 `GameStateService` 的 action 入口做 gate。
  - 入口判断 `blockedSeat`/`wolfKillDisabled` 等 → 直接 `sendPrivate(ACTION_REJECTED)` 并 return。
  - resolver 继续保持“纯计算/纯解析”风格，避免 resolver 自己发消息。
- **备选**：resolver validation 层返回 `valid:false + rejectReason`（由 host 入口统一转成 `ACTION_REJECTED`）。
  - 仍然禁止 resolver 直接触发副作用。

需要特别覆盖的“silent no-op”路径包括（Night-1-only，按扫描到的文件列出）：

- 典型 `blockedSeat === actorSeat -> { valid:true, result:{} }`：
  - `src/services/night/resolvers/seer.ts`
  - `src/services/night/resolvers/psychic.ts`
  - `src/services/night/resolvers/gargoyle.ts`
  - `src/services/night/resolvers/witch.ts`
  - `src/services/night/resolvers/guard.ts`
  - `src/services/night/resolvers/magician.ts`
  - `src/services/night/resolvers/wolfRobot.ts`
  - `src/services/night/resolvers/dreamcatcher.ts`
  - `src/services/night/resolvers/wolfQueen.ts`
  - `src/services/night/resolvers/slacker.ts`
- `wolfKillDisabled -> { valid:true, result:{} }`：
  - `src/services/night/resolvers/wolf.ts`

> 注意：这些属于“可观测性/UX 契约”的统一改造，不改变任何 Night-1 规则本身，也不触碰 `SCHEMAS.wolfKill.constraints` 的中立红线。

---

## 7. 分 3 个 commit 的落地切片（建议）

### Commit 1：ACTION_REJECTED 基建 + UI 统一弹窗 + Host 入口 gate（把 silent ignore / silent no-op 变成可观测 reject）

目标：先把“Host 拒绝必须有回执”的链路打通，让 UI 能稳定看到拒绝原因，再做规则细化；避免一上来就改大量 resolver 导致定位困难。

改动范围：
- `src/services/types/PrivateBroadcast.ts`
  - 新增 `PrivatePayload` 分支：`kind: 'ACTION_REJECTED'`
  - 字段至少包含：`reason: string`、`action: 'submitAction' | 'submitWolfVote'`
  - 可选：`schemaId?: SchemaId`、`requestId?: string`
- `src/services/GameStateService.ts`
  - 在私信 inbox/handle 里接入并存储 `ACTION_REJECTED`
  - 提供 `getActionRejected()` / `waitForActionRejected(timeoutMs=800)`（供 UI 轮询/await）
  - **Host gate**：把最少覆盖的一条主路径从“静默 return/ignore”改为 `sendPrivate(ACTION_REJECTED)` + return
- `src/screens/RoomScreen/RoomScreen.tsx`
  - `proceedWithAction()`：提交后短等待 `ACTION_REJECTED`，若收到则统一弹窗并停止后续 wait
  - seer/psychic：必须先等待 reject（如 reject 则不再等待 reveal），防止“被拒绝但仍 waitForReveal 卡住”

Host gate 的“最少覆盖主路径”（先做 1~2 条，打通端到端即可）：
- 梦魇封锁（blockedSeat）：非 skip 一律 `ACTION_REJECTED`
- `wolfKillDisabled`：非“空刀/跳过”一律 `ACTION_REJECTED`
- wrong phase / wrong role：至少覆盖 1 条主路径，确认端到端链路可观测

  > 这里的“silent ignore / silent no-op”特指：**本应判定为输入不合法** 的提交，在 Host 入口被静默丢弃（silent ignore），或被下游 resolver 用 `valid:true + 空 result` 吞成 no-op（silent no-op），从而 UI 侧拿不到 `ACTION_REJECTED`（玩家感觉“点了没反应”）。
  > 这不否定 resolver 作为纯计算层的“no-op 表达”本身；问题在于 **不合法输入** 没有走统一的 reject 回执契约。

验收：
- 触发任意一条 Host reject 场景，用户端 **一定**出现统一弹窗（标题“操作无效”+ Host reason）
- 端到端至少能观测到 1 条“之前静默丢弃”的路径已变为 `ACTION_REJECTED`

### Commit 2：移除 blocked intent（逻辑统一版本）
目标：彻底移除“UI blocked intent 特判”，把“只能跳过/不能行动”统一交给 Host reject 回执表达。

范围：
- `useRoomActions.ts`：移除 blocked intent
- `RoomScreen.tsx`：移除 `case 'blocked'`

同时保留纯 UX：当 `isBlockedByNightmare === true` 时底部仍强制显示“跳过（技能被封锁）”。

验收：
- 被梦魇封锁者点击任意座位：走提交→Host reject→统一弹窗；仍可“跳过（技能被封锁）”。

### Commit 3：见面狼投票禁投角色（Design A）+ 恶灵骑士不能自刀（输入合法性）

目标：把“wolf meeting vote 禁投角色（target-based）”与“恶灵骑士不能自刀（actor-specific）”这两类输入合法性都收敛到同一个 `submitWolfVote` 的 reject 回执路径。

范围（规则实现）：
- `src/models/roles/spec/schemas.ts`
  - 在 wolf meeting vote 对应 schema 的 constraints 中新增：`forbiddenTargetRoleIds: RoleId[]`
  - 配置：至少包含 `['spiritKnight', 'wolfQueen']`（以最终 roleId 为准）
- `src/services/GameStateService.ts`（函数：`handleWolfVote`）
  - actor-specific：`spiritKnight self-vote` → reject + `ACTION_REJECTED(action='submitWolfVote')`
  - target-based：若 constraints 的 `forbiddenTargetRoleIds` 命中 `targetSeat.roleId` → reject + 回执（要求改投或 skip）

范围（测试）：
- Integration test：
  - spiritKnight 投自己 → 必拒绝（不写入 wolfVotes，不推进 finalize）
  - 任意狼投 spiritKnight / wolfQueen → 必拒绝；随后改投其他目标或 skip → 可继续流程
- Contract test（若项目已有 schema/role/step 的 contract tests）：
  - 断言 `forbiddenTargetRoleIds` 只能包含有效 `RoleId`
  - 断言表驱动配置不漂移（避免之后改了 schema 但 Host 校验没跟上）

验收：
- spiritKnight self-vote 不会写入 wolfVotes / 不会推进 finalize；且 UI 有统一弹窗提示
- 投 spiritKnight / wolfQueen 会被拒绝；玩家改投其他目标或 skip 后流程可继续

---

## 8. 测试清单（避免回归与踩红线）

### 8.1 Contract tests
- `src/services/__tests__/privateEffect.contract.test.ts`
  - 增加 `ACTION_REJECTED` payload 结构断言
- 若存在 PrivatePayload union 覆盖测试（如 `visibility.contract.test.ts`）：把新 kind 加进去

### 8.2 Host runtime integration（建议）
- `src/services/__tests__/boards/SpiritKnight12.integration.test.ts`
  - 新增用例：spiritKnight 在狼队投票时投自己 → 被拒绝（行为不生效）
  - 新增用例：任意狼投票目标为 spiritKnight 或 wolfQueen → 被拒绝（必须可改投或 skip）

---

## 9. 文案建议

- 弹窗标题建议统一：`操作无效`
- 文案由 Host `reason` 提供：
  - 梦魇封锁：`你被梦魇封锁，本回合只能跳过`
  - 恶灵骑士自刀：`恶灵骑士不能自刀，请重新选择`

---

## 10. 非目标（明确不做）

- 不把恶灵骑士免疫做成 `wolfKill` 的 constraint / UI 禁选。
- 不引入跨夜状态/记忆。
- 不把 reject 写入 public broadcast。

---

## 11. 影响面与风险

- 移除 blocked intent 后，会增加一次“无效提交”到 host 的机会（请求更多）。
  - 但换来逻辑统一与可测试性。
  - 可通过短 timeout 的 reject wait（例如 800ms）降低 UI 卡顿。

---

## 12. 相关文件索引

- 私信协议：`src/services/types/PrivateBroadcast.ts`
- Host 行为：`src/services/GameStateService.ts`
- UI orchestrator：`src/screens/RoomScreen/RoomScreen.tsx`
- UI intent 层：`src/screens/RoomScreen/hooks/useRoomActions.ts`
- Schemas（红线：wolfKill constraints 必须为空）：`src/models/roles/spec/schemas.ts`
- wolfKill resolver 注释（中立规则）：`src/services/night/resolvers/wolf.ts`
- SpiritKnight integration：`src/services/__tests__/boards/SpiritKnight12.integration.test.ts`
