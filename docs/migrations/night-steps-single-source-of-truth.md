# NightSteps 单一真相重构方案

> 状态：待实施  
> 作者：技术团队  
> 日期：2026-01-14  
> 分支：`refactor/roles-spec-schema-resolver`

---

## 0. 目标与非目标

### 目标

1. **单一真相**：夜晚顺序 + step→schema + step→音频 + 可见性 **只在一个表里**
2. **策划可维护**：表结构是"流程表"，策划可读可改
3. **工程红线不破**：
   - NightFlowController 仍是唯一推进者
   - Host 仍是计算权威
   - 敏感信息仍只走 toUid 私信
   - Night-1-only（严禁跨夜状态）

### 非目标

- ❌ 不做 Night-2+（禁止引入 `previousNight` / `lastNight` 等跨夜字段）
- ❌ 不把主持词文案做成测试强约束

---

## 1. 现状分析

### 1.1 当前架构（散落的真相）

```
ROLE_SPECS[role].night1.order      → 顺序（数字散落在各角色）
ROLE_SPECS[role].night1.schemaId   → schema 绑定
ROLE_SPECS[role].night1.actsSolo   → 可见性
ROLE_SPECS[role].ux.audioKey       → 音频
```

**问题**：
- 调顺序需要改数字，容易冲突
- order/schemaId/actsSolo 与角色定义耦合
- 策划无法直观看到"夜晚流程表"

### 1.2 终局架构（单一真相）

```
NIGHT_STEPS[] 数组顺序 = 权威顺序
NIGHT_STEPS[step].schemaId        → schema 绑定
NIGHT_STEPS[step].visibility      → 可见性
NIGHT_STEPS[step].audioKey        → 音频

ROLE_SPECS[role].night1.hasAction → 仅布尔开关（是否参与夜晚）
```

**优势**：
- 数组顺序即权威，无 order 冲突
- 策划调顺序只需移动数组元素
- 职责清晰：RoleSpec = "谁是什么"，NightSteps = "谁什么时候做什么"

---

## 2. 数据模型

### 2.1 类型定义

文件：`src/models/roles/spec/nightSteps.types.ts`

```typescript
export type NightStepId = 
  | 'magicianSwap'
  | 'slackerChoose'
  | 'dreamcatcherDream'
  | 'guardProtect'
  | 'nightmareBlock'
  | 'gargoyleCheck'
  | 'wolfRobotLearn'
  | 'wolfKill'
  | 'wolfQueenCharm'
  | 'witchAction'
  | 'seerCheck'
  | 'psychicCheck'
  | 'hunterConfirm'
  | 'darkWolfKingConfirm';

export interface StepVisibility {
  readonly actsSolo: boolean;
}

export interface StepSpec {
  readonly id: NightStepId;
  readonly roleId: RoleId;
  readonly schemaId: SchemaId;
  readonly audioKey: string;
  readonly audioEndKey?: string;
  readonly visibility: StepVisibility;
}
```

### 2.2 步骤表

文件：`src/models/roles/spec/nightSteps.ts`

