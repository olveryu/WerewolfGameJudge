# Schema-driven UI 全量收口方案（不踩红线版）

> 目标：在不违反项目既定红线（Host 权威 / Anti-cheat / Night-1-only / 单一真相）前提下，把 RoomScreen 里“仍然靠 role-specific 或 legacy 分支”的部分，尽可能收敛为 **schema-driven UI**。
>
> 本文只覆盖 **RoomScreen（及其 hooks/components/dialogs）** 的 UI 驱动方式，不更改 Supabase 责任边界。

---

## 0. 结论先说

- **是的**：在不踩红线的情况下，schema-driven UI 整体更好：
  - 减少 role/name 分支爆炸；
  - 让“规则-UI”对齐更可预测；
  - 新增 schema/step 时改动面更小；
  - 更容易写 contract tests 防 drift。

- **但不是所有字段都应该 UI 直接消费**：
  - 任何会泄露敏感信息的字段（reveal 结果、身份、私信内容）都必须走 private message；
  - 任何“结算规则”都不应该被 UI 当作输入合法性校验（Host 才是裁判）。

本文的方案设计核心是：

1) **UI 只做 view-model 渲染与交互引导**（可做禁用/提示，但不能当裁判）；
2) **Host gate/resolve 是唯一判定**（非法输入 → ACTION_REJECTED 私信回执）；
3) **同一处字段只允许一个权威来源**（避免 role/step/schema 多处写同一规则）。

---

## 0.5 字段覆盖对照表（As-is → UI 是否已消费 → To-be 迁移动作）

> 你之前要的“schema/specs/nightSteps 里所有字段是否 reflect 到 UI”的逐字段清单，这里补全并把它**直接转成迁移 checklist**。
>
> 约定：
> - ✅ = RoomScreen 体系已经直接消费；
> - ⚠️ = 只间接影响（多为 Host 侧/测试/仅 fallback）或 UI 仍有 role/legacy 分支；
> - ❌ = RoomScreen 未消费（可能应当补齐，也可能属于红线/不应该消费）。

### A) `SCHEMAS` / `schema.types.ts` 字段

#### A.1 BaseActionSchema（所有 schema 共有）

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `id` | ⚠️ 不渲染；多数分支依赖 `kind` + role | ✅ 作为 turn VM 的 `schemaId` 暴露给 UI（调试/埋点/测试稳定键） | `SchemaId` 必须来自 `SCHEMAS`（contract 已保障） |
| `displayName` | ⚠️ UI 文案主要来自 role.ux；schema.displayName 不稳定 | ✅ 作为 fallback 或用于 turn VM 的默认 prompt 生成 | 不应包含敏感信息；只是“动作名”（查验/守护/学习） |

#### A.2 ChooseSeatSchema（`kind:'chooseSeat'`）

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `kind` | ✅ intent 分流主入口 | ✅ 保持 | 这是 schema-driven 的核心 |
| `constraints` | ⚠️ UI 不做裁判；Host reject | ⚠️ UI 可选做“禁点/提示”（UX），但必须保留 Host reject | Host 才是裁判；禁止把约束当成“不会被点”的安全假设 |
| `canSkip` | ✅ 已双保险（按钮展示 + intent 生成） | ✅ 保持，并把其他 kind 的 skip 也收敛到 schema/turnVM | chooseSeat 的 canSkip 是典型 schema-driven 字段 |

#### A.3 WolfVoteSchema（`kind:'wolfVote'`）

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|------|
| `kind` | ✅ | ✅ |  |
| `constraints` | ⚠️ 同 chooseSeat | ⚠️ 同 chooseSeat（仅 UX hint） |  |
| `forbiddenTargetRoleIds?` | ❌ RoomScreen 未消费 | ✅（可选）在 turnVM 里生成 `disabledSeatIds`/提示文案（仅 UX） | **禁止**改 `SCHEMAS.wolfKill`；该字段只用于 meeting vote gate（Host 拒绝 + 回执） |

#### A.4 CompoundSchema / CompoundStep（witch）

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `kind:'compound'` | ✅ 用于 auto-trigger 分流 | ✅ 保持 |  |
| `steps[*]`（含 stepId/displayName/kind/constraints/canSkip） | ❌ UI 走专用两阶段逻辑，未消费 steps | ✅ 迁移为 steps 驱动（PR3） | 私信 `WITCH_CONTEXT` 仍必须是 Host 发送，UI 只消费展示 |

