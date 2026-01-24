# V2 Night-1 全角色对齐与测试门禁执行方案（给实施者）

> 目标：**逐个角色把 UI → Host Handler → Resolver 的 on-wire 协议对齐**，并用自动化测试把 drift 永久锁死。
>
> **硬约束（不可违反）**
>
> - Host 是唯一游戏逻辑权威；Player 端不得运行 resolver / night progression / death calc。
> - 仅 Night-1；禁止跨夜字段与规则。
> - `BroadcastGameState` 是唯一且完整单一真相；不得平行双写。
> - legacy 仅用于对照理解；**禁止为了兼容 legacy wire 重新引入 legacy 编码**（例如 mergedTarget=402）。
> - Schema-first：输入合法性以 `SCHEMAS[*].constraints` 为准；resolver 校验必须一致。

---

## 0. 交付方式（强制）

- **必须分 Commit**，每个 commit 都要：
  1) 扫描/对齐结论（写在 PR/commit message）
  2) 最少 1 个 Handler Contract Test（验证 UI payload → `buildActionInput`）
  3) 最少 1 个 Resolver Integration Test（验证 resolver 输入/输出 shape + 关键 edge case）
  4) 最少 1 个 **V2 boards / harness integration**（必须跑在 v2-only harness 上，见 0.1）
  4) 本地跑过 Jest 全绿
- 每个 commit 完成后 **停下来等审核**，不得一次性批量堆 10+ 角色。

### 0.1 V2-only 门禁（强制，避免 legacy 假阳性）

> 这部分是本方案的核心升级：**对齐的最终证据必须来自 v2 runtime pipeline**，不能再用 legacy Host 跑出“看似通过”的结果。

每个涉及 Night-1 行动协议的改动（UI/handler/resolver 任一处），必须同时满足：

1) **boards/integration 必须基于 v2-only harness**

- 必须使用：`src/services/v2/__tests__/boards/hostGameFactory.v2.ts`（或等价 v2-only harness）。
- ❌ 禁止：在 v2 boards 目录下 import `src/services/GameStateService*`、`src/services/legacy/**`、`NightFlowController`。

2) **必须有 boundary guard（防止回退到 legacy/encoded-target）**

- 必须通过：`src/services/v2/__tests__/boards/boundary.guard.test.ts`
- guard 至少要覆盖：
  - v2 boards harness 目录
  - v2 core（`src/services/v2/handlers/**`、`src/services/v2/reducer/**`）

3) **必须有 wire protocol contract（锁死“harness 实际发送的 payload shape”）**

- 必须通过：`src/services/v2/__tests__/boards/wireProtocol.contract.test.ts`
- contract 不只测 `SCHEMAS/NIGHT_STEPS`，还必须额外锁死：`hostGameFactory.v2.ts` 实际发送的 `PlayerMessage`（或等价测试手段）。
  - swap（magicianSwap）：`target === null` + `extra.targets`（仅在 length>0 时存在）
  - compound（witchAction）：`target === null` + `extra.stepResults` 且包含 `save/poison` 两个 key

4) **单一真相（BroadcastGameState）强制落地到 night end / death calc**

- night end / death calc 必须只读 `BroadcastGameState`（= v2 state）中的权威字段。
- 例如：witch 的 save/poison 结果必须从 `currentNightResults.savedSeat/poisonedSeat` 读取。
- ❌ 禁止：从 `ProtocolAction.targetSeat` 反推 witch 行为（这会导致 drift）。

---

## 1. “对齐”的定义（必须按这个做）

对每个 Night-1 行动角色（或 schema）都要回答下面 3 个问题，并用测试覆盖：

1) **UI 实际提交的 payload 长什么样？**
   - 以 `src/screens/RoomScreen/__tests__/*.ui.test.tsx` 里的 `toHaveBeenCalledWith(...)` 为事实来源。
   - 如果没有对应 UI 测试，先补 UI 测试再谈对齐。

2) **Handler 如何把 payload 转成 `ActionInput`？**
   - 入口在 `src/services/v2/handlers/actionHandler.ts` 的 `buildActionInput()`。
   - Handler Contract Test 必须断言 build 出来的 `ActionInput` 字段：`target | targets | stepResults | confirmed`。

