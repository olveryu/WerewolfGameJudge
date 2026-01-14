
# Night-1 编排单一真相（改良版）迁移方案

> 目标：在 **Host 权威**（Host as Authority）、**Night-1-only**、**anti-cheat** 的架构红线下，把 Night-1 的“顺序 + stepId/schemaId + 音频编排 + 可见性”收敛为可验证的**单一真相**，并以契约测试防止回退与漂移。

## 背景与动机

当前 Night-1 编排相关信息可能分散在多个地方（例如 RoleSpec、NightSteps、NightPlan、UI 逻辑）。分散的风险：

- **双写漂移**：改了顺序或音频只改一处，导致 Host 运行与 UI 表现不一致
- **复制当契约**：测试或逻辑依赖文案/旁白字段，轻微重构就引入 flake
- **反作弊边界被破坏**：把本应 host-side 的 visibility/私密信息混入广播状态

本方案选择以 `NIGHT_STEPS` 作为 Night-1 编排的权威单一真相，并把与 Night-1 编排强相关的信息（音频、可见性）收敛到同一张“步骤表”。

## 核心约束（必须满足）

### 1) Host as Authority

- Night-1 流程推进、音频播放、行动接收与校验由 Host 负责
- Supabase 仅做 transport/discovery/identity，不做任何规则裁决

### 2) Night-1-only

- 本项目只覆盖第一晚
- 禁止引入跨夜状态/约束（如 lastNight/previousNight/notSameAsLastNight 等）

### 3) Anti-cheat（可见性红线）

- `visibility`（actsSolo / wolfMeetingPhase 等）属于 **host-side view-model**
- `visibility` 不得进入 `BroadcastGameState` / public broadcast payload
- 敏感信息必须用 toUid 私信（PrivateBroadcast）

## 终局契约（Single Source of Truth 划分）

### A. `SCHEMAS`：输入协议单一真相

- `SchemaId = keyof typeof SCHEMAS`
- 描述 action 输入结构与约束（kind/constraints/compound steps…）

### B. `ROLE_SPECS`：角色静态定义单一真相

- 只放角色“是什么”（阵营、描述、UI copy、wolfMeeting 元信息、被动 flags 等）
- 不承载 Night-1 编排信息（顺序/stepId/schemaId/audio 编排均不在这里）

> **改良点**：允许保留 `night1.hasAction` 作为“语义标签”（用于阅读与审计），但必须通过契约测试保证它与 `NIGHT_STEPS` 一致，并且 `night1` 中不得再出现 legacy 字段（order/schemaId/actsSolo）。

### C. `NIGHT_STEPS`：Night-1 编排单一真相（权威表）

数组顺序 = 权威顺序。

每个 step 至少包含：

- `id: SchemaId`（**stepId 就是 schemaId**）
- `roleId: RoleId`
- `audioKey`（可选 `audioEndKey`）
- `visibility: StepVisibility`

### audioKey 放哪里？（本方案定案）

**audioKey 的单一真相在 `NIGHT_STEPS`。**

理由：音频属于 Night-1 编排（主持流程）的一部分。顺序、唤醒、行动阶段、结束音频都应该在同一张“步骤表”里维护。

因此：

- `ROLE_SPECS.ux.audioKey` 应删除（或强制进入短期过渡后删除）
- `buildNightPlan()` / 夜晚音频播放只读 `NIGHT_STEPS.audioKey`

## 运行时结构（保持对外结构稳定）

### NightPlan/NightPlanStep（运行时快照，推荐保留）

为了减少消费方到处 lookup、避免把复杂度扩散到 UI/服务层，本方案 **不推荐** 把 `NightPlanStep` 极简化到只保留 `stepId`。

建议保持现有“快照字段”（兼容消费方，也更易读）：

- `roleId`
- `stepId: SchemaId`
- `order: number`（对外兼容字段）
- `displayName`（来自 `ROLE_SPECS`）
- `audioKey`（来自 `NIGHT_STEPS`）
- `actsSolo`（来自 `visibility.actsSolo`）

> 注：M2 后 `order` 的语义应明确为 **plan-local index（0..n-1）**，不再等价于历史的全局 order 值。

## 分阶段迁移步骤（可执行）

> 推荐按三个小里程碑提交（M3a/M3b/M3c）。每一步都给出验收标准。

### M3a：删除 StepSpec 的 schemaId 双写（低风险、高收益）

**目标**：`StepSpec` 只保留 `id: SchemaId`，不再保留 `schemaId` 字段。

**改动**：