#### A.5 SwapSchema（magician）

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `kind:'swap'` | ✅ | ✅ |  |
| `constraints` | ⚠️ UI 不裁判 | ⚠️ 可做 UX hint |  |
| `canSkip` | ⚠️ 底部 skip 对非 chooseSeat 仍混有 legacy | ✅ 把 swap 的 skip 完整纳入 schema/turnVM 的 bottomAction | 需要你确认魔术师是否允许 skip（规则层决定） |

#### A.6 ConfirmSchema / SkipSchema

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `confirm.kind` | ✅（auto-trigger） | ✅ |  |
| `skip.kind` | ❌ 基本不用 | 视情况；如未来有纯 skip step，再由 schema 驱动 |  |

---

### B) `ROLE_SPECS` / `spec.types.ts` 字段

> RoomScreen 目前更多消费 `getRoleDisplayInfo()` 的字段；但这里按 spec 层的字段语义给出“是否 reflect + 是否应该转移到 schema/turnVM”。

#### B.1 基础身份/展示字段

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `id` | ✅（myRole/currentActionRole） | ✅ 保持 |  |
| `displayName` | ✅（显示/统计/文案 fallback） | ✅ 保持 |  |
| `englishName?` | ❌ | 可选：如要双语显示再接入 |  |
| `description` | ❌（RoomScreen 不展示） | 不建议在 RoomScreen 展示；可在角色介绍页使用 |  |
| `faction` / `team` | ⚠️/❌（RoomScreen 不直接用） | ❌ 不建议直接驱动 RoomScreen 分支 | `team`/结果推断容易触碰 anti-cheat 边界 |

#### B.2 行动/会议/flags/ux

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `night1.hasAction` | ⚠️（由 NIGHT_STEPS contract 保证一致性） | ✅ 保持作表一致性；UI 不必直接读 | UI 以当前回合 turnVM/schema 为准 |
| `wolfMeeting.*` | ⚠️ UI 不直接读；靠 useActionerState/Host 状态 | ✅ 把“是否显示狼队友”收敛为 turnVM 的 `showWolves`（PR4） | 同步遵守 anti-cheat：只能在 wolfMeetingPhase 相关回合展示 |
| `flags.blocksSkill` | ⚠️ 只作为 UX hint；Host 才裁判 | ✅ turnVM 可提供 `bottomAction` 文案（如“技能被封锁，只能跳过”） | 不能让 UI 代替 Host reject |
| `flags.immuneToNightDamage/reflectsDamage` | ❌（且不应在公屏透出） | ❌ 保持不进 UI（只在结算层） | anti-cheat + 规则边界 |
| `flags.canSaveSelf?`（deprecated） | ❌ | ✅ 删除方向不在 UI；规则迁移到 schema.constraints | 独立迁移事项 |
| `ux.actionMessage/actionConfirmMessage` | ✅ 当前是 UI 文案主源 | ⚠️ 逐步降级为 fallback：主源迁移到 schema/turnVM（PR1） | 避免 role/step/schema 多处写同一文案 |

---

### C) `NIGHT_STEPS` / `nightSteps.types.ts` 字段

| 字段 | As-is（RoomScreen） | To-be（迁移动作） | 红线/备注 |
|---|---|---|---|
| `id`（SchemaId） | ✅（经由 Host 派发 currentSchema/turn） | ✅ 保持，并用于 turnVM.schemaId | 单一真相 |
| `roleId` | ✅（currentActionRole） | ✅ 保持 |  |
| `audioKey/audioEndKey` | ❌（RoomScreen 只看 isAudioPlaying） | ⚠️ 可选：turnVM 暴露 `audioKey` 仅用于 UI 展示“正在播放…” | 不应影响逻辑，只显示 |
| `visibility.actsSolo/wolfMeetingPhase` | ❌（RoomScreen 未直接消费） | ✅ turnVM 统一暴露 `showWolves`/`actsSolo`（PR4） | 不能把敏感信息塞进 public；actsSolo 只是“显示规则” |

---

## 0.6 本方案明确“不会迁移”的字段（不应该 reflect 到 RoomScreen）

