# 《瞎掰王》(Fib King) 设计文档 —— engine registry 架构

> **状态:as-built 设计记录,随实现持续校准。** 所有「承重断言」均经真实代码核验(含 file:line),标 `✓` 为本会话亲自复核的核心事实。
> **架构定调**:engine registry(可插拔 engine)+ shared room shell/controller/store/action helper;早期「平行复制」方案已弃(理由见 §2.3)。
>
> **一句话**:把 `GameRoom` 这个 Durable Object 从「焊死狼人」改造成「game-agnostic 平台壳 + 按 `gameType` 选择的可插拔游戏 engine」。建房统一按 `gameType + config` 走 create registry;狼人和瞎掰王运行期都走 `engineAction`;未来「你画我猜」只需再注册 creator/engine/effect(如有),DO 与核心 RPC 面零新增方法。

---

## 0. 已确认的产品决策(权威)

- 入口:首页「创建房间」→ 模式卡(狼人 / 瞎掰王);公共 DO;玩家输房号正常 join。
- 角色每轮随机重分;计分**纯线下口头**,App 不记分、不碰 `settleGameResults`/`userStats`/XP/gacha。
- host 也是玩家,可随时重开;不显示局数。
- 大聪明(guesser)身份**公开**;老实人 / 瞎掰王身份**隐藏**,仅 reveal 时公开。
- 查看身份用**按钮**(非长按)。
- fib 调人数走 Config 屏,房内可复用 Config 改人数。
- UI:抽共享房间基础层(`src/components/room/*` 的 header/seat/bottom/status/profile/QR/shell styles + `src/components/room/hooks/*` controller hooks + `src/components/room/policy/*` lifecycle/seat policy),狼人和 fib 分别接 adapter;fib 只保留玩法特殊 UI。
- 客户端状态/连接/action helper:房间 snapshot 走 `SnapshotStore<TState>`;连接/transport/room state fetch 走泛型 `ConnectionManager<TState>`/`IRealtimeTransport<TState>`/`IRoomService.getGameState<TState>`;非狼人 action 走 `defineRoomAction`。
- 服务端架构:**engine registry**(本文 §3),狼人和 fib 都是注册 engine;GameRoom 不再暴露游戏专用 RPC。
- 建房:**服务端权威构造**初始状态(create registry 的 `createInitialState`,客户端只 POST `gameType + config`),对齐「服务端唯一权威」铁律(§6.3)。

---

## 1. 游戏定义(权威,按此实现)

《瞎掰王》是「猜真释义」的吹牛派对游戏。手机只做**裁判 / 助手**,发言、提问、指认全部**线下面对面**。

- **人数**:至少 4 人,默认 8 人,无产品上限。UI 必须支持很多人玩;服务端只校验下限与座位索引合法性。
- **每轮随机分配身份**:
  - **大聪明 (Guesser) ×1** —— **身份公开**。本人能看到词,但看不到真实释义;听完所有人发言后口头指认谁是老实人。
  - **老实人 (Honest) ×1** —— 手机显示**词 + 真实释义**,讲真话(可演技装成在瞎掰)。**身份隐藏,仅 reveal 公开。**
  - **瞎掰王 (Fibber) ×其余** —— 手机只显示**词,无释义**,临场编一个像样的假释义。**身份隐藏,仅 reveal 公开。**
- **手机端职责**:① 抽生僻词 + 真释义;② 分配身份(大聪明公开 / 其余隐藏);③ 所有人点按钮查看本人可见内容;④ reveal 公布真词 + 真释义 + 全部身份;⑤ 玩法说明页。
- **计分纯线下口头**。App 不记分。

---

## 2. 设计哲学(2026 实践 + design patterns)

### 2.1 采用的设计模式(本文骨架)

> 参考 refactoring.guru 的 GoF 目录。本设计是几个经典模式的组合,**不为套模式而套**(见 §2.4)。

| 模式                             | 在本设计的落点                                                                                                       | 作用                                                                                             |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Strategy(策略)** —— 核心       | `GameEngine` 接口:一族可互换算法(`dispatch`/`reduce`/`normalize`/`createInitialState`),DO 运行期按 `gameType` 选一个 | DO 是 Context,委托给选中的 Strategy。加游戏 = 加一个 Strategy                                    |
| **Command(命令)**                | DO `engineAction(actionType, payload)` → engine `dispatch`:动作变成数据对象,engine 当 interpreter 执行               | 统一动作入口,DO RPC 面不随游戏数膨胀                                                             |
| **Factory Method(工厂方法)**     | `engine.createInitialState(config)`:每个 engine 是「造自己初始状态」的工厂                                           | 建房按 `gameType` 选工厂,服务端权威构造初始 blob                                                 |
| **Template Method(用组合实现)**  | `processEngineAction` 固定骨架(读 blob → dispatch → reduce → normalize → 写 → 广播),可变步骤由 engine 注入           | 2026 惯例:用 Strategy 注入而非继承,避免基类耦合                                                  |
| **Registry**(类 Service Locator) | `ENGINE_REGISTRY: Record<gameType, GameEngine>`                                                                      | 按 key 选 Strategy / Factory                                                                     |
| **Plugin 架构**(宏观)            | 平台壳 + 注册式 engine 模块                                                                                          | = Strategy + Factory + Registry 的合体,对齐 Jackbox / Board Game Arena / Discord Activities 范式 |

### 2.2 2026 工程原则(本项目强约束)

- **服务端唯一权威**:初始状态由 engine 在服务端构造(`createInitialState`),不信任客户端 POST 的整块 blob。
- **组合优于继承**:Template Method 用注入实现,engine 之间零继承、零共享可变状态。
- **Fail-fast**:未知 `gameType`/`actionType`、相位不符、缩容越界 → 立即拒绝 + 中文 UI 反馈,不静默兜底。
- **结构性隔离优于约定**:fib 不进狼人 settle 路径,不是靠「fib 永不到 Ended」的约定,而是 post-commit effect 按 `gameType` 注册;fib 没有 settlement effect(§6.4)。

### 2.3 为什么不是早期的「平行复制」

早期方案(Plan C)为 fib 平行加 ~12 个 `fibXxx` DO RPC 方法 + 复制一份 `processFibAction`。它对**第二个**游戏成立,但对**第三个(你画我猜)及以后不 scale**:每加一个游戏,`GameRoom` 多 ~12 方法、`IGameRoomRPC` 累积所有签名、再复制一份 `processXxxAction` —— 增长 **O(游戏数 × 动作数)**,`GameRoom` 退化成 god object。

本版改为**参数化抽取**:DO 壳保持 game-agnostic,新增**单一 `engineAction` RPC**(Command)+ 把 `processAction` 的 reduce/normalize 抽成 **`GameEngine` 接口**(Strategy)。增长降为 **O(1) DO 壳 + O(游戏数) 个自包含 engine**。

### 2.4 反模式警戒(先抽稳定房间能力,不抽狼人夜晚业务)

