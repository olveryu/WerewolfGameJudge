---
name: 'TypeScript & Hooks'
description: '类型安全、React Hooks 卫生、未使用变量处理规范'
applyTo: 'src/**/*.ts,src/**/*.tsx,packages/game-engine/src/**/*.ts'
---

# TypeScript & React Hooks 规范

## 类型安全

- 用 type guard / `satisfies` / 泛型推导替代 `as` 断言（`as const` 和测试 mock 除外）。api-worker handler body 校验用 `jsonBody(schema)` 中间件 + `c.req.valid('json')`，禁止 `as` cast。
- `unknown` + 类型收窄替代 `any`（第三方库类型缺失需附注释 suppress）。
- ESLint `@typescript-eslint/no-unsafe-*` 六条规则（`no-unsafe-argument`、`no-unsafe-assignment`、`no-unsafe-call`、`no-unsafe-member-access`、`no-unsafe-return`、`no-unsafe-enum-comparison`）均为 `error`，禁止 `any` 泄漏到类型安全代码中。
- `noUncheckedIndexedAccess` 已启用。数组/字典索引访问返回 `T | undefined`，必须处理：
  - 已有 length / boundary 守卫证明安全：用 `!` non-null assertion（`arr[i]!`）。
  - 无法证明安全：用 narrowing guard 或 optional chaining 处理 `undefined`。
  - 复合赋值（`+=`、`|=`）需展开：`data[x] = data[x]! + y`。
  - 禁止对已经是非 `undefined` 类型的表达式加 `!`（ESLint `no-unnecessary-type-assertion` 会报警告）。
- Discriminated Union（`type` / `kind` 标签字段），禁止 optional 字段堆叠区分变体。
- Exhaustive `switch`：`default` 用 `assertNever` 或 `const _: never`。
- `satisfies` 用于"既检查类型又保留字面量推导"（`ROLE_SPECS`、`SCHEMAS`、config 对象等）。
- 函数参数数组/对象优先 `readonly`，导出常量优先 `as const`。
- 导出类型用 `export type`，re-export 用 `export type { Foo } from './bar'`。

## 未使用变量 / 导入

- 未使用的独立变量赋值：**直接删除整行**，禁止加 `_` 前缀消音。
- 未使用的导入：**直接从 import 语句中移除**。
- `_` 前缀仅限**语法上必须声明但逻辑上不使用**的场景（解构占位 `const [_, b] = ...`、回调参数 `(_, index) => ...`）。

## Async / Promise 安全

- ESLint `recommendedTypeChecked` 启用 `no-floating-promises` 和 `no-misused-promises`。
- 故意 fire-and-forget 的 Promise 用 `void` 前缀标记：`void someAsyncFn()`。
- JSX `onPress` / `onChange` 等事件回调期望 `() => void`，async handler 需包 void wrapper：`onPress={() => void handlePress()}`。
- 禁止 `require-await`（已 off；DO 接口等大量 false positive）。

## React Compiler 状态

- `babel-plugin-react-compiler@^1.0.0` 已安装但 **未在 `babel.config.js` 启用**。当前仍依赖手动 `useMemo` / `useCallback`。
- `eslint-plugin-react-hooks@^7.0.1` 新增三个 Compiler 配套规则，均已显式 `off`：
  - `react-hooks/static-components` — Compiler 自动处理，手动模式不需要。
  - `react-hooks/set-state-in-effect` — 有效但误报多，暂关。
  - `react-hooks/preserve-manual-memoization` — Compiler 未启用时无意义。
- 启用 Compiler 后需重新评估 `useMemo` / `useCallback` 手动规则和上述三个 lint 规则。

## React Hooks 卫生

- 自定义 hook 以 `use` 前缀命名，文件名与 hook 名一致（`useNightProgress.ts` → `useNightProgress()`）。
- 禁止条件式调用 hook（`if` / `for` / `switch` / 早期 `return` 之后）。
- deps 必须诚实反映回调实际读取的值：缺少的要补，**不读取的要移除**。未使用的 dep 参数如果也无其他消费者，应从函数签名一并删除。禁止无理由 suppress `react-hooks/exhaustive-deps`（suppress 需附注释）。
- Guard 从权威来源读取（`facade.isHostPlayer()`），不从 state dep 读。禁止 `useRef` 镜像 state 绕过 deps（stale closure 例外）。
- `useEffect` 含订阅 / timer / listener 必须返回 cleanup 函数（即使"现在不会 unmount"）。
- `useMemo` 仅用于昂贵计算（filter/sort/reduce、对象深构建），禁止对 primitive / 简单对象字面量包 useMemo。
- `useCallback` 用于传给 memo 化子组件的回调。不传给子组件的内部 handler 不需要。
- 返回值 >2 个用具名对象（`function useXxx(): XxxResult`）。单一职责，~80 行考虑拆分。