```typescript
export const NIGHT_STEPS: readonly StepSpec[] = [
  // === 特殊角色（最先行动）===
  {
    id: 'magicianSwap',
    roleId: 'magician',
    schemaId: 'magicianSwap',
    audioKey: 'magician',
    visibility: { actsSolo: true },
  },
  {
    id: 'slackerChoose',
    roleId: 'slacker',
    schemaId: 'slackerChoose',
    audioKey: 'slacker',
    visibility: { actsSolo: true },
  },
  
  // === 守护类 ===
  {
    id: 'dreamcatcherDream',
    roleId: 'dreamcatcher',
    schemaId: 'dreamcatcherDream',
    audioKey: 'dreamcatcher',
    visibility: { actsSolo: true },
  },
  {
    id: 'guardProtect',
    roleId: 'guard',
    schemaId: 'guardProtect',
    audioKey: 'guard',
    visibility: { actsSolo: true },
  },
  
  // === 狼人阵营 ===
  {
    id: 'nightmareBlock',
    roleId: 'nightmare',
    schemaId: 'nightmareBlock',
    audioKey: 'nightmare',
    visibility: { actsSolo: true },  // 梦魇独立行动
  },
  {
    id: 'gargoyleCheck',
    roleId: 'gargoyle',
    schemaId: 'gargoyleCheck',
    audioKey: 'gargoyle',
    visibility: { actsSolo: true },  // 石像鬼不知道狼队友
  },
  {
    id: 'wolfRobotLearn',
    roleId: 'wolfRobot',
    schemaId: 'wolfRobotLearn',
    audioKey: 'wolf_robot',
    visibility: { actsSolo: true },  // 机器狼不知道狼队友
  },
  {
    id: 'wolfKill',
    roleId: 'wolf',
    schemaId: 'wolfKill',
    audioKey: 'wolf',
    visibility: { actsSolo: false }, // 狼人互相可见
  },
  {
    id: 'wolfQueenCharm',
    roleId: 'wolfQueen',
    schemaId: 'wolfQueenCharm',
    audioKey: 'wolf_queen',
    visibility: { actsSolo: false }, // 狼美人可见狼队友
  },
  
  // === 女巫 ===
  {
    id: 'witchAction',
    roleId: 'witch',
    schemaId: 'witchAction',
    audioKey: 'witch',
    visibility: { actsSolo: true },
  },
  
  // === 查验类 ===
  {
    id: 'seerCheck',
    roleId: 'seer',
    schemaId: 'seerCheck',
    audioKey: 'seer',
    visibility: { actsSolo: true },
  },
  {
    id: 'psychicCheck',
    roleId: 'psychic',
    schemaId: 'psychicCheck',
    audioKey: 'psychic',
    visibility: { actsSolo: true },
  },
  
  // === 确认类 ===
  {
    id: 'hunterConfirm',
    roleId: 'hunter',
    schemaId: 'hunterConfirm',
    audioKey: 'hunter',
    visibility: { actsSolo: true },
  },
  {
    id: 'darkWolfKingConfirm',
    roleId: 'darkWolfKing',
    schemaId: 'darkWolfKingConfirm',
    audioKey: 'dark_wolf_king',
    visibility: { actsSolo: true },
  },
] as const;
```

---

## 3. 迁移阶段

### M1：新增表 + Contract Tests（不改运行逻辑）

**范围**：纯新增，零风险

**交付物**：
- [ ] `src/models/roles/spec/nightSteps.types.ts` — 类型定义
- [ ] `src/models/roles/spec/nightSteps.ts` — 步骤表常量
- [ ] `src/models/roles/spec/__tests__/nightSteps.contract.test.ts` — 契约测试
- [ ] 更新 `src/models/roles/spec/index.ts` — 导出

**验证**：
```bash
npm run typecheck
npm run test -- nightSteps.contract
```

---

### M2：切换 buildNightPlan 来源（核心改动）

**范围**：改 `plan.ts`，让 buildNightPlan 从 NIGHT_STEPS 过滤生成

**改动点**：
- [ ] `src/models/roles/spec/plan.ts` — 改为遍历 NIGHT_STEPS
- [ ] `src/models/roles/spec/plan.types.ts` — 更新 NightPlanStep 类型
- [ ] `src/models/roles/spec/__tests__/plan.contract.test.ts` — 更新测试

**新逻辑**：
```typescript
export function buildNightPlan(roles: RoleId[]): NightPlanStep[] {
  const roleSet = new Set(roles);
  return NIGHT_STEPS
    .filter(step => roleSet.has(step.roleId) && ROLE_SPECS[step.roleId].night1.hasAction)
    .map(step => ({
      stepId: step.id,
      roleId: step.roleId,
      schemaId: step.schemaId,
      audioKey: step.audioKey,
      visibility: step.visibility,
    }));
}
```

**验证**：
```bash
npm run typecheck
npm run test -- plan.contract
npm run test
npm run e2e:core
```

---

### M3：清理 RoleSpec 旧字段

**范围**：删除代码，编译失败逼迁移

**改动点**：
- [ ] `src/models/roles/spec/spec.types.ts` — Night1Config 只留 hasAction
- [ ] `src/models/roles/spec/specs.ts` — 移除每个角色的 order/schemaId/actsSolo
- [ ] `src/models/roles/spec/__tests__/specs.contract.test.ts` — 删除 order/schemaId 断言

