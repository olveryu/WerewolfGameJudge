# 统一 Host Reject 回执 + 移除 blocked intent + 恶灵骑士不能自刀（Night-1-only）方案（中文）

> 目的：把“Host 拒绝无提示”“梦魇封锁只能跳过”“恶灵骑士不能自刀”这类问题统一收敛到一套可复用的架构里，避免后续上下文丢失。
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
`ROLE_SPECS.spiritKnight.description` 明确写了“无法自刀”，但 wolf vote/kill 的协议是团队投票，且当前实现默认允许投自己。

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

### 6.3 wrong role/phase 等：统一回执
建议将以下 silent ignore 都逐步改为“回执 + return”（至少覆盖主路径）：
- wrong role acting
- nightFlow phase 不匹配
- nightFlow role mismatch

---

## 7. 分 3 个 commit 的落地切片（建议）

### Commit 1：ACTION_REJECTED 基建 + UI 统一弹窗
范围：
- `PrivateBroadcast.ts`：新增 `ACTION_REJECTED`
- `GameStateService`：收/存/wait reject
- `RoomScreen`：`proceedWithAction` 提交后等待 reject 并弹窗；seer/psychic 分支先 reject 后 reveal
- Host：至少把“梦魇封锁非 skip”与“wrong phase/role 之一”接入回执

验收：
- 触发一个 Host reject 的场景，用户必然看到弹窗。

### Commit 2：移除 blocked intent（逻辑统一版本）
范围：
- `useRoomActions.ts`：移除 blocked intent
- `RoomScreen.tsx`：移除 `case 'blocked'`

验收：
- 被梦魇封锁者点击任意座位：走提交→Host reject→统一弹窗；仍可“跳过（技能被封锁）”。

### Commit 3：恶灵骑士不能自刀（输入合法性）
范围：
- `GameStateService.handleWolfVote`：对 `spiritKnight self-vote` 做 reject + 回执
- 新增/更新 Integration test：覆盖“恶灵骑士投自己被拒绝”

验收：
- spiritKnight self-vote 不会写入 wolfVotes / 不会导致 finalize；且 UI 有提示。

---

## 8. 测试清单（避免回归与踩红线）

### 8.1 Contract tests
- `src/services/__tests__/privateEffect.contract.test.ts`
  - 增加 `ACTION_REJECTED` payload 结构断言
- 若存在 PrivatePayload union 覆盖测试（如 `visibility.contract.test.ts`）：把新 kind 加进去

### 8.2 Host runtime integration（建议）
- `src/services/__tests__/boards/SpiritKnight12.integration.test.ts`
  - 新增用例：spiritKnight 在狼队投票时投自己 → 被拒绝（行为不生效）

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