1) 所有 reveal 结果（seer/psychic/gargoyle/wolfRobot）
  - 必须走 `PrivateBroadcast`（toUid 私信），不能由 schema/steps/public state 推导。
2) 结算规则（免死/反伤/毒无效等）
  - 属于 resolver/DeathCalculator，UI 只能展示 Host 给出的结果。
3) 任何跨夜字段
  - Night-1-only 红线。

---

## 1. 红线清单（必须遵守）

这些来自 repo 的既定架构约束（见 `.github/copilot-instructions.md` + `docs/architecture/unified-host-reject-and-wolf-rules.zh-CN.md`）：

1. **Host 是唯一权威**：UI 不校验“是否合法”，只做 UX。
2. **Anti-cheat**：敏感信息只走 `toUid` 私信（PrivateBroadcast）；public BroadcastGameState 不能包含敏感字段。
3. **Night-1-only**：不引入跨夜记忆（previousActions/lastNightTarget 等）。
4. **单一真相**：
   - 夜晚步骤顺序以 `NIGHT_STEPS` 为权威；
   - schema 注册以 `SCHEMAS` 为权威；
   - 不引入 parallel order/map。
5. **Wolf kill neutral judge**：`SCHEMAS.wolfKill` 不得引入 forbidden/notSelf/notWolf 等限制。
   - wolf meeting vote 的限制只能存在于专门 gate/config（例如 `wolfMeetingVoteConfig.ts` + Host gate）。

---

## 2. “Schema-driven UI” 在本项目的定义（Contract）

### 2.1 输入与输出

**输入（UI 可依赖）**
- `currentSchema: ActionSchema | null`（来自 `useGameRoom`）
- `currentActionRole: RoleName | null`（显示/统计用；不是分支 key）
- `imActioner / isAudioPlaying / roomStatus`（可操作性 gating）
- `PrivateInbox` 中的私信 payload（仅 UI 展示，不扩散到 public）

### 2.3 本方案最终选择：Option 1（在 `SCHEMAS` 增加 `ui.*` 字段）

你已确认选择 **Option 1**：

- 不引入新的 public turn view-model（不新增第二份“UI 真相表”）；
- 通过在 `ActionSchema` 上增加一个纯 UI 的 `ui` 子对象，让 UI 的编排从 role-specific 收敛到 schema-driven；
- `ui.*` 必须是 **非敏感、纯编排/文案/提示** 信息。

最小契约（建议）：

```ts
type RevealKind = 'seer' | 'psychic' | 'gargoyle' | 'wolfRobot';

type SchemaUi = {
  /** 用于回合提示（替代 role.ux.actionMessage 的主源；role.ux 仅为 fallback） */
  readonly prompt?: string;
  /** 用于确认按钮/确认句式（替代 role.ux.actionConfirmMessage 的主源；role.ux 仅为 fallback） */
  readonly confirmText?: string;
  /** 用于消除 UI 的 role-switch：chooseSeat 但需要走 reveal 私信等待 */
  readonly revealKind?: RevealKind;
  /** bottom 行为只描述 UI；不可替代 Host gate */
  readonly bottomActionText?: string;
};
```

约束：

- `revealKind` 只用于“等哪种私信 payload”和“弹哪个 reveal ack”，**不包含 reveal 结果**（结果仍来自 PrivateInbox）。
- `prompt/confirmText/bottomActionText` 不得包含敏感信息（例如“你验到他是狼人”这种）。
- UI 可用 `ui.*` 做 UX 禁点/提示，但 Host 仍必须 reject 非法输入并发送 `ACTION_REJECTED` 私信回执。

**输出（UI 只能做的事）**
- 渲染 prompt / button / seat selectable/disabled
- 触发交互：`submitAction(target|null)` / `submitWolfVote(target|-1)` / `submitRevealAck(role)`
- 消费 Host 回执：`ACTION_REJECTED`（弹窗提示）

### 2.2 禁止事项

- UI **不得**根据本地推断去决定“输入不发送/发送不同内容”来替代 Host 判定（除非是纯 UX 的 disable）。
- UI **不得**从 public state 推导出敏感结果并展示（例如 seer/psychic/gargoyle 结果必须私信）。

---