3) **Resolver 实际读取哪些字段？**
   - 在 `src/services/night/resolvers/<role>.ts` 中看 `input.*` 访问点。
   - Resolver Integration Test 必须用真实的 `ActionInput` shape 调用 resolver（不要用“自己拍脑袋造的 input”）。

> 结论：**只写 resolver 单测不算完成**。必须覆盖 wire protocol（UI→Handler）。

---

## 2. 现已确认的高风险断裂（必须优先修）

### 2.1 Witch（已证实是致命 bug）

- **v2 目标协议（硬约束）**：witchAction 是 compound schema，UI/boards 必须提交 `extra.stepResults`
- **Handler 目标**：`buildActionInput()` 从 `extra.stepResults` 读取并传给 resolver
- **Resolver 期望**：`src/services/night/resolvers/witch.ts` 读取 `input.stepResults`
- **night end / death calc 目标**：结算必须从 `BroadcastGameState.currentNightResults.savedSeat/poisonedSeat` 读取（单一真相）

**修复方向（必须选其一，且不能兼容 legacy）**

- ✅ 必须：UI 提交为 v2 统一协议：`submitAction(actorSeat, { stepResults: { save: <seat|null>, poison: <seat|null> } })`
  - 这符合 schema-first（compound）输入模型
  - 同时更新 UI 测试断言
- ❌ 禁止：为了“兼容旧测试/旧 harness”在 v2 handler 中支持 `{ poison: true }/{ save: true }` 这种 legacy-ish payload。若现有测试仍依赖该形态，应先迁移测试到 v2 wire。

**测试门禁（必须）**

- Handler Contract Test：给定 UI extra，断言 build 出 `ActionInput.stepResults` 完整形态
- Resolver Integration Test：
  - poison 路径：`poison: { target: X }`（或等价 schema 结构）产生正确 updates
  - save 路径
  - edge：`stepResults` 全 null 等价 skip

---

## 3. 角色输入类型分组（按组批量做）

> 目的：减少重复劳动。每组用 `describe.each` 批量生成 contract tests。

### 3.1 chooseSeat（多数角色：`input.target`）

典型：seer/guard/psychic/nightmare/slacker/dreamcatcher/gargoyle/wolfQueen/wolfRobot/wolf

- UI payload 目标：`submitAction(actorSeat, { target: seat })` 或 `submitAction(actorSeat, seat)`（以 UI tests 为准）
- Handler 输出目标：`ActionInput.target === seat`
- Resolver 读取：`input.target`

**每个角色必须的测试**

- 1 个 Handler Contract Test：UI payload → `buildActionInput().target`
- 1 个 Resolver Integration Test：
  - happy path
  - edge：nightmare block（`currentNightResults.blockedSeat === actorSeat`）返回 valid 但无效果

### 3.2 swap（magician：`input.targets: [a,b]`）

- UI payload：必须是 `submitAction(null, { targets: [a,b] })`（已修复过，不能回退）
- Handler 输出：`ActionInput.targets`
- Resolver 读取：`input.targets`

**测试门禁**

- 断言 targets 顺序/长度/不允许 target 混用
- edge：targets 缺失 → skip

### 3.3 confirm（hunter / darkWolfKing 等：`confirmed:true`）

- UI payload：`submitAction(actorSeat, { confirmed: true })`
- Handler：`isSkipAction()` 用 `confirmed !== true` 判定 skip；nightmare block 要走统一 guard
- Resolver 可能不读 input（confirm guard 在 handler）

**测试门禁**

- Handler Contract Test：
  - confirmed=true → 不 skip
  - confirmed=false/undefined → 当作 skip（或按现有 schema 定义）
  - blockedSeat === actorSeat → 必须是 valid 但无效果（skip-like）

### 3.4 wolfVote（独立链路）

- UI 不是 `submitAction`，而是 `submitWolfVote(seat)`
- 必须确认：
  - Host 是否仍走统一 resolver 管线
  - 免疫目标禁选/UI 提示 + Host reject（已完成过的硬约束不要回归）

**测试门禁**

- 至少 1 个 contract（或 board-level）测试：从 UI 意图到 Host 更新 `currentNightResults.wolfVotesBySeat` 的链路不 drift

---

