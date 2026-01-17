# Phase 5 清理方案 - 全面扫描报告与执行计划

> 基于 2025 年 1 月全面扫描 `src/**` 的结果
>
> **目标**：删除所有 legacy / deprecated / fallback 代码，实现 fail-fast 架构
>
> **状态**：✅ **已完成** - 2025-01-17

---

## ✅ 执行结果

| #   | 任务                                               | 状态    | 改动                                     |
| --- | -------------------------------------------------- | ------- | ---------------------------------------- |
| 1   | RoomScreen.tsx UI prompt fail-fast                 | ✅ 完成 | 删除 fallback `\|\|`，改用 throw Error   |
| 2   | constraintValidator.ts fail-fast                   | ✅ 完成 | Unknown constraint throw Error           |
| 3   | 删除 getActionOrderFromPlan                        | ✅ 完成 | 无调用者，已删除                         |
| 4   | 删除 Room.ts getHunterStatus/getDarkWolfKingStatus | ✅ 完成 | 无调用者，已删除                         |
| 5   | 清理 backward compatibility 注释                   | ✅ 完成 | plan.ts, GameStateService.ts, testids.ts |

### 验证

- ✅ TypeScript 编译通过
- ✅ Jest 1061 tests 全绿
- 分支：`phase5-one-shot`

---

## 📊 扫描结果摘要

### ✅ 已完成清理（可忽略）

| 项目                       | 状态      | 说明                                                |
| -------------------------- | --------- | --------------------------------------------------- |
| `Template.actionOrder`     | ✅ 已删除 | Phase 5 已完成，`GameTemplate` 不再有 `actionOrder` |
| `RoleName` type alias      | ✅ 已删除 | 已统一使用 `RoleId`                                 |
| `ROLES` record             | ✅ 已删除 | 不再存在 `getRoleDisplayInfo()` 或 `ROLES`          |
| `gameStatusToRoomStatus()` | ✅ 已删除 | 已删除 numeric RoomStatus 映射                      |
| `@deprecated` 标注         | ✅ 无残留 | `src/**` 内无 `@deprecated` 标注                    |
| `TODO(remove by ...)`      | ✅ 无残留 | `src/**` 内无遗留的待删除标注                       |

### ⚠️ 仍存在的问题（需处理）

---

## 🔴 问题 1：UI Fallback 残留

**位置**：`src/screens/RoomScreen/RoomScreen.tsx`

**问题**：

```tsx
// Line 582
currentSchema?.ui?.prompt || '请选择目标';

// Line 790-791
const baseMessage = currentSchema?.ui?.prompt || '请选择目标';
```

**你的要求**：fail-fast，不要 fallback

**方案 A（推荐）**：如果 `currentSchema?.ui?.prompt` 为空，抛出 Error 或显示 Error UI

```tsx
if (!currentSchema?.ui?.prompt) {
  throw new Error(`Missing schema.ui.prompt for current action`);
}
const baseMessage = currentSchema.ui.prompt;
```

**方案 B**：静默显示 "schema 未配置" 而非空白

```tsx
const baseMessage = currentSchema?.ui?.prompt ?? '[ERROR: schema.ui.prompt missing]';
```

**影响文件**：

- `src/screens/RoomScreen/RoomScreen.tsx` (2 处)
- 可能需要更新 contract test `schemas.ui.coverage.test.ts`（已存在，验证 schema 完整性）

---

## 🔴 问题 2：constraintValidator fail-open 策略

**位置**：`src/services/night/resolvers/constraintValidator.ts:47`

**问题**：

```typescript
default:
  // Unknown constraint - treat as valid (fail-open for forward compat)
  log.extend('Constraint').warn(`Unknown constraint: ${constraint}`);
```

**你的要求**：fail-fast

**方案**：Unknown constraint 应该抛出 Error

```typescript
default:
  throw new Error(`Unknown constraint: ${constraint}. Add handler or remove from schema.`);
```

**影响**：如果 schema 包含未实现的 constraint，会 crash（这正是 fail-fast 的目的）

---

## 🟡 问题 3：HomeScreen displayName fallback

**位置**：`src/screens/HomeScreen/HomeScreen.tsx:302-305`

**问题**：

```tsx
// Fallback for logged-in users without displayName: use email prefix
if (user.email) {
  return user.email.split('@')[0];
}
return '用户';
```

**评估**：这是 **合理的业务逻辑 fallback**，不是 legacy compat

**方案**：**保留** - 这是 UI 友好的默认值，不是为了兼容旧代码

---

## 🟡 问题 4：AudioService timeout fallback

**位置**：`src/services/AudioService.ts:132-135`

**问题**：

```typescript
// Timeout fallback - resolve after max time even if audio didn't finish
setTimeout(() => {
  // Keep the fallback, but avoid noisy test output.
  ...
```

**评估**：这是 **必要的 robustness 机制**，不是 legacy compat

