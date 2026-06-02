---
name: 'TypeScript & Hooks'
description: 'Type safety, React Hooks hygiene, unused variable handling standards. Use when: TypeScript type safety, React hooks hygiene, unused variables, type assertions, generic inference, noUncheckedIndexedAccess'
applyTo: 'src/**/*.ts,src/**/*.tsx,packages/game-engine/src/**/*.ts'
---

# TypeScript & React Hooks Standards

## Type Safety

- Use type guards / `satisfies` / generic inference instead of `as` assertions (`as const` and test mocks excepted). api-worker handler body validation uses `jsonBody(schema)` middleware + `c.req.valid('json')`. `as` cast is forbidden.
- `unknown` + type narrowing instead of `any` (third-party lib type gaps require comment suppress). ESLint `@typescript-eslint/no-unsafe-*` six rules all set to `error`, auto-intercept `any` leakage.
- `noUncheckedIndexedAccess` is enabled. Array/dictionary index access returns `T | undefined`, must be handled:
  - Already have length / boundary guard proving safety: use `!` non-null assertion (`arr[i]!`).
  - Cannot prove safety: use narrowing guard or optional chaining to handle `undefined`.
  - Compound assignment (`+=`, `|=`) needs expansion: `data[x] = data[x]! + y`.
  - Adding `!` to expressions already non-`undefined` is forbidden (ESLint `no-unnecessary-type-assertion` will warn).
- Discriminated Union (`type` / `kind` tag field). Optional field stacking to distinguish variants is forbidden.
- Operation results uniformly use `ActionResult` (`@werewolf/game-engine/protocol/ActionResult`) DU: `{ success: true; reason?: string } | { success: false; reason: string }`. Loose `{ success: boolean; reason?: string }` is forbidden.
- Exhaustive `switch`: `default` uses `assertNever` or `const _: never`.
- `satisfies` used for "both type-check and preserve literal inference" (`ROLE_SPECS`, `SCHEMAS`, config objects etc.).
- Function parameter arrays/objects prefer `readonly`; exported constants prefer `as const`.
- Export types with `export type`; re-export with `export type { Foo } from './bar'`.

## Unused Variables / Imports

- Unused standalone variable assignments: **delete the entire line**. Adding `_` prefix to silence is forbidden.
- Unused imports: **remove from import statement directly**.
- `_` prefix only for scenarios where **syntactically required but logically unused** (destructure placeholder `const [_, b] = ...`, callback parameter `(_, index) => ...`).

## Async / Promise Safety

- ESLint `recommendedTypeChecked` enables `no-floating-promises` and `no-misused-promises`.
- Intentional fire-and-forget Promises use `void` prefix: `void someAsyncFn()`.
- JSX `onPress` / `onChange` event callbacks expect `() => void`; async handlers need void wrapper: `onPress={() => void handlePress()}`.
- `require-await` is disabled (already off; DO interfaces have many false positives).

## React Compiler Status

- `babel-plugin-react-compiler@^1.0.0` is installed but **not enabled in `babel.config.js`**. Currently still relies on manual `useMemo` / `useCallback`.
- `eslint-plugin-react-hooks@^7.0.1` adds three Compiler companion rules, all explicitly `off`:
  - `react-hooks/static-components` — Compiler handles automatically, not needed in manual mode.
  - `react-hooks/set-state-in-effect` — Useful but too many false positives, temporarily off.
  - `react-hooks/preserve-manual-memoization` — Meaningless when Compiler is not enabled.
- When enabling Compiler, reassess manual `useMemo` / `useCallback` rules and the three lint rules above.

## React Hooks Hygiene

- Custom hooks use `use` prefix, filename matches hook name (`useNightProgress.ts` → `useNightProgress()`).
- Conditional hook calls are forbidden (`if` / `for` / `switch` / after early `return`).
- Deps must honestly reflect values actually read by callback: missing ones must be added, **unread ones must be removed**. Unused dep parameters that have no other consumers should be removed from function signature entirely. Suppressing `react-hooks/exhaustive-deps` without reason is forbidden (suppress requires comment).
- Guards read from authoritative source (`facade.isHostPlayer()`), not from state dep. `useRef` mirroring state to bypass deps is forbidden (stale closure exception).
- `useEffect` with subscriptions / timers / listeners must return cleanup function (even if "won't unmount now").
- `useMemo` only for expensive computations (filter/sort/reduce, deep object construction). Wrapping primitives / simple object literals in useMemo is forbidden.
- `useCallback` for callbacks passed to memoized child components. Internal handlers not passed to children don't need it.
- Return values >2 use named objects (`function useXxx(): XxxResult`). Single responsibility, ~80 lines consider splitting.

## JSDoc Standards

- **Module header**: every `.ts` file top must have `/** ... */` module comment explaining responsibility, boundary constraints (no IO / no state writes etc.).
- **@throws**: public functions/routes that may throw or return error status codes must annotate `@throws`, listing HTTP status codes or exception types + trigger conditions.
- **@pre**: functions/methods with preconditions use `@pre` (e.g., `status === 'Ongoing'`, `isHost === true`). Pure reducers summarize in module comment.
- **@remarks**: core design decisions, concurrency strategies, algorithm characteristics (e.g., OCC retry, pity counter, single-flight lock) go in `@remarks` — avoid repeating comments in implementation.
- **Field comments**: fields with non-obvious semantics in interfaces/types get inline `/** ... */` comments (null meaning, special value -1 meaning, unit etc.).
- **Empty comments forbidden**: don't write comments like `// set variable` that repeat code semantics. Only comment at the "why" level.
- **Language**: comment body in English, tag keywords (@throws / @pre / @remarks / @param) in English.
