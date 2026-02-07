```instructions
---
applyTo: "src/**/*.ts,src/**/*.tsx"
---

# TypeScript 严格编码规范

> 项目已启用 `strict: true`，以下规则进一步收紧类型安全。

## 核心原则

- ✅ type guard / `satisfies` / 泛型推导替代类型断言。
- ✅ `as const` 字面量收窄。
- ✅ Discriminated Union（`type` / `kind` 标签字段做联合区分）。
- ✅ `readonly` 标注函数参数中的数组/对象类型。
- ✅ `unknown` + 类型收窄替代 `any`。
- ✅ exhaustive `switch`（`default` 用 `assertNever` / `const _: never`）。
- ❌ 禁止 `as` 强制类型断言（`as const` 和测试 mock 除外）。
- ❌ 禁止 `any`（第三方库类型缺失时的 suppress 需附注释）。
- ❌ 禁止用一堆 optional 字段 + runtime 判断区分变体。

## 禁止 `as` 强制类型断言（Hard rule）

- ❌ `const x = value as SomeType;`
- ✅ 优先使用 type guard / `satisfies` / 泛型推导。
- 唯一允许例外：`as const`（字面量收窄）、测试文件中构造 mock 数据。

## 禁止 `any`（Hard rule）

- ❌ `any` → ✅ `unknown` + 类型收窄（`typeof` / `instanceof` / discriminated union guard）。
- 允许例外：第三方库类型缺失时的 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`（必须附注释说明原因）。

## Exhaustive switch（Hard rule）

- `switch` 语句必须处理所有 case。
- `default` 分支使用 `assertNever` 或 `const _exhaustive: never = x;` 确保编译期完备。

```typescript
// ✅ 正确
switch (action.type) {
  case 'A': return handleA();
  case 'B': return handleB();
  default: {
    const _: never = action.type;
    throw new Error(`Unhandled action: ${action.type}`);
  }
}
```

## 优先使用 Discriminated Union

- 当一个类型有多种变体时，使用 `type` / `kind` 标签字段做联合区分。
- ❌ 禁止用一堆 optional 字段 + runtime 判断 `if (x.fieldA !== undefined)` 来区分变体。

```typescript
// ✅ 正确
type Result =
  | { type: 'success'; data: Player[] }
  | { type: 'error'; reason: string };

// ❌ 避免
type Result = { data?: Player[]; reason?: string };
```

## `satisfies` 优先

- 需要"既检查类型又保留字面量推导"时，用 `satisfies` 而非 `as`。
- 典型场景：`ROLE_SPECS`、`SCHEMAS`、config 对象。

## `readonly` 优先

- 函数参数中的数组/对象类型优先标 `readonly`。
- 导出的常量数组/对象优先使用 `as const` 或 `readonly`。

## 命名类型导出规则

- 导出类型时必须用 `export type`（而非 `export`），确保被 `isolatedModules` 正确擦除。
- 同理 re-export：`export type { Foo } from './bar';`。
```
