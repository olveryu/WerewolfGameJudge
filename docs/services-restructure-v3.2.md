# services 目录重构设计 v3.2

> **版本**：v3.2 (2026-01-24)  
> **范围**：`src/services/` 扁平化 + v2 前缀清理  
> **原则**：只做设计方案，不改代码

---

## 真实文件/目录清单（单一真相）

以下清单来自 `find src/services -type f -name "*.ts" | sort` 和 `find src/services -type d | sort`。  
**本文档所有映射只能引用此清单中的条目，禁止臆造。**

### 目录清单（24 个）

```
src/services
src/services/__tests__
src/services/core
src/services/core/state
src/services/core/state/__tests__
src/services/night
src/services/night/resolvers
src/services/night/resolvers/__tests__
src/services/protocol
src/services/types
src/services/v2
src/services/v2/__tests__
src/services/v2/__tests__/boards
src/services/v2/facade
src/services/v2/facade/__tests__
src/services/v2/handlers
src/services/v2/handlers/__tests__
src/services/v2/intents
src/services/v2/protocol
src/services/v2/reducer
src/services/v2/reducer/__tests__
src/services/v2/store
src/services/v2/store/__tests__
src/services/v2/transport
src/services/v2/transport/__tests__
```

### 文件清单（87 个 .ts 文件）

```
src/services/AudioService.ts
src/services/AuthService.ts
src/services/AvatarUploadService.ts
src/services/BroadcastService.ts
src/services/DeathCalculator.ts
src/services/NightFlowController.ts
src/services/SimplifiedRoomService.ts
src/services/__tests__/AudioService.test.ts
src/services/__tests__/AuthService.test.ts
src/services/__tests__/AvatarUploadService.test.ts
src/services/__tests__/DeathCalculator.test.ts
src/services/core/index.ts
src/services/core/state/__tests__/normalize.contract.test.ts
src/services/core/state/normalize.ts
src/services/index.ts
src/services/night/resolvers/__tests__/constraints.contract.test.ts
src/services/night/resolvers/__tests__/darkWolfKing.resolver.test.ts
src/services/night/resolvers/__tests__/dreamcatcher.resolver.test.ts
src/services/night/resolvers/__tests__/gargoyle.resolver.test.ts
src/services/night/resolvers/__tests__/guard.resolver.test.ts
src/services/night/resolvers/__tests__/hunter.resolver.test.ts
src/services/night/resolvers/__tests__/magician.resolver.test.ts
src/services/night/resolvers/__tests__/night1FullAlignment.contract.test.ts
src/services/night/resolvers/__tests__/night1Only.contract.test.ts
src/services/night/resolvers/__tests__/nightmare.resolver.test.ts
src/services/night/resolvers/__tests__/psychic.resolver.test.ts
src/services/night/resolvers/__tests__/schemaResolverAlignment.contract.test.ts
src/services/night/resolvers/__tests__/seer.resolver.test.ts
src/services/night/resolvers/__tests__/slacker.resolver.test.ts
src/services/night/resolvers/__tests__/swap.integration.test.ts
src/services/night/resolvers/__tests__/witch.resolver.test.ts
src/services/night/resolvers/__tests__/wolf.resolver.test.ts
src/services/night/resolvers/constraintValidator.ts
src/services/night/resolvers/darkWolfKing.ts
src/services/night/resolvers/dreamcatcher.ts
src/services/night/resolvers/gargoyle.ts
src/services/night/resolvers/guard.ts
src/services/night/resolvers/hunter.ts
src/services/night/resolvers/index.ts
src/services/night/resolvers/magician.ts
src/services/night/resolvers/nightmare.ts
src/services/night/resolvers/psychic.ts
src/services/night/resolvers/seer.ts
src/services/night/resolvers/slacker.ts
src/services/night/resolvers/types.ts
src/services/night/resolvers/witch.ts
src/services/night/resolvers/wolf.ts
src/services/night/resolvers/wolfQueen.ts
src/services/night/resolvers/wolfRobot.ts
src/services/protocol/types.ts
src/services/resolveWolfVotes.ts
src/services/types/GameStateTypes.ts
src/services/types/IGameFacade.ts
src/services/types/PublicBroadcast.ts
src/services/types/index.ts
src/services/v2/__tests__/actionHandler.test.ts
src/services/v2/__tests__/boards/DarkWolfKingMagician12.v2.integration.test.ts
src/services/v2/__tests__/boards/boundary.guard.test.ts
src/services/v2/__tests__/boards/hostGameFactory.v2.ts
src/services/v2/__tests__/boards/magicianSwap.seerReveal.v2.integration.test.ts
src/services/v2/__tests__/boards/seer.v2.integration.test.ts
src/services/v2/__tests__/boards/wireProtocol.contract.test.ts
src/services/v2/__tests__/boards/wolfVote.v2.integration.test.ts
src/services/v2/__tests__/factory.test.ts
src/services/v2/__tests__/hardGates.test.ts
src/services/v2/__tests__/legacyRuntimeGate.contract.test.ts
src/services/v2/__tests__/night1RoleCoverage.contract.test.ts
src/services/v2/facade/V2GameFacade.ts
src/services/v2/facade/__tests__/V2GameFacade.test.ts
src/services/v2/facade/__tests__/playerMessageRouterCoverage.contract.test.ts
src/services/v2/facade/__tests__/restartGame.contract.test.ts
src/services/v2/facade/hostActions.ts
src/services/v2/facade/index.ts
src/services/v2/facade/messageRouter.ts
src/services/v2/facade/seatActions.ts
src/services/v2/factory.ts
src/services/v2/handlers/__tests__/actionHandler.test.ts
src/services/v2/handlers/__tests__/chooseSeat.batch.contract.test.ts
src/services/v2/handlers/__tests__/gameControlHandler.test.ts
src/services/v2/handlers/__tests__/nightFlowHandler.test.ts
src/services/v2/handlers/__tests__/seatHandler.test.ts
src/services/v2/handlers/__tests__/witchContract.test.ts
src/services/v2/handlers/actionHandler.ts
src/services/v2/handlers/gameControlHandler.ts
src/services/v2/handlers/index.ts
src/services/v2/handlers/nightFlowHandler.ts
src/services/v2/handlers/seatHandler.ts
src/services/v2/handlers/types.ts
src/services/v2/index.ts
src/services/v2/intents/index.ts
src/services/v2/intents/types.ts
src/services/v2/protocol/reasonCodes.ts
src/services/v2/reducer/__tests__/gameReducer.test.ts
src/services/v2/reducer/gameReducer.ts
src/services/v2/reducer/index.ts
src/services/v2/reducer/types.ts
src/services/v2/store/GameStore.ts
src/services/v2/store/__tests__/GameStore.test.ts
src/services/v2/store/index.ts
src/services/v2/store/types.ts
src/services/v2/transport/TransportAdapter.ts
src/services/v2/transport/__tests__/TransportAdapter.test.ts
src/services/v2/transport/index.ts
```

