# WerewolfGameJudge 大规模重构方案

> 生成日期：2026-03-07  
> 基线版本：`main` HEAD  
> 代码库规模：273 源文件 / 48,655 行（不含测试）；212 单元测试 / 17 E2E spec

---

## 目录

1. [Executive Decision](#1-executive-decision)
2. [当前架构诊断（证据驱动 Top 10）](#2-当前架构诊断证据驱动-top-10)
3. [Target Architecture（目标架构）](#3-target-architecture目标架构)
4. [大规模重构路线图（分阶段）](#4-大规模重构路线图分阶段)
5. [迁移策略](#5-迁移策略)
6. [风险与回滚预案](#6-风险与回滚预案)
7. [测试与质量门禁](#7-测试与质量门禁)
8. [交付清单](#8-交付清单)
9. [成功度量](#9-成功度量)
10. [缺失上下文清单](#10-缺失上下文清单)

---

## 1. Executive Decision

| 维度                   | 结论                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **是否建议大规模重构** | **Yes** — 但采用"渐进式深度重构"而非一次性重写                                                                           |
| **重构收益评估**       | **中高** — 当前架构基础扎实（分层清晰、无循环依赖、DI 健全），但 RoomScreen hooks 层的内部复杂度已成为日常迭代的主要阻力 |
| **重构风险评估**       | **中低** — 212 个单元测试 + 17 个 E2E + 类型系统提供安全网；最大风险在 RoomScreen hooks 拆分时的行为一致性验证           |
| **建议重构窗口**       | **4~6 周**（1 人全职）                                                                                                   |

**决策依据**：RoomScreen hooks 层 4 个文件合计 **2,524 行**（`useRoomScreenState` 791 + `useActionOrchestrator` 762 + `useRoomActions` 540 + `useInteractionDispatcher` 430），每个都超过 400 行 SRP 信号。`useRoomScreenState` 内含 10 个 `useState` + 6 个 `useEffect` + 17 个 `useMemo`/`useCallback`，新增功能的改动影响面不可控。不改的代价：每次新增角色或夜晚行为变更，都需同时理解 ~2,500 行上下文。

---

## 2. 当前架构诊断（证据驱动 Top 10）

### Issue 1: God Composition Hook — `useRoomScreenState.ts`

| 维度         | 详情                                                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/screens/RoomScreen/hooks/useRoomScreenState.ts` — 791 行，10 `useState` / 6 `useEffect` / 17 `useMemo`+`useCallback`，Return 扁平 bag 供 `RoomScreen.tsx` 消费 |
| **根因**     | 所有 RoomScreen 子 hook 的组装、UI 局部状态、派生计算全部堆在同一个 hook 中                                                                                         |
| **影响范围** | RoomScreen 全部交互路径，新增夜晚行为/UI 状态必须修改此文件                                                                                                         |
| **不改代价** | 每次改动需理解 791 行上下文，re-render cascade 难以推理，单测需 mock 13+ 依赖                                                                                       |

### Issue 2: Oversized Action Orchestrator — `useActionOrchestrator.ts`

| 维度         | 详情                                                                                                                   |
| ------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/screens/RoomScreen/hooks/useActionOrchestrator.ts` — 762 行，85 个函数定义，大 switch 处理 9+ `ActionIntent` 变体 |
| **根因**     | 所有 intent 的执行逻辑（reveal/wolfVote/actionConfirm/skip/autoTrigger 等）集中在单一 hook 中                          |
| **影响范围** | 夜晚行动提交全路径                                                                                                     |
| **不改代价** | 新增 `ActionIntent` 变体需在 762 行文件中插入 case，测试覆盖难以隔离                                                   |

### Issue 3: Wide Facade Interface — `IGameFacade` 36 方法

| 维度         | 详情                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| **证据**     | `src/services/types/IGameFacade.ts` — 259 行，36 个方法。所有消费者只用子集             |
| **根因**     | Facade 同时承载 Lifecycle / Seating / GameControl / NightAction / Sync / Debug 六大职责 |
| **影响范围** | 测试 mock 需实现 36 方法；新增方法影响所有消费者的 type-check                           |
| **不改代价** | ISP 违背加深，mock 成本持续增长                                                         |

### Issue 4: Repetitive HTTP API Boilerplate — `gameActions.ts`

| 维度         | 详情                                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/services/facade/gameActions.ts` — 604 行，18 处 `callGameControlApi` 调用，每个方法结构近乎一致（get roomCode → call → handle response → log） |
| **根因**     | 缺少声明式 API 定义层，每个 action 各自手写 HTTP 编排                                                                                               |
| **影响范围** | 新增 API 端点需手写 ~30 行重复代码                                                                                                                  |
| **不改代价** | 维护成本线性增长，error handling 一致性容易 drift                                                                                                   |

### Issue 5: game-engine Handler 膨胀

| 维度         | 详情                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `packages/game-engine/src/engine/handlers/actionHandler.ts` 656 行，`packages/game-engine/src/engine/reducer/gameReducer.ts` 640 行，`packages/game-engine/src/engine/handlers/stepTransitionHandler.ts` 629 行 |
| **根因**     | `actionHandler` 处理所有 schema kind 的分发 + 通用逻辑；`gameReducer` 处理所有 `StateAction`                                                                                                                    |
| **影响范围** | 服务端与客户端共享逻辑的核心                                                                                                                                                                                    |
| **不改代价** | 新增 schema kind / state action 需在 600+ 行文件中定位插入点                                                                                                                                                    |

### Issue 6: Monolithic Style Files

| 维度         | 详情                                                                                                                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/screens/ConfigScreen/components/styles.ts` 768 行，`src/screens/RoomScreen/components/styles.ts` 573 行，`src/components/AIChatBubble/AIChatBubble.styles.ts` 634 行，共 2,937 行 style 代码 |
| **根因**     | 每个 Screen 的所有组件 styles 集中在单个文件中                                                                                                                                                    |
| **影响范围** | 修改任一组件样式都可能触发 merge conflict                                                                                                                                                         |
| **不改代价** | 协作成本增加，样式 review 效率低                                                                                                                                                                  |

### Issue 7: RoleRevealEffects 体积失控

| 维度         | 详情                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/components/RoleRevealEffects/` — 35 文件 / 9,689 行，占客户端代码 **~20%**                          |
| **根因**     | 每种动画效果（SealBreak 934 行, EnhancedRoulette 758 行, FateGears 697 行...）独立实现，缺乏动画原语复用 |
| **影响范围** | Bundle size、初始加载性能                                                                                |
| **不改代价** | 新增动画效果继续 copy-paste 700+ 行模板                                                                  |

### Issue 8: Deep Import 绕过 Barrel

| 维度         | 详情                                                                                  |
| ------------ | ------------------------------------------------------------------------------------- |
| **证据**     | 161 处 deep import（`from '@werewolf/game-engine/models/roles'`），0 处 barrel import |
| **根因**     | `package.json` 的 `exports` 字段未配置子路径导出，消费者直接引用内部路径              |
| **影响范围** | game-engine 内部重组时，所有 161 处 deep import 都是 breaking change                  |
| **不改代价** | game-engine 内部文件移动成本极高                                                      |

Deep import sub-module 分布：

```
  56 models/roles
  21 models/GameStatus
  14 models/Template
  12 types/RoleRevealAnimation
  12 models/roles/spec
   9 protocol/types
   7 models/roles/spec/types
   6 models/actions/RoleAction
   5 utils/random
   5 engine/store
   3 utils/id
   3 engine/store/types
   2 utils/shuffle
   2 engine/state/buildInitialState
   1 utils/audioKeyOverride
   1 resolvers/types
   1 models/roles/spec/nightSteps
   1 models/actions/WitchAction
```

### Issue 9: Error Handling 散布

| 维度         | 详情                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| **证据**     | 35 处 `Sentry.captureException`，37 处 `isAbortError` 守卫，94 处 `showAlert` — 散布在 services / hooks / screens |
| **根因**     | 缺少统一的 error boundary 中间件或 error handler 管道                                                             |
| **影响范围** | 新增 catch 块必须记住三层齐备（log + Sentry + showAlert），容易遗漏                                               |
| **不改代价** | error handling 一致性只靠人工 review 保证                                                                         |

### Issue 10: GameFacade 薄委托开销

| 维度         | 详情                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| **证据**     | `src/services/facade/GameFacade.ts` 648 行，~20 个方法是 1-3 行的 pass-through 到 `gameActions.*` / `seatActions.*` |
| **根因**     | Facade 既当 composition root 又当 API 代理                                                                          |
| **影响范围** | 新增 API 需同时修改 `gameActions` + `IGameFacade` + `GameFacade` 三处                                               |
| **不改代价** | 三处同步修改的心智负担和遗漏风险持续存在                                                                            |

---

## 3. Target Architecture（目标架构）

### 3.1 目标分层

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer (Screens / Components / Styles)                   │
│  ├── Presentational Components (pure render + intent)       │
│  ├── Screen Shells (composition only)                       │
│  └── Screen Hooks (grouped by concern, slim)                │
├─────────────────────────────────────────────────────────────┤
│  Application Layer (Orchestration / Policy / State)         │
│  ├── Policy Modules (pure decision → Instruction)           │
│  ├── Intent Executors (per-intent strategy, replaces switch)│
│  ├── Facade Segments (ISP: Lifecycle/Control/Night/Seat)    │
│  └── Error Pipeline (unified catch → classify → act)        │
├─────────────────────────────────────────────────────────────┤
│  Domain Layer (@werewolf/game-engine)                       │
│  ├── Models (specs / schemas / steps / templates)           │
│  ├── Engine (handlers / reducer / store / state)            │
│  └── Resolvers (per-role pure functions)                    │
├─────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                       │
│  ├── Transport (RealtimeService)                            │
│  ├── Infra Services (Audio / Auth / Room)                   │
│  ├── Feature Services (Settings / Avatar / AIChat)          │
│  └── API Utils (HTTP retry / response guard)                │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 依赖方向（单向）

```
UI → Application → Domain
UI → Application → Infrastructure
Application → Domain
Application → Infrastructure
Infrastructure → Domain (type-only)
Domain → (nothing, leaf)
```

**禁止**：Infrastructure → Application / UI；Domain → 任何上层。

### 3.3 需新增的公共能力层

| 能力                         | 形式                                                                       | 说明                                       |
| ---------------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| **Intent Executor Registry** | `Map<ActionIntent['type'], IntentExecutor>`                                | 替代 `useActionOrchestrator` 的 big switch |
| **API Definition Layer**     | `defineGameAction(name, path, payloadFn)`                                  | 消除 `gameActions` 的重复 boilerplate      |
| **Error Pipeline**           | `handleError(err, { label, expectedCodes? })`                              | 统一 log+Sentry+showAlert 三层逻辑         |
| **Facade Segments**          | `ILifecycleFacade` / `IGameControlFacade` / `INightFacade` / `ISeatFacade` | ISP 拆分 `IGameFacade`                     |

### 3.4 必须移除的反模式

| 反模式                      | 位置                          | 替代方案                                                    |
| --------------------------- | ----------------------------- | ----------------------------------------------------------- |
| God composition hook        | `useRoomScreenState`          | 拆为 3+ 组合 hook（identity / night / modals / derived）    |
| Big switch orchestrator     | `useActionOrchestrator`       | Intent executor registry（strategy pattern）                |
| 36-method god interface     | `IGameFacade`                 | 4 个 segment interface，合并 type 仍可用                    |
| Thin delegation boilerplate | `GameFacade` 20+ pass-through | 直接通过 context 暴露 sub-module                            |
| Monolithic styles           | `styles.ts` per screen        | 每组件一个 `createXxxStyles` 函数或 co-located styles       |
| Animation copy-paste        | `RoleRevealEffects`           | 提取共享动画原语（particle / glow / transition primitives） |

---

## 4. 大规模重构路线图（分阶段）

### Phase 0: 准备阶段（Week 1, Day 1-3）

**目标**：建立安全网和度量基线。

**改动范围**：

- 运行 `pnpm run quality` 确认绿灯
- 记录基线指标（文件行数、coverage、build time）
- 创建 `feature/refactor-phase-*` 分支策略
- 新增架构守护测试（防止引入循环依赖、跨层 import）

**里程碑**：

- [ ] 基线指标文档化
- [ ] 架构守护测试绿灯
- [ ] Phase 1 任务 branch 创建

**退出条件**：`pnpm run quality` 通过 + 架构守护测试覆盖所有层级边界。

---

### Phase 1: 架构打底（Week 1-2, Day 3-10）

**目标**：建立新边界、收敛接口，不改变外部行为。

**改动范围**：

1. **Error Pipeline 统一**
   - 新增 `src/utils/errorPipeline.ts`
   - `handleError(err, opts)` 封装 log + Sentry + showAlert 三层
   - 逐文件替换 35 处 Sentry + 37 处 isAbortError 散布代码

2. **IGameFacade ISP 拆分**
   - 拆 `ILifecycleFacade` / `IGameControlFacade` / `INightActionFacade` / `ISeatFacade` / `ISyncFacade`
   - `IGameFacade = ILifecycleFacade & IGameControlFacade & INightActionFacade & ISeatFacade & ISyncFacade`（兼容层）
   - 现有消费者不修改，逐步迁移到细粒度 interface

3. **Intent Executor Registry 骨架**
   - 新增 `src/screens/RoomScreen/executors/` 目录
   - 定义 `IntentExecutor` 接口 + registry
   - 暂时所有 executor 仍委托到 `useActionOrchestrator` 内部函数（adapter）

4. **game-engine `exports` 字段配置**
   - `package.json` 添加 `"exports"` 子路径映射
   - 保留 deep import 兼容（渐进迁移）

**里程碑**：

- [ ] Error pipeline 上线，消除 ≥20 处重复 catch 块
- [ ] IGameFacade 类型拆分完成，兼容层就位
- [ ] Intent executor registry 骨架可运行
- [ ] game-engine exports 配置完成

**退出条件**：`pnpm run quality` 绿灯 + 全部 E2E 通过 + 无 behavior change。

---

### Phase 2: 业务迁移（Week 2-4, Day 8-20）

**目标**：逐模块迁移到新架构。

**改动范围**：

1. **拆分 `useRoomScreenState`**（P0，影响最大）
   - 提取 `useRoomIdentity()` — actor identity / my\*/effective\* 计算
   - 提取 `useRoomNightState()` — night progress / wolf vote countdown / actioner state
   - 提取 `useRoomDerived()` — seatViewModels / roleStats / wolfVotesMap
   - 提取 `useRoomModals()` — 已有，确认完整独立
   - 保留 `useRoomScreenState` 作薄组装层（目标 <200 行）

2. **拆分 `useActionOrchestrator`**（P0）
   - 每个 `ActionIntent` type 一个 executor 文件
   - `executors/revealExecutor.ts`, `executors/wolfVoteExecutor.ts`, `executors/actionConfirmExecutor.ts` 等
   - `useActionOrchestrator` 收缩为 registry lookup + dispatch（目标 <150 行）

3. **瘦身 `gameActions.ts`**（P1）
   - 引入 `defineGameAction` 声明式 API 工厂
   - 18 处 `callGameControlApi` 收敛为声明式定义 + 统一执行

4. **拆分 Style 文件**（P1）
   - `ConfigScreen/components/styles.ts`（768 行）→ 按组件拆分
   - `RoomScreen/components/styles.ts`（573 行）→ co-locate 到组件

5. **game-engine Handler 拆分**（P2）
   - `actionHandler.ts` → 按 schema kind 拆分分发器 + per-kind 处理
   - `gameReducer.ts` → 按 action category 拆分子 reducer + combineReducers

**里程碑**：

- [ ] `useRoomScreenState` < 200 行
- [ ] `useActionOrchestrator` < 150 行
- [ ] `gameActions` 使用声明式定义
- [ ] 每个 Screen 无 >500 行 style 文件
- [ ] game-engine 无 >500 行单文件

**退出条件**：`pnpm run quality` 绿灯 + 全部 E2E 通过 + coverage 不下降。

---

### Phase 3: 收尾治理（Week 4-6, Day 20-30）

**目标**：删除兼容代码、统一规范、完善文档。

**改动范围**：

1. **删除兼容层**
   - 移除 `IGameFacade` 联合类型（如所有消费者已迁移到 segment interface）
   - 移除 intent executor adapter（如所有 intent 已迁移）
   - 移除 game-engine deep import（如 exports 子路径已稳定）

2. **RoleRevealEffects 动画原语提取**（P2，可延后）
   - 提取共享 particle system / glow effect / transition primitive
   - 各动画组件改为 compose 原语

3. **架构文档更新**
   - 更新 `copilot-instructions.md` 中的架构描述
   - 更新模块边界约束

4. **Dead code 清理**
   - 运行 `npx knip` 清除未使用导出/文件

**里程碑**：

- [ ] 无兼容层残留
- [ ] 架构文档与代码一致
- [ ] knip 无 false-negative 报告

**退出条件**：`pnpm run quality` 绿灯 + 全部 E2E 通过 + 所有 P0/P1 任务 closed。

---

## 5. 迁移策略

### 5.1 Strangler Fig — Intent Executor 迁移

```
Step 1: 新建 IntentExecutor interface + registry
Step 2: 每次迁移 1 个 ActionIntent type:
        - 在 executors/ 创建 XxxExecutor
        - XxxExecutor 内部暂时 import useActionOrchestrator 的私有函数（adapter）
        - Registry 注册新 executor
        - useActionOrchestrator 的 switch case 删除对应分支
Step 3: 所有 case 迁移完毕后，useActionOrchestrator 收缩为 dispatch shell
Step 4: 删除旧 switch body
```

**回滚点**：每个 executor 独立 PR，revert 单个 PR 即可恢复 switch case。

### 5.2 Branch by Abstraction — IGameFacade ISP

```
Step 1: 定义 segment interfaces（ILifecycleFacade 等）
Step 2: IGameFacade = union of segments（zero breaking change）
Step 3: 新代码使用 segment interface
Step 4: 逐步修改旧代码引用 segment interface
Step 5: 当所有消费者都用 segment interface 时，删除 IGameFacade 联合型
```

**新旧并存**：`IGameFacade` 联合型在整个迁移期间保持存在，TypeScript 编译器保证兼容。

### 5.3 Adapter 兼容层 — useRoomScreenState 拆分

```
Step 1: 提取 useRoomIdentity（纯 rename + extract）
Step 2: useRoomScreenState 调用 useRoomIdentity，返回相同 shape（adapter）
Step 3: RoomScreen.tsx 不修改（from single hook，shape unchanged）
Step 4: 逐步提取更多子 hook，useRoomScreenState 变薄
Step 5: 最终 RoomScreen.tsx 拆开直接调用子 hook（或保留薄壳）
```

**可回滚**：每步保持 `useRoomScreenState` 返回 shape 不变，`RoomScreen.tsx` 零修改。

### 5.4 关键接口迁移顺序

```
1. Error Pipeline（无依赖，独立模块）
2. IGameFacade ISP 拆分（纯类型，不碰运行时）
3. useRoomScreenState 子 hook 提取（每步 shape 不变）
4. Intent Executor Registry（依赖 step 3 的 identity hook）
5. gameActions 声明式（纯 service 层，不碰 UI）
6. game-engine handler/reducer 拆分（纯 domain，不碰 UI）
7. Style 文件拆分（纯 UI，不碰逻辑）
```

---

## 6. 风险与回滚预案

| #   | 风险                                            | 类型 | 概率 | 缓解措施                                                                                               | 回滚策略                                              |
| --- | ----------------------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| R1  | `useRoomScreenState` 拆分引入 re-render cascade | 功能 | 中   | 每步用 React DevTools Profiler 验证 render count；Golden snapshot 对比                                 | Revert 到拆分前 commit，恢复单一 hook                 |
| R2  | Intent executor 迁移遗漏边界 case               | 功能 | 低   | 每个 executor 必须携带原 switch case 的单测；Board UI contract test 全覆盖                             | Revert 单个 executor PR，恢复 switch case             |
| R3  | `IGameFacade` 类型拆分导致下游 type error       | 发布 | 低   | 联合型兼容层保证 zero breaking change；CI typecheck 门禁                                               | 保留联合型不删除                                      |
| R4  | game-engine exports 配置破坏 Deno import        | 发布 | 中   | Edge Function 使用 ESM bundle（`build:esm`），不走 `exports`；CI `deploy-edge-functions` 验证          | Revert `package.json` exports 字段                    |
| R5  | Error pipeline 误分类 expected/unexpected error | 功能 | 低   | 保留原有 `isAbortError` / `isExpectedAuthError` 作为 pipeline 内部判断；不删除旧逻辑直到 pipeline 稳定 | Revert `errorPipeline.ts`，保留 inline error handling |
| R6  | Style 拆分导致样式回归                          | 视觉 | 中   | 每个 style 拆分 PR 附 screenshot 对比；E2E 截图 diff                                                   | Revert 单个 style PR                                  |
| R7  | 多人协作时 rebase 冲突                          | 协作 | 中   | Phase 2 按文件级别分配负责人，避免同一文件并行修改；每 PR ≤300 行                                      | 小 PR 策略本身就是最佳回滚保障                        |

---

## 7. 测试与质量门禁

### 7.1 重构期间必须保持的质量门槛

| 门禁             | 工具                                        | 阈值                                      |
| ---------------- | ------------------------------------------- | ----------------------------------------- |
| TypeScript       | `npx tsc --noEmit`                          | 0 errors                                  |
| ESLint           | `npx eslint .`                              | 0 errors                                  |
| Prettier         | `npx prettier --check .`                    | 0 diffs                                   |
| Unit/Integration | `npx jest --forceExit`                      | 全绿                                      |
| E2E              | `pnpm exec playwright test --reporter=list` | 全绿                                      |
| Coverage         | `jest --coverage`                           | Lines ≥ 61%, Branches ≥ 53%（不低于基线） |

**每个 PR 必须通过 `pnpm run quality`**，无例外。

### 7.2 新增契约测试

| 测试                                | 防止什么                                                                                              |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Layer boundary test**             | `grep` 检查：`screens/` 不直接 import `services/`（除 type import）；`services/` 不 import `screens/` |
| **IGameFacade segment 覆盖**        | 确认 union type `IGameFacade` 等于所有 segment 的交集（使用 `Expect<Equal<>>` 类型断言）              |
| **Intent executor registry 完整性** | 使用 `ActionIntent['type']` 穷举，确认 registry 覆盖所有 intent type                                  |
| **game-engine export 完整性**       | 检查 `package.json` exports 覆盖所有被消费的子路径                                                    |

### 7.3 行为一致性验证

| 方法                        | 应用场景                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Board integration tests** | 验证夜晚全流程行为不变（现有 212 测试即可）                                          |
| **Board UI contract tests** | 验证 UI 弹窗/组件覆盖不变                                                            |
| **E2E golden path**         | 17 个 E2E spec 验证端到端行为                                                        |
| **Render count snapshot**   | 对 `useRoomScreenState` 拆分，用 React Profiler 记录关键路径的 render 次数，前后对比 |

---

## 8. 交付清单

### 8.1 P0 — 必须做（阻塞日常迭代）

| #    | 任务                                            | 复杂度 | 预计工时 | 依赖                         |
| ---- | ----------------------------------------------- | ------ | -------- | ---------------------------- |
| P0-1 | Error Pipeline 统一（`errorPipeline.ts`）       | M      | 2d       | 无                           |
| P0-2 | 拆分 `useRoomScreenState` → 4 个子 hook         | XL     | 4d       | 无                           |
| P0-3 | Intent Executor Registry + 迁移全部 9 种 intent | L      | 3d       | P0-2（需 `useRoomIdentity`） |
| P0-4 | `IGameFacade` ISP 类型拆分                      | S      | 1d       | 无                           |

### 8.2 P1 — 应该做（显著改善开发体验）

| #    | 任务                                    | 复杂度 | 预计工时 | 依赖                   |
| ---- | --------------------------------------- | ------ | -------- | ---------------------- |
| P1-1 | `gameActions.ts` 声明式 API 工厂        | M      | 2d       | P0-1（error pipeline） |
| P1-2 | Style 文件拆分（4 个 Screen）           | M      | 2d       | 无                     |
| P1-3 | game-engine `package.json` exports 配置 | S      | 0.5d     | 无                     |
| P1-4 | 架构守护测试（layer boundary）          | S      | 0.5d     | 无                     |

### 8.3 P2 — 可以做（长期健康）

| #    | 任务                                                | 复杂度 | 预计工时 | 依赖                 |
| ---- | --------------------------------------------------- | ------ | -------- | -------------------- |
| P2-1 | game-engine `actionHandler` 按 schema kind 拆分     | L      | 2d       | 无                   |
| P2-2 | game-engine `gameReducer` 按 category 拆分          | L      | 2d       | 无                   |
| P2-3 | RoleRevealEffects 动画原语提取                      | XL     | 5d       | 无                   |
| P2-4 | GameFacade pass-through 消除（直接暴露 sub-module） | M      | 1.5d     | P0-4（ISP 拆分）     |
| P2-5 | Deep import → barrel import 迁移（161 处）          | M      | 1.5d     | P1-3（exports 配置） |

### 8.4 前两周详细执行列表（Day 1 ~ Day 10）

| Day     | 任务                                                                               | 产出                                                  |
| ------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **D1**  | 基线指标采集 + 架构守护测试（P1-4）                                                | `src/__tests__/architecture.contract.test.ts` 绿灯    |
| **D2**  | Error Pipeline 实现 + 10 处高频 catch 迁移（P0-1 前半）                            | `src/utils/errorPipeline.ts` + services/facade 迁移完 |
| **D3**  | Error Pipeline 剩余 25 处迁移（P0-1 后半）                                         | 全部 35 处 Sentry 站点统一                            |
| **D4**  | `IGameFacade` ISP 类型拆分（P0-4）+ game-engine exports（P1-3）                    | 5 个 segment interface + `package.json` exports       |
| **D5**  | 提取 `useRoomIdentity` + `useRoomDerived`（P0-2 前半）                             | 2 个新 hook，`useRoomScreenState` 减少 ~250 行        |
| **D6**  | 提取 `useRoomNightState` + 瘦身 `useRoomScreenState`（P0-2 后半）                  | `useRoomScreenState` < 200 行，全测通过               |
| **D7**  | Intent Executor Registry 骨架 + revealExecutor + wolfVoteExecutor（P0-3 前半）     | 2/9 executor 迁移完                                   |
| **D8**  | 4 个 executor 迁移（actionConfirm / skip / autoTrigger / groupConfirm）（P0-3 中） | 6/9 迁移完                                            |
| **D9**  | 剩余 3 executor + `useActionOrchestrator` 收缩（P0-3 后半）                        | `useActionOrchestrator` < 150 行                      |
| **D10** | `gameActions.ts` 声明式工厂（P1-1）+ Style 拆分开始（P1-2）                        | `gameActions` < 300 行                                |

---

## 9. 成功度量

### 9.1 复杂度下降指标

| 指标                                   | 当前基线                   | 目标  | 测量方式            |
| -------------------------------------- | -------------------------- | ----- | ------------------- |
| 最大单文件行数（排除 animation/style） | 791 (`useRoomScreenState`) | < 300 | `wc -l`             |
| >400 行文件数（排除 animation/style）  | **23 个**                  | ≤ 10  | `find + wc -l`      |
| `useRoomScreenState` useState 数       | 10                         | ≤ 3   | `grep -c useState`  |
| `useRoomScreenState` useEffect 数      | 6                          | ≤ 2   | `grep -c useEffect` |
| `useActionOrchestrator` 函数定义数     | 85                         | ≤ 20  | `grep -c`           |

### 9.2 架构指标

| 指标                                   | 当前基线            | 目标                        | 测量方式            |
| -------------------------------------- | ------------------- | --------------------------- | ------------------- |
| 跨层 import（screens → services 直接） | 3 处                | 0                           | `grep` 架构守护测试 |
| `IGameFacade` 方法数                   | 36                  | 4 个 segment 各 ≤ 10        | `grep -c`           |
| game-engine deep import 处数           | 161                 | < 30（仅 type import）      | `grep`              |
| Error handling 散布 catch 块           | 35 手动 Sentry 站点 | ≤ 5（其余由 pipeline 统一） | `grep`              |

### 9.3 研发效率指标

| 指标                             | 当前估算                                    | 目标                             | 测量方式          |
| -------------------------------- | ------------------------------------------- | -------------------------------- | ----------------- |
| 新增角色需修改文件数             | ~8 文件（含 style）                         | ~6 文件                          | SOP 清单          |
| 新增 `ActionIntent` 需修改文件数 | 2（orchestrator + types）                   | 1（新建 executor 文件）          | 代码审计          |
| 新增 API 端点需修改文件数        | 3（gameActions + IGameFacade + GameFacade） | 1（声明式定义文件）              | 代码审计          |
| 回归缺陷率（重构 PR 引入 bug）   | N/A                                         | 0（靠 E2E + contract test 门禁） | CI 记录           |
| 测试覆盖率                       | 61% lines / 54% branches                    | ≥ 61% / ≥ 54%（不下降）          | `jest --coverage` |

---

## 10. 缺失上下文清单

| 项目                        | 影响                      | 当前假设                          |
| --------------------------- | ------------------------- | --------------------------------- |
| `npx knip` 完整输出         | 无法精确定位 dead code    | 假设 dead code 少量，Phase 3 清理 |
| 团队人数与排期约束          | 影响并行度和 phase 时间   | 按 1 人全职估算                   |
| React Native 目标平台优先级 | 影响 bundle size 优化 ROI | 假设 Web 优先（Expo Web）         |
| CI 流水线完整时长           | 影响 PR 频率              | 假设 <10min                       |

---

## 11. Self-Review 勘误

> 以下是对本文档数据和方案设计的逐项复核，基于 `grep` / `wc -l` 实测结果。

### 11.1 数据修正

| 项目                                    | 文档值     | 实测值                                                     | 说明                                                                                                                                                                                      |
| --------------------------------------- | ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useActionOrchestrator` 行数            | 762        | **761**                                                    | Δ=1，忽略                                                                                                                                                                                 |
| `useActionOrchestrator` 函数定义数      | 85         | **68**                                                     | 原始 regex 过宽（含注释行），实际 `const/let/var/function` 定义数 = 68                                                                                                                    |
| ActionIntent switch case 数             | 9+         | **11**                                                     | 完整列表：reveal / magicianFirst / wolfVote / actionConfirm / skip / actionPrompt / confirmTrigger / wolfRobotViewHunterStatus / multiSelectToggle / multiSelectConfirm / groupConfirmAck |
| `IGameFacade` 行数 / 方法数             | 259 / 36   | **258 / 35**                                               | 各 off-by-1                                                                                                                                                                               |
| `gameActions` 行数                      | 604        | **603**                                                    | Δ=1                                                                                                                                                                                       |
| `callGameControlApi` 调用数             | 18         | **19**（不含定义/import）                                  | off-by-1                                                                                                                                                                                  |
| Deep import 处数                        | 161        | **141**（非 test）/ **324**（含 test）                     | 文档 161 的子模块明细包含了部分 test 文件 import；非 test 实际 141                                                                                                                        |
| Barrel import 处数                      | 0          | **6**                                                      | 已有少量 barrel import 存在                                                                                                                                                               |
| `showAlert` 调用数                      | 94         | **68**（不含 import 行）                                   | 原始统计误含 import 声明                                                                                                                                                                  |
| RoleRevealEffects 文件 / 行数           | 35 / 9,689 | **37 / 10,160**                                            | 少统计 2 文件 / ~471 行                                                                                                                                                                   |
| ">400 行文件数（排除 animation/style）" | 23         | **18**（排除 animation+style）/ **23**（仅排除 animation） | 文档标签写"排除 animation/style"但数值 23 对应"仅排除 animation"                                                                                                                          |

### 11.2 方案设计修正

#### (a) Executor 数量：9 → 11（或 8 个分组）

文档说 "9 种 intent"，实际 `ActionIntentType` 有 **11** 个值。建议以逻辑亲和度分为 **8 个 executor**：

| Executor               | 覆盖的 ActionIntentType                                       |
| ---------------------- | ------------------------------------------------------------- |
| `revealExecutor`       | `reveal`                                                      |
| `wolfVoteExecutor`     | `wolfVote`                                                    |
| `actionSubmitExecutor` | `actionConfirm` / `magicianFirst`（都是 action 提交）         |
| `skipExecutor`         | `skip`                                                        |
| `promptExecutor`       | `actionPrompt` / `confirmTrigger`（都是 prompt/trigger 流程） |
| `wolfRobotExecutor`    | `wolfRobotViewHunterStatus`                                   |
| `multiSelectExecutor`  | `multiSelectToggle` / `multiSelectConfirm`                    |
| `groupConfirmExecutor` | `groupConfirmAck`                                             |

#### (b) `useRoomScreenState` <200 行的可行性

文档目标 <200 行偏乐观。useRoomScreenState 的 return 对象本身就有 **~110 行**，加上 sub-hook 调用 + destructuring + composition glue，**目标修正为 <350 行**。

如希望 <200 行，需将 RoomScreen.tsx 改为直接调用多个 sub-hook（而非通过单一 useRoomScreenState 聚合），属于更大的架构变动，可作为 Phase 3 优化。

#### (c) `useRoomModals` 已存在确认

`useRoomModals.ts`（158 行）已存在且管理 roleCard / skillPreview / nightReview / shareReview / lastNightInfo。文档中"已有，确认完整独立"的说法正确。

`useRoomSeatDialogs` 也已存在，管理 seat modal（显示 / 确认 / 取消 / 离开）。文档未提及此 hook 的存在。

#### (d) 现有 sub-hook 盘点（文档遗漏）

useRoomScreenState 已经调用以下 sub-hook，文档未完整列出：

| 已抽取的 Hook           | 行数 | 职责                                       |
| ----------------------- | ---- | ------------------------------------------ |
| `useRoomModals`         | 158  | 角色卡/技能预览/夜晚详情/分享/昨夜信息弹窗 |
| `useRoomInit`           | 216  | 房间初始化 + rejoin recovery               |
| `useNightProgress`      | 92   | 夜晚进度文本                               |
| `useActionerState`      | 56   | 当前 actioner 判定                         |
| `useWolfVoteCountdown`  | 82   | 狼人投票倒计时                             |
| `useSpeakingOrder`      | 65   | 发言顺序文本                               |
| `useHiddenDebugTrigger` | 69   | 调试模式触发                               |
| `bottomActionBuilder`   | 300  | 底部按钮 intent 构造                       |
| `actionIntentHelpers`   | 66   | intent 辅助函数                            |

**结论**：useRoomScreenState 的剩余"可提取"空间主要是 **派生计算**（actorIdentity / seatViewModels / roleStats / wolfVotesMap / actionMessage — ~180 行）和 **本地 UI 状态**（settings / swap / multi-select — ~60 行），共 ~240 行可提取。

#### (e) 补充风险：Hook 拆分的 re-render 影响

拆分单一 hook 为多个 hook 后，React 的 state update batching 边界会改变。原本在同一 hook 中的多个 `setState` 是原子批量更新，拆分后可能触发额外 re-render。**每步拆分后必须用 React DevTools Profiler 对比 render count**。

#### (f) `useRoomActions`（540 行）和 `useInteractionDispatcher`（430 行）

文档诊断中提到这两个文件超 400 行，但路线图未安排拆分计划。建议列入 P2 或 Phase 3。

---

## 12. Commit-by-Commit 执行计划

> 共 **25 个 commit**，分 4 期。每个 commit 独立通过 `pnpm run quality`。
>
> Commit message 遵循 `<type>(<scope>): <description>` 格式。

### Phase 0: 准备（3 commits, Day 1）

#### C01 — 架构守护测试

```
test(architecture): add layer boundary contract tests
```

| 项目 | 详情                                                                                                                                         |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `src/__tests__/architecture.contract.test.ts`                                                                                                |
| 内容 | ① screens/ 不直接 import services/（type import 除外）<br>② services/ 不 import screens/<br>③ game-engine 不 import src/<br>④ 无循环依赖检测 |
| 验证 | `npx jest --testPathPattern=architecture.contract`                                                                                           |
| 行数 | ~80 行新增                                                                                                                                   |

#### C02 — 基线指标记录

```
docs(refactor): record baseline metrics snapshot
```

| 项目 | 详情                                                              |
| ---- | ----------------------------------------------------------------- |
| 新建 | `docs/refactoring-baseline.md`                                    |
| 内容 | 文件行数 Top 20、coverage 数值、hook 复杂度指标、deep import 分布 |
| 验证 | 无代码变更，文档 only                                             |
| 行数 | ~60 行新增                                                        |

#### C03 — game-engine exports 配置

```
build(game-engine): configure package.json exports subpath mappings
```

| 项目 | 详情                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| 修改 | `packages/game-engine/package.json`                                                                               |
| 内容 | 添加 `"exports"` 字段，映射 `./models/*`、`./engine/*`、`./protocol/*`、`./types/*`、`./utils/*`、`./resolvers/*` |
| 风险 | R4（Deno import 兼容性）— 需验证 `supabase/functions/` 的 import 不受影响                                         |
| 验证 | `pnpm run quality` + 检查 Edge Function 编译                                                                      |
| 行数 | ~20 行修改                                                                                                        |

---

### Phase 1: 架构打底（7 commits, Day 2-5）

#### C04 — Error Pipeline 创建

```
feat(utils): add errorPipeline unified error handler
```

| 项目 | 详情                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `src/utils/errorPipeline.ts`                                                                                                                                     |
| 新建 | `src/__tests__/errorPipeline.test.ts`                                                                                                                            |
| 内容 | `handleError(err, opts)` 封装 log + Sentry + showAlert 三层；`opts.expectedCodes` 支持可预期错误跳过 Sentry；内部复用现有 `isAbortError` / `isExpectedAuthError` |
| 验证 | 单测绿灯                                                                                                                                                         |
| 行数 | ~120 行新增                                                                                                                                                      |

#### C05 — Error Pipeline 迁移：Services 层

```
refactor(services): migrate error handling to errorPipeline
```

| 项目 | 详情                                                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------- |
| 修改 | `GameFacade.ts`、`gameActions.ts`、`AudioOrchestrator.ts`、`RoomService.ts`、`AuthService.ts`、`AIChatService.ts` |
| 内容 | 将 ~15 处手动 `Sentry.captureException` + `showAlert` 替换为 `handleError()` 调用                                 |
| 验证 | `pnpm run quality`                                                                                                |
| 行数 | ~200 行修改（净减少 ~60 行）                                                                                      |

#### C06 — Error Pipeline 迁移：Hooks + Screens 层

```
refactor(hooks,screens): migrate error handling to errorPipeline
```

| 项目 | 详情                                                                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 修改 | `useRoomScreenState.ts`、`useActionOrchestrator.ts`、`useInteractionDispatcher.ts`、`useConfigScreenState.ts`、`RoomScreen.tsx`（debug buttons）、`HomeScreen.tsx` |
| 内容 | 将 ~20 处手动 catch 块替换为 `handleError()` 调用                                                                                                                  |
| 验证 | `pnpm run quality` + E2E 全通过                                                                                                                                    |
| 行数 | ~250 行修改（净减少 ~80 行）                                                                                                                                       |

#### C07 — IGameFacade ISP 类型拆分

```
refactor(services): split IGameFacade into segment interfaces
```

| 项目     | 详情                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 修改     | `src/services/types/IGameFacade.ts`                                                                                                              |
| 新建     | `src/services/types/segments/` — `ILifecycleFacade.ts`、`IGameControlFacade.ts`、`INightActionFacade.ts`、`ISeatFacade.ts`、`ISyncFacade.ts`     |
| 内容     | 5 个 segment interface 定义；`IGameFacade = ILifecycleFacade & IGameControlFacade & INightActionFacade & ISeatFacade & ISyncFacade` 联合型兼容层 |
| 新增测试 | `Expect<Equal<IGameFacade, union>>` 类型断言                                                                                                     |
| 验证     | `npx tsc --noEmit`（零 type error）                                                                                                              |
| 行数     | ~200 行新增，~30 行修改                                                                                                                          |

#### C08 — Intent Executor 骨架

```
feat(room): add IntentExecutor interface and registry skeleton
```

| 项目 | 详情                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 新建 | `src/screens/RoomScreen/executors/types.ts` — `IntentExecutor` interface                |
| 新建 | `src/screens/RoomScreen/executors/registry.ts` — executor registry + `dispatchIntent()` |
| 新建 | `src/screens/RoomScreen/executors/index.ts` — barrel export                             |
| 修改 | `useActionOrchestrator.ts` — 在 switch 前加 registry lookup（fallback 到 switch）       |
| 验证 | `pnpm run quality`                                                                      |
| 行数 | ~100 行新增，~15 行修改                                                                 |

#### C09 — Executor 批次 1（4 个）

```
refactor(room): extract reveal, wolfVote, actionSubmit, skip executors
```

| 项目 | 详情                                                                                                                                                                 |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `executors/revealExecutor.ts`、`executors/wolfVoteExecutor.ts`、`executors/actionSubmitExecutor.ts`（含 actionConfirm + magicianFirst）、`executors/skipExecutor.ts` |
| 修改 | `useActionOrchestrator.ts` — 删除 4 个 switch case（reveal / magicianFirst / wolfVote / actionConfirm / skip）                                                       |
| 验证 | `pnpm run quality` + E2E（夜晚流程）                                                                                                                                 |
| 行数 | ~400 行新增，~300 行删除                                                                                                                                             |

#### C10 — Executor 批次 2（4 个）+ 收缩 Orchestrator

```
refactor(room): extract remaining executors, shrink useActionOrchestrator
```

| 项目 | 详情                                                                                                                                                                                          |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `executors/promptExecutor.ts`（actionPrompt + confirmTrigger）、`executors/wolfRobotExecutor.ts`、`executors/multiSelectExecutor.ts`（toggle + confirm）、`executors/groupConfirmExecutor.ts` |
| 修改 | `useActionOrchestrator.ts` — 删除剩余 6 个 switch case，收缩为 registry dispatch shell                                                                                                        |
| 目标 | `useActionOrchestrator.ts` < **200** 行                                                                                                                                                       |
| 验证 | `pnpm run quality` + E2E（全部夜晚角色流程）                                                                                                                                                  |
| 行数 | ~350 行新增，~400 行删除                                                                                                                                                                      |

---

### Phase 2: 业务迁移（9 commits, Day 5-10）

#### C11 — 提取 `useRoomIdentity`

```
refactor(room): extract useRoomIdentity from useRoomScreenState
```

| 项目 | 详情                                                                                         |
| ---- | -------------------------------------------------------------------------------------------- |
| 新建 | `src/screens/RoomScreen/hooks/useRoomIdentity.ts`                                            |
| 修改 | `useRoomScreenState.ts` — 调用 `useRoomIdentity()`，删除内联 `actorIdentity` 计算            |
| 内容 | 提取 `actorIdentity` useMemo + `effectiveSeat` / `effectiveRole` / `controlledSeat` 相关逻辑 |
| 验证 | `pnpm run quality` + React Profiler render count 对比                                        |
| 行数 | ~60 行新增，~50 行删除                                                                       |

#### C12 — 提取 `useRoomDerived`

```
refactor(room): extract useRoomDerived from useRoomScreenState
```

| 项目 | 详情                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `src/screens/RoomScreen/hooks/useRoomDerived.ts`                                                                                                                                                                                                  |
| 修改 | `useRoomScreenState.ts`                                                                                                                                                                                                                           |
| 内容 | 提取 `seatViewModels` / `roleStats` (roleCounts, wolfRoles, godRoles, specialRoles, villagerCount, wolfRoleItems, godRoleItems, specialRoleItems, villagerRoleItems) / `wolfVotesMap` / `currentSchemaConstraints` / `actionMessage` 五组 useMemo |
| 验证 | `pnpm run quality` + Profiler                                                                                                                                                                                                                     |
| 行数 | ~150 行新增，~130 行删除                                                                                                                                                                                                                          |

#### C13 — 提取 `useRoomSettings`

```
refactor(room): extract useRoomSettings from useRoomScreenState
```

| 项目 | 详情                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------------------------------------------- |
| 新建 | `src/screens/RoomScreen/hooks/useRoomSettings.ts`                                                                           |
| 修改 | `useRoomScreenState.ts`                                                                                                     |
| 内容 | 提取 settingsSheetVisible / bgmEnabled / handleOpenSettings / handleCloseSettings / handleAnimationChange / handleBgmChange |
| 验证 | `pnpm run quality`                                                                                                          |
| 行数 | ~50 行新增，~40 行删除                                                                                                      |

#### C14 — 瘦身 `useRoomScreenState`

```
refactor(room): consolidate useRoomScreenState after extraction
```

| 项目 | 详情                                            |
| ---- | ----------------------------------------------- |
| 修改 | `useRoomScreenState.ts`                         |
| 内容 | 清理 import、移除冗余变量中转、整理 return 对象 |
| 目标 | `useRoomScreenState.ts` < **350** 行            |
| 验证 | `pnpm run quality` + E2E                        |
| 行数 | ~50 行净减少                                    |

#### C15 — `defineGameAction` 工厂

```
feat(services): add defineGameAction declarative API factory
```

| 项目 | 详情                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------- |
| 新建 | `src/services/facade/defineGameAction.ts`                                                                     |
| 新建 | `src/services/facade/__tests__/defineGameAction.test.ts`                                                      |
| 内容 | `defineGameAction(name, path, payloadFn)` 返回标准化 async 函数，内部统一 callGameControlApi + error handling |
| 验证 | 单测绿灯                                                                                                      |
| 行数 | ~80 行新增                                                                                                    |

#### C16 — 迁移 `gameActions.ts` 到声明式

```
refactor(services): convert gameActions to declarative definitions
```

| 项目 | 详情                                                              |
| ---- | ----------------------------------------------------------------- |
| 修改 | `src/services/facade/gameActions.ts`                              |
| 内容 | 19 处 `callGameControlApi` 手动调用替换为 `defineGameAction` 声明 |
| 目标 | `gameActions.ts` < **300** 行                                     |
| 验证 | `pnpm run quality` + E2E                                          |
| 行数 | ~300 行修改（净减少 ~250 行）                                     |

#### C17 — 拆分 ConfigScreen styles

```
refactor(config): split ConfigScreen monolithic styles into per-component files
```

| 项目 | 详情                                                                          |
| ---- | ----------------------------------------------------------------------------- |
| 修改 | `src/screens/ConfigScreen/components/styles.ts`（768 行 → ~150 行 re-export） |
| 新建 | 按组件拆分的 style 文件（`SeatGrid.styles.ts`、`RoleSelector.styles.ts` 等）  |
| 验证 | `pnpm run quality` + 目视 UI 无回归                                           |
| 行数 | ~700 行搬移                                                                   |

#### C18 — 拆分 RoomScreen styles

```
refactor(room): split RoomScreen monolithic styles into per-component files
```

| 项目 | 详情                                                                        |
| ---- | --------------------------------------------------------------------------- |
| 修改 | `src/screens/RoomScreen/components/styles.ts`（573 行 → ~100 行 re-export） |
| 新建 | 按组件拆分的 style 文件                                                     |
| 验证 | `pnpm run quality` + 目视 UI                                                |
| 行数 | ~500 行搬移                                                                 |

#### C19 — 拆分 AIChatBubble styles

```
refactor(components): split AIChatBubble monolithic styles
```

| 项目 | 详情                                                           |
| ---- | -------------------------------------------------------------- |
| 修改 | `src/components/AIChatBubble/AIChatBubble.styles.ts`（634 行） |
| 新建 | 按子组件拆分                                                   |
| 验证 | `pnpm run quality`                                             |
| 行数 | ~600 行搬移                                                    |

---

### Phase 3: 深度治理（6 commits, Day 10-15）

#### C20 — 拆分 `actionHandler.ts`

```
refactor(game-engine): split actionHandler by schema kind
```

| 项目 | 详情                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| 修改 | `packages/game-engine/src/engine/handlers/actionHandler.ts`（656 行）                |
| 新建 | 按 schema kind 拆分的 handler 文件（`handleWolfVote.ts`、`handleWitchAction.ts` 等） |
| 目标 | `actionHandler.ts` < 200 行（dispatch shell）                                        |
| 验证 | `pnpm run test:all`                                                                  |
| 行数 | ~500 行搬移                                                                          |

#### C21 — 拆分 `gameReducer.ts`

```
refactor(game-engine): split gameReducer by action category
```

| 项目 | 详情                                                               |
| ---- | ------------------------------------------------------------------ |
| 修改 | `packages/game-engine/src/engine/reducer/gameReducer.ts`（640 行） |
| 新建 | 按 action category 拆分的子 reducer                                |
| 目标 | `gameReducer.ts` < 200 行（compose shell）                         |
| 验证 | `pnpm run test:all`                                                |
| 行数 | ~500 行搬移                                                        |

#### C22 — Deep import → barrel（批次 1）

```
refactor(imports): migrate deep imports to barrel — models + types
```

| 项目 | 详情                                                                                    |
| ---- | --------------------------------------------------------------------------------------- |
| 新建 | barrel re-export 文件（`models/index.ts`、`types/index.ts`）                            |
| 修改 | ~90 处 deep import（`models/roles` 56 + `models/GameStatus` 21 + `models/Template` 14） |
| 验证 | `pnpm run quality`                                                                      |
| 行数 | ~90 处 import path 修改                                                                 |

#### C23 — Deep import → barrel（批次 2）

```
refactor(imports): migrate deep imports to barrel — remaining paths
```

| 项目 | 详情                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------ |
| 修改 | ~51 处 deep import（`types/RoleRevealAnimation` 12 + `protocol/types` 9 + `engine/store` 8 + 其余 22） |
| 验证 | `pnpm run quality` + Edge Function 编译验证                                                            |
| 行数 | ~51 处 import path 修改                                                                                |

#### C24 — 删除兼容层

```
refactor(services): remove IGameFacade union compat layer
```

| 项目 | 详情                                                            |
| ---- | --------------------------------------------------------------- |
| 前提 | 所有消费者已迁移到 segment interface（可选：视 C07 后迭代进度） |
| 修改 | `IGameFacade.ts` 删除联合型、消费者更新 import                  |
| 验证 | `npx tsc --noEmit`                                              |
| 行数 | ~50 行删除                                                      |

#### C25 — 最终清理 + 文档更新

```
docs(refactor): update architecture docs and cleanup
```

| 项目 | 详情                                             |
| ---- | ------------------------------------------------ |
| 修改 | `.github/copilot-instructions.md` — 更新架构描述 |
| 修改 | `.github/instructions/*.md` — 更新模块边界       |
| 运行 | `npx knip --no-exit-code` — 清理 dead exports    |
| 验证 | `pnpm run quality`                               |
| 行数 | ~100 行修改                                      |

---

### 12.1 Commit 总览

| Phase | Commit                         | 日期   | 复杂度 | 类别     |
| ----- | ------------------------------ | ------ | ------ | -------- |
| **0** | C01 架构守护测试               | D1     | S      | 测试     |
| **0** | C02 基线指标                   | D1     | S      | 文档     |
| **0** | C03 game-engine exports        | D1     | S      | 构建     |
| **1** | C04 errorPipeline 创建         | D2     | M      | 基础设施 |
| **1** | C05 error 迁移 — services      | D2-3   | M      | 迁移     |
| **1** | C06 error 迁移 — hooks/screens | D3     | M      | 迁移     |
| **1** | C07 IGameFacade ISP 拆分       | D4     | S      | 类型     |
| **1** | C08 Executor 骨架              | D4     | S      | 基础设施 |
| **1** | C09 Executor 批次 1            | D5     | L      | 迁移     |
| **1** | C10 Executor 批次 2            | D5-6   | L      | 迁移     |
| **2** | C11 useRoomIdentity            | D6     | M      | 提取     |
| **2** | C12 useRoomDerived             | D6-7   | M      | 提取     |
| **2** | C13 useRoomSettings            | D7     | S      | 提取     |
| **2** | C14 useRoomScreenState 瘦身    | D7     | S      | 清理     |
| **2** | C15 defineGameAction 工厂      | D8     | M      | 基础设施 |
| **2** | C16 gameActions 声明式         | D8     | M      | 迁移     |
| **2** | C17 ConfigScreen styles 拆分   | D9     | M      | 拆分     |
| **2** | C18 RoomScreen styles 拆分     | D9     | M      | 拆分     |
| **2** | C19 AIChatBubble styles 拆分   | D9     | S      | 拆分     |
| **3** | C20 actionHandler 拆分         | D10    | L      | 拆分     |
| **3** | C21 gameReducer 拆分           | D10-11 | L      | 拆分     |
| **3** | C22 barrel import 批次 1       | D11-12 | M      | 迁移     |
| **3** | C23 barrel import 批次 2       | D12    | M      | 迁移     |
| **3** | C24 删除兼容层                 | D13    | S      | 清理     |
| **3** | C25 文档 + dead code 清理      | D13    | S      | 文档     |

### 12.2 依赖图

```
C01 ─┐
C02 ─┼─> Phase 0 完成
C03 ─┘
      ├─> C04 ──> C05 ──> C06        (Error Pipeline 链)
      ├─> C07                          (ISP 拆分，独立)
      ├─> C08 ──> C09 ──> C10        (Executor 链)
      └─> C03 ──> C22 ──> C23        (Barrel import 链)

C06 + C10 ──> C11 ──> C12 ──> C13 ──> C14  (Hook 拆分链)
C04 ──> C15 ──> C16                          (API 工厂链)
C17, C18, C19                                (Style 拆分，互相独立)
C20, C21                                     (game-engine 拆分，互相独立)
C07 + C14 ──> C24                            (兼容层删除)
All ──> C25                                  (最终清理)
```

### 12.3 关键回滚点

| 回滚点   | Commit     | 说明                                                                |
| -------- | ---------- | ------------------------------------------------------------------- |
| **RP-1** | C06 完成后 | Error pipeline 全量上线，可整体 revert C04-C06 恢复 inline handling |
| **RP-2** | C10 完成后 | Executor 全量迁移完成，可 revert C08-C10 恢复 big switch            |
| **RP-3** | C14 完成后 | Hook 拆分完成，可 revert C11-C14 恢复原始 useRoomScreenState        |
| **RP-4** | C16 完成后 | API 工厂迁移完成，可 revert C15-C16 恢复手动 gameActions            |

### 12.4 每日验证检查

每个 commit 后执行：

```bash
pnpm run quality          # typecheck + lint + format + test
```

Phase 1/2 的关键 commit（C06, C10, C14, C16）后额外执行：

```bash
pnpm exec playwright test --reporter=list   # E2E 全通过
```
