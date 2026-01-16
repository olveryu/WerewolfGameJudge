# Phase 5：清理所有 legacy / deprecated（终局迁移方案）

> 目标：把仓库里所有标注为 **legacy / backward compat / deprecated** 的结构与 API 全部清掉，让 **NightPlan(NIGHT_STEPS + SCHEMAS)** 成为唯一权威；Host 仍是唯一裁判（Supabase 只做传输/发现/身份）。
>
> 本文是“怎么删干净”的方案，不是一次性 PR；会拆成多个小 PR，每个 PR 都必须：Typecheck + Jest 全绿。

---

## ✅需求清单（来自你的要求）

- [x] **scan 完所有 legacy / deprecated**（基于全仓库关键词：`legacy|backward compat|deprecated|compatibility` + 关键符号：`RoleName/ROLES/actionOrder/RoomStatus/...`）。
- [x] **写 1 个中文 doc**，给出“全部干掉”的落地方案。
- [ ] **真正落地代码删除**：按本文分 PR 推进（下一步我可以直接开干）。

---

## 0）定义“删干净”的 Done 标准

满足以下条件才算 Phase 5 Done：

1. `rg -n "legacy|backward compat|deprecated" src` 结果为空或仅剩“历史说明文档”（不在 `src/**`）。
2. `RoleName`、`ROLES`、`Template.actionOrder`、`currentActionerIndex`（作为驱动夜晚流程的旧指标）不再存在于 runtime 类型/逻辑中。
3. 公共广播（public broadcast）里不出现任何“旧字段兼容层”残留（例如老的 numeric status 兼容映射）。
4. `NightFlowController` / `GameStateService` 夜晚推进只由 `NightPlan` 驱动（step index / step id / roles 仅来自 NightPlan）。
5. Jest 全绿（包含 contract tests + integration tests）。

---

## 1）Scan 结果（你要的“把 legacy 全数点名”）

下面按“源头分类”列出目前 `src/` 下明确存在的 legacy/deprecated 面（示例文件来自扫描结果；不保证只有这些行，但这些是权威入口）。

### A. RoleName / ROLES（roles facade 中的兼容层）

文件：`src/models/roles/index.ts`

- `export type RoleName = keyof typeof ROLE_SPECS;`
  - 注释：backward compatibility alias for RoleId
- `getRoleDisplayInfo()`
  - 注释：compatibility glue
  - 内部有 `roleToSchemaId` 的手写映射（属于双写：role→schema）
- `export const ROLES` record
  - 注释：Backward Compatibility - ROLES record

**结论：**这是你点名要干掉的核心 legacy 源头之一。


### B. Template.actionOrder（旧夜晚顺序数据结构）

文件：`src/models/Template.ts`

- `export interface GameTemplate { ... actionOrder: RoleName[]; }`
- `getActionOrderForRoles()` 标注：`@deprecated`
- `createCustomTemplate/createTemplateFromRoles` 都会写入 `actionOrder`
- `getTemplateRoomInfo()` 依赖 `ROLES[r].displayName`（又一处 ROLES 依赖）

**结论：**`actionOrder` 是“夜晚顺序的第二真相”，必须移除，且会牵动 tests/boards 工厂。


### C. NightFlowController 内部兼容字段 _actionOrder

文件：`src/services/NightFlowController.ts`

- `private readonly _actionOrder: RoleName[];  // Derived from NightPlan for backward compat`
- `NightFlowState` 里暴露 `actionOrder`
- `currentRole` 基于 `_actionOrder + currentActionIndex`

**结论：**这是 service runtime “还在用 role 顺序” 的残留，应改为只暴露 `NightPlanStep`。


### D. GameStatus → RoomStatus numeric 映射（UI 兼容层）

文件：`src/services/types/GameStateTypes.ts`

- `gameStatusToRoomStatus(status): number`
  - 注释：for backward compatibility / legacy numeric room status

以及：`src/hooks/useGameRoom.ts` 仍使用 `RoomStatus`（会导致 UI 继续吃旧枚举）。

**结论：**这是“状态协议层”的 legacy，最终应让 UI 直接消费 `GameStatus` 或新的 `RoomStatus`（字符串/枚举）而不是 number。


### E. services/types 的 legacy re-export

文件：`src/services/types/index.ts`

- `export * from './GameStateTypes';`
  - 注释：Legacy GameState types

**结论：**这是“迁移期便利出口”，phase 5 应删除，避免外部继续引用旧结构。


### F. spec 层的 migration-only deprecated 字段（带 remove by 2026-03-01）

文件：

- `src/models/roles/spec/schema.types.ts`
  - 多个 `/** @deprecated TODO(remove by 2026-03-01) */`