---

## 0) Pre-flight 护栏

在任何文件操作之前，必须满足以下门禁：

| Gate | 命令 | 预期结果 |
|------|------|----------|
| Tests green | `npm run test -- --passWithNoTests` | ≥95 suites, 0 fail |
| Lint clean | `npm run lint` | 0 errors |
| TypeCheck | `npx tsc --noEmit` | 0 errors |
| Git clean | `git status --porcelain` | 空 (所有改动已 commit) |

**Line Count 红线**：任何单文件超过 ~400 行（不含空白/注释）必须拆分，禁止 God Class。

---

## A) 目标目录结构（Tree）

采用 **四层架构**：`infra/` + `transport/` + `engine/` + `facade/`

```
src/services/
├── protocol/                      # 保持原位
│   ├── types.ts
│   └── reasonCodes.ts             # ← 来自 v2/protocol/
├── types/                         # 保持原位
│   ├── GameStateTypes.ts
│   ├── IGameFacade.ts
│   ├── PublicBroadcast.ts
│   └── index.ts
├── infra/                         # 基础设施（无游戏逻辑）
│   ├── AudioService.ts
│   ├── AuthService.ts
│   ├── AvatarUploadService.ts
│   ├── RoomService.ts             # ← SimplifiedRoomService.ts 重命名
│   └── index.ts                   # 新增
├── transport/                     # 传输层（广播 + 适配器）
│   ├── BroadcastService.ts
│   ├── TransportAdapter.ts
│   ├── index.ts                   # 新增
│   └── __tests__/
│       └── TransportAdapter.test.ts
├── engine/                        # 游戏逻辑核心（纯函数/无 IO）
│   ├── DeathCalculator.ts
│   ├── NightFlowController.ts
│   ├── resolveWolfVotes.ts
│   ├── core/                      # 整体移入
│   │   ├── index.ts
│   │   └── state/
│   │       ├── normalize.ts
│   │       └── __tests__/
│   │           └── normalize.contract.test.ts
│   ├── night/                     # 整体移入
│   │   └── resolvers/
│   │       ├── *.ts (15 个 resolver)
│   │       ├── constraintValidator.ts
│   │       ├── types.ts
│   │       ├── index.ts
│   │       └── __tests__/ (17 个测试)
│   ├── store/                     # 来自 v2/store
│   │   ├── GameStore.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── GameStore.test.ts
│   ├── reducer/                   # 来自 v2/reducer
│   │   ├── gameReducer.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── gameReducer.test.ts
│   ├── handlers/                  # 来自 v2/handlers
│   │   ├── actionHandler.ts
│   │   ├── gameControlHandler.ts
│   │   ├── nightFlowHandler.ts    # ⚠️ 技术债：812 行，见 D.4
│   │   ├── seatHandler.ts
│   │   ├── types.ts
│   │   ├── index.ts
│   │   └── __tests__/
│   │       └── *.test.ts (6 个)
│   ├── intents/                   # 来自 v2/intents
│   │   ├── types.ts
│   │   └── index.ts
│   └── index.ts                   # 新增
├── facade/                        # Facade 层（编排入口）
│   ├── GameFacade.ts              # ← V2GameFacade.ts 重命名
│   ├── hostActions.ts
│   ├── messageRouter.ts
│   ├── seatActions.ts
│   ├── index.ts                   # 新增（替换原 v2/facade/index.ts）
│   └── __tests__/
│       ├── GameFacade.test.ts     # ← V2GameFacade.test.ts 重命名
│       ├── playerMessageRouterCoverage.contract.test.ts
│       └── restartGame.contract.test.ts
├── __tests__/                     # 合并后的测试
│   ├── AudioService.test.ts
│   ├── AuthService.test.ts
│   ├── AvatarUploadService.test.ts
│   ├── DeathCalculator.test.ts
│   ├── actionHandler.integration.test.ts  # ← v2/__tests__/actionHandler.test.ts 重命名
│   ├── hardGates.test.ts
│   ├── legacyRuntimeGate.contract.test.ts
│   ├── night1RoleCoverage.contract.test.ts
│   └── boards/
│       ├── DarkWolfKingMagician12.v2.integration.test.ts
│       ├── boundary.guard.test.ts
│       ├── hostGameFactory.v2.ts
│       ├── magicianSwap.seerReveal.v2.integration.test.ts
│       ├── seer.v2.integration.test.ts
│       ├── wireProtocol.contract.test.ts
│       └── wolfVote.v2.integration.test.ts
└── index.ts                       # 重写：统一导出
```

