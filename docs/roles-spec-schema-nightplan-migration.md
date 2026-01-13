# Roles Spec/Schema/NightPlan 重构记录（Phase 1 → Phase 3）

这份文档是为了避免“过几个月回头看完全忘了当初为什么这么设计”。

它记录了本仓库围绕 **角色系统与首夜夜晚流程** 的重构目标、边界、模块划分、以及 Phase 2/3 的渐进式迁移路线。

> 范围说明：本 App 只做 **首夜（Night 1）**。白天发言/投票不在本 App 内。

---

## 最重要的原则（必须遵守）

### 1) Host as Authority（房主是游戏逻辑权威）

- 房主客户端是 **唯一** 的游戏逻辑权威：夜晚流程推进、动作校验、音频串联、死亡结算都在 Host 本地内存完成。
- Supabase 只负责系统层：房间发现/存在、身份、presence、realtime transport；**不存游戏状态、不执行逻辑、不判定结果**。

### 2) NightFlowController 是夜晚推进唯一权威

- `NightFlowController` 只负责“合法状态迁移”（phase/step 变更）。
- `GameStateService` 只是桥接层：audio + broadcast + apply patches；不能私自推进流程。
- Host 夜晚 ongoing 时 `nightFlow` 必须存在；缺失属于 bug，需要 fail-fast 或明确救援协议。

### 3) 夜晚行动顺序必须来自 NightPlan（单一来源）

- Night 1 的行动序列必须是 table-driven 的 `NightPlan`。
- 禁止在 UI/services/tests 里新增第二份“行动顺序数组/映射”（例如新的 `ACTION_ORDER`）。

### 4) UI 不编码 gameplay（只消费 schema/view-model）

- UI 不允许写 `if (roleId === 'witch') { ...规则... }` 这种“角色规则分支”。
- UI 只能根据 Host 广播的 `schemaId`/schema 属性渲染，规则校验必须在 Host resolver 上完成。

---

## Phase 1（已落地）：声明式 Spec + Schema + NightPlan + Host-only Resolvers

### 目标

把“角色能力 / 动作输入协议 / 首夜行动序列”变成可测试、可复用、UI 可消费的纯数据层；把动作校验与结算放到 Host-only 的纯函数 resolvers。

### 代码落点（当前分支）

#### A) 纯数据层（UI 可 import）

目录：`src/models/roles/spec/`

- `ROLE_SPECS`：角色声明（显示名、团队、night1.hasAction/order/schemaId/actsSolo、UX 文案、audioKey 等）
- `SCHEMAS`：动作 schema registry（chooseSeat / wolfVote / compound / confirm / ...）
- `buildNightPlan(templateRoles)`：从模板角色集推导 NightPlan（dedupe + sort + fail-fast）

关键约束：

- `buildNightPlan()` 会对输入 roleId 做 fail-fast：遇到非法 roleId 直接抛 `NightPlanBuildError`。

#### B) Host-only resolvers（纯函数）

目录：`src/services/night/resolvers/`

- 每个角色/动作对应 resolver：验证输入并返回 patches（例如 `wolfKillDisabled`）
- 通过 import-boundary contract test 强制 UI 不得 import resolvers

#### C) Contract tests（门禁）

目录：`src/models/roles/spec/__tests__/`

- specs/schema/nightPlan 合约测试
- import-boundary 测试

---

## Phase 2（集成期）：把 NightPlan 接入现有系统（双轨兼容，最小爆炸半径）

> 这一阶段的核心是：**内部权威切换到 NightPlan**，但对外保持兼容（现有 `template.actionOrder`、`ROLE_TURN`、既有 Jest contract tests 与 UI 不能大面积爆炸）。

### Step 2.1 现状调研（必须先做）

产出：`docs/phase2-migration-audit.md`

列出清单：

