```instructions
---
applyTo: "src/hooks/**,src/screens/**/hooks/**"
---

# React Hooks 卫生规范

## 命名（Hard rule）

- 自定义 hook 必须以 `use` 前缀命名：`useXxx`。
- 文件名与 hook 名一致：`useNightProgress.ts` → `export function useNightProgress()`。

## 禁止条件式调用（Hard rule）

- Hook 不得出现在 `if` / `for` / `switch` / 早期 `return` 之后。
- 需要条件逻辑时，在 hook 内部处理（参数控制 + 内部 early return）。

## 依赖数组完整性（Hard rule）

- 禁止无理由地 `// eslint-disable-next-line react-hooks/exhaustive-deps`。
- 如果确实需要 suppress，必须附注释说明"为什么这个依赖不需要加"。
- 常见正确做法：
  - 稳定引用（`useRef`）不需要加入 dep array → 不用 suppress，ESLint 本身不会报。
  - dispatch / navigation 等 React 保证稳定的引用 → 同上。

## `useEffect` 必须 cleanup

- 若 `useEffect` 内含订阅 / timer / event listener / channel subscription，必须返回 cleanup 函数。
- 即使"现在不会 unmount"，也必须写 cleanup（防未来重构泄漏）。

```typescript
// ✅ 正确
useEffect(() => {
  const sub = channel.subscribe(handler);
  return () => sub.unsubscribe();
}, [channel]);

// ❌ 泄漏
useEffect(() => {
  channel.subscribe(handler);
}, [channel]);
```

## `useMemo` / `useCallback` 使用口径

- `useMemo`：仅用于**真正昂贵的计算**（数组 filter/sort/reduce、对象深构建）。
  - ❌ 禁止对 primitive 值或简单对象字面量包 `useMemo`。
- `useCallback`：用于**传给 memo 化子组件的回调**，保持引用稳定。
  - 不传给子组件的内部 handler 不需要 `useCallback`（除非有其他 dep 依赖它）。

## 返回值类型

- 自定义 hook 的返回值优先用**具名对象**（而非元组），超过 2 个返回值时必须用对象。
- 返回值类型建议显式标注（`function useXxx(): XxxResult`），方便消费方推导。

## 单一职责

- 一个 hook 只做一件事。如果 hook 超过 ~80 行，考虑拆分成更小的 hook。
- 禁止在一个 hook 里同时管理多个不相关的 state + effect。
```