### 分层边界规则

| 层 | 允许依赖 | 禁止依赖 | 职责 |
|----|----------|----------|------|
| `protocol/` | 无 | 任何其他层 | wire 协议类型定义 |
| `types/` | `protocol/` | 任何其他层 | 游戏状态类型定义 |
| `infra/` | `types/`, 第三方库 | `transport/`, `engine/`, `facade/` | 基础设施（Auth/Audio/Avatar/Room） |
| `transport/` | `types/`, `protocol/`, `infra/` | `engine/`, `facade/` | 广播 + 传输适配 |
| `engine/` | `types/`, `protocol/` | `transport/`, `facade/`, `infra/`(除 Audio) | 游戏逻辑核心（纯函数） |
| `facade/` | 可依赖所有层 | — | 编排入口 |

> **v3.2 修正**：`engine/` 禁止依赖 `transport/`，确保 resolver/handler 保持纯函数。

---

## B) 分阶段执行（Phases）

| Phase | 描述 | 范围 | 验证 |
|-------|------|------|------|
| 1 | 创建骨架目录 + 新 index.ts | 创建 `infra/`, `transport/`, 新 index.ts 占位 | tsc + lint |
| 2 | infra/ 迁移 | Audio/Auth/Avatar/Room → `infra/` | 全套门禁 |
| 3 | transport/ 迁移 | Broadcast + TransportAdapter → `transport/`；**删除** `v2/transport/index.ts` | 全套门禁 |
| 4a | engine/ 迁移 - root files | Death/NightFlow/resolveWolfVotes → `engine/` | 全套门禁 |
| 4b | engine/ 迁移 - core/night | core/ + night/ 整体移入 `engine/` | 全套门禁 |
| 4c | engine/ 迁移 - v2 子目录 | v2/{store,reducer,handlers,intents} → `engine/` | 全套门禁 |
| 5 | facade/ 迁移 | v2/facade → `facade/` | 全套门禁 |
| 6 | tests 迁移 | v2/__tests__ → `__tests__/`（含重命名） | 全套门禁 |
| 7 | v2/protocol 合并 | v2/protocol/reasonCodes.ts → `protocol/` | 全套门禁 |
| 8 | 删除 v2/ + factory.ts | 删除整个 v2 目录 | 全套门禁 + v2 残留检查 |
| 9 | 更新根 index.ts | 重写导出 | 全套门禁 |