- **不把狼人夜晚业务硬塞进通用基类**:狼人夜晚 action/audio 只在 `werewolfEngine` 内部路由,XP/gacha settlement 只在 api-worker 的 werewolf effect runner 内运行;通用基类不承载狼人规则。
- **基础房间能力必须抽**:座位板、资料卡、二维码、header 菜单、bottom panel、连接生命周期、snapshot store、bot takeover、room lifecycle capability、非狼人 action helper 已经有第二个真实消费者(fib),继续复制会直接伤害第三个游戏。
- **抽房间基础能力,不抽业务基类**:共享 header/menu/seat board/seat confirm/bottom panel 这类稳定房间能力;狼人夜晚业务、fib 身份查看等特殊流程各自 adapter。

---

## 3. 架构总览(三层:平台壳 + 注册分发 + 每游戏 engine)

```
┌──────────────────────────────────────────────────────────────┐
│  平台壳 GameRoom (game-agnostic,已存在 ~80%)                    │
│   blob+revision / #broadcast / WebSocket hibernation           │
│   getState / getRevision / cleanup                             │
│   + 新增通用:initState(gameType, blob)、engineAction(actionType, payload) │
└───────────────────────────────┬──────────────────────────────┘
                                │  按 gameType 查 ENGINE_REGISTRY (Registry)
                                ▼
        GameEngine 接口 (Strategy + Command + Factory)
        { gameType, createSchema, createInitialState,
          dispatch, reduce, normalize }
          ├─ werewolfEngine  —— 狼人运行期 Command router + reducer/normalize
          ├─ fibEngine       —— 瞎掰王 engine
          └─ drawEngine      —— 你画我猜以后只加这一行
```

- **平台壳**:`room_state` 单行 JSON blob + `revision`、`#broadcast`、WebSocket hibernation、`getState`/`getRevision`/`cleanup` 已 game-agnostic(✓ 见 §4)。公共 RPC 面只保留 `initState` + `engineAction` 两个通用写入口。
- **GameEngine(game-engine 包,纯函数、零跨游戏依赖)**:每游戏一份,`reduce`/`normalize` 是它自己的(fib 用 `normalizeFibState`,绝不碰狼人 `normalizeWerewolfState`)。
- **注册表(api-worker)**:`ENGINE_REGISTRY = { werewolf: werewolfEngine, fibking: fibEngine }`。加游戏 = 加一行。
- **运行期零平行实现**:狼人与 fib 都走 `engineAction`;游戏规则入口在各自 engine,运行时 IO effect 在 `ENGINE_EFFECT_REGISTRY`。同一个 DO 只负责持久化、广播、WebSocket 与 effect 调度。

> fib 房与狼人房都用同一 `GameRoom` DO 类,按 `idFromName(roomCode)` 各自独立实例。玩家 join 方式完全一致(输房号)。

### 3.0.1 game-engine 目录边界(as-built)

```text
packages/game-engine/src/
  engine/              # 跨游戏 runtime contracts / kernels only
    registry/
    seating/
    store/SnapshotStore.ts
  protocol/            # 跨游戏 protocol primitives
    common.ts
    gameTypes.ts
    ActionResult.ts
  werewolf/            # 狼人杀专属 runtime + domain
    engine.ts
    dispatch.ts
    actions.ts
    protocol/types.ts
    models/
    resolvers/
    handlers/
    reducer/
    state/
    store/WerewolfStore.ts
  fibking/             # 瞎掰王专属 runtime + domain
    engine.ts
    dispatch.ts
    reducer.ts
    types.ts
    store/FibStore.ts
```

新增游戏必须落在自己的顶层 game module(如 `draw/`),不得继续把具体游戏放进 `engine/`。

### 3.1 被拒绝的备选

| 备选                                                                                             | 拒绝原因                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 给狼人 `WerewolfState` 加 `gameType`,在 `werewolfReducer`/`normalizeWerewolfState` 内分支** | 污染 `Complete<WerewolfState>` 守卫、reducer、契约测试。engine registry **不在 `werewolfReducer` 内分支**,每个 engine 的 reduce/normalize 独立,故不踩此坑。 |
| **B. 把 fib 角色塞进 `ROLE_SPECS`/三层表当 preset board**                                        | 违反「不得新增 `RoleId`/动三层表」;fib 无夜晚/死亡结算,语义不符。                                                                                           |
| **C. 早期的平行复制(~12 个 `fibXxx` RPC + `processFibAction`)**                                  | O(游戏数 × 动作数) 增长,`GameRoom` 成 god object(§2.3)。                                                                                                    |
| **D. 全新独立 DO 类 `FibRoom`**                                                                  | 隔离更强,但要重写 hibernation + `#broadcast` + DO 迁移 + stub 管线,样板翻倍。保留为「更强隔离」后备。                                                       |
| **E. 先把狼人重构进 registry,再做 fib**                                                          | N=1 抽象易抽错;狼人热路径、零用户价值。正确顺序:fib 先验证接口(§2.4)。                                                                                      |

---

## 4. 核验基线(为什么是这个形状,file:line)

> 早期分析列了 10 条乐观假设,6 条被真实代码反驳。下表是本版仍依赖的承重事实。

| #    | 事实(file:line)                                                                                                                                                                           | 对架构的约束                                                                              |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1 ✓  | [processEngineAction.ts](../packages/api-worker/src/durableObjects/processEngineAction.ts) 只接收 `GameEngine` 的 `dispatch`/`reduce`/`normalize`/`afterReduce`                           | reduce/normalize 已参数化;新增游戏不复制 DO 写入管线                                      |
| 2 ✓  | [GameRoom.ts](../packages/api-worker/src/durableObjects/GameRoom.ts) `#broadcast` / WebSocket hibernation / `getState` / `getRevision` / `cleanup` 全 game-agnostic                       | 平台壳已存在,白拿;所有建房都走通用 `initState(gameType, blob)`                            |
| 3 ✓  | [werewolfSettlementEffects.ts](../packages/api-worker/src/durableObjects/effects/werewolfSettlementEffects.ts) 只注册到 `werewolf` gameType 且只响应 `AUDIO_ACK` 后的 ended state         | settle 是狼人 runtime effect;fib 没有 effect runner → 结构性零 XP/gacha                   |
| 4 ✓  | [roomHandlers.ts](../packages/api-worker/src/handlers/roomHandlers.ts) `/create`:D1 insert `rooms` + `game_type`;所有游戏经 create registry 构造 blob 后 `stub.initState(gameType, blob)` | 建房 = game-agnostic 房间记录 + 游戏专属初始化;`game_type` 已落库,冷启动和输房号靠它分流  |
| 5    | DO 不会在裸 `await fetch` 时 input-gate(需显式 `blockConcurrencyWhile`),否则丢更新/双开局(早期核验)                                                                                       | 抽词(15s)**移出 DO**放到 Worker 路由;DO 的 dispatch 保持同步                              |
| 6    | [werewolf/protocol/types.ts](../packages/game-engine/src/werewolf/protocol/types.ts) 模块级 `import RoleId/Team/WolfKillOverride` 只存在于狼人模块内                                      | `RosterEntry`/`SideEffect` 在零依赖 `protocol/common.ts`,fib 只从它导入                   |
| 7 ✓  | 组合根 [registry.ts](../src/services/registry.ts) / [App.tsx](../App.tsx) 创建 `WerewolfFacade` 与 `FibFacade`;route 已按 `gameType` 分流                                                 | facade 只在对应游戏边界暴露;join 查 D1 `game_type` 后进 `Room` 或 `FibRoom`               |
| 8 ✓  | transport runtime(`CFRealtimeService`/`ConnectionManager`/`ConnectionFSM`)可复用;`ConnectionManager<TState>`/`IRealtimeTransport<TState>`/`IRoomService.getGameState<TState>` 已泛型化    | fib 复用同一连接栈且组合根不再 `as unknown as FibState`;第三个游戏按 state 类型接 adapter |
| 9 ✓  | `WerewolfStore` 与 `FibStore` 的 revision/listener/applySnapshot/reset/lastAction 已收敛到 `SnapshotStore<TState>`                                                                        | 每个游戏 store 只保留对外能力边界,不再复制 snapshot 管线                                  |
| 10 ✓ | `FibFacade` 的 `/fib/*` POST action 已改用 `defineRoomAction`,只声明 path/body                                                                                                            | 第三个游戏不需要再复制 `try cfPost/catch reason` 小体系                                   |

