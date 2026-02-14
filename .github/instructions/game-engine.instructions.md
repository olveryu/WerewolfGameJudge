---
applyTo: packages/game-engine/**
---

# @werewolf/game-engine 包规范

## 概述

`@werewolf/game-engine` 是 pnpm workspace monorepo 下的纯游戏逻辑共享包，客户端和服务端同时 import。
包含：models / protocol / resolvers / engine，**零**平台依赖。

## 核心原则

- ✅ 纯逻辑、类型定义、声明式配置、纯函数。
- ✅ 使用 Web Crypto API（`crypto.getRandomValues`）生成随机数和 ID。
- ✅ 使用 `getEngineLogger()` 获取 logger（从 `./utils/logger.ts`）。
- ✅ 所有 import 使用**相对路径**（`../models/roles`、`../../utils/id`）。
- ❌ **禁止** `@/` path alias（game-engine `tsconfig.json` 里 `paths: {}` 为空）。
- ❌ **禁止** import React / React Native / Expo / 任何平台依赖。
- ❌ **禁止** import `src/` 目录下的任何文件（必须自包含）。
- ❌ **禁止** `console.*`（使用 `getEngineLogger()`）。
- ❌ **禁止** Node.js 专属 API（`fs`、`path`、`process` 等）在 src/ 中使用。

## Logger 抽象

game-engine 使用依赖注入模式获取 logger：

```typescript
// 定义：packages/game-engine/src/utils/logger.ts
export interface EngineLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  extend(name: string): EngineLogger;
}
export function setEngineLogger(logger: EngineLogger): void;
export function getEngineLogger(): EngineLogger;
```

- 客户端在 App 启动时调用 `setEngineLogger(log)`，注入 `react-native-logs` 实例。
- 服务端调用 `setEngineLogger(consoleLogger)`。
- game-engine 内部使用 `getEngineLogger()` 或 `getEngineLogger().extend('ModuleName')`。
- 未注入时使用 noop logger（不崩溃也不输出）。

## 目录结构

```
packages/game-engine/src/
├── index.ts              ← barrel export
├── models/               ← 角色 spec / schema / nightSteps（声明式）
│   ├── GameStatus.ts
│   ├── Template.ts
│   ├── actions/          ← RoleAction / WitchAction
│   └── roles/
│       └── spec/         ← types / schemas / specs / plan / nightSteps
├── protocol/             ← 协议类型（BroadcastGameState / ProtocolAction / reasonCodes）
├── resolvers/            ← Night resolver 纯函数（校验 + 计算）
├── engine/               ← Host-only 引擎
│   ├── DeathCalculator.ts
│   ├── resolveWolfVotes.ts
│   ├── handlers/         ← actionHandler / stepTransitionHandler / etc.
│   ├── intents/          ← intent 类型
│   ├── reducer/          ← gameReducer + types
│   ├── store/            ← GameStore + types
│   └── state/            ← normalizeState
├── types/                ← 共享类型（RoleRevealAnimation）
└── utils/                ← 平台无关工具（id / logger / random / shuffle）
```

## Proxy Re-export Stubs（代理重导出存根）

源文件从 `src/` 迁移到 `packages/game-engine/src/` 后，原路径保留**薄存根**：

```typescript
// src/models/GameStatus.ts（存根示例）
export * from '@werewolf/game-engine/models/GameStatus';
```

### 存根规则

- ✅ 存根文件只有一行 `export * from '@werewolf/game-engine/...'`。
- ✅ 消费者无需修改 import 路径（通过存根透明代理）。
- ❌ **禁止**在存根文件中添加任何逻辑代码。
- ❌ **禁止**在存根文件中添加额外的 export。
- ❌ **禁止**绕过存根直接从 `packages/game-engine/src/` 相对路径 import（使用 `@werewolf/game-engine/...`）。

### 存根位置

以下路径的文件是 proxy re-export stubs：

| 存根目录                                  | 源目录（game-engine）                                   |
| ----------------------------------------- | ------------------------------------------------------- |
| `src/models/`                             | `packages/game-engine/src/models/`                      |
| `src/services/protocol/`                  | `packages/game-engine/src/protocol/`                    |
| `src/services/night/resolvers/`           | `packages/game-engine/src/resolvers/`                   |
| `src/services/engine/` (除 `__tests__/`)  | `packages/game-engine/src/engine/`                      |
| `src/services/engine/resolveWolfVotes.ts` | `packages/game-engine/src/engine/resolveWolfVotes.ts`   |
| `src/types/RoleRevealAnimation.ts`        | `packages/game-engine/src/types/RoleRevealAnimation.ts` |

### 修改源代码的正确位置

- ✅ 修改游戏逻辑 → 编辑 `packages/game-engine/src/` 下的源文件。
- ❌ 不要编辑存根文件中的逻辑（存根只有一行 re-export）。

## 新增文件规则

### 新增游戏逻辑文件

1. 在 `packages/game-engine/src/` 对应目录创建源文件。
2. 所有 import 使用相对路径。
3. 如果需要被 `src/` 消费者使用，在对应的 `src/` 路径创建存根。
4. 根据需要更新 `packages/game-engine/src/index.ts` barrel export。

### 新增平台相关文件

平台相关文件（依赖 React Native / Expo / Supabase / 音频等）不属于 game-engine，直接放在 `src/` 对应目录。

## Jest 配置

- game-engine 模块通过 `jest.config.js` 的 `moduleNameMapper` 映射：
  - `^@werewolf/game-engine/(.*)$` → `<rootDir>/packages/game-engine/src/$1`
  - `^@werewolf/game-engine$` → `<rootDir>/packages/game-engine/src/index.ts`
- 测试中 `jest.mock()` 如果要 mock game-engine 内的模块，路径应使用 `@werewolf/game-engine/...` 而非相对路径。
- 静态分析测试（如 `import-boundary.test.ts`）读取源文件内容时，应从 `packages/game-engine/src/` 读取，而非从存根读取。