## 3. 现状盘点：哪些仍非 schema-driven（需要收口）

基于当前代码（RoomScreen + useRoomActions + dialogs），这里把“仍非 schema-driven”的点**按列表逐条列出来**，并标注：

- **现状位置**（文件/符号）
- **为什么算 non-schema-driven**（仍依赖 role/legacy/硬编码）
- **建议收口方式**（对应 PR1~PR4）

> 注：下面只列“应该收口为 schema-driven 的”。
> 像 reveal 结果/死亡结算这类 **本来就不应该 schema-driven 到公屏 UI** 的，已经在 “0.6 不会迁移” 里单独划掉。

### A) ✅ 已较好 schema-driven（保留）

- seat tap → intent：主要按 `currentSchema.kind`（`useRoomActions.ts`）
- chooseSeat 的 `canSkip`：已做双保险（RoomScreen + intent 层）
- confirm/swap/compound/wolfVote：入口已按 `kind` 分流

### B) ⚠️ 仍有 role-specific 分支（可收敛）

#### B.1 顶部/回合提示文案依赖 role.ux（应迁移到 schema/turnVM）

- 现状位置：`src/screens/RoomScreen/RoomScreen.tsx`（`getActionMessage()` / `actionMessage`）
- 现状依赖：`getRoleDisplayInfo(currentActionRole).actionMessage` + fallback
- 问题：同一个“回合提示”来源分散在 role spec（ux）而不是 schema/step，导致：
  - schema.displayName 改了 UI 不变；
  - 新增 schema 时容易忘记补 role.ux；
  - UI 仍在“按角色”思考而不是“按 schema/step”。
- 收口方式：PR1（文案主源迁移到 schema 或 turnVM；role.ux 降级为 fallback）

#### B.2 确认弹窗文案依赖 role.ux.actionConfirmMessage（应迁移到 schema/turnVM）

- 现状位置：`src/screens/RoomScreen/hooks/useRoomActions.ts`（`buildActionMessage()`）
- 现状依赖：`getRoleDisplayInfo(actingRole).actionConfirmMessage`
- 收口方式：PR1（schema/turnVM 提供 confirmText；role.ux 仅 fallback）

#### B.3 chooseSeat 的 intent 仍按 role 分支（seer/psychic/gargoyle/wolfRobot）

- 现状位置：`src/screens/RoomScreen/hooks/useRoomActions.ts`（`deriveChooseSeatIntent()`）
- 为什么算 non-schema-driven：虽然入口是 `kind==='chooseSeat'`，但 reveal intent 的类型仍由 `myRole` 决定
- 收口方式（两种，不踩红线）：
  - PR1/PR2：在 schema 增加 `ui.intentStyle`（例如 `'reveal:seer' | 'reveal:psychic' | 'confirmTarget'`）让 UI 不再 switch role
  - 或 turnVM 直接提供 `intentKind`（仍不包含 reveal 结果，只是“需要等哪个私信”）

#### B.4 底部按钮策略仍混有 legacy（非 chooseSeat/swap/compound 仍不统一）

- 现状位置：`src/screens/RoomScreen/RoomScreen.tsx`（底部按钮判定逻辑；你前面修过 chooseSeat 的 canSkip）
- 为什么算 non-schema-driven：
  - wolfVote 的“空刀”按钮不是 schema/turnVM 提供；
  - blocked（梦魇）场景有 UI 特例文案；
  - 仍保留 role 黑名单/legacy gating。
- 收口方式：PR2（turnVM.bottomAction 作为唯一入口：skip / wolfEmptyVote / blockedSkip 等）

#### B.5 swap.canSkip 未被严格消费

- 现状位置：RoomScreen 底部按钮逻辑对 swap 没有完全按 schema.canSkip
- 收口方式：PR2（将 swap 纳入统一 bottomAction 生成/消费）

### C) ❌ schema 字段存在但 UI 未消费（可选择性迁移，不踩红线）

#### C.1 `WolfVoteSchema.forbiddenTargetRoleIds?`（仅 UX 增强，Host 仍裁判）

- 现状位置：`src/models/roles/spec/schema.types.ts` 存在字段；RoomScreen 未消费
- 收口方式：PR2（turnVM 生成 disabledSeatIds + 提示文案）；或在 PlayerGrid 上做 disabled 状态
- 红线：不能把它加进 `SCHEMAS.wolfKill`；只能用于 meeting vote gate（Host 拒绝 + 私信回执）