---

## 5. GameEngine 接口(Strategy + Command + Factory,as-built)

`packages/game-engine/src/engine/registry/types.ts`,纯函数、零跨游戏依赖、**零 zod / 零 Cloudflare `Env`**:

```ts
/** 一个游戏的全部权威逻辑 = 一个 Strategy。诞生(Factory)+ 活着(Command/Strategy)。 */
interface GameEngine<TState, TAction, TConfig> {
  readonly gameType: string;

  // ── 诞生:Factory Method ────────────────────────────────
  /** 服务端权威构造初始 blob(不信任客户端 POST 整块 state) */
  createInitialState(config: TConfig, ctx: CreateCtx): TState;

  // ── 活着:Command 分发 + Strategy 算法 ───────────────────
  /** 路由 actionType → 该游戏纯 handler,返回 EngineResult<TAction>(success/rejection/error) */
  dispatch(state: TState, revision: number, action: GameAction): EngineResult<TAction>;
  /** 可选:同一事务内的纯后续推进,例如狼人 audioAck 后 inline progression */
  afterReduce?(state: TState, context: AfterReduceContext<TAction>): readonly TAction[];
  /** 该游戏自己的 reducer(action 用本游戏的 TAction,fib 用 FibAction) */
  reduce(state: TState, action: TAction): TState;
  /** 该游戏自己的 normalize + Complete 守卫(fib 用 normalizeFibState) */
  normalize(state: TState): TState;
}

interface CreateCtx {
  roomCode: string;
  hostUserId: string;
  hostProfile: RosterEntry;
}
interface GameAction {
  actionType: string;
  payload: unknown;
}
type EngineResult<TAction> =
  | {
      kind: 'success';
      actions: readonly TAction[];
      sideEffects?: readonly SideEffect[];
      reason?: string;
      broadcastAction?: string | null;
    }
  | {
      kind: 'rejection';
      reason: string;
      actions: readonly TAction[];
      sideEffects?: readonly SideEffect[];
      broadcastAction?: string | null;
    }
  | { kind: 'error'; reason: string };
```

> **实现中的两处精炼(已落地)**:
>
> 1. **泛型化 action 类型 `TAction`** —— 狼人 `HandlerResult.actions` 是 `StateAction[]`(狼人专属),fib 不能复用;改用通用 `EngineResult<TAction>`,fib 携带自己的 `FibAction`。
> 2. **接口保持纯净** —— 不放 `createSchema`(zod):game-engine 零依赖,建房参数校验留在 api-worker 边界(`packages/api-worker/src/games/fibking/schemas/fibSchemas.ts`),engine 只收已校验的 `TConfig`。不放 Cloudflare `Env`:XP/gacha 这类 IO effect 在 api-worker 的 `ENGINE_EFFECT_REGISTRY` 按 `gameType` 注册。

注册表 `packages/api-worker/src/durableObjects/engineRegistry.ts`:

```ts
import { fibEngine } from '@werewolf/game-engine/fibking/engine';

export const ENGINE_REGISTRY: Record<string, GameEngine<unknown, unknown>> = {
  werewolf: werewolfEngine,
  fibking: fibEngine,
  // pictionary: drawEngine,   // ★ 你画我猜以后只加这一行,DO 与 /room/create 零改动
};
```

---

## 6. 服务端架构

### 6.1 平台壳新增的通用 RPC(对游戏数稳定)

```ts
// IGameRoomRPC 公共写入口 —— 仅 2 个,加游戏零新增
initState(gameType: string, blob: unknown): Promise<void>;                    // 存 blob + DO storage 记 game_type
engineAction(actionType: string, payload: unknown): Promise<DispatchResult>;   // 查 registry → engine → 写 + 广播 + effect
```

> `assignRoles`/`seat`/`submitAction`/`audioAck` 等旧游戏专用 RPC 已删除;API route 保留原 URL,内部统一调用 `engineAction(WEREWOLF_ACTION.X, payload)`。

### 6.2 通用核心 `processEngineAction`(Template Method via 组合)

`durableObjects/processEngineAction.ts`(新),镜像现有 `processAction` 但 reduce/normalize 由 engine 注入:

```ts
function processEngineAction<S>(
  sql: DurableObjectState['storage']['sql'],
  engine: GameEngine<S, unknown>,
  trigger: GameAction,
): DispatchResult {
  // 1. 读 blob(同步)
  // 2. result = dispatchFn(state, revision)        ← engine.dispatch
  // 3. error → 不持久化;success/rejection → 逐 action 走 engine.reduce
  // 3.5 success → 可选 engine.afterReduce(同事务纯推进)
  // 4. engine.normalize → revision+1 → 写 SQLite(同步原子)
  // 5. success/rejection 只要产生 state/revision 都由 GameRoom 广播
}
```

DO 的 `engineAction` 内部(同步,无 `await fetch`):

```
读 game_type → engine = ENGINE_REGISTRY[gameType] (未注册→fail-fast)
→ res = processEngineAction(sql, engine, { actionType, payload })
→ res.success → #broadcast(复用)          ← revision 排序/丢旧(ConnectionFSM)不变
→ runEnginePostCommitEffects(gameType, res, trigger)  ← fib 显式空 effect policy,狼人 settlement 在这里
```

### 6.3 建房:通用 `/room/create`(Factory Method)

服务端权威构造,**不信任客户端整块 blob**:

```
POST /room/create { roomCode, gameType, config }
  1. creator = ROOM_CREATE_REGISTRY[gameType]         // 未知 gameType → fail-fast 400
  2. cfg = creator.configSchema.parse(config)         // zod strict 校验
  3. blob = creator.createInitialState(cfg, { roomCode, hostUserId })
  4. db.insert(rooms){ code, hostUserId, game_type: gameType }
  5. stub.initState(gameType, blob)                  // 失败 → 回滚 D1(复用 §4 #4 的回滚)
```

