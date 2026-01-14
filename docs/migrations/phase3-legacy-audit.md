# Phase 3 Legacy Audit - ✅ COMPLETED

## Summary

Phase 3 migration is complete. All legacy `ACTION_ORDER` / `getNightActionOrderForRoles` references have been removed, and UI is now schema-driven.

### Key Changes

1. **`useGameRoom.ts`**: Added `currentSchemaId` and `currentSchema` (derived locally from spec)
2. **`useRoomActions.ts`**: Refactored to use `schema.kind` instead of role names
3. **`roles/index.ts`**: Deleted `ACTION_ORDER` and `getNightActionOrderForRoles`
4. **Tests migrated**: `Room.test.ts`, `Template.test.ts`, `Template.contract.test.ts`
5. **Tests deleted**: Legacy compat suite in `roles.registry.contract.test.ts`

---

## 1. `ACTION_ORDER` / `getNightActionOrderForRoles` 剩余引用 - ✅ DONE

### 代码引用（已迁移/删除）

| 文件 | 原行号 | 类型 | 状态 |
|------|--------|------|------|
| `src/models/roles/index.ts` | 366 | 定义 | ✅ 删除 |
| `src/models/roles/index.ts` | 322 | 定义 | ✅ 删除 |
| `src/models/__tests__/roles.registry.contract.test.ts` | 2, 84-85, 91-111 | 测试 | ✅ 删除 ACTION_ORDER suite |
| `src/models/__tests__/roles.registry.contract.test.ts` | 12, 206-227 | 测试 | ✅ 删除 getNightActionOrderForRoles suite |
| `src/models/__tests__/roles.registry.contract.test.ts` | 256-310 | 测试 | ✅ 删除 NightPlan compat suite |
| `src/models/__tests__/Template.test.ts` | 8, 30-45 | 测试 | ✅ 迁移到 getActionOrderViaNightPlan |
| `src/models/__tests__/Template.contract.test.ts` | 15, 69-75 | 测试 | ✅ 迁移到 getActionOrderViaNightPlan |
| `src/models/__tests__/Room.test.ts` | 20, 27, 630, 673, 717 | 测试 | ✅ 迁移到 getActionOrderViaNightPlan |

---

## 2. UI schema-driven - ✅ DONE

### `src/hooks/useGameRoom.ts`

| 新增字段 | 说明 |
|----------|------|
| `currentSchemaId` | 从 `currentActionRole` 本地查 spec 得到 |
| `currentSchema` | 从 `currentSchemaId` 本地查 schema 得到 |

### `src/screens/RoomScreen/hooks/useRoomActions.ts`

| 原代码 | 新代码 | 状态 |
|--------|--------|------|
| `if (myRole === 'witch')` | `if (currentSchema?.kind === 'compound')` | ✅ |
| `if (myRole === 'hunter')` | `if (currentSchema?.kind === 'confirm')` | ✅ |
| `if (myRole === 'darkWolfKing')` | `if (currentSchema?.kind === 'confirm')` | ✅ |
| `if (myRole === 'magician' && ...)` | `if (currentSchema?.kind === 'swap' && ...)` | ✅ |
| `if (myRole === 'seer')` | `if (currentSchema?.kind === 'chooseSeat')` | ✅ |
| `if (myRole === 'psychic')` | `if (currentSchema?.kind === 'chooseSeat')` | ✅ |
| `if (currentActionRole === 'wolf' && ...)` | `if (currentSchema?.kind === 'wolfVote' && ...)` | ✅ |

---

## Verification

```bash
npm run typecheck  # ✅ Passed
npm test           # ✅ 711 tests passed
```
| 276 | `if (currentActionRole === 'wolf' && isWolfRole(myRole))` | wolf vote | 改为 `schema.kind === 'wolfVote'` |
| 304 | `if (currentActionRole === 'wolf' && isWolfRole(myRole))` | wolf vote 文案 | 同上 |

### `src/screens/RoomScreen/RoomScreen.helpers.ts`

| 行号 | 代码 | 说明 | 处理方式 |
|------|------|------|---------|
| 83 | `if (currentActionRole === 'nightmare' && myRole === 'nightmare')` | nightmare block | 可由 spec.night1.actsSolo 本地推导 |
| 93 | `if (currentActionRole === 'wolf' && myRole && isWolfRole(myRole))` | wolf vote visibility | 改为 `schema.kind === 'wolfVote'` |
| 111 | `if (myRole === 'wolf' && mySeatNumber !== null && wolfVotes.has(mySeatNumber))` | wolf vote status | 保留（这是状态判断，不是渲染分支）|

---

## 3. UI 依赖 actionOrder 的位置

| 文件 | 行号 | 说明 | 处理方式 |
|------|------|------|---------|
| `src/screens/RoomScreen/__tests__/RoomScreen.helpers.test.ts` | 178, 212 | 测试用的 mock template | 迁移到用 `getActionOrderViaNightPlan` |

---

## 总结：Phase 3 工作清单

### Step 3.2（UI schema-driven）

优先级排序：
1. **高收益、低风险**：`confirm` schema（hunter/darkWolfKing）
2. **高收益、中风险**：`wolfVote` schema
3. **中收益、中风险**：`chooseSeat` schema（seer/psychic/guard 等）
4. **高风险**：`compound` schema（witch 两阶段）
5. **中风险**：`swap` schema（magician）

### Step 3.4（删除 legacy）

删除顺序：
1. 删除 `roles.registry.contract.test.ts` 的 legacy suites（3 个 describe）
2. 迁移 `Template.test.ts` / `Template.contract.test.ts` / `Room.test.ts`
3. 删除 `ActionFlow.test.ts` 的 ACTION_ORDER 注释
4. 删除 `roles/index.ts` 的 `ACTION_ORDER` 和 `getNightActionOrderForRoles`

### 验证门禁

```bash
npm run typecheck
npm test
npx jest --runInBand src/screens/RoomScreen/hooks/__tests__/hooks.boundary.test.ts
npx jest --runInBand src/screens/RoomScreen/__tests__/RoomScreen.helpers.test.ts
```