---

## C) 文件映射表（100% 覆盖）

所有路径相对于 `src/services/`。

### C.1 Root 文件 → 目标

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 1 | `AudioService.ts` | `infra/AudioService.ts` | 移动 | 2 |
| 2 | `AuthService.ts` | `infra/AuthService.ts` | 移动 | 2 |
| 3 | `AvatarUploadService.ts` | `infra/AvatarUploadService.ts` | 移动 | 2 |
| 4 | `SimplifiedRoomService.ts` | `infra/RoomService.ts` | 移动+重命名 | 2 |
| 5 | `BroadcastService.ts` | `transport/BroadcastService.ts` | 移动 | 3 |
| 6 | `DeathCalculator.ts` | `engine/DeathCalculator.ts` | 移动 | 4a |
| 7 | `NightFlowController.ts` | `engine/NightFlowController.ts` | 移动 | 4a |
| 8 | `resolveWolfVotes.ts` | `engine/resolveWolfVotes.ts` | 移动 | 4a |
| 9 | `index.ts` | `index.ts` | 重写 | 9 |

### C.2 Root __tests__/ → 目标

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 10 | `__tests__/AudioService.test.ts` | `__tests__/AudioService.test.ts` | 保持 | — |
| 11 | `__tests__/AuthService.test.ts` | `__tests__/AuthService.test.ts` | 保持 | — |
| 12 | `__tests__/AvatarUploadService.test.ts` | `__tests__/AvatarUploadService.test.ts` | 保持 | — |
| 13 | `__tests__/DeathCalculator.test.ts` | `__tests__/DeathCalculator.test.ts` | 保持 | — |

### C.3 core/ → engine/core/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 14 | `core/index.ts` | `engine/core/index.ts` | 移动 | 4b |
| 15 | `core/state/normalize.ts` | `engine/core/state/normalize.ts` | 移动 | 4b |
| 16 | `core/state/__tests__/normalize.contract.test.ts` | `engine/core/state/__tests__/normalize.contract.test.ts` | 移动 | 4b |