- `src/models/roles/spec/spec.types.ts`
  - `NOTE(remove by 2026-03-01)`
- `src/models/roles/spec/plan.ts`
  - `NightPlanStep.order`：consumer-facing field kept for backward compatibility
  - `getActionOrderViaNightPlan()`：for backward compatibility

**结论：**这些是“spec API 自己就承认是过渡”的地方，Phase 5 需要集中清掉并配 contract test 防回归。


### G. 其他显式 @deprecated

- `src/services/AudioService.ts`：存在 `@deprecated` 方法（`safePlayAudioFile` 替代）。

**结论：**这类属于“独立技术债”，不影响 NightPlan 主线，但既然你说“都干掉”，也要纳入。

---

## 2）迁移总原则（避免删崩 + 保持红线）

- **Host 是唯一权威**：任何动作合法性、夜晚推进、死亡结算仍在 Host runtime；这里只是在删“兼容层数据结构”。
- **单一真相**：
  - Night 顺序只来自 `NIGHT_STEPS` → `buildNightPlan()` → `NightPlan.steps`。
  - UI copy/交互只来自 `SCHEMAS`/steps（你已经选了硬核 A：缺字段就 throw）。
- **不引入 cross-night/state 记忆**：本 phase 只清理旧结构，不加新规则。

---

## 3）分 PR 执行路线（每步都能绿）

> 为什么要分：你要求“删干净”，但这些 legacy 贯穿 types/tests/ui/service。切成可验证的 PR 才不会大爆炸。


### PR-1：去掉 `Template.actionOrder`（最关键的“第二真相”）

**目标：**`GameTemplate` 只保留 `roles`，夜晚顺序实时从 `buildNightPlan(roles)` 推导。

- 修改：`src/models/Template.ts`
  - 删除字段 `actionOrder`
  - 删除 `getActionOrderForRoles()`（deprecated wrapper）
  - `createCustomTemplate/createTemplateFromRoles` 不再写 `actionOrder`
  - `getTemplateRoomInfo()` 改为 `getRoleSpec(r).displayName`（彻底去 ROLES 依赖）

- 修改：所有读取 `template.actionOrder` 的地方（常见：`useGameRoom.ts` / tests / board 工厂）
  - 用 `buildNightPlan(template.roles)` 或 Host broadcast 的 `currentStepId` 来计算 UI 展示

- 风险点：大量 tests 传入 `actionOrder` 构造 template
  - 处理：统一用 helper `makeTestTemplate(roles)`

- 验证：Jest 全绿 + 增加 contract test：`GameTemplate` 不允许有 `actionOrder`


### PR-2：NightFlowController 移除 `_actionOrder` & 面向 step 驱动

**目标：**NightFlow state machine 只认识 `NightPlanStep`，不再公开 `actionOrder/currentRole(RoleName)`。

- 修改：`src/services/NightFlowController.ts`
  - 删除 `_actionOrder`、`actionOrder getter`、`currentRole`（或改为 `currentRoleId` 从 `currentStep.roleId` 临时读）
  - `NightFlowState` 去掉 `actionOrder` 字段
  - `hasMoreRoles()` 改为 `currentActionIndex < nightPlan.steps.length`

- 同步修改：`GameStateService` 中任何用 `nightFlow.actionOrder/currentRole` 的逻辑
  - 统一改读 `nightFlow.currentStep`

- 验证：现有 nightFlow contract tests + boards integration tests


### PR-3：干掉 RoleName（统一 RoleId）

**目标：**工程内只存在 `RoleId`（来自 `ROLE_SPECS` key），不再有 `RoleName` alias。

- 修改：`src/models/roles/index.ts`
  - 删除 `export type RoleName`
  - 删除 `isValidRoleName()`

- 全仓替换类型：
  - `RoleName` → `RoleId`（注意：不要用 `as any`）
  - `Map<RoleName, ...>` → `Map<RoleId, ...>`

- 风险点：Broadcast payload 里有 `role: RoleName`
  - 处理：改成 `roleId: RoleId` 或沿用 `role: RoleId`（但字段名最好也改，避免语义继续叫 name）

- 验证：Typecheck + Jest


### PR-4：干掉 ROLES record + getRoleDisplayInfo（compat glue）

**目标：**roles facade 不再提供“旧 UI 面向 display info” 的 API；UI 只使用 schema/spec。

- 修改：`src/models/roles/index.ts`
  - 删除 `ROLES` / `RoleDefinition` / `buildRolesRecord()`
  - 删除 `getRoleDisplayInfo()`（以及内部 role→schema 手写映射）