**方案**：**保留** - 音频可能因为各种原因无法完成（autoplay blocked, file missing），timeout 是合理的安全阀

---

## 🟡 问题 5：alert.ts web fallback

**位置**：`src/utils/alert.ts:40`

**问题**：

```typescript
// Fallback to native alert
```

**评估**：这是 **web 平台适配**，不是 legacy compat

**方案**：**保留** - React Native Web 需要这个

---

## 🟡 问题 6：backward compatibility 注释/导出

### 6.1 GameStateService re-export

**位置**：`src/services/GameStateService.ts:48`

```typescript
// Re-export types for backward compatibility
```

**评估**：如果没有外部消费者，可以删除

**方案**：检查是否有代码 import from GameStateService 而非 types/index

### 6.2 Room.ts wrapper

**位置**：`src/models/Room.ts:340`

```typescript
// Convenience wrappers for backward compatibility
```

**方案**：检查这些 wrapper 是否还有调用者，如无则删除

### 6.3 plan.ts getActionOrderFromPlan

**位置**：`src/models/roles/spec/plan.ts:85`

```typescript
/**
 * Get action order from night plan (for backward compatibility)
 */
export function getActionOrderFromPlan(plan: NightPlan): RoleId[] {
  return plan.steps.map((step) => step.roleId);
}
```

**方案**：检查调用者，如只在 test 中使用则保留（test helper），否则可删除

### 6.4 NightPlanStep.order

**位置**：`src/models/roles/spec/plan.ts:9`

```typescript
 * - `NightPlanStep.order` is derived from the table index (consumer-facing field kept for backward compatibility).
```

**方案**：检查是否有消费者使用 `step.order`，如无则从 type 中删除

---

## 🟡 问题 7：testids.ts legacy compatibility

**位置**：`src/__tests__/testids.contract.test.ts:3-4`

```typescript
describe('testids.ts contract (stability + legacy compatibility)', () => {
  it('keeps legacy seatTile testID unchanged', () => {
```

**评估**：这是 **E2E 稳定性保证**，不是 legacy compat in code

**方案**：**保留** - 确保 E2E 选择器不会意外 break

---

## 🟡 问题 8：Test 中的 actionOrder 变量名

**位置**：`src/services/__tests__/GameStateService.nightFlow.contract.test.ts`

**问题**：测试代码中使用 `actionOrder` 作为变量名

```typescript
const actionOrder: RoleId[] = ['seer', 'witch'];
```

**评估**：这只是测试里的本地变量名，不是 legacy 结构

**方案**：**可选重命名** 为 `roles` 或 `testRoles`，但不是关键问题

---

## ⚪ 问题 9：`??` nullish coalescing 用法

**位置**：多处

**问题**：有大量 `??` 用法

**评估**：这是 **正常的 TypeScript 编程**，不是 fallback

**方案**：**不需要清理** - `??` 用于处理 null/undefined 是合理的

---

## 🎯 执行计划（推荐）

### 必须做（符合 fail-fast 要求）

| #   | 任务                          | 文件                     | 预估改动 |
| --- | ----------------------------- | ------------------------ | -------- |
| 1   | UI prompt fail-fast           | `RoomScreen.tsx`         | ~10 行   |
| 2   | constraintValidator fail-fast | `constraintValidator.ts` | ~3 行    |

### 可选做（清理注释/死代码）

| #   | 任务                              | 文件               | 预估改动 |
| --- | --------------------------------- | ------------------ | -------- |
| 3   | 检查并删除 getActionOrderFromPlan | `plan.ts` + 调用者 | ~5 行    |
| 4   | 检查并删除 Room.ts wrapper        | `Room.ts`          | ~10 行   |
| 5   | 删除 backward compatibility 注释  | 多处               | 注释清理 |

### 不需要做

| #                               | 理由              |
| ------------------------------- | ----------------- |
| HomeScreen displayName fallback | 合理的 UI 默认值  |
| AudioService timeout            | 必要的 robustness |
| alert.ts web fallback           | 平台适配          |
| testids contract test           | E2E 稳定性保证    |
| `??` nullish coalescing         | 正常 TypeScript   |

---

## 🚦 下一步

1. **确认方案**：你要我执行哪些任务？
   - [ ] 只做必须做的 1-2
   - [ ] 做必须做 + 可选做全部
   - [ ] 自定义选择

2. **执行方式**：
   - 在当前分支 `phase5-one-shot` 继续
   - 每个任务单独 commit
   - 全部完成后跑 TypeCheck + Jest + E2E

---

## 附录：扫描命令

```bash
# 已执行的扫描
grep -rn "legacy|Legacy|LEGACY" src/
grep -rn "fallback|Fallback|FALLBACK" src/
grep -rn "backward|compat|Compat|COMPAT" src/
grep -rn "@deprecated|deprecated|DEPRECATED" src/
grep -rn "TODO|FIXME|HACK|XXX" src/
```