### C.4 night/ → engine/night/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 17 | `night/resolvers/constraintValidator.ts` | `engine/night/resolvers/constraintValidator.ts` | 移动 | 4b |
| 18 | `night/resolvers/darkWolfKing.ts` | `engine/night/resolvers/darkWolfKing.ts` | 移动 | 4b |
| 19 | `night/resolvers/dreamcatcher.ts` | `engine/night/resolvers/dreamcatcher.ts` | 移动 | 4b |
| 20 | `night/resolvers/gargoyle.ts` | `engine/night/resolvers/gargoyle.ts` | 移动 | 4b |
| 21 | `night/resolvers/guard.ts` | `engine/night/resolvers/guard.ts` | 移动 | 4b |
| 22 | `night/resolvers/hunter.ts` | `engine/night/resolvers/hunter.ts` | 移动 | 4b |
| 23 | `night/resolvers/index.ts` | `engine/night/resolvers/index.ts` | 移动 | 4b |
| 24 | `night/resolvers/magician.ts` | `engine/night/resolvers/magician.ts` | 移动 | 4b |
| 25 | `night/resolvers/nightmare.ts` | `engine/night/resolvers/nightmare.ts` | 移动 | 4b |
| 26 | `night/resolvers/psychic.ts` | `engine/night/resolvers/psychic.ts` | 移动 | 4b |
| 27 | `night/resolvers/seer.ts` | `engine/night/resolvers/seer.ts` | 移动 | 4b |
| 28 | `night/resolvers/slacker.ts` | `engine/night/resolvers/slacker.ts` | 移动 | 4b |
| 29 | `night/resolvers/types.ts` | `engine/night/resolvers/types.ts` | 移动 | 4b |
| 30 | `night/resolvers/witch.ts` | `engine/night/resolvers/witch.ts` | 移动 | 4b |
| 31 | `night/resolvers/wolf.ts` | `engine/night/resolvers/wolf.ts` | 移动 | 4b |
| 32 | `night/resolvers/wolfQueen.ts` | `engine/night/resolvers/wolfQueen.ts` | 移动 | 4b |
| 33 | `night/resolvers/wolfRobot.ts` | `engine/night/resolvers/wolfRobot.ts` | 移动 | 4b |
| 34 | `night/resolvers/__tests__/constraints.contract.test.ts` | `engine/night/resolvers/__tests__/constraints.contract.test.ts` | 移动 | 4b |
| 35 | `night/resolvers/__tests__/darkWolfKing.resolver.test.ts` | `engine/night/resolvers/__tests__/darkWolfKing.resolver.test.ts` | 移动 | 4b |
| 36 | `night/resolvers/__tests__/dreamcatcher.resolver.test.ts` | `engine/night/resolvers/__tests__/dreamcatcher.resolver.test.ts` | 移动 | 4b |
| 37 | `night/resolvers/__tests__/gargoyle.resolver.test.ts` | `engine/night/resolvers/__tests__/gargoyle.resolver.test.ts` | 移动 | 4b |
| 38 | `night/resolvers/__tests__/guard.resolver.test.ts` | `engine/night/resolvers/__tests__/guard.resolver.test.ts` | 移动 | 4b |
| 39 | `night/resolvers/__tests__/hunter.resolver.test.ts` | `engine/night/resolvers/__tests__/hunter.resolver.test.ts` | 移动 | 4b |
| 40 | `night/resolvers/__tests__/magician.resolver.test.ts` | `engine/night/resolvers/__tests__/magician.resolver.test.ts` | 移动 | 4b |
| 41 | `night/resolvers/__tests__/night1FullAlignment.contract.test.ts` | `engine/night/resolvers/__tests__/night1FullAlignment.contract.test.ts` | 移动 | 4b |
| 42 | `night/resolvers/__tests__/night1Only.contract.test.ts` | `engine/night/resolvers/__tests__/night1Only.contract.test.ts` | 移动 | 4b |
| 43 | `night/resolvers/__tests__/nightmare.resolver.test.ts` | `engine/night/resolvers/__tests__/nightmare.resolver.test.ts` | 移动 | 4b |
| 44 | `night/resolvers/__tests__/psychic.resolver.test.ts` | `engine/night/resolvers/__tests__/psychic.resolver.test.ts` | 移动 | 4b |
| 45 | `night/resolvers/__tests__/schemaResolverAlignment.contract.test.ts` | `engine/night/resolvers/__tests__/schemaResolverAlignment.contract.test.ts` | 移动 | 4b |
| 46 | `night/resolvers/__tests__/seer.resolver.test.ts` | `engine/night/resolvers/__tests__/seer.resolver.test.ts` | 移动 | 4b |
| 47 | `night/resolvers/__tests__/slacker.resolver.test.ts` | `engine/night/resolvers/__tests__/slacker.resolver.test.ts` | 移动 | 4b |
| 48 | `night/resolvers/__tests__/swap.integration.test.ts` | `engine/night/resolvers/__tests__/swap.integration.test.ts` | 移动 | 4b |
| 49 | `night/resolvers/__tests__/witch.resolver.test.ts` | `engine/night/resolvers/__tests__/witch.resolver.test.ts` | 移动 | 4b |
| 50 | `night/resolvers/__tests__/wolf.resolver.test.ts` | `engine/night/resolvers/__tests__/wolf.resolver.test.ts` | 移动 | 4b |

### C.5 protocol/ + types/ → 保持原位

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 51 | `protocol/types.ts` | `protocol/types.ts` | 保持 | — |
| 52 | `types/GameStateTypes.ts` | `types/GameStateTypes.ts` | 保持 | — |
| 53 | `types/IGameFacade.ts` | `types/IGameFacade.ts` | 保持 | — |
| 54 | `types/PublicBroadcast.ts` | `types/PublicBroadcast.ts` | 保持 | — |
| 55 | `types/index.ts` | `types/index.ts` | 保持 | — |

### C.6 v2/store/ → engine/store/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 56 | `v2/store/GameStore.ts` | `engine/store/GameStore.ts` | 移动 | 4c |
| 57 | `v2/store/index.ts` | `engine/store/index.ts` | 移动 | 4c |
| 58 | `v2/store/types.ts` | `engine/store/types.ts` | 移动 | 4c |
| 59 | `v2/store/__tests__/GameStore.test.ts` | `engine/store/__tests__/GameStore.test.ts` | 移动 | 4c |