#### C.2 `CompoundSchema.steps[*]`（女巫步骤声明未驱动 UI）

- 现状位置：`src/models/roles/spec/schemas.ts` 有 `witchAction.steps`；RoomScreen 仍维护 `witchPhase` 与专用流程
- 收口方式：PR3（让 UI 以 steps 驱动阶段，`witchPhase` 变成 derived / 或删除）

#### C.3 `NIGHT_STEPS.visibility`（actsSolo / wolfMeetingPhase）

- 现状位置：`src/models/roles/spec/nightSteps.ts` + `nightSteps.types.ts`
- 现状问题：RoomScreen 不直接使用 visibility；显示狼队友的逻辑来源分散（useActionerState/Host state/历史分支）
- 收口方式：PR4（turnVM 暴露 showWolves/actsSolo，UI 单点消费，避免重复推导）

#### C.4 `NIGHT_STEPS.audioKey/audioEndKey`（UI 不展示）

- 现状位置：`src/models/roles/spec/nightSteps.ts`
- 收口方式：可选（PR1 或附加 PR）：turnVM 暴露当前 audioKey 仅用于 UI 文案“正在播放…”
- 红线：音频 key 不应影响逻辑；逻辑仍由 Host/NightFlowController 驱动

---

## 4. 目标状态（To-be）：RoomScreen 只看 schema（含 `ui.*`）+ private inbox

在 Option 1 下，To-be 非常明确：

- 渲染/编排以 `currentSchema.kind + currentSchema.ui.* + currentSchema.canSkip/constraints` 为主源
- role.ux 只作为 fallback（逐步弱化，避免双写）
- reveal 结果仍严格来自 `PrivateInbox`（toUid 私信），UI 只负责等待/展示/ack

### 4.1 UI 统一渲染规则（不再 switch role）

RoomScreen 目标：

- 顶部提示：`currentSchema.ui.prompt ?? role.ux.actionMessage ?? fallback`
- 确认文案：`currentSchema.ui.confirmText ?? role.ux.actionConfirmMessage ?? fallback`
- chooseSeat 的 reveal：改为用 `currentSchema.ui.revealKind` 决定走哪个 reveal intent/等待哪个私信（不再 switch `myRole`）
- 底部按钮：由 `schema.kind + canSkip + ui.bottomActionText` 统一生成（不再 hardcode wolf/blocked/legacy）

---

## 5. 单 PR（多 commit）实施方案（一次合并，分步落地）

你说得对：我们可以只开 **1 个 PR**，但把工作拆成多个 commit（每个 commit 对应一个“可验收的小闭环”），这样：

- review/回滚都更容易；
- 每个 commit 都能跑一遍关键测试门禁，定位回归更快；
- 最终仍然是一次 merge，不会占用多条 PR 资源。

下面的 commit 列表会覆盖 **第 0.5/第 3 节里所有“应该 schema-driven”的条目**，不漏。

### Commit 1：把 UI 文案主源从 RoleUx 收敛到 Schema/TurnVM（覆盖 B.1/B.2 + A.displayName）

**目标**
- Prompt / confirm 文案不再依赖 `getRoleDisplayInfo(...).ux` 作为主路径。

**做法**
- 为每个 schema 增加可选字段（不改变 SchemaId）：
  - `prompt?: string`
  - `confirmText?: string`
  - （wolfVote 另有 `emptyVoteText?: string`）
- RoomScreen 使用顺序：
  1) schema.prompt/confirmText
  2) role.ux.actionMessage/actionConfirmMessage
  3) fallback 默认

**红线检查**
- 文案不包含敏感结果。

**测试**
- contract：所有 `NIGHT_STEPS` 引用的 schema 必须提供 prompt（或明确允许 fallback）
- UI smoke：现有 RoomScreen smoke 不应改变行为，只是文案更统一（可不 assert 文案）。

### Commit 2：把“底部按钮策略 / skip/空刀/封锁提示”完全 schema-driven（覆盖 B.4/B.5 + A.canSkip + wolfVote 空刀）

**目标**
- RoomScreen 底部按钮显示/文案不再 role-specific。