**狼人建房也不特殊**:狼人 `/create` 同样 POST `{ gameType:'werewolf', config:{ template } }`,由 `roomCreate/registry.ts` 调 `buildInitialWerewolfState` 服务端构造 blob。请求 schema 使用 `z.strictObject` 只接受 `roomCode/gameType/config`;`initialState` 等多余字段 fail-fast。D1 insert 后必须初始化 DO;DO init 失败则回滚 D1,不会留下未初始化房间。客户端创建成功后只调用 `WerewolfFacade.connectCreatedRoom(roomCode, hostUserId)` 连接并接收服务端 snapshot,不再本地构造权威初始 state。

### 6.4 玩法动作:REST 端点 + 通用 dispatch

> REST 端点按游戏分文件(`/fib/*` 在 `games/fibking/handlers/fibRoutes.ts`,你画我猜以后放在 `games/<game>/handlers/*Routes.ts`)——**隔离小模块,非 god object**,做 zod 校验 + 编排,经通用 `dispatch` 落到 engine。actionType 是该游戏领域动作。

```
POST /fib/update-config → engineAction('UPDATE_CONFIG', { n })        // Lobby-only
POST /fib/sit | /leave  → engineAction('SIT' | 'LEAVE', { ... })
POST /fib/start-round    → 两段式编排(抽词在 Worker,§7):
        1. r1 = engineAction('BEGIN_DRAW', {})        // 相位+坐满守卫 → phase=Starting,广播"出题中"
           !r1.success → return r1                    // fail-fast
        2. word = await generateFibWord(env, { avoid: r1.state.usedWords })   // ★ Worker 侧 await fetch
        3. engineAction('START_ROUND', { word, def, source })   // 同步:随机分角色 + 写词 → phase=Playing
        catch(代码 bug) → engineAction('ABORT_DRAW', {}) + log.error + Sentry + 中文 fail
POST /fib/reveal        → engineAction('REVEAL', {})                  // phase=Revealed
POST /fib/next-round    → 同 start-round 两段式(仅 Revealed)
POST /fib/restart       → engineAction('RESTART', {})                // 任意非 Lobby → Lobby(弃局)
POST /fib/kick          → engineAction('KICK', { targetSeat })       // Lobby-only
POST /fib/clear-seats   → engineAction('CLEAR_SEATS', {})            // Lobby-only
POST /fib/fill-bots     → engineAction('FILL_BOTS', {})              // Lobby-only,填满空座给手测/大房间压测
```