### C.7 v2/reducer/ → engine/reducer/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 60 | `v2/reducer/gameReducer.ts` | `engine/reducer/gameReducer.ts` | 移动 | 4c |
| 61 | `v2/reducer/index.ts` | `engine/reducer/index.ts` | 移动 | 4c |
| 62 | `v2/reducer/types.ts` | `engine/reducer/types.ts` | 移动 | 4c |
| 63 | `v2/reducer/__tests__/gameReducer.test.ts` | `engine/reducer/__tests__/gameReducer.test.ts` | 移动 | 4c |

### C.8 v2/handlers/ → engine/handlers/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 64 | `v2/handlers/actionHandler.ts` | `engine/handlers/actionHandler.ts` | 移动 | 4c |
| 65 | `v2/handlers/gameControlHandler.ts` | `engine/handlers/gameControlHandler.ts` | 移动 | 4c |
| 66 | `v2/handlers/index.ts` | `engine/handlers/index.ts` | 移动 | 4c |
| 67 | `v2/handlers/nightFlowHandler.ts` | `engine/handlers/nightFlowHandler.ts` | 移动 | 4c |
| 68 | `v2/handlers/seatHandler.ts` | `engine/handlers/seatHandler.ts` | 移动 | 4c |
| 69 | `v2/handlers/types.ts` | `engine/handlers/types.ts` | 移动 | 4c |
| 70 | `v2/handlers/__tests__/actionHandler.test.ts` | `engine/handlers/__tests__/actionHandler.test.ts` | 移动 | 4c |
| 71 | `v2/handlers/__tests__/chooseSeat.batch.contract.test.ts` | `engine/handlers/__tests__/chooseSeat.batch.contract.test.ts` | 移动 | 4c |
| 72 | `v2/handlers/__tests__/gameControlHandler.test.ts` | `engine/handlers/__tests__/gameControlHandler.test.ts` | 移动 | 4c |
| 73 | `v2/handlers/__tests__/nightFlowHandler.test.ts` | `engine/handlers/__tests__/nightFlowHandler.test.ts` | 移动 | 4c |
| 74 | `v2/handlers/__tests__/seatHandler.test.ts` | `engine/handlers/__tests__/seatHandler.test.ts` | 移动 | 4c |
| 75 | `v2/handlers/__tests__/witchContract.test.ts` | `engine/handlers/__tests__/witchContract.test.ts` | 移动 | 4c |

### C.9 v2/intents/ → engine/intents/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 76 | `v2/intents/index.ts` | `engine/intents/index.ts` | 移动 | 4c |
| 77 | `v2/intents/types.ts` | `engine/intents/types.ts` | 移动 | 4c |

### C.10 v2/transport/ → transport/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 78 | `v2/transport/TransportAdapter.ts` | `transport/TransportAdapter.ts` | 移动 | 3 |
| 79 | `v2/transport/index.ts` | — | **删除** | 3 |
| 80 | `v2/transport/__tests__/TransportAdapter.test.ts` | `transport/__tests__/TransportAdapter.test.ts` | 移动 | 3 |

### C.11 v2/facade/ → facade/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 81 | `v2/facade/V2GameFacade.ts` | `facade/GameFacade.ts` | 移动+重命名 | 5 |
| 82 | `v2/facade/hostActions.ts` | `facade/hostActions.ts` | 移动 | 5 |
| 83 | `v2/facade/index.ts` | `facade/index.ts` | 移动+重写 | 5 |
| 84 | `v2/facade/messageRouter.ts` | `facade/messageRouter.ts` | 移动 | 5 |
| 85 | `v2/facade/seatActions.ts` | `facade/seatActions.ts` | 移动 | 5 |
| 86 | `v2/facade/__tests__/V2GameFacade.test.ts` | `facade/__tests__/GameFacade.test.ts` | 移动+重命名 | 5 |
| 87 | `v2/facade/__tests__/playerMessageRouterCoverage.contract.test.ts` | `facade/__tests__/playerMessageRouterCoverage.contract.test.ts` | 移动 | 5 |
| 88 | `v2/facade/__tests__/restartGame.contract.test.ts` | `facade/__tests__/restartGame.contract.test.ts` | 移动 | 5 |

