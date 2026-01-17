# Phase 2 Migration Audit

## 1. `template.actionOrder` 读写点

### 写入点

| 文件                        | 行号                        | 描述                                      |
| --------------------------- | --------------------------- | ----------------------------------------- |
| `src/models/Template.ts:42` | `getActionOrderForRoles()`  | 内部函数，从 `ACTION_ORDER.filter()` 派生 |
| `src/models/Template.ts:49` | `createCustomTemplate()`    | 调用 `getActionOrderForRoles(roles)`      |
| `src/models/Template.ts:56` | `createTemplateFromRoles()` | 调用 `getActionOrderForRoles(roles)`      |

### 读取点

| 文件                                    | 行号                                                       | 描述                     |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `src/services/GameStateService.ts:983`  | `new NightFlowController(this.state.template.actionOrder)` | NightFlowController 构造 |
| `src/services/GameStateService.ts:1239` | `getCurrentActionRole()`                                   | 获取当前行动角色         |
| `src/hooks/useGameRoom.ts:138`          | UI 读取用于显示                                            |
| `src/models/Room.ts:201,213`            | Room model 读取                                            |

---

## 2. `currentActionerIndex` 推进点

| 文件                                         | 行号                                      | 描述 |
| -------------------------------------------- | ----------------------------------------- | ---- |
| `src/services/GameStateService.ts:197`       | 初始化 `currentActionerIndex: 0`          |
| `src/services/GameStateService.ts:738`       | restart 时重置为 0                        |
| `src/services/GameStateService.ts:1001`      | startGame 时重置为 0                      |
| `src/services/GameStateService.ts:1016`      | 从 `nightFlow.currentActionIndex` 同步    |
| `src/services/GameStateService.ts:1059`      | 某处重置为 0                              |
| `src/services/GameStateService.ts:1153`      | 某处重置为 0                              |
| `src/services/GameStateService.ts:1329-1330` | `advanceToNextAction()` 从 nightFlow 同步 |

**关键**: `currentActionerIndex` 只由 `NightFlowController.currentActionIndex` 同步更新，不手动 `++`。

---

## 3. `ROLE_TURN` payload 依赖

### 类型定义

```typescript
// src/services/BroadcastService.ts:37
{ type: 'ROLE_TURN'; role: RoleName; pendingSeats: number[]; killedIndex?: number }
```

### 发送点

| 文件                                         | 行号                                  | 描述 |
| -------------------------------------------- | ------------------------------------- | ---- |
| `src/services/GameStateService.ts:1287-1291` | `playCurrentRoleAudio()` 内 broadcast |

### 消费点

| 文件                                                                 | 行号                         | 描述 |
| -------------------------------------------------------------------- | ---------------------------- | ---- |
| `src/services/GameStateService.ts:705`                               | `case 'ROLE_TURN':` 处理分支 |
| `src/services/__tests__/GameStateService.nightFlow.contract.test.ts` | 多处断言 `ROLE_TURN`         |
| `e2e/night1.basic.spec.ts:270-332`                                   | `ROLE_TURN_KEYWORDS` UI 断言 |

### 当前字段

- `role: RoleName` - 当前行动角色 ID
- `pendingSeats: number[]` - 该角色的座位号列表
- `killedIndex?: number` - 女巫救人时显示被杀者（仅 witch）

---

## 4. `ACTION_ORDER` / `getNightActionOrderForRoles` 依赖点

### `ACTION_ORDER` 定义

```typescript
// src/models/roles/index.ts:336
export const ACTION_ORDER: RoleName[] = getRolesByActionOrder().map((r) => r.id) as RoleName[];
```

### 使用点

| 文件                                                   | 描述                                   |
| ------------------------------------------------------ | -------------------------------------- |
| `src/models/Template.ts:1`                             | import 用于 `getActionOrderForRoles()` |
| `src/models/__tests__/roles.registry.contract.test.ts` | 多处断言 ACTION_ORDER                  |
| `src/models/__tests__/Template.contract.test.ts`       | 断言 actionOrder 顺序符合 ACTION_ORDER |
| `src/models/__tests__/ActionFlow.test.ts`              | 注释引用 ACTION_ORDER 索引             |
| `src/models/__tests__/Template.test.ts`                | 断言顺序                               |

### `getNightActionOrderForRoles` 定义

```typescript
// src/models/roles/index.ts:319-323
export function getNightActionOrderForRoles(roles: RoleName[]): RoleName[] {
  const roleSet = new Set(roles);
  return getRolesByActionOrder()
    .filter((role) => roleSet.has(role.id as RoleName))
    .map((role) => role.id as RoleName);
}
```

### 使用点

| 文件                                                           | 描述                   |
| -------------------------------------------------------------- | ---------------------- |
| `src/models/__tests__/roles.registry.contract.test.ts:205-226` | 专门的 describe 块测试 |

---

## 5. 依赖 actionOrder 的测试

### `src/models/__tests__/ActionFlow.test.ts`

- 断言 `template.actionOrder.toEqual([...])` 对具体角色组合

### `src/models/__tests__/Template.contract.test.ts`

- 断言 actionOrder 中所有角色都来自 roles
- 断言顺序符合 ACTION_ORDER

### `src/models/__tests__/Template.test.ts`

- 断言 `ACTION_ORDER` 顺序

### `src/services/__tests__/GameStateService.nightFlow.contract.test.ts`

- 断言 `ROLE_TURN` 广播顺序与 actionOrder 一致

---

## Phase 2 实施结论

### 最小爆炸半径策略

1. **不改 NightFlowController 构造签名** - 仍接收 `RoleName[]`
2. **只改 actionOrder 来源** - 在 `Template.ts` 的 `getActionOrderForRoles()` 切到 `getActionOrderViaNightPlan()`
3. **扩 ROLE_TURN** - 增加 `schemaId?: SchemaId`，从 `getRoleSpec(currentRole).night1.schemaId` 获取
4. **fail-safe** - 用 `isValidRoleId()` guard，非法时不发 schemaId

### 预期影响

- 外部行为无变化（actionOrder 顺序相同）
- `schemaId` 是新增 optional 字段，UI 可逐步消费
- 所有现有测试应通过
