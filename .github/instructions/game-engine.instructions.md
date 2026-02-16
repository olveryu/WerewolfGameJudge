```instructions
---
applyTo: packages/game-engine/**
---

# @werewolf/game-engine 包规范

纯游戏逻辑共享包（pnpm workspace），客户端和服务端同时 import。零平台依赖。

## 核心规则

- 所有 import 用**相对路径**（`../models/roles`），禁止 `@/` alias（`tsconfig.json` 里 `paths: {}` 为空）。
- 禁止 React / React Native / Expo / 任何平台依赖。禁止 import `src/` 目录下任何文件。
- 禁止 Node.js 专属 API（`fs`/`path`/`process` 等）在 src/ 中使用。
- 禁止 `console.*`，使用 `getEngineLogger()`（DI 模式：`setEngineLogger()` 注入，未注入时 noop）。
- 随机数/ID 使用 Web Crypto API（`crypto.getRandomValues`）。

## Proxy Re-export Stubs

源文件迁移后，原路径保留薄存根（仅 `export * from '@werewolf/game-engine/...'`）：

| 存根目录 | 源目录 |
|----------|--------|
| `src/models/` | `packages/game-engine/src/models/` |
| `src/services/protocol/` | `packages/game-engine/src/protocol/` |
| `src/services/night/resolvers/` | `packages/game-engine/src/resolvers/` |
| `src/services/engine/`（除 `__tests__/`） | `packages/game-engine/src/engine/` |

- 修改游戏逻辑 → 编辑 `packages/game-engine/src/` 源文件，禁止在存根中加逻辑/额外 export。
- 消费者无需修改 import（存根透明代理），禁止绕过存根用相对路径 import game-engine。
- 新增文件：在 game-engine 创建源文件 + 对应 `src/` 存根 + 更新 `index.ts` barrel export。平台相关文件不属于 game-engine，直接放 `src/`。

## Jest 配置

`jest.config.js` 的 `moduleNameMapper` 映射 `@werewolf/game-engine/*`。测试中 `jest.mock()` 路径使用包路径（`@werewolf/game-engine/resolvers`），禁止相对路径 mock 存根。静态分析测试从 `packages/game-engine/src/` 读取源文件。

```