### C.12 v2/__tests__/ → __tests__/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 89 | `v2/__tests__/actionHandler.test.ts` | `__tests__/actionHandler.integration.test.ts` | 移动+**重命名** | 6 |
| 90 | `v2/__tests__/hardGates.test.ts` | `__tests__/hardGates.test.ts` | 移动 | 6 |
| 91 | `v2/__tests__/legacyRuntimeGate.contract.test.ts` | `__tests__/legacyRuntimeGate.contract.test.ts` | 移动 | 6 |
| 92 | `v2/__tests__/night1RoleCoverage.contract.test.ts` | `__tests__/night1RoleCoverage.contract.test.ts` | 移动 | 6 |
| 93 | `v2/__tests__/boards/DarkWolfKingMagician12.v2.integration.test.ts` | `__tests__/boards/DarkWolfKingMagician12.v2.integration.test.ts` | 移动 | 6 |
| 94 | `v2/__tests__/boards/boundary.guard.test.ts` | `__tests__/boards/boundary.guard.test.ts` | 移动 | 6 |
| 95 | `v2/__tests__/boards/hostGameFactory.v2.ts` | `__tests__/boards/hostGameFactory.v2.ts` | 移动 | 6 |
| 96 | `v2/__tests__/boards/magicianSwap.seerReveal.v2.integration.test.ts` | `__tests__/boards/magicianSwap.seerReveal.v2.integration.test.ts` | 移动 | 6 |
| 97 | `v2/__tests__/boards/seer.v2.integration.test.ts` | `__tests__/boards/seer.v2.integration.test.ts` | 移动 | 6 |
| 98 | `v2/__tests__/boards/wireProtocol.contract.test.ts` | `__tests__/boards/wireProtocol.contract.test.ts` | 移动 | 6 |
| 99 | `v2/__tests__/boards/wolfVote.v2.integration.test.ts` | `__tests__/boards/wolfVote.v2.integration.test.ts` | 移动 | 6 |

### C.13 v2/protocol/ → protocol/

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 100 | `v2/protocol/reasonCodes.ts` | `protocol/reasonCodes.ts` | 移动 | 7 |

### C.14 v2 根文件 → 删除

| # | 源路径 | 目标路径 | 操作 | Phase |
|---|--------|----------|------|-------|
| 101 | `v2/index.ts` | — | 删除 | 8 |
| 102 | `v2/factory.ts` | — | 删除（见 D.1 门禁） | 8 |
| 103 | `v2/__tests__/factory.test.ts` | — | 删除 | 8 |

---

## C.ADD) 新增文件清单（Additions）

| 目标路径 | 用途 | 内容限制 |
|----------|------|----------|
| `infra/index.ts` | 统一导出 infra 模块 | 只允许 re-export，禁止逻辑 |
| `transport/index.ts` | 统一导出 transport 模块 | 只允许 re-export，禁止逻辑 |
| `transport/__tests__/` | 目录，用于 TransportAdapter.test.ts | — |
| `engine/index.ts` | 统一导出 engine 模块 | 只允许 re-export，禁止逻辑 |
| `facade/index.ts` | 统一导出 facade 模块 | 只允许 re-export，禁止逻辑（已存在，重写） |

---

## D) 特殊处理

### D.1 factory.ts 删除门禁

**当前状态**：`createGameServices`/`destroyGameServices` 无 runtime 调用者（仅 v2/index.ts 导出）。

**Phase 8 执行前门禁**：
```bash
# 必须返回空（exit code 1）
grep -rn "createGameServices\|destroyGameServices" src --include="*.ts" \
  | grep -v "\.test\." \
  | grep -v "__tests__" \
  | grep -v "v2/factory" \
  | grep -v "v2/index"
```

**门禁通过 → 删除**：
- 删除 `v2/factory.ts`
- 删除 `v2/__tests__/factory.test.ts`

**门禁失败 → Fallback**：
1. 迁移 `v2/factory.ts` → `facade/createGameServices.ts`
2. 更新调用者 import
3. 原因：factory 创建的是 Facade 层依赖的 services，归属 facade/ 语义正确

### D.2 重命名清单

| 原名 | 新名 | Phase | 全局替换 |
|------|------|-------|----------|
| `SimplifiedRoomService.ts` | `RoomService.ts` | 2 | class 名 + import path |
| `V2GameFacade.ts` | `GameFacade.ts` | 5 | class 名 + import path |
| `V2GameFacade.test.ts` | `GameFacade.test.ts` | 5 | — |
| `v2/__tests__/actionHandler.test.ts` | `actionHandler.integration.test.ts` | 6 | 避免与 handlers/__tests__/actionHandler.test.ts 冲突 |