## 4. 推荐的分 5 个 Commit 落地顺序（照做）

### Commit 1：Witch 协议修复 + 双层测试

- 改 UI 或 handler，使 witch 产生正确的 `ActionInput.stepResults`
- 更新/新增：
  - `RoomScreen` 的 witch 提交 payload
  - `witchPoison.ui.test.tsx` / `witchSave.ui.test.tsx`（如存在）
  - `actionHandler` contract test（witch 专项）
  - `resolvers/witch` integration test

### Commit 2：Confirm 角色 contract（hunter/darkWolfKing）

- 加 `confirmed` 的 contract tests
- 覆盖 nightmare block 行为（blocked → valid but no effect）

### Commit 3：wolfVote 链路 contract（不引入新协议）

- 扫描并锁定 submitWolfVote → handler/resolver → broadcast state 的路径
- 加 1~2 个 contract tests 防回归

### Commit 4：chooseSeat 批量 contract + 最小 integration

- 用 `describe.each` 为所有 chooseSeat schema 建 contract tests
- 至少每类挑 1~2 个角色写 resolver integration（其余角色可只做 contract，后续再补齐）

### Commit 5：收尾与一致性审计

- audit：所有 Night-1 schema 都至少有 1 条 contract 覆盖
- audit：任何 UI payload 变化都会失败（防 drift）
- 去掉任何临时兼容分支（若做过）

---

## 5. 新测试怎么写（模板级要求）

### 5.1 Handler Contract Test（必须验证 buildActionInput）

- 放在：`src/services/v2/handlers/__tests__/actionHandler.contract.test.ts`（或项目已有同类位置）
- 断言：输入是 UI 会发出的 `{ actorSeat, extra }`，输出是 resolver 期望的 `ActionInput` shape
- 禁止：只断言返回 valid/reject，不看输入 shape

### 5.2 Resolver Integration Test（必须用真实 ActionInput）

### 5.3 V2 boards harness integration（必须，作为最终证据）

- 放在：`src/services/v2/__tests__/boards/*.v2.integration.test.ts`
- 必须使用 `createHostGameV2()` + `ctx.runNight(...)` 驱动 Night-1 完整流程
- 至少覆盖：
  - 1 个 swap（magicianSwap）场景
  - 1 个 compound（witchAction）场景
- 断言：
  - 广播状态（BroadcastGameState）正确更新（例如 swappedSeats / savedSeat / poisonedSeat / deaths）
  - 流程能完整 end night（避免 legacy 推进语义导致的假死）

- 放在：`src/services/night/resolvers/__tests__/<role>.integration.test.ts`
- 断言：
  - `valid`
  - `updates` 写到 `currentNightResults` 的 key（single source of truth）
  - nightmare block edge

---

## 6. 验收标准（你提交前自己对照）

- ✅ Witch poison/save 在 UI→Host→broadcast 端到端可生效（至少通过 contract + integration tests）
- ✅ 任一角色 UI payload 改动会导致 contract test 失败（防 drift）
- ✅ Jest 全绿
- ✅ 没有新增 `console.*` 到 `src/**` 业务代码
- ✅ 没有引入跨夜状态/规则

---

## 7. 你需要看的关键文件清单

- UI：`src/screens/RoomScreen/RoomScreen.tsx`
- UI tests：`src/screens/RoomScreen/__tests__/*.ui.test.tsx`
- Schemas：`src/models/roles/spec/schemas.ts`
- Handler：`src/services/v2/handlers/actionHandler.ts`
- Resolvers：`src/services/night/resolvers/*.ts`
- 广播状态：`BroadcastGameState` 类型定义（按项目现有位置）

---

## 8. 必须先做的“扫描清单”（每个 commit 开始前 5 分钟）

对你要改的角色，按顺序扫描并写在 commit message：

1) UI tests 里 submitAction/submitWolfVote 的实参长什么样
2) `buildActionInput()` 现在怎么解析
3) resolver 读取哪些 `input.*`
4) schema constraints 有哪些（notSelf / allowSelf / etc.）
5) nightmare block 是否适用；适用则必须覆盖测试

---

> 只要严格照本 doc 做，swap/witch 这种“协议没对齐但测试全通过”的情况就不会再发生。