**RoleSpec 终局结构**：
```typescript
// 修改前
night1: {
  hasAction: true,
  order: 15,
  schemaId: 'seerCheck',
}

// 修改后
night1: {
  hasAction: true,
}
```

**验证**：
```bash
npm run typecheck  # 编译失败 = 有遗漏引用
npm run test
npm run e2e:core
```

---

## 4. Contract Tests 覆盖

### 4.1 nightSteps.contract.test.ts

| 测试项 | 说明 |
|--------|------|
| stepId 唯一性 | 无重复 stepId |
| 数组顺序稳定 | snapshot 锁定 |
| roleId 有效性 | 每个 roleId ∈ RoleId |
| schemaId 有效性 | 每个 schemaId ∈ SchemaId |
| audioKey 非空 | 必须有音频 |
| Night-1-only | 无跨夜字段 |
| 与 RoleSpec 对齐 | hasAction=false 的角色不在表中 |

### 4.2 plan.contract.test.ts

| 测试项 | 说明 |
|--------|------|
| 顺序正确 | 按 NIGHT_STEPS 顺序 |
| 过滤正确 | 只包含模板中的角色 |
| hasAction=false 过滤 | 不包含无行动角色 |
| 空模板 | 返回空数组 |

---

## 5. 红线检查清单

| 红线 | 状态 | 验证方式 |
|------|------|----------|
| Host 权威 | ✅ | buildNightPlan 在 GameStateService.startGame() 调用 |
| NightFlowController 权威 | ✅ | 只读 NightPlanStep[]，不做规则判断 |
| Night-1-only | ✅ | Contract test 禁止跨夜字段 |
| UI schema-driven | ✅ | UI 通过 schemaId 渲染 |
| 私信反作弊 | ✅ | visibility 字段不进入 BroadcastGameState |

---

## 6. 目录结构（终局）

```
src/models/roles/spec/
├── index.ts                  # 统一导出
├── specs.ts                  # ROLE_SPECS（角色静态信息）
├── spec.types.ts             # RoleSpec 类型
├── schemas.ts                # SCHEMAS（Action Schema）
├── nightSteps.ts             # NIGHT_STEPS（单一真相）← 新增
├── nightSteps.types.ts       # StepSpec 类型 ← 新增
├── plan.ts                   # buildNightPlan()
├── plan.types.ts             # NightPlanStep 类型
└── __tests__/
    ├── specs.contract.test.ts
    ├── nightSteps.contract.test.ts  ← 新增
    └── plan.contract.test.ts
```

---

## 7. 时间线

| 阶段 | 预估工时 | 前置条件 |
|------|----------|----------|
| M1 | 2h | 无 |
| M2 | 4h | M1 合并 |
| M3 | 2h | M2 合并 |

总计：约 8 小时

---

## 8. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| M2 改动影响运行时 | 全量 Jest + E2E 验证 |
| schemaId 映射错误 | Contract test 强制 stepId=schemaId |
| 遗漏角色 | Contract test 对齐 ROLE_SPECS |
| 音频文件不存在 | 可选：增加音频资源存在性测试 |

---

## 9. 附录：stepId 与 schemaId 对照表

| stepId | roleId | schemaId | 说明 |
|--------|--------|----------|------|
| magicianSwap | magician | magicianSwap | 魔术师交换 |
| slackerChoose | slacker | slackerChoose | 懒汉选偶像 |
| dreamcatcherDream | dreamcatcher | dreamcatcherDream | 追梦人追梦 |
| guardProtect | guard | guardProtect | 守卫守护 |
| nightmareBlock | nightmare | nightmareBlock | 梦魇恐惧 |
| gargoyleCheck | gargoyle | gargoyleCheck | 石像鬼查验 |
| wolfRobotLearn | wolfRobot | wolfRobotLearn | 机器狼学习 |
| wolfKill | wolf | wolfKill | 狼人杀人 |
| wolfQueenCharm | wolfQueen | wolfQueenCharm | 狼美人魅惑 |
| witchAction | witch | witchAction | 女巫用药 |
| seerCheck | seer | seerCheck | 预言家查验 |
| psychicCheck | psychic | psychicCheck | 通灵师查验 |
| hunterConfirm | hunter | hunterConfirm | 猎人确认 |
| darkWolfKingConfirm | darkWolfKing | darkWolfKingConfirm | 黑狼王标记 |