**做法**
- 在 schema 层加入 `bottomAction` 描述（或在 turnVM 生成）
- 规则：
  - chooseSeat：由 `canSkip` 决定是否出现 skip
  - wolfVote：固定提供 `wolfEmptyVote`（投票空刀），不走 canSkip
  - swap：由 swap.canSkip 控制（如果你希望魔术师也能 skip）
  - compound：由步骤驱动（见 PR3）

**红线检查**
- wolfVote 的空刀仍是投票选项，不是“skip action”。

**测试**
- 扩展 `skipAction.ui.test.tsx`：覆盖 swap / wolfVote bottom action 文案与行为

### Commit 3：女巫 UI 改成真正消费 `CompoundSchema.steps`（覆盖 C.2 + A.compound.steps）

**目标**
- RoomScreen 对女巫不再有专用两阶段状态机（或至少由 schema.steps 驱动）。

**做法**
- 把 witchPhase 从“UI 自己维护”变为“由 compound step index 驱动”：
  - step0: save（chooseSeat + canSkip）
  - step1: poison（chooseSeat + canSkip）
- Host 仍然通过 PrivateBroadcast 提供 `WITCH_CONTEXT`（killedIndex/canSave），UI 只消费它来渲染 step0 的可选提示。

**红线检查**
- 私信内容不进入 public。
- UI 不在本地判断 canSave（Host 算）。

**测试**
- 现有 `witchSave.ui.test.tsx` / `witchPoison.ui.test.tsx` 重写为“按 schema.steps 走完”。

### Commit 4：把 `NIGHT_STEPS.visibility` 收敛为 UI 显示狼队友的唯一来源（覆盖 C.3 + B.wolfMeeting.* 的 UI 分支消隐）

> 注：这个 commit 不改变“谁能看见谁”的规则，只是把 UI 的分散推导变成单点 view-model（仍然 Host 权威）。

### Commit 5（可选）：把 `WolfVoteSchema.forbiddenTargetRoleIds` 做成 UI 禁点/提示（覆盖 C.1，纯 UX）

> 这是纯 UX 提升：就算 UI 不做禁点，Host 也必须拒绝非法 vote 并回执（Anti-cheat+Host 权威）。

### Commit 6（可选）：在 UI 显示当前 step 的音频提示（覆盖 C.4，纯展示）

> 仅用于显示“正在播放：xxx”，不参与任何逻辑 gating。

### Commit 7：清理旧的/不对的/没用的 legacy（收口清理，必须做）

> 你提的这个点很关键：当 Commit 1~6 把 UI 真正收敛到 schema-driven 之后，必须再做一次“删旧代码”提交，避免：
>
>- 以后维护者误以为两套逻辑都要改（双写 drift）
>- 测试继续为旧分支兜底，导致新逻辑回退也不报错
>
**清理目标（按本方案范围）**

1) RoomScreen / hooks 里所有“已被 schema.ui.* 替代”的 role/legacy 分支
  - 例如：以 `myRole/currentActionRole` 决定 prompt/confirm 文案、reveal intent 的 switch 分支
2) 不再被使用的 fallback/compat helper（如果只剩 0~1 处使用，也应内联或删除）
3) 过期的注释/文档段落（与新 schema-driven contract 冲突的说明）
4) 测试里对 legacy 行为的兜底断言（改为断言 schema-driven 行为，或删除不再需要的 staging compat tests）

**红线**

- 不删 Host 权威 gate / ACTION_REJECTED 消费逻辑
- 不删 anti-cheat 的 private inbox 流程
- 不把“结算逻辑”拖回 UI

**验收**

- 全套测试门禁通过（同 5.2）
- grep 验证：RoomScreen 中不再出现已淘汰的 role-specific prompt/confirm/reveal 分支（以 schema.ui.* 为准）

---

## 5.1 逐条映射：哪些清单项由哪个 commit 覆盖（防漏表）

### 来自第 3 节（B/C）的 non-schema-driven 清单

- B.1（回合提示文案 role.ux）→ Commit 1
- B.2（确认文案 role.ux.actionConfirmMessage）→ Commit 1
- B.3（chooseSeat reveal intent 仍按 role 分支）→ Commit 1（通过 schema/turnVM.intentStyle 消除 role switch）
- B.4（底部按钮混 legacy/特例）→ Commit 2
- B.5（swap.canSkip 未严格消费）→ Commit 2