1. `template.actionOrder` 的写入/读取点
2. `currentActionerIndex` 的推进点（谁 ++，谁读）
3. `ROLE_TURN` payload 在 UI/tests 的字段依赖
4. `ACTION_ORDER` / `getNightActionOrderForRoles` 依赖点
5. 直接依赖 `actionOrder` 的 tests（文件 + 断言摘要）

### Step 2.2 Template 集成（内部用 NightPlan 推导 actionOrder）

现实约束（以仓库为准）：

- 本仓库的 `src/models/Template.ts` 是**函数式**（`createCustomTemplate` / `createTemplateFromRoles` 返回 `GameTemplate`），没有 `class Template`。

目标行为：

- `template.actionOrder` 不再来自旧的 `ACTION_ORDER.filter(...)`。
- 改为：`buildNightPlan(template.roles).steps.map(s => s.roleId)` 的派生结果。
- `ACTION_ORDER` 暂时保留（只做对比测试 + deprecated），不立刻删除。

新增测试（建议）：

- `Template.actionOrder.compat.test.ts`：对一组代表性模板 roles，断言：
  - 新 `actionOrder`（NightPlan） == 旧 `actionOrder`（legacy filter 逻辑）

### Step 2.3 NightFlowController（不调用 buildNightPlan，仅更换注入来源）

目标：

- `NightFlowController` 仍然接收 `actionOrder` 作为构造/输入。
- 只把该输入的来源切换成 Template（此时 Template 已经由 NightPlan 推导 actionOrder）。
- Controller 内部不引入 spec/plan 构建逻辑。

### Step 2.4 GameStateService 桥接（广播协议渐进式扩字段）

现实约束（以仓库为准）：

- 目前 `ROLE_TURN` 是在 `GameStateService.playCurrentRoleAudio()` 内**内联 broadcast**，并没有独立的 `broadcastRoleTurn()`。

目标行为：

- 保持 `ROLE_TURN` 旧字段（`role`, `pendingSeats`, `killedIndex`）不变。
- 在同一个 payload 内新增 schema 驱动字段：
  - `schemaId`
  - `displayName`
  - `actionMessage`
  - `actsSolo`

新增测试（烟雾级）：

- 在 `src/services/__tests__/GameStateService.nightFlow.contract.test.ts` 增加 1~2 个断言：
  - `ROLE_TURN` 至少带上 `schemaId`（例如 seer/wolf 任一）

### Step 2.5 UI（仅做 2.5-A：读 schemaId，保留 role fallback）

目标：

- UI 开始读取 `schemaId` 并使用 schema 的参数（如 `notSelf`/`canSkip`）。
- 暂时保留 role-specific switch/case（Phase 3 再删除）。

---

## Phase 3（收口期）：完全 schema-driven，删除 legacy 权威

当 Phase 2 完成并稳定后，进入收口：

1. 广播层形成稳定的夜晚 view-model（currentStep/schema/constraints 等）
2. UI 删除 role-specific 分支，完全由 `schema.kind` 渲染
3. 删除 legacy：`ACTION_ORDER` / 旧 ordering 逻辑 / 旧 roles 文件（确认无引用后）

---

## 验证门禁（建议执行顺序）

> 命令以 `package.json` scripts 为准。

```bash
# 类型检查
npm run typecheck

# 单测
npm test

# Phase 1 合约门禁（跑得快，适合本地频繁执行）
npx jest --runInBand src/models/roles/spec/__tests__

# 如改动夜晚流程，请额外跑 nightFlow contract tests
npx jest --runInBand src/services/__tests__/GameStateService.nightFlow.contract.test.ts

# E2E（smoke-only；必须 workers=1）
npm run e2e:core
```

---

## 常见坑与处理原则

- **不要引入第二份行动顺序**：所有地方都应从 NightPlan 派生。
- **不要让 UI 做规则校验**：Host resolver 必须拒绝非法动作并保持幂等。
- **兼容期不要删 ACTION_ORDER**：先 deprecated + TODO timebox，等全链路切完再删。
- **别在 Controller 里 buildNightPlan**：plan 构建应在 Template/Host 初始化阶段完成，然后注入 controller。