**操作步骤**（以 SimplifiedRoomService 为例）：
```bash
git mv src/services/SimplifiedRoomService.ts src/services/infra/RoomService.ts

# 全局替换 import path
# macOS:
grep -rn "SimplifiedRoomService" src --include="*.ts" | cut -d: -f1 | sort -u | xargs sed -i '' 's/SimplifiedRoomService/RoomService/g'

# Linux:
# grep -rn "SimplifiedRoomService" src --include="*.ts" | cut -d: -f1 | sort -u | xargs sed -i 's/SimplifiedRoomService/RoomService/g'
```

### D.3 v2 删除验证（Phase 8 完成后）

```bash
# 1. 目录不存在
ls src/services/v2 2>&1 | grep -q "No such file" && echo "✅ v2/ removed"

# 2. 无 v2 import 残留
grep -rn "from.*v2\|import.*v2" src --include="*.ts" | grep -v node_modules
# 预期：空或只剩 .v2.integration.test.ts 文件名匹配（非 import）

# 3. 无 V2GameFacade 类名残留
grep -rn "V2GameFacade" src --include="*.ts"
# 预期：空
```

### D.4 技术债声明：nightFlowHandler.ts

**现状**：`v2/handlers/nightFlowHandler.ts` 共 812 行，超过 400 行红线。

**暂缓拆分原因**：
- 本次重构范围是目录扁平化 + v2 前缀清理，不涉及逻辑重构
- nightFlowHandler 内部职责边界尚未明确，贸然拆分可能引入 bug

**后续计划**（建议在单独 PR 处理）：
1. 按职责拆分为：
   - `nightFlowHandler.ts` - 主流程编排 (~200 行)
   - `stepTransitionHandler.ts` - 步骤切换逻辑
   - `actionDispatcher.ts` - action 分发
2. 添加合约测试确保拆分后行为不变
3. 目标：每个文件 < 400 行

**本次迁移**：照常移动到 `engine/handlers/nightFlowHandler.ts`，并在文件头部添加 TODO 注释：
```typescript
// TODO: Tech debt - 812 lines, should split into stepTransitionHandler + actionDispatcher
```

---

## E) 验证 Checklist

每个 Phase 完成后执行：

```bash
# 1. TypeCheck
npx tsc --noEmit

# 2. Lint
npm run lint

# 3. Tests
npm run test -- --passWithNoTests

# 4. Git commit (每个 Phase 独立 commit)
git add -A && git commit -m "refactor(services): phase N - <description>"
```

---

## F) 覆盖自检声明

| 分类 | 清单数量 | C 表覆盖数 | 全覆盖? |
|------|----------|------------|---------|
| Root .ts 文件 | 9 | 9 (#1-9) | ✅ |
| Root __tests__/ | 4 | 4 (#10-13) | ✅ |
| core/ | 3 | 3 (#14-16) | ✅ |
| night/resolvers/ + __tests__ | 17+17=34 | 34 (#17-50) | ✅ |
| protocol/ + types/ | 5 | 5 (#51-55) | ✅ |
| v2/store/ | 4 | 4 (#56-59) | ✅ |
| v2/reducer/ | 4 | 4 (#60-63) | ✅ |
| v2/handlers/ + __tests__ | 6+6=12 | 12 (#64-75) | ✅ |
| v2/intents/ | 2 | 2 (#76-77) | ✅ |
| v2/transport/ | 3 | 3 (#78-80) | ✅ |
| v2/facade/ + __tests__ | 5+3=8 | 8 (#81-88) | ✅ |
| v2/__tests__/ + boards/ | 4+7=11 | 11 (#89-99) | ✅ |
| v2/protocol/ | 1 | 1 (#100) | ✅ |
| v2 根文件 | 3 | 3 (#101-103) | ✅ |
| **合计** | **103 条目** | **103** | ✅ |
| 新增文件 | 5 | C.ADD 表 | ✅ |

**A/C/D 一致性检查**：
- A 树中每个文件/目录都在 C 表有来源或标为新增 ✅
- C 表的目标都能在 A 树找到归属 ✅
- D 的 rename/delete 都在 C 表明确标注 ✅
- factory.ts 删除有门禁 + fallback + 归属说明 ✅
- nightFlowHandler.ts 技术债已声明 + 后续计划 ✅
- actionHandler.test.ts 命名冲突已解决（#89 重命名为 integration） ✅

---

**文档终结**
