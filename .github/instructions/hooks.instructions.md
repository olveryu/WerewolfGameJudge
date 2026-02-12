```instructions
---
applyTo: "src/hooks/**,src/screens/**/hooks/**"
---

# React Hooks 卫生规范

## 核心原则

- ✅ 自定义 hook 以 `use` 前缀命名，文件名与 hook 名一致。
- ✅ `useCallback` 用于传给 memo 化子组件的回调，保持引用稳定。
- ✅ `useMemo` 用于真正昂贵的计算（数组 filter/sort/reduce、对象深构建）。
- ✅ 返回值超 2 个用具名对象（`function useXxx(): XxxResult`）。
- ✅ `useEffect` 含订阅/timer/listener 必须返回 cleanup 函数。
- ❌ 禁止条件式调用 hook（`if` / `for` / `switch` / 早期 `return` 之后）。
- ❌ 禁止无理由 suppress `react-hooks/exhaustive-deps`（suppress 必须附注释）。
- ❌ 禁止对 primitive 值或简单对象字面量包 `useMemo`。
- ❌ 禁止在一个 hook 里同时管理多个不相关的 state + effect。
- ❌ 禁止 `console.*`（使用命名 logger）。

## 命名（Hard rule）

- 自定义 hook 必须以 `use` 前缀命名：`useXxx`。
- 文件名与 hook 名一致：`useNightProgress.ts` → `export function useNightProgress()`。

## 禁止条件式调用（Hard rule）

- Hook 不得出现在 `if` / `for` / `switch` / 早期 `return` 之后。
- 需要条件逻辑时，在 hook 内部处理（参数控制 + 内部 early return）。

## 依赖数组完整性（Hard rule）

- **deps 必须诚实反映回调实际读取的值。**
- 禁止无理由地 `// eslint-disable-next-line react-hooks/exhaustive-deps`。
- 如果确实需要 suppress，必须附注释说明"为什么这个依赖不需要加"。
- **Guard（`if (!x) return`）应从权威来源读取，而非 state dep。**
  - ❌ `useCallback(() => { if (!isHost) return; ... }, [isHost, facade])` — `isHost` 是派生 state，变化导致不必要的引用更新。
  - ✅ `useCallback(() => { if (!facade.isHostPlayer()) return; ... }, [facade])` — 从权威来源读取，deps 只含稳定引用。
- **禁止用 `useRef` 镜像 state 来绕过 deps。**
  - ❌ `const xRef = useRef(x); xRef.current = x;` + `useCallback(() => xRef.current, [])` — 欺骗 deps 的 workaround。
  - ✅ 应从权威来源（facade/service 方法）读取，或接受 state 作为诚实 dep。
  - 例外：async/setTimeout 闭包读最新值（stale closure 问题）时，ref 镜像是正确模式。
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