- **同步执行**(无 `await fetch`)→ 规避 DO 并发陷阱(§4 #5)。
- **双击开局**被 fibEngine 对 `'BEGIN_DRAW'` 的相位守卫挡(第二次 phase 已 `Starting` → 拒,无副作用)。
- **结构性零 settle**:`engineAction` 后按 `gameType` 查 `ENGINE_EFFECT_REGISTRY`;fib 注册空 effect policy,不会触达 `settleGameResults`/XP/gacha。

### 6.5 抽词位置(为何在 Worker 而非 DO)

- **保密**:host 可能不是老实人;在 host 客户端抽词会提前看到真释义 → 破坏游戏。
- **不阻塞**:DO 裸 `await fetch` 不 input-gate(§4 #5),15s 抽词进 DO 会丢更新/双开局。
- **结论**:抽词在**无状态 Worker 路由**(与 `geminiProxy` 同样 `await fetch`),抽到词后传入**同步** DO `engineAction('START_ROUND', { word, ... })`。服务端唯一权威,host 不在出题阶段接触真释义。

### 6.6 D1 迁移

- `rooms` 加 `game_type TEXT NOT NULL DEFAULT 'werewolf'`;迁移回填存量 `'werewolf'`。
- `/room/create` 写对应 `gameType`;`/room/get` 返回 `gameType` 供客户端冷启动路由(§9.3)。

### 6.7 判别与零耦合(结构性,非约定)

- **game 判别**:`initState` 时把 `game_type` 存进 DO storage 独立行(**不内联 blob、不碰狼人 `WerewolfState`**)。`engineAction` 读它查 registry。客户端冷启动靠 **D1 `game_type` 列**。`FibState.gameType` 仅自描述。
- **零 settle**:见 §6.4 / §4 #3。
- **狼人运行期零污染**:见 §3。

---

## 7. 抽词设计(结构化输出 + 多样性去重 + fallback + 内容安全)

### 7.1 调用目标

抽 `geminiProxy` 常量到 `lib/geminiConfig.ts` 共享:`GEMINI_OPENAI_BASE`、`GEMINI_MODEL`、15s 超时、Workers AI 绑定 `AI`。`generateFibWord(env, { avoid })` 在 Worker 侧直连(`geminiProxySchema` 不透传 `response_format`)。

### 7.2 结构化输出(2026)

- Gemini provider adapter `response_format: { type: 'json_object' }` + 强 system prompt(flash-lite 上 `json_schema` strict 仍 beta,用 json_object)。
- system prompt:生僻但真实存在的中文词 + 真实准确简洁释义,纯 JSON,禁含 `avoid` 词,**禁冒犯/政治敏感/不实释义**。
- 解析:剥 ```json 围栏 → `JSON.parse`→ Zod 4`safeParse`:

```ts
const FibWordSchema = z.object({
  word: z.string().min(2).max(12),
  definition: z.string().min(8).max(120),
});
```

### 7.3 去重与多样性(四层,根因修复)

> **风险**:LLM 无跨调用记忆 → 同 prompt 在 flash-lite 上反复回同几个词(modal collapse)。`usedWords` 按房初始空,救不了「新房第一个词雷同」。**不设固定 seed**(固定 seed = 更雷同)。

1. **Prompt 熵注入(主力,模型无关)**:每次用 `crypto.getRandomValues` 注入 随机领域 tag(~30 个)+ 随机字形线索(部首/拼音首字母)+ nonce → 不同房落不同词域,首词不雷同。
2. **采样参数(次要)**:`temperature ≈ 1.0`;`frequency_penalty`/`presence_penalty ≈ 0.4` best-effort(Gemini OpenAI-compatible endpoint未必认,设了不依赖);不设固定 seed。
3. **硬性后置去重(同房保证)**:解析后 `word` 归一化,若 `∈ usedWords` → 判废重试(≤2,换熵种子 + 加进 avoid);仍重复 → fallback 词库。同房不重复是**保证**,不靠 prompt 听话。
4. **fallback 词库洗牌**:`FIB_WORD_BANK` Web Crypto 洗牌后按 `usedWords` 过滤再取(非固定 index 0),窗口耗尽则重置。

> 跨房去重靠第 1 层熵注入,不引入全局词库存储(过重)。

### 7.4 内容安全

system prompt 安全约束 + 输出过 `FIB_WORD_BLOCKLIST` + 不合规限次重试(≤1)→ 降级。

### 7.5 三级 fallback(必出词)

```
Gemini(503 重试1次) ──失败/超时/geo──▶ Workers AI(env.AI) ──失败──▶ FIB_WORD_BANK(内置 ≥80 词)
```

三级同走 `parseWordResponse`;`FIB_WORD_BANK` 洗牌 + `usedWords` 过滤,窗口耗尽重置;`wordSource ∈ {gemini, workersai, fallback}` 记来源。

### 7.6 失败 UX(fail-fast)

有内置兜底,抽词「必出」;每级降级 `log.warn`(预期,不报 Sentry)。真抛错(代码 bug)→ `engineAction('ABORT_DRAW')` 回 Lobby + `log.error` + `Sentry.captureException` + 中文 `showAlert('开始失败', …)`。不静默吞。

---

## 8. 共享纯函数 kernel(座位 CRUD)+ 前置重构

### 8.1 seating kernel(狼人与 fib 共用)

> 入座/离座/踢人/清座的**通用 CRUD** 抽成共享纯函数 kernel。实测狼人 [seatHandler.ts](../packages/game-engine/src/werewolf/handlers/seatHandler.ts) ~78% 通用,~22% 狼人专属(`GameStatus`、`Player.role/hasViewedRole`)。

- **新建 `packages/game-engine/src/engine/seating/`**(纯函数,零游戏依赖):
  - `types.ts`:`BaseSeat { userId; seat }`、`GamePhase { name; allowSeating }`、`GenericSeatState { seats; roster; phase; hostUserId }`。
  - `kernel.ts`:`seatJoin / seatLeave / seatKick / seatClearAll` —— `(state, …) → SeatOpResult`(占座/换座/移除/清空/校验 + game-agnostic reason codes)。
- **狼人改薄 adapter**(行为不变):`seatHandler.ts` 把 CRUD 委托 kernel,只留 `GameStatus` 守卫 + `Player` 字段 + 转回 `PLAYER_JOIN/PLAYER_LEAVE`。**不动** `werewolfReducer`/`normalizeWerewolfState`/契约测试。
- **fib 接同一 kernel**:fibEngine 对 `'SIT'/'LEAVE'/'KICK'/'CLEAR_SEATS'` 的 handler 把 `FibState`(`phase → { allowSeating: phase==='Lobby' }`)适配成 `GenericSeatState`,调 kernel,写回 `FibState.seats`。
- **可共享 vs 必须各自**:可共享 = CRUD 逻辑 + `RosterEntry` + reason codes + UI 范式 + transport;必须各自 = REST 端点、动作分发(fib `engineAction('SIT')` 经 fibEngine,狼人 `WEREWOLF_ACTION.SEAT` 经 werewolfEngine)、状态容器(`FibState.seats` vs `WerewolfState.players`)。回归风险 **LOW**(纯函数 + 既有座位测试护栏)。

### 8.2 `protocol/common.ts` 前置重构

`RosterEntry`、通用 `SideEffect`/`STANDARD_SIDE_EFFECTS` 位于 `packages/game-engine/src/protocol/common.ts`(零狼人依赖);`werewolf/protocol/types.ts`、`werewolf/handlers/types.ts` 只在狼人模块内复用这些 shared primitives。fib 只从 `common.ts` 导入,杜绝传递性拖入 `RoleId`(§4 #6)。

---

## 9. 客户端架构

### 9.1 分游戏 store / facade(复用 transport)

- **`FibStore`**(game-engine,镜像 `werewolf/store/WerewolfStore.ts`):`applySnapshot` 调 `normalizeFibState`(非狼人 `normalizeWerewolfState`)。
- **`FibFacade`**(`src/services/games/fibking/FibFacade.ts`):**复用** `ConnectionManager`/`CFRealtimeService` runtime,`onStateUpdate → fibStore.applySnapshot`;动作走 `src/services/room/defineRoomAction.ts`。
- **狼人专属 action**:`defineGameAction`/`apiUtils` 位于 `src/services/games/werewolf/`,绑定 `WerewolfStore/GameActionsContext`;它们不再伪装成跨游戏基础能力。

### 9.2 组合根按 gameType 解析 facade

组合根一次性创建 `WerewolfFacade` 与 `FibFacade`,经 `RoomFacadeProvider` 注入;Screen 只取自身游戏 hook。输房号路径先查 D1 `game_type`,再路由到 `Room` 或 `FibRoom`。

### 9.3 join 路由

输房号 → `/room/get` 查 `gameType` → 路由到 `Room` 或 `FibRoom`;拿错 mode 房号 → fail-fast 中文提示。

---

## 10. FibState 与相位机

### 10.1 FibState

```ts
type FibPhase = 'Lobby' | 'Starting' | 'Playing' | 'Revealed';
type FibRole = 'guesser' | 'honest' | 'fibber';
type FibWordSource = 'gemini' | 'workersai' | 'fallback';

interface FibSeat {
  userId: string;
  seat: number;
}

interface FibState {
  gameType: 'fibking'; // 自描述(冷启动以 D1 game_type 为准)
  roomCode: string;
  hostUserId: string;
  phase: FibPhase;
  numberOfPlayers: number; // >=4,默认 8,无产品上限
  seats: Record<number, FibSeat>; // sparse occupied-seat map;空座不入 state
  roster: Record<string, RosterEntry>; // 从 protocol/common.ts
  word?: string; // Playing/Revealed 必有;Lobby/Starting 必无
  definition?: string; // 同上
  roleBySeat?: Record<number, FibRole>; // 同上
  wordSource?: FibWordSource; // 同上
  usedWords: string[]; // 跨轮去重;环形上限 FIB_USED_WORDS_CAP
}
```

### 10.2 相位机

```
Lobby ──BEGIN_DRAW──▶ Starting ──START_ROUND──▶ Playing ──REVEAL──▶ Revealed
  ▲          │(抽词失败)                                              │
  │          └──ABORT_DRAW──▶ Lobby                                    │
  └───────────────────── NEXT_ROUND ◀──────────────────────────────────┘
              (新词 + 随机重分;保留 seats/roster/usedWords/numberOfPlayers;不计局数)

  ✦ RESTART:Starting / Playing / Revealed ──▶ Lobby
            (弃局:清 roleBySeat/word/definition/wordSource + 清 usedWords;保 seats/roster/numberOfPlayers)
```

> 图中转换名 = §6.4 的 `dispatch` actionType,由 fibEngine 路由,**非独立 DO RPC**。

- **Lobby**:入座(坐满即可开局);host 可「设置」改人数。
- **Starting**:广播「出题中…」,Worker 抽词(全员转圈);无 `word`/`roleBySeat`,查看身份禁用。
- **Playing**:词已抽、角色已分;点「查看身份」看本人内容;线下发言/指认。
- **Revealed**:host「公布答案」,公开 词 + 真释义 + 全部 `roleBySeat`。

### 10.3 normalizeFibState(按 phase 判别式,fail-fast)

- 通用必填:`gameType/roomCode/hostUserId/phase/numberOfPlayers/seats/roster/usedWords`。
- 相位相关:`Playing`/`Revealed` 下 `word`/`roleBySeat`/`wordSource` 必存在(缺则抛);`Lobby`/`Starting` 下三者必缺省。
- `satisfies Complete<FibState>` 守卫:漏 normalize 即编译报错。

### 10.4 NEXT_ROUND 重置集(显式枚举,带测试)

- 清空:`roleBySeat`/`word`/`definition`/`wordSource`。
- 保留:`usedWords`/`seats`/`roster`/`numberOfPlayers`/`gameType`/`roomCode`/`hostUserId`。
- 无 `round` 字段;无 `viewedSeats`(查看身份是纯客户端读取,§14.3)。

### 10.5 重新开始 vs 下一轮

| 动作     | actionType   | 允许相位                  | 目标             | 清空                 | 保留                         | UI 展示                                     |
| -------- | ------------ | ------------------------- | ---------------- | -------------------- | ---------------------------- | ------------------------------------------- |
| 下一轮   | `NEXT_ROUND` | Revealed                  | Starting→Playing | role/word/def/source | seats/roster/N/**usedWords** | Revealed host 主按钮                        |
| 重新开始 | `RESTART`    | Starting/Playing/Revealed | Lobby            | 同上 + **usedWords** | seats/roster/N               | Starting/Playing host ghost;Revealed 不展示 |

### 10.6 边界

- **开局门槛**:坐满 `numberOfPlayers`(N≥4);未坐满 `开始本轮` 置灰 + hint;N≥4 保证 1 guesser + 1 honest + ≥2 fibber。
- **UPDATE_CONFIG**:仅 Lobby;新人数 < 已就座数 → fail-fast 拒绝(`'已有 X 人就座,无法减到 Y…'`),不静默截断。

### 10.7 座位 / 断线 / host 生命周期

- 座位内部 0-based,UI 1-based;`numberOfPlayers` 即固定座位数。
- 入座/离座/踢/清**仅 Lobby**;其余相位锁定。底层 CRUD 委托 §8.1 kernel。
- `PlayerProfileCard` 的离座/移出按钮只在 Lobby 暴露;Playing/Revealed 点击头像只看资料/机器人信息,不展示会被服务端 `NOT_LOBBY` 拒绝的动作。
- host 手测机器人:填充机器人后,Playing/Revealed 长按 bot 座位接管/退出;`ControlledSeatBanner` 展示当前接管座位,`FibIdentitySheet` 读取 `effectiveSeat = controlledSeat ?? mySeat`。这是 UI 调试控制,不改变座位 CRUD 规则。
- 扩容只改 `numberOfPlayers`,不预写空座;缩容仅高位空座可减(否则 fail-fast),不压缩重排。
- 断线:座位保留;`StatusRibbon` 显示「重连中…」;transport `getState`+`applySnapshot` 恢复;中途掉线不重分。
- host 卡 Starting:用 ghost `重新开始`(RESTART→Lobby)恢复。本期不做 host 转移。

---

## 11. 角色分配与秘密揭示

### 11.1 分配(可确定性测试)

`assignFibRoles(seats, rng)`:`shuffleArray(seats, rng)` 后取 1 guesser + 1 honest + 其余 fibber。生产用 Web Crypto `secureRng`;测试注入 `createSeededRng(seed)` → 精确 `roleBySeat`。

### 11.2 秘密揭示(公开广播 + UI 按相位/身份过滤)

`roleBySeat`/`word`/`definition` 随 `FibState` 公开广播,UI 过滤(与狼人 `seerReveal` 同范式):

| 本人角色       | Playing 期「查看身份」显示 | 他人看到           |
| -------------- | -------------------------- | ------------------ |
| 大聪明 guesser | 词;无真释义                | **公开**(座位徽章) |
| 老实人 honest  | 词 + 真释义                | 隐藏(仅「已就座」) |
| 瞎掰王 fibber  | 仅词                       | 隐藏(仅「已就座」) |

Revealed:全员公开 词 + 真释义 + 全部 `roleBySeat`。符合项目 trust model(面对面,假设不作弊)。

---

## 12. 入口与导航

### 12.1 流程

```
首页「创建房间」──▶ GameModePickerModal(居中弹窗,复用现有 Modal 视觉)
                     🐺 狼人杀 → BoardPicker→Config→Room(完全不变)
                     🤥 瞎掰王 → FibConfig→/room/create→FibRoom(默认 8,可改为任意 >=4 人数)
```

### 12.2 FibConfig 一份两用(对齐狼人 Config `existingRoomCode`)

```
建房:  模式卡·瞎掰王 → FibConfig(无 existingRoomCode) → POST /room/create{gameType:'fibking',config} → FibRoom
房内:  FibRoom·Lobby → host「设置」→ FibConfig({existingRoomCode}) → engineAction('UPDATE_CONFIG') → 回房
```

### 12.3 导航 route 增量

```ts
FibConfig: { existingRoomCode?: string };
FibRoom:   { roomCode: string; isHost: boolean };
FibRules:  undefined;
```

---

## 13. UI 复用矩阵(共享房间基础层 + 每游戏 adapter)

| UI                                              | 复用策略                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| theme tokens / Toast / showAlert                | **直接共用**                                                                                                                     |
| 头像+gacha 外框+名字样式                        | **compose** `AvatarWithFrame`/`NameStyleText`(已被 PlayerProfileCard/Gacha 复用),零改动                                          |
| 房间 Header                                     | 抽共享 `RoomHeaderActions`;狼人 adapter 保留分享/音乐/机器人操作,fib adapter 接分享/填充机器人/清空座位;fib 设置留在底部主操作区 |
| StatusRibbon / 二维码分享 Modal / JoinRoomModal | `RoomStatusRibbon`/`QRCodeModal` 已进 `src/components/room`;join 后按 gameType 路由                                              |
| 座位单元                                        | `RoomSeatBoard` + `RoomSeatTile` 已进 shared;adapter 传 bot 标记、bot role label、controlledSeat、公开徽章                       |
| 头像卡 / 接管机器人 banner                      | `PlayerProfileCard` + `ControlledSeatBanner` 进 shared;各游戏 adapter 决定何时传 `onKick/onLeaveSeat/onSeatLongPress`            |
| 查看身份卡                                      | **不碰 RoleCardModal**;自建 `FibIdentitySheet`(theme + reanimated)                                                               |
| 底部操作面板 / GameModePickerModal              | 复用 `RoomBottomActionPanel` 三层按钮布局;新增模式弹窗使用现有 Modal 视觉                                                        |

> **原则**:共享稳定房间基础能力;狼人夜晚业务和 fib 玩法特殊内容各自 adapter,不把不同游戏规则塞进同一个基类。

---

## 14. 控制与交互 + 查看身份卡

### 14.1 底部按钮矩阵(相位 × 角色)

| 相位     | host 主              | host ghost             | 玩家(就座)     | 玩家(未就座) |
| -------- | -------------------- | ---------------------- | -------------- | ------------ |
| Lobby    | `开始本轮`(坐满启用) | `设置`                 | `等待房主开始` | 点空位入座   |
| Starting | `出题中…`            | `重新开始`(卡住恢复)   | `出题中…`      | —            |
| Playing  | `公布答案`           | `查看身份`、`重新开始` | `查看身份`     | —            |
| Revealed | `下一轮`             | —                      | `等待房主`     | —            |

`设置` 仅 Lobby;`查看身份` 仅 Playing(含大聪明本人);Revealed 全公开,改内联 roster。

### 14.2 按钮 ⇄ 触发 + 确认弹窗

| 按钮       | 触发                                                                         | 确认                                |
| ---------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| 设置       | `navigate('FibConfig',{existingRoomCode})` → `engineAction('UPDATE_CONFIG')` | 无                                  |
| 开始本轮   | `POST /fib/start-round`(两段式,§6.4)                                         | 无(坐满才启用)                      |
| 查看身份   | 打开本地 `FibIdentitySheet`(无请求,§14.3)                                    | 无                                  |
| 公布答案   | `POST /fib/reveal`                                                           | `'公布答案?将公开真词与所有人身份'` |
| 下一轮     | `POST /fib/next-round`                                                       | 无                                  |
| 重新开始   | `POST /fib/restart`                                                          | `'重新开始?将弃掉本局回到房间'`     |
| 清空座位   | `POST /fib/clear-seats`                                                      | `'清空所有座位?'`                   |
| 填充机器人 | `POST /fib/fill-bots`                                                        | `'填充机器人?将用机器人填满空座位'` |
| 移出       | `POST /fib/kick`                                                             | 仅 Lobby profile card 内 `移出`     |
| 接管机器人 | 本地切换 `controlledSeat`                                                    | Playing/Revealed 长按 bot 座位      |

### 14.3 FibIdentitySheet(纯客户端读取)

- 自建,compose theme tokens + reanimated v4(fade+scale),半透明 overlay。**不复用** 690 行 `RoleCardModal`。
- 内容全来自本机 `FibStore` 已广播的 `FibState`(`roleBySeat[mySeat]`/`word`/`definition`),**点按钮不发请求**,只开本地 Modal。故无 `viewedSeats`、无 RPC。
- 三态(accent 用 theme token,不硬编码颜色):

| 角色           | accent              | 词      | 释义                 | 提示                  |
| -------------- | ------------------- | ------- | -------------------- | --------------------- |
| 老实人 honest  | `colors.success` 😇 | ✅ 大字 | ✅ 全文              | 讲真话,但可装成在瞎掰 |
| 瞎掰王 fibber  | `colors.warning` 🤥 | ✅ 大字 | ❌(占位"临场编一个") | 编得越具体越唬人      |
| 大聪明 guesser | `colors.primary` 🔍 | ✅ 大字 | ❌                   | 听完口头指认老实人    |

底标「看完即收,别让旁人看到」(大聪明身份公开,无隐私底标)。

### 14.4 加载 / 空 / 错误态

连接中全屏「连接中…」;空 Lobby 座位全 `+`;重连中 `StatusRibbon`;出题失败 `ABORT_DRAW` 回 Lobby + `showAlert`;join 类型不符 fail-fast 回首页;normalize 失败 = bug,fail-fast + Sentry。

---

## 15. 玩法说明文案(按 GameRulesScreen 信息层级)

`FibRulesScreen` 用 `GameRulesScreen` 的 section header + rule card 样式;房间内入口用 icon row,不使用散在内容流里的裸文字链接。

- **玩法流程**:一句话玩法 / 线下发言 / 下一轮。
- **身份说明**:大聪明 ×1 / 老实人 ×1 / 瞎掰王 ×其余。
- **手机使用**:查看身份 / 房主也是玩家。

---

## 16. File-by-file 变更清单(分级)

### P0(平台壳改造 / engine 接口 / 前置重构 / 抽词 / D1)

| 文件                                                                                                        | 变更点                                                                                                        | 风险                         |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `packages/game-engine/src/protocol/common.ts` + `werewolf/protocol/types.ts` / `werewolf/handlers/types.ts` | `RosterEntry`/`SideEffect` 属于零狼人依赖 shared protocol;狼人协议只在本模块复用                              | 中;grep 全 consumer 双向核对 |
| `packages/game-engine/src/engine/registry/types.ts`(新)                                                     | `GameEngine` 接口 + `EngineResult`(create/dispatch/reduce/normalize;泛型 TState/TAction/TConfig)              | 低;纯类型                    |
| `packages/game-engine/src/engine/seating/{types,kernel}.ts`(新)                                             | 共享座位 CRUD kernel(§8.1)                                                                                    | 低;纯函数                    |
| 改 `werewolf/handlers/seatHandler.ts` → 薄 adapter                                                          | 狼人座位委托 kernel,行为不变,不动 reducer/normalize/契约                                                      | 中;既有座位测试须全绿        |
| `…/fibking/{types,buildInitialFibState,normalizeFibState,assignRoles}.ts`(新)                               | FibState + phase 判别 normalize + 注入 RNG 分角色                                                             | 低                           |
| `…/fibking/engine.ts`(新)                                                                                   | 组装 `fibEngine`(createInitialState + dispatch 路由 + normalizeFibState + reducer);engine 纯净,无 settle 钩子 | 中;fib 动作全集              |
| `…/fibking/wordGen/{buildWordPrompt,parseWordResponse,FIB_WORD_BANK,blocklist}.ts`(新)                      | prompt/解析/zod/词库/黑名单                                                                                   | 中;需测试覆盖                |
| `packages/api-worker/src/lib/geminiConfig.ts`(新)+ 改 `geminiProxy.ts`                                      | 抽共享 gemini 常量                                                                                            | 低                           |
| `packages/api-worker/src/games/fibking/services/fibWordSource.ts`                                           | `generateFibWord` 三级 fallback(Worker 侧)                                                                    | 中;可注入 mock               |
| `…/durableObjects/processEngineAction.ts`(新)                                                               | 通用核心,reduce/normalize 由 engine 注入(同步)                                                                | 中;不得误用狼人 normalize    |
| `…/durableObjects/engineRegistry.ts`                                                                        | `ENGINE_REGISTRY = { werewolf: werewolfEngine, fibking: fibEngine }`                                          | 低                           |
| `…/durableObjects/GameRoom.ts`                                                                              | 只保留 `initState`/`engineAction`/read/cleanup/WebSocket;post-commit effect 走 registry                       | 中;旧 RPC 全迁移             |
| `…/durableObjects/IGameRoomRPC.ts`                                                                          | 删除游戏专用签名,只保留平台 RPC                                                                               | 中;handler/tests 同步迁移    |
| `…/roomCreate/registry.ts` + 改 `handlers/roomHandlers.ts` `/create` + `schemas/room.ts`                    | `/room/create` 统一 `gameType + config`;按 create registry 构造 state;写 `game_type`;禁止 `initialState`      | 中;狼人建房路径迁移          |
| D1 迁移 `…/db/` + `rooms` 表                                                                                | 加 `game_type`(默认 'werewolf')+ 回填;`/room/get` 返回 gameType                                               | 中;迁移脚本                  |

### P1(端点 / facade / store / 组合根)

| 文件                                                                                                                                                 | 变更点                                                                                                                                                              | 风险                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `packages/api-worker/src/games/fibking/schemas/fibSchemas.ts` + `packages/api-worker/src/games/fibking/handlers/fibRoutes.ts` + `index.ts` 挂 `/fib` | 端点 zod + 两段式 start-round 编排(经 `engineAction`)                                                                                                               | 中                      |
| `…/fibking/handlers/*.ts`(新)                                                                                                                        | sit/leave/kick/clearSeats/fillBots(委托 kernel/共享 bot 命名)、updateConfig、startRound/reveal/nextRound/restart(纯函数 + phase-guard;由 `fibEngine.dispatch` 路由) | 中                      |
| `…/fibking/store/FibStore.ts`(新)                                                                                                                    | 镜像 WerewolfStore,`applySnapshot → normalizeFibState`                                                                                                              | 低                      |
| `src/services/games/fibking/FibFacade.ts`                                                                                                            | 复用 transport runtime;建房走 `IRoomService.createRoom`;动作走 `defineRoomAction`                                                                                   | 中                      |
| `src/services/registry.ts`、`App.tsx`、`contexts/RoomFacadeContext.tsx`                                                                              | 按 gameType 解析 facade;join 路由                                                                                                                                   | 中高;狼人路径须回归验证 |
| `src/navigation/types.ts`、`AppNavigator.tsx`                                                                                                        | 加 `FibConfig`/`FibRoom`/`FibRules` route + linking                                                                                                                 | 低                      |

### P2(UI / 文案 / 文档 / 测试)

| 文件                                                                                                                    | 变更点                                                                               | 风险 |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ---- |
| `src/screens/HomeScreen/` + `components/GameModePickerModal.tsx`(新)                                                    | 创建→模式弹窗                                                                        | 低   |
| `src/screens/FibConfigScreen/*`(新)                                                                                     | 人数输入 + stepper(默认 8,最少 4,无产品上限);按 `existingRoomCode` 走 create/update  | 低   |
| `src/components/room/RoomSeatBoard.tsx`/`RoomSeatTile.tsx`/`ControlledSeatBanner.tsx` + `src/screens/FibRoomScreen.tsx` | 共享座位板 + 接管 banner + fib adapter;各游戏 adapter 解析 role/bot label 与交互权限 | 中   |
| `src/screens/FibRoomScreen/*`(新)                                                                                       | Lobby/Starting/Playing/Revealed                                                      | 中   |
| `src/screens/FibRulesScreen/*`(新)                                                                                      | 玩法说明(§15)                                                                        | 低   |
| 各 `__tests__`                                                                                                          | 见 §18;Fib 多人 e2e 后续单独补                                                       | 低   |

**明确不碰**:`ROLE_SPECS/SCHEMAS/NIGHT_STEPS/RoleId`、狼人 `WerewolfState/werewolfReducer/normalizeWerewolfState` 语义、`settleGameResults/userStats/XP/gacha` 业务规则。

---

## 16.1 当前剩余关注点(as-built)

- **transport 类型泛型化**:`ConnectionManager`/`IRealtimeTransport`/`IRoomService` runtime 已复用;第三个游戏前应继续收紧组合根与 facade 注入类型,避免新增 state cast。
- **客户端 registry**:当前是一个 `RoomFacadeProvider` 下暴露 `useWerewolfFacade`/`useFibFacade` 两个 accessor;命名按游戏边界,不再有通用 `GameFacade`。
- **action helper**:`FibFacade` 动作已走 `src/services/room/defineRoomAction`;`defineGameAction`/`apiUtils` 留在 `src/services/games/werewolf` 作为狼人动作工厂。
- **E2E 覆盖**:已有模式选择和 Fib 单客户端入口;还需要 Fib 4 人 sit/start/reveal、输房号 join、冷启动 deep link 的多人 e2e。
- **URL 策略**:当前输房号会按 D1 `game_type` 分流;链接层仍有 `/room/:code` 与 `/fib/room/:code`。若产品要单一链接,需加 resolver screen。

---

## 17. 非目标 / 明确不做

- 不新增 `RoleId`、不动三层表与契约测试。
- 不改狼人 `WerewolfState`/`werewolfReducer`/`normalizeWerewolfState` 的业务语义;运行期入口迁入 `werewolfEngine` 只做路由归位。
- **狼人已经迁进 engine registry**:API URL 不变,handler 调 `engineAction(WEREWOLF_ACTION.X, payload)`;XP/gacha settlement 迁入 `werewolfSettlementEffects` 并按 `gameType` 注册。
- 不接 growth/scoring;计分纯线下展示文本。
- 不做跨夜/多轮持久统计;App 不记分。

---

## 18. 测试计划

- **game-engine 单测**(注入 `createSeededRng`):`assignFibRoles`(种子→精确 roleBySeat,各档恰好 1+1+(N-2));`normalizeFibState`(phase 判别必填:Playing 缺 word 即抛);NEXT_ROUND 重置完整性;UPDATE_CONFIG(Lobby-only、缩容 fail-fast);`parseWordResponse`(围栏/非法/超长/黑名单);`FIB_WORD_BANK` 窗口耗尽重置;**seating kernel** + fib 座位 adapter。
- **去重/多样性**(注入 RNG + mock LLM):`buildWordPrompt` 每次注入不同领域/部首/nonce;硬性后置去重(连回重复词判废重试≤2 再降级);`pickFallbackWord` 不出重复、耗尽重置;断言不设固定 seed。
- **worker/DO**(mock `generateFibWord`):`createInitialState` 服务端权威构造;start-round 两段式;双击被 `'BEGIN_DRAW'` 守卫挡;**未知 gameType/actionType fail-fast**;fib 没注册 settlement effect,不触达 `settleGameResults`;抽词来源矩阵。
- **回归(证零污染)**:狼人 `test:all` 全绿;**「fib 全生命周期 0 次 `settleGameResults`」断言**(spy env);狼人契约测试不受 `common.ts` 重构影响;`/room/create` 狼人经 `{ gameType:'werewolf', config:{ template } }` 建房;狼人座位回归(adapter 后 sit/leave/kick/clear 不变)。
- **冷启动/深链**:join fib 房号 → 查 D1 gameType → 路由 `FibRoom`;拿错 mode fail-fast。
- **e2e(后续)**:模式卡建房 → 选人数 → 坐满 → 开始本轮 → 各座查看身份校验过滤 → 公布 → 下一轮。
- **收口**:本轮以 `pnpm run quality` 为完成条件;Fib 多人 e2e 后续独立补。

---

## 19. 库验证(2026)

- **Gemini 结构化输出**:Gemini provider adapter支持 `response_format`;flash-lite 上 `json_schema` strict 仍 beta → `{type:'json_object'}` + 强 prompt + 健壮解析。
- **Zod 4**:`z.email()` 等顶层校验器;`z.string().min(1)` 取代已移除的 `.nonempty()`;`safeParse` 返回 discriminated union。
- **Expo / RN / React 19**:查看身份用 `Pressable` + Modal;动画 `react-native-reanimated` v4。实现阶段对具体 API 再按文档核对。

---

## 20. 开放问题(等确认)

1. 玩法文案:用 §15 草稿,还是贴原文替换?
2. 实现顺序:确认按 P0 → P1 → P2 一次性端到端交付。

---

## 21. 已定决策(本轮确认)

- **`createInitialState` 服务端权威构造**:采纳。客户端只 POST `gameType + config`(狼人 `{ template }`;Fib `{ numberOfPlayers }`),服务端 create registry 构造初始 blob,对齐「服务端唯一权威」铁律(§5 / §6.3)。
- **文档**:本文为唯一权威设计文档(早期 v1 已废弃,不再保留)。