- 替代方案：
  - 角色百科/展示：`getRoleSpec(roleId)`（displayName/description/team/faction）
  - 行动提示：`getSchema(schemaId).ui.*` + `NIGHT_STEPS`

- 额外顺带：`src/models/Template.ts:getTemplateRoomInfo()` 必须已在 PR-1 去掉 ROLES，否则这里会卡死。

- 验证：Jest + contract test：禁止 `src/models/roles/index.ts` 出现 `ROLES|getRoleDisplayInfo|RoleName`


### PR-5：消灭 GameStatus→RoomStatus numeric 映射（协议层 legacy）

**目标：**UI/state 只消费 `GameStatus`（string enum）或新的 `RoomStatus`（非 number）。

建议策略（二选一，推荐 A）：

- A) **删 RoomStatus（legacy numeric）**，UI 全部改用 `GameStatus`
  - `useGameRoom.ts` 不再输出 `roomStatus: RoomStatus`，改输出 `gameStatus: GameStatus`
  - RoomScreen 以及其它 screen 的状态分支改用 string enum

- B) RoomStatus 保留但改成 string enum，并让它成为权威
  - 风险更大（涉及 models/Room.ts），不如 A 直接。

- 修改：
  - 删除 `gameStatusToRoomStatus()`
  - 删除所有依赖 numeric room status 的代码/测试

- 验证：Jest + UI smoke tests（你现在的 per-schema smoke suite 可以帮我们防回归）


### PR-6：清理 spec 层 migration-only deprecated 字段（remove by 2026-03-01）

**目标：**spec/types 里所有 `@deprecated TODO(remove by 2026-03-01)` 字段全部删除，并通过 contract test 锁死。

- `src/models/roles/spec/schema.types.ts`
  - 删除标注 deprecated 的旧字段（具体字段名以文件内容为准）

- `src/models/roles/spec/plan.ts`
  - 删除 `NightPlanStep.order`（如果确实是“对外兼容字段”）
  - 删除 `getActionOrderViaNightPlan()`（兼容 API）

- `src/models/roles/spec/spec.types.ts`
  - 删除 deprecated 的 legacy validation 字段（文档里写明“约束必须来自 SCHEMAS.constraints”）

- 验证：
  - 现有 contract tests 更新
  - 新增 contract：`NightPlanStep` 只允许 `{ roleId, schemaId, audioKey, ... }`（以当前最终设计为准）


### PR-7：清理 AudioService 的 @deprecated

- 删除旧方法（如 `playAudioFile`）或改为 private，更新调用点到 `safePlayAudioFile`
- 验证：`AudioService.test.ts` 全绿


### PR-8（收尾）：删除 services/types 的 legacy re-export & repo 级“禁回归”护栏

- 修改：`src/services/types/index.ts`
  - 移除 `export * from './GameStateTypes'`
- 新增：repo contract test（或把它合进现有 contract suite）
  - `rg` 级禁词（在 Jest 里用 `glob + readFileSync` 做白名单扫描）
  - 禁止 `RoleName|ROLES|actionOrder|gameStatusToRoomStatus` 在 `src/**` 出现

---

## 4）为什么这套顺序是“最稳的删法”

- `Template.actionOrder` 是最核心的“第二真相”，不先删它，任何 RoleName/ROLES 的替换都容易被 actionOrder 依赖卡住。
- NightFlowController 先改成 step 驱动，可以把后续 RoleId 替换的 blast radius 限制在 types 层。
- ROLES/getRoleDisplayInfo 是典型 compat glue：只有在上游都切完后才好删，否则 UI/Template 还会引用。

---

## 5）验证与回滚策略

- 每个 PR：
  - Typecheck（TS）
  - Jest（全量）
- 任一步出现大面积失败：
  - 先用 `git bisect` 确认是哪一步引入
  - 不做“临时 fallback”，坚持 fail-fast（你已选硬核 A）

---

## 6）下一步我能直接做什么（不需要你再拆任务）

你如果点头，我建议我直接从 **PR-1（删 Template.actionOrder）** 开始落地：

- 修改 `Template.ts` + 相关 tests 工厂
- 把 `useGameRoom.ts` 中 `currentActionRole` 从 `actionOrder` 改为 schema/step 推导
- 跑 Jest，保证绿

---

## 附：本 phase 涉及的关键文件清单（非穷举）

- `src/models/Template.ts`
- `src/models/roles/index.ts`
- `src/services/NightFlowController.ts`
- `src/services/types/GameStateTypes.ts`
- `src/services/types/index.ts`
- `src/hooks/useGameRoom.ts`
- `src/services/GameStateService.ts`
- `src/services/BroadcastService.ts`（role 字段）
- `src/services/__tests__/**`（boards/contract/integration）