- C.1（wolfVote forbiddenTargetRoleIds UI 未消费）→ Commit 5（可选）
- C.2（witch steps 未驱动 UI）→ Commit 3
- C.3（nightSteps.visibility 未作为 UI 单一来源）→ Commit 4
- C.4（audioKey/audioEndKey UI 不展示）→ Commit 6（可选）

### 来自第 0.5 节的字段覆盖表（schema/specs/nightsteps）

- `SCHEMAS[*].displayName` 目前未作为文案主源 → Commit 1
- `ChooseSeatSchema.canSkip`（已双保险）→ Commit 2 里纳入“统一底部按钮策略”回归测试（防退化）
- `SwapSchema.canSkip` → Commit 2
- `CompoundSchema.steps/CompoundStep.*` → Commit 3
- `WolfVoteSchema.forbiddenTargetRoleIds` → Commit 5（可选，纯 UX）
- `NIGHT_STEPS.visibility.*` → Commit 4
- `NIGHT_STEPS.audioKey/audioEndKey` → Commit 6（可选，纯展示）
- “旧的/不对的/没用的删掉” → Commit 7（必须做，收口清理）

---

## 5.2 每个 commit 的统一测试门禁（建议）

每个 commit 都至少跑一次：

```bash
# RoomScreen UI smoke
npm test --silent -- src/screens/RoomScreen/__tests__ --runInBand

# spec contract（表一致性 + 红线）
npm test --silent -- src/models/roles/spec/__tests__ --runInBand

# night resolvers（避免改 UI 牵连规则误改）
npm test --silent -- src/services/night/resolvers --runInBand
```

**目标**
- `actsSolo/wolfMeetingPhase` 不再散落在 `useActionerState` / role 判断。

**做法**
- turnVM 提供：`showWolves: boolean`（由 Host 基于 step.visibility + ROLE_SPECS.wolfMeeting 推导）
- UI 只用这个布尔值做显示；不推导。

**红线检查**
- 这属于“非敏感 UI 状态”，可以 public。

**测试**
- contract：nightmare step actsSolo=true 必须导致 showWolves=false（已在 nightSteps.contract 有类似断言）

---

## 6. 必须新增的 Contract Tests（防 drift）

为了保证“schema-driven”不会回退到 role-specific，建议加 2 类红线测试：

1) **UI contract（静态/半静态）**
- `RoomScreen` 底部按钮的可见性在 chooseSeat 时必须只由 `schema.canSkip` 决定。

2) **Spec contract（表一致性）**
- `NIGHT_STEPS[*].id` 必须存在于 `SCHEMAS`（已存在）
- 每个 `ChooseSeatSchema` 必须显式声明 `canSkip`（已存在）
- wolfKill schema 不允许出现 forbidden/notSelf 等（已有 neutral red line test）

---

## 7. 风险与取舍

- **最大收益**：减少 RoomScreen role 分支，降低未来加角色/加 step 的回归成本。
- **最大风险点**：女巫 compound steps 重构（PR3）。
- **可选增强**：wolfVote forbiddenTargetRoleIds 的 UI 禁点提示（只是 UX，Host 仍裁判）。

---

## 8. 验收标准（Definition of Done）

- RoomScreen 不再依赖 role-specific 分支决定：
  - prompt 文案
  - bottom action 按钮（skip / 空刀等）
  - seat 可点性（至少能通过 schema/turnVM 提供的 selectable/disabled 做 UX）

- 所有行为仍满足红线：
  - 非法输入必有 ACTION_REJECTED 私信回执
  - public broadcast 不包含敏感字段
  - Night-1-only

- 测试门禁：
  - `npm test -- src/screens/RoomScreen/__tests__ --runInBand` ✅
  - `npm test -- src/models/roles/spec/__tests__ --runInBand` ✅
  - `npm test -- src/services/night/resolvers --runInBand` ✅

---

## 9. 下一步（如果你点头，我就按 PR1 → PR4 逐个落地）

我建议先做 PR1 + PR2（低风险、收益立竿见影），PR3（女巫）单独开一条更严格的测试回归链路。