1) `src/models/roles/spec/nightSteps.types.ts`
	- 删除 `schemaId: SchemaId`
2) `src/models/roles/spec/nightSteps.ts`
	- 每个 step 对象删除 `schemaId: 'xxx'`
3) 全 repo：`step.schemaId` → `step.id`
4) 契约测试：删除/更新“stepId === schemaId”的断言（因为 schemaId 字段消失）

**验收标准**：

- TypeScript typecheck 通过
- `nightSteps.contract.test.ts` 仍断言 `step.id` 是有效 `SchemaId`

### M3b：audioKey 单一真相归 NIGHT_STEPS（删除 `ROLE_SPECS.ux.audioKey`）

**目标**：Night-1 的音频编排只在 `NIGHT_STEPS` 定义。

**改动**：

1) `src/models/roles/spec/spec.types.ts`
	- 从 `RoleUx` / `UxConfig` 删除 `audioKey`
2) `src/models/roles/spec/specs.ts`
	- 删除所有 `ux.audioKey`
3) 迁移消费方（全 repo 搜索 `ux.audioKey`）：
	- Night-1 流程需要音频：使用 `NightPlanStep.audioKey` 或 `getStepSpec(stepId).audioKey`
	- 如存在“非 Night-1 的角色介绍音效”需求：新增 `ux.introAudioKey?`（仅在明确需求时引入；默认不要为了迁移而新加字段）

**验收标准**：

- TypeScript typecheck 通过（编译失败即遗漏迁移点）
- Jest 全绿

### M3c（改良点）：保留 `night1.hasAction` 语义标签，但用契约测试锁一致

**目标**：避免“硬删 night1 导致阅读/审计困难”，同时阻止 legacy 字段回归。

**改动**：

1) `RoleSpec.night1` 仅允许：`{ hasAction: boolean }`
2) 增加/更新契约测试（建议放在 `src/models/roles/spec/__tests__/specs.contract.test.ts` 或新增专门的 contract）：
	- 对每个 `RoleId`：
	  - `spec.night1.hasAction === (getStepsByRole(roleId).length > 0)`
	- 严禁 legacy：
	  - `spec.night1` 不得出现 `order/schemaId/actsSolo`

**验收标准**：

- 任意一侧修改 `NIGHT_STEPS` 或 `ROLE_SPECS.night1.hasAction`，若不匹配则 contract 必须失败

## 契约测试清单（必须具备）

### NightSteps contract

- step.id 唯一
- step.id 是有效 `SchemaId`
- step.roleId 是有效 `RoleId`
- 顺序稳定（只 snapshot stepId 列表；不要 snapshot 文案/旁白）
- `audioKey` 非空
- visibility 合法：`actsSolo=true` ⇒ `wolfMeetingPhase` 不为 true
- （Night-1-only）不含跨夜字段：`previousNight/lastNight/night2` 等不存在

### NightPlan contract

- `order` 必须为连续序列：`0..n-1`
- `stepId` 为有效 `SchemaId`
- plan 由 `NIGHT_STEPS` 过滤生成，顺序与 `NIGHT_STEPS` 一致

### Specs ↔ Steps alignment contract（改良点核心）

- `night1.hasAction` 与 `NIGHT_STEPS` 的存在性一致
- `night1` 不允许出现 legacy 字段

## 风险与回滚策略

### 主要风险

- M3b 删除 `ux.audioKey` 会引起编译期大量报错（这是预期的“逼迁移”机制）
- 若有非 Night-1 场景确实依赖角色音频，需要明确新增字段或改为从 step 推导（不要偷用已删除字段）

### 回滚策略（不推荐长期使用，仅用于紧急）

- 如果必须暂时保留 `ROLE_SPECS.ux.audioKey`：
  - 标注 `@deprecated`
  - 写清 `TODO(remove by YYYY-MM-DD)`
  - 增加契约测试强制 `ROLE_SPECS.ux.audioKey === NIGHT_STEPS.audioKey`
  - 禁止新用法

## 变更完成后的开发者心智模型

- 想改 Night-1 顺序/音频/可见性：只改 `NIGHT_STEPS`
- 想改输入限制（notSelf/compound nesting）：只改 `SCHEMAS`
- 想改角色名称/描述/提示文案：只改 `ROLE_SPECS`
- 想判断某角色 Night-1 是否行动：
  - 业务代码推荐：`getStepsByRole(roleId).length > 0`
  - 审计/阅读：`ROLE_SPECS[roleId].night1.hasAction`（由契约锁一致）

