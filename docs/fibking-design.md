# 《瞎掰王》(Fib King) 设计文档 —— engine registry 架构

> **状态:as-built 设计记录,随实现持续校准。** 所有「承重断言」均经真实代码核验(含 file:line),标 `✓` 为本会话亲自复核的核心事实。
> **架构定调**:engine registry(可插拔 engine);早期「平行复制」方案已弃(理由见 §2.3)。
>
> **一句话**:把 `GameRoom` 这个 Durable Object 从「焊死狼人」改造成「game-agnostic 平台壳 + 按 `gameType` 选择的可插拔游戏 engine」。瞎掰王是**第一个**正式注册的 engine;狼人原地不动;未来「你画我猜」只需再注册一个 engine,DO 与核心管线零新增方法。

---

## 0. 已确认的产品决策(权威)

- 入口:首页「创建房间」→ 模式卡(狼人 / 瞎掰王);公共 DO;玩家输房号正常 join。
- 角色每轮随机重分;计分**纯线下口头**,App 不记分、不碰 `settleGameResults`/`userStats`/XP/gacha。
- host 也是玩家,可随时重开;不显示局数。
- 大聪明(guesser)身份**公开**;老实人 / 瞎掰王身份**隐藏**,仅 reveal 时公开。
- 查看身份用**按钮**(非长按)。
- fib 调人数走 Config 屏,房内可复用 Config 改人数。
- UI:抽共享房间基础层(`src/components/room/*` 的 header/seat/bottom/status/profile/QR/shell styles + `src/components/room/hooks/*` controller hooks),狼人和 fib 分别接 adapter;fib 只保留玩法特殊 UI。
- 服务端架构:**engine registry**(本文 §3),fib 是第一个 engine,狼人保留 bespoke 方法。
- 建房:**服务端权威构造**初始状态(engine 的 `createInitialState`,客户端只 POST 最小 config),对齐「服务端唯一权威」铁律(§6.3)。

---

## 1. 游戏定义(权威,按此实现)

《瞎掰王》是「猜真释义」的吹牛派对游戏。手机只做**裁判 / 助手**,发言、提问、指认全部**线下面对面**。

- **人数**:至少 4 人,默认 8 人,无产品上限。UI 必须支持很多人玩;服务端只校验下限与座位索引合法性。
- **每轮随机分配身份**:
  - **大聪明 (Guesser) ×1** —— **身份公开**。本人看不到词与任何释义,听完所有人发言后口头指认谁是老实人。
  - **老实人 (Honest) ×1** —— 手机显示**词 + 真实释义**,讲真话(可演技装成在瞎掰)。**身份隐藏,仅 reveal 公开。**
  - **瞎掰王 (Fibber) ×其余** —— 手机只显示**词,无释义**,临场编一个像样的假释义。**身份隐藏,仅 reveal 公开。**
- **手机端职责**:① 抽生僻词 + 真释义;② 分配身份(大聪明公开 / 其余隐藏);③ 老实人 / 瞎掰王点按钮查看本人内容;④ reveal 公布真词 + 真释义 + 全部身份;⑤ 玩法说明页。
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
- **结构性隔离优于约定**:fib 不进狼人 settle 路径,不是靠「fib 永不到 Ended」的约定,而是「通用 dispatch 路径根本不含 settle 调用」的结构(§6.4)。

### 2.3 为什么不是早期的「平行复制」

早期方案(Plan C)为 fib 平行加 ~12 个 `fibXxx` DO RPC 方法 + 复制一份 `processFibAction`。它对**第二个**游戏成立,但对**第三个(你画我猜)及以后不 scale**:每加一个游戏,`GameRoom` 多 ~12 方法、`IGameRoomRPC` 累积所有签名、再复制一份 `processXxxAction` —— 增长 **O(游戏数 × 动作数)**,`GameRoom` 退化成 god object。

本版改为**参数化抽取**:DO 壳保持 game-agnostic,新增**单一 `engineAction` RPC**(Command)+ 把 `processAction` 的 reduce/normalize 抽成 **`GameEngine` 接口**(Strategy)。增长降为 **O(1) DO 壳 + O(游戏数) 个自包含 engine**。

### 2.4 反模式警戒(Rule of Three / 不过早抽象)

- **不先重构狼人**:狼人是 N=1 唯一样本、热路径、零用户价值、爆炸半径最大。Fowler 的 Rule of Three —— **第三次重复出现时再抽**。fib 是第二个真实策略,先把接口立起来验证;狼人**未来可选**迁移(§17)。
- **抽房间基础能力,不抽业务基类**:共享 header/menu/seat board/seat confirm/bottom panel 这类稳定房间能力;狼人夜晚业务、fib 身份查看等特殊流程各自 adapter。

---

## 3. 架构总览(三层:平台壳 + 注册分发 + 每游戏 engine)

```
┌──────────────────────────────────────────────────────────────┐
│  平台壳 GameRoom (game-agnostic,已存在 ~80%)                    │
│   blob+revision / #broadcast / WebSocket hibernation           │
│   getState / getRevision / cleanup                             │
│   + 新增通用:initState(engineType, blob)、engineAction(actionType, payload) │
└───────────────────────────────┬──────────────────────────────┘
                                │  按 gameType 查 ENGINE_REGISTRY (Registry)
                                ▼
        GameEngine 接口 (Strategy + Command + Factory)
        { gameType, createSchema, createInitialState,
          dispatch, reduce, normalize }
          ├─ werewolfEngine  —— 未来可选迁移(本期不做,§17);狼人现走 bespoke 方法
          ├─ fibEngine       —— 本期新增,第一个注册的 engine
          └─ drawEngine      —— 你画我猜以后只加这一行
```

- **平台壳(不动 + 极小新增)**:`room_state` 单行 JSON blob + `revision`、`#broadcast`、WebSocket hibernation、`getState`/`getRevision`/`cleanup` 已 game-agnostic(✓ 见 §4),**白拿**。仅新增 `initState` + `engineAction` 两个通用方法。
- **GameEngine(game-engine 包,纯函数、零跨游戏依赖)**:每游戏一份,`reduce`/`normalize` 是它自己的(fib 用 `normalizeFibState`,绝不碰狼人 `normalizeState`)。
- **注册表(api-worker)**:`ENGINE_REGISTRY = { fibking: fibEngine }`。加游戏 = 加一行。
- **狼人零回归**:狼人保留全部 bespoke 方法(`assignRoles`/`seat`/`submitAction`/`audioAck`/…)与 `#processAction` → `processAction`,**一行不改**。fib 只走新增 `engineAction`。两条路径同 DO 并存、互不调用,共用 `#broadcast` 与 hibernation。

> fib 房与狼人房都用同一 `GameRoom` DO 类,按 `idFromName(roomCode)` 各自独立实例。玩家 join 方式完全一致(输房号)。

### 3.1 被拒绝的备选

| 备选                                                                             | 拒绝原因                                                                                                                                            |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A. 给狼人 `GameState` 加 `gameType`,在 `gameReducer`/`normalizeState` 内分支** | 污染 `Complete<GameState>` 守卫、reducer、契约测试。engine registry **不在 `gameReducer` 内分支**,每个 engine 的 reduce/normalize 独立,故不踩此坑。 |
| **B. 把 fib 角色塞进 `ROLE_SPECS`/三层表当 preset board**                        | 违反「不得新增 `RoleId`/动三层表」;fib 无夜晚/死亡结算,语义不符。                                                                                   |
| **C. 早期的平行复制(~12 个 `fibXxx` RPC + `processFibAction`)**                  | O(游戏数 × 动作数) 增长,`GameRoom` 成 god object(§2.3)。                                                                                            |
| **D. 全新独立 DO 类 `FibRoom`**                                                  | 隔离更强,但要重写 hibernation + `#broadcast` + DO 迁移 + stub 管线,样板翻倍。保留为「更强隔离」后备。                                               |
| **E. 先把狼人重构进 registry,再做 fib**                                          | N=1 抽象易抽错;狼人热路径、零用户价值。正确顺序:fib 先验证接口(§2.4)。                                                                              |

---

## 4. 核验基线(为什么是这个形状,file:line)

> 早期分析列了 10 条乐观假设,6 条被真实代码反驳。下表是本版仍依赖的承重事实。

| #   | 事实(file:line)                                                                                                                                                                                                    | 对架构的约束                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| 1 ✓ | [gameProcessor.ts](../packages/api-worker/src/durableObjects/gameProcessor.ts) 的 `processAction` 直接 import 并调 `gameReducer` + `normalizeState` + `runInlineProgression`                                       | reduce/normalize 写死狼人 → 必须**参数化成 engine 注入**(`processEngineAction`),否则每游戏复制一份 |
| 2 ✓ | [GameRoom.ts](../packages/api-worker/src/durableObjects/GameRoom.ts) `#broadcast` / WebSocket hibernation / `getState` / `getRevision` / `cleanup` / `init` 全 game-agnostic                                       | 平台壳已存在,白拿;`init(GameState)` 类型锁死狼人 → fib 走新增通用 `initState(engineType, blob)`    |
| 3 ✓ | [GameRoom.ts](../packages/api-worker/src/durableObjects/GameRoom.ts) `#settleIfEnded` 在 `status===Ended` 时由 `audioAck` 无条件触发 settle(XP/gacha)                                                              | settle 是**狼人 bespoke 私有逻辑**;通用 dispatch 路径不含它 → fib 结构性零 settle(§6.4)            |
| 4 ✓ | [roomHandlers.ts](../packages/api-worker/src/handlers/roomHandlers.ts) `/create`:D1 insert `rooms` + `game_type`;fib 路径由 engine Factory 构造 blob 后 `stub.initState`;狼人 legacy 路径仍 `stub.init(GameState)` | 建房 = game-agnostic 房间记录 + 游戏专属初始化;`game_type` 已落库,冷启动和输房号靠它分流           |
| 5   | DO 不会在裸 `await fetch` 时 input-gate(需显式 `blockConcurrencyWhile`),否则丢更新/双开局(早期核验)                                                                                                                | 抽词(15s)**移出 DO**放到 Worker 路由;DO 的 dispatch 保持同步                                       |
| 6   | [protocol/types.ts](../packages/game-engine/src/protocol/types.ts) 模块级 `import RoleId/Team/WolfKillOverride` 传递性拖入狼人(早期核验)                                                                           | 先把 `RosterEntry`/`SideEffect` 抽到零依赖 `protocol/common.ts`,fib 只从它导入                     |
| 7   | 客户端全局单例 `GameFacade`([registry.ts](../src/services/registry.ts) / [App.tsx](../App.tsx)),route 无 gameType(早期核验)                                                                                        | 改组合根按 gameType 解析 facade;新增 `FibRoom` route;join 查 D1 gameType 路由                      |
| 8   | transport runtime(`CFRealtimeService`/`ConnectionManager`/`ConnectionFSM`)可复用;但 `ConnectionManager`/`IRoomService` 类型仍偏狼人 `GameState`                                                                    | fib 当前复用 runtime,但组合根仍有 state cast;第三个游戏前应泛型化 transport 类型                   |

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
    }
  | {
      kind: 'rejection';
      reason: string;
      actions: readonly TAction[];
      sideEffects?: readonly SideEffect[];
    }
  | { kind: 'error'; reason: string };
```

> **实现中的两处精炼(已落地)**:
>
> 1. **泛型化 action 类型 `TAction`** —— 狼人 `HandlerResult.actions` 是 `StateAction[]`(狼人专属),fib 不能复用;改用通用 `EngineResult<TAction>`,fib 携带自己的 `FibAction`。
> 2. **接口保持纯净** —— 不放 `createSchema`(zod):game-engine 零依赖,建房参数校验留在 api-worker 边界(`schemas/fib.ts`),engine 只收已校验的 `TConfig`。不放 `afterCommit`(Cloudflare `Env`):当前无 engine 使用 = dead code(YAGNI),省去后通用 dispatch 路径**根本不含 settle 概念**——这才是 fib 结构上触不到 XP/gacha 的最硬保证。

注册表 `packages/api-worker/src/durableObjects/engineRegistry.ts`:

```ts
import { fibEngine } from '@werewolf/game-engine/fibking/engine';

export const ENGINE_REGISTRY: Record<string, GameEngine<unknown, unknown>> = {
  fibking: fibEngine,
  // pictionary: drawEngine,   // ★ 你画我猜以后只加这一行,DO 与 /room/create 零改动
};
```

---

## 6. 服务端架构

### 6.1 平台壳新增的通用 RPC(对游戏数稳定)

```ts
// IGameRoomRPC 增量 —— 仅 2 个,加游戏零新增
initState(engineType: string, blob: unknown): Promise<void>;                  // 存 blob + DO storage 记 engine_type
engineAction(actionType: string, payload: unknown): Promise<GameActionResult>; // 查 registry → engine → 写 + 广播
```

> 狼人 bespoke 方法(`init`/`assignRoles`/`seat`/`submitAction`/`audioAck`/…)**一律不动**。

### 6.2 通用核心 `processEngineAction`(Template Method via 组合)

`durableObjects/processEngineAction.ts`(新),镜像现有 `processAction` 但 reduce/normalize 由 engine 注入:

```ts
function processEngineAction<S>(
  sql: DurableObjectState['storage']['sql'],
  engine: GameEngine<S, unknown>,
  dispatchFn: (state: S, revision: number) => HandlerResult,
): GameActionResult {
  // 1. 读 blob(同步)
  // 2. result = dispatchFn(state, revision)        ← engine.dispatch
  // 3. error → 不持久化;success/rejection → 逐 action 走 engine.reduce
  // 4. engine.normalize → revision+1 → 写 SQLite(同步原子)
  // 5. success/rejection 只要产生 state/revision 都由 GameRoom 广播
}
```

DO 的 `engineAction` 内部(同步,无 `await fetch`):

```
读 engine_type → engine = ENGINE_REGISTRY[engineType] (未知→fail-fast)
→ res = processEngineAction(sql, engine, (s, r) => engine.dispatch(s, r, { actionType, payload }))
→ res.success → #broadcast(复用)          ← revision 排序/丢旧(ConnectionFSM)不变
→ 通用 dispatch 路径无 settle 概念     ← fib 结构上触不到 XP/gacha
```

### 6.3 建房:通用 `/room/create`(Factory Method)

服务端权威构造,**不信任客户端整块 blob**:

```
POST /room/create { gameType, config }              // fib: config = { numberOfPlayers }
  1. engine = ENGINE_REGISTRY[gameType]              // 未知 gameType → fail-fast 400
  2. cfg = engine.createSchema.parse(config)         // zod 校验
  3. blob = engine.createInitialState(cfg, { roomCode, hostUserId, hostProfile })
  4. db.insert(rooms){ code, hostUserId, game_type: gameType }
  5. stub.initState(gameType, blob)                  // 失败 → 回滚 D1(复用 §4 #4 的回滚)
```

**狼人不动**:狼人继续走 [roomHandlers.ts](../packages/api-worker/src/handlers/roomHandlers.ts) 现有 `/create`(客户端 POST `initialState`,`stub.init`),仅多写一列 `game_type: 'werewolf'`。判别:请求带 `gameType` 且命中 registry → engine 路径;否则 → 狼人 legacy 路径。**一个端点,两条路径,狼人零行为变化。**

### 6.4 玩法动作:REST 端点 + 通用 dispatch

> REST 端点按游戏分文件(`/fib/*` 在 `fibHandlers.ts`,你画我猜以后 `/draw/*` 在 `drawHandlers.ts`)——**隔离小模块,非 god object**,做 zod 校验 + 编排,经通用 `dispatch` 落到 engine。actionType 是该游戏领域动作。

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
- **结构性零 settle**:通用 `engineAction` 路径根本不含 settle 概念,不调 `#settleIfEnded`/`audioAck`(§4 #3)。

### 6.5 抽词位置(为何在 Worker 而非 DO)

- **保密**:host 可能是大聪明;在 host 客户端抽词会被偷看 → 破坏游戏。
- **不阻塞**:DO 裸 `await fetch` 不 input-gate(§4 #5),15s 抽词进 DO 会丢更新/双开局。
- **结论**:抽词在**无状态 Worker 路由**(与 `geminiProxy` 同样 `await fetch`),抽到词后传入**同步** DO `engineAction('START_ROUND', { word, ... })`。服务端唯一权威,host 永不见词。

### 6.6 D1 迁移

- `rooms` 加 `game_type TEXT NOT NULL DEFAULT 'werewolf'`;迁移回填存量 `'werewolf'`。
- `/room/create` 写对应 `gameType`;`/room/get` 返回 `gameType` 供客户端冷启动路由(§9.3)。

### 6.7 判别与零耦合(结构性,非约定)

- **engine 判别**:`initState` 时把 `engine_type` 存进 DO storage 独立行(**不内联 blob、不碰狼人 `GameState`**)。`engineAction` 读它查 registry。客户端冷启动靠 **D1 `game_type` 列**。`FibState.gameType` 仅自描述。
- **零 settle**:见 §6.4 / §4 #3。
- **狼人零回归**:见 §3。

---

## 7. 抽词设计(结构化输出 + 多样性去重 + fallback + 内容安全)

### 7.1 调用目标

抽 `geminiProxy` 常量到 `lib/geminiConfig.ts` 共享:`GEMINI_OPENAI_BASE`、`GEMINI_MODEL`、15s 超时、Workers AI 绑定 `AI`。`generateFibWord(env, { avoid })` 在 Worker 侧直连(`geminiProxySchema` 不透传 `response_format`)。

### 7.2 结构化输出(2026)

- OpenAI 兼容层 `response_format: { type: 'json_object' }` + 强 system prompt(flash-lite 上 `json_schema` strict 仍 beta,用 json_object)。
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
2. **采样参数(次要)**:`temperature ≈ 1.0`;`frequency_penalty`/`presence_penalty ≈ 0.4` best-effort(Gemini 兼容层未必认,设了不依赖);不设固定 seed。
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

> 入座/离座/踢人/清座的**通用 CRUD** 抽成共享纯函数 kernel。实测狼人 [seatHandler.ts](../packages/game-engine/src/engine/handlers/seatHandler.ts) ~78% 通用,~22% 狼人专属(`GameStatus`、`Player.role/hasViewedRole`)。

- **新建 `packages/game-engine/src/engine/seating/`**(纯函数,零游戏依赖):
  - `types.ts`:`BaseSeat { userId; seat }`、`GamePhase { name; allowSeating }`、`GenericSeatState { seats; roster; phase; hostUserId }`。
  - `kernel.ts`:`seatJoin / seatLeave / seatKick / seatClearAll` —— `(state, …) → SeatOpResult`(占座/换座/移除/清空/校验 + game-agnostic reason codes)。
- **狼人改薄 adapter**(行为不变):`seatHandler.ts` 把 CRUD 委托 kernel,只留 `GameStatus` 守卫 + `Player` 字段 + 转回 `PLAYER_JOIN/PLAYER_LEAVE`。**不动** `gameReducer`/`normalizeState`/契约测试。
- **fib 接同一 kernel**:fibEngine 对 `'SIT'/'LEAVE'/'KICK'/'CLEAR_SEATS'` 的 handler 把 `FibState`(`phase → { allowSeating: phase==='Lobby' }`)适配成 `GenericSeatState`,调 kernel,写回 `FibState.seats`。
- **可共享 vs 必须各自**:可共享 = CRUD 逻辑 + `RosterEntry` + reason codes + UI 范式 + transport;必须各自 = REST 端点、动作分发(fib `engineAction('SIT')` 经 fibEngine vs 狼人 bespoke `seat`)、状态容器(`FibState.seats` vs `GameState.players`)。回归风险 **LOW**(纯函数 + 既有座位测试护栏)。

### 8.2 `protocol/common.ts` 前置重构

`RosterEntry`、通用 `SideEffect`/`STANDARD_SIDE_EFFECTS` 迁入新建 `packages/game-engine/src/protocol/common.ts`(零狼人依赖);`protocol/types.ts`、`engine/handlers/types.ts` 改 re-export(行为不变,grep 全 consumer 双向核对)。fib 只从 `common.ts` 导入,杜绝传递性拖入 `RoleId`(§4 #6)。

---

## 9. 客户端架构

### 9.1 平行 store / facade(复用 transport)

- **`FibStore`**(game-engine,镜像 `engine/store/GameStore.ts`):`applySnapshot` 调 `normalizeFibState`(非狼人 `normalizeState`)。
- **`FibFacade`**(`src/services/facade/FibFacade.ts`):**复用** `ConnectionManager`/`CFRealtimeService` runtime,`onStateUpdate → fibStore.applySnapshot`;当前直接用 `cfPost('/fib/*')`,未新增 `fibActions.ts`。
- **剩余改造**:`defineGameAction`/`apiUtils` 仍绑定狼人 `GameStore/GameActionsContext`;第三个游戏前应抽 `RoomActionClient<TState>` 或让 action helper 接收 `applySnapshot` adapter。

### 9.2 组合根按 gameType 解析 facade

现状单例 `GameFacade`(§4 #7)。改造:组合根提供**按 gameType 解析的 facade**经 context 注入;新增 `FibRoom` route + linking。

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

| 动作     | actionType   | 允许相位                  | 目标             | 清空                 | 保留                         | 确认弹窗                        |
| -------- | ------------ | ------------------------- | ---------------- | -------------------- | ---------------------------- | ------------------------------- |
| 下一轮   | `NEXT_ROUND` | Revealed                  | Starting→Playing | role/word/def/source | seats/roster/N/**usedWords** | 无                              |
| 重新开始 | `RESTART`    | Starting/Playing/Revealed | Lobby            | 同上 + **usedWords** | seats/roster/N               | `'重新开始?将弃掉本局回到房间'` |

### 10.6 边界

- **开局门槛**:坐满 `numberOfPlayers`(N≥4);未坐满 `开始本轮` 置灰 + hint;N≥4 保证 1 guesser + 1 honest + ≥2 fibber。
- **UPDATE_CONFIG**:仅 Lobby;新人数 < 已就座数 → fail-fast 拒绝(`'已有 X 人就座,无法减到 Y…'`),不静默截断。

### 10.7 座位 / 断线 / host 生命周期

- 座位内部 0-based,UI 1-based;`numberOfPlayers` 即固定座位数。
- 入座/离座/踢/清**仅 Lobby**;其余相位锁定。底层 CRUD 委托 §8.1 kernel。
- 扩容只改 `numberOfPlayers`,不预写空座;缩容仅高位空座可减(否则 fail-fast),不压缩重排。
- 断线:座位保留;`StatusRibbon` 显示「重连中…」;transport `getState`+`applySnapshot` 恢复;中途掉线不重分。
- host 卡 Starting:用 ghost `重新开始`(RESTART→Lobby)恢复。本期不做 host 转移。

---

## 11. 角色分配与秘密揭示

### 11.1 分配(可确定性测试)

`assignFibRoles(seats, rng)`:`shuffleArray(seats, rng)` 后取 1 guesser + 1 honest + 其余 fibber。生产用 Web Crypto `secureRng`;测试注入 `createSeededRng(seed)` → 精确 `roleBySeat`。

### 11.2 秘密揭示(公开广播 + UI 按相位/身份过滤)

`roleBySeat`/`word`/`definition` 随 `FibState` 公开广播,UI 过滤(与狼人 `seerReveal` 同范式):

| 本人角色       | Playing 期「查看身份」显示           | 他人看到           |
| -------------- | ------------------------------------ | ------------------ |
| 大聪明 guesser | "你是大聪明,看不到词,听完指认老实人" | **公开**(座位徽章) |
| 老实人 honest  | 词 + 真释义                          | 隐藏(仅「已就座」) |
| 瞎掰王 fibber  | 仅词                                 | 隐藏(仅「已就座」) |

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
| 座位单元                                        | `RoomSeatBoard` + `RoomSeatTile` 已进 shared;狼人 adapter 解析 bot role label,fib 只传状态徽章/身份公开规则                      |
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
| Revealed | `下一轮`             | `重新开始`             | `等待房主`     | —            |

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
| 移出       | `POST /fib/kick`                                                             | profile card 内 `移出`              |

### 14.3 FibIdentitySheet(纯客户端读取)

- 自建,compose theme tokens + reanimated v4(fade+scale),半透明 overlay。**不复用** 690 行 `RoleCardModal`。
- 内容全来自本机 `FibStore` 已广播的 `FibState`(`roleBySeat[mySeat]`/`word`/`definition`),**点按钮不发请求**,只开本地 Modal。故无 `viewedSeats`、无 RPC。
- 三态(accent 用 theme token,不硬编码颜色):

| 角色           | accent              | 词      | 释义                 | 提示                  |
| -------------- | ------------------- | ------- | -------------------- | --------------------- |
| 老实人 honest  | `colors.success` 😇 | ✅ 大字 | ✅ 全文              | 讲真话,但可装成在瞎掰 |
| 瞎掰王 fibber  | `colors.warning` 🤥 | ✅ 大字 | ❌(占位"临场编一个") | 编得越具体越唬人      |
| 大聪明 guesser | `colors.primary` 🔍 | ❌      | ❌                   | 听完口头指认老实人    |

底标「看完即收,别让旁人看到」(大聪明身份公开,无隐私底标)。

### 14.4 加载 / 空 / 错误态

连接中全屏「连接中…」;空 Lobby 座位全 `+`;重连中 `StatusRibbon`;出题失败 `ABORT_DRAW` 回 Lobby + `showAlert`;join 类型不符 fail-fast 回首页;normalize 失败 = bug,fail-fast + Sentry。

---

## 15. 玩法说明文案(草稿,可逐字替换)

`FibRulesScreen` 用 `GameRulesScreen` 的 `RuleItemConfig` 卡片样式。

- **一句话**:一个生僻词,只有一人知道真释义,其余人现编假释义。大聪明听完发言,指认谁讲真话(老实人)。全程线下面对面,手机当裁判。
- **流程**:① 手机抽词分身份(大聪明公开,其余隐藏);② 轮流口头给释义(老实人真话,瞎掰王现编);③ 大聪明只听不看,口头指认;④ reveal 对答案;⑤ host 随时重开。
- **三身份**:大聪明 ×1(公开,看不到词,指认老实人)/ 老实人 ×1(隐藏,词+真释义,讲真话)/ 瞎掰王 ×其余(隐藏,只词,现编假释义)。

---

## 16. File-by-file 变更清单(分级)

### P0(平台壳改造 / engine 接口 / 前置重构 / 抽词 / D1)

| 文件                                                                                                            | 变更点                                                                                                          | 风险                         |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `packages/game-engine/src/protocol/common.ts`(新)+ 改 `protocol/types.ts`、`engine/handlers/types.ts` re-export | 迁出 `RosterEntry`/`SideEffect` 到零狼人依赖模块                                                                | 中;grep 全 consumer 双向核对 |
| `packages/game-engine/src/engine/registry/types.ts`(新)                                                         | `GameEngine` 接口 + `EngineResult`(create/dispatch/reduce/normalize;泛型 TState/TAction/TConfig)                | 低;纯类型                    |
| `packages/game-engine/src/engine/seating/{types,kernel}.ts`(新)                                                 | 共享座位 CRUD kernel(§8.1)                                                                                      | 低;纯函数                    |
| 改 `engine/handlers/seatHandler.ts` → 薄 adapter                                                                | 狼人座位委托 kernel,行为不变,不动 reducer/normalize/契约                                                        | 中;既有座位测试须全绿        |
| `…/fibking/{types,buildInitialFibState,normalizeFibState,assignRoles}.ts`(新)                                   | FibState + phase 判别 normalize + 注入 RNG 分角色                                                               | 低                           |
| `…/fibking/engine.ts`(新)                                                                                       | 组装 `fibEngine`(createInitialState + dispatch 路由 + normalizeFibState + reducer);engine 纯净,无 settle 钩子   | 中;fib 动作全集              |
| `…/fibking/wordGen/{buildWordPrompt,parseWordResponse,FIB_WORD_BANK,blocklist}.ts`(新)                          | prompt/解析/zod/词库/黑名单                                                                                     | 中;需测试覆盖                |
| `packages/api-worker/src/lib/geminiConfig.ts`(新)+ 改 `geminiProxy.ts`                                          | 抽共享 gemini 常量                                                                                              | 低                           |
| `…/services/fibWordSource.ts`(新)                                                                               | `generateFibWord` 三级 fallback(Worker 侧)                                                                      | 中;可注入 mock               |
| `…/durableObjects/processEngineAction.ts`(新)                                                                   | 通用核心,reduce/normalize 由 engine 注入(同步)                                                                  | 中;不得误用狼人 normalize    |
| `…/durableObjects/engineRegistry.ts`(新)                                                                        | `ENGINE_REGISTRY = { fibking: fibEngine }`                                                                      | 低                           |
| `…/durableObjects/GameRoom.ts`                                                                                  | **仅加 `initState` + `engineAction`** 两个通用方法;不动狼人 bespoke / `init`/`#settleIfEnded`                   | 中;新增不触旧路径            |
| `…/durableObjects/IGameRoomRPC.ts`                                                                              | 加 `initState`+`engineAction` 两个签名                                                                          | 低                           |
| 改 `handlers/roomHandlers.ts` `/create` + `schemas/room.ts`                                                     | 带 `gameType` 走 engine Factory(`createSchema`/`createInitialState`/`initState`);否则狼人 legacy;写 `game_type` | 中;狼人路径须零行为变化      |
| D1 迁移 `…/db/` + `rooms` 表                                                                                    | 加 `game_type`(默认 'werewolf')+ 回填;`/room/get` 返回 gameType                                                 | 中;迁移脚本                  |

### P1(端点 / facade / store / 组合根)

| 文件                                                                        | 变更点                                                                                                                                                              | 风险                  |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `…/schemas/fib.ts`(新)+ `handlers/fibHandlers.ts`(新)+ `index.ts` 挂 `/fib` | 端点 zod + 两段式 start-round 编排(经 `engineAction`)                                                                                                               | 中                    |
| `…/fibking/handlers/*.ts`(新)                                               | sit/leave/kick/clearSeats/fillBots(委托 kernel/共享 bot 命名)、updateConfig、startRound/reveal/nextRound/restart(纯函数 + phase-guard;由 `fibEngine.dispatch` 路由) | 中                    |
| `…/fibking/store/FibStore.ts`(新)                                           | 镜像 GameStore,`applySnapshot → normalizeFibState`                                                                                                                  | 低                    |
| `src/services/facade/FibFacade.ts`(新)                                      | 复用 transport runtime;当前直接 `cfPost('/fib/*')`,后续再抽通用 action helper                                                                                       | 中                    |
| `src/services/registry.ts`、`App.tsx`、`contexts/GameFacadeContext.tsx`     | 按 gameType 解析 facade;join 路由                                                                                                                                   | 中高;狼人路径须零回归 |
| `src/navigation/types.ts`、`AppNavigator.tsx`                               | 加 `FibConfig`/`FibRoom`/`FibRules` route + linking                                                                                                                 | 低                    |

### P2(UI / 文案 / 文档 / 测试)

| 文件                                                                                         | 变更点                                                                              | 风险 |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---- |
| `src/screens/HomeScreen/` + `components/GameModePickerModal.tsx`(新)                         | 创建→模式弹窗                                                                       | 低   |
| `src/screens/FibConfigScreen/*`(新)                                                          | 人数输入 + stepper(默认 8,最少 4,无产品上限);按 `existingRoomCode` 走 create/update | 低   |
| `src/components/room/RoomSeatBoard.tsx`/`RoomSeatTile.tsx` + `src/screens/FibRoomScreen.tsx` | 共享座位板 + fib adapter;狼人 role/bot label 在狼人 adapter 解析                    | 中   |
| `src/screens/FibRoomScreen/*`(新)                                                            | Lobby/Starting/Playing/Revealed                                                     | 中   |
| `src/screens/FibRulesScreen/*`(新)                                                           | 玩法说明(§15)                                                                       | 低   |
| 各 `__tests__`                                                                               | 见 §18;Fib 多人 e2e 后续单独补                                                      | 低   |

**明确不碰**:`ROLE_SPECS/SCHEMAS/NIGHT_STEPS/RoleId`、狼人 `GameState/gameReducer/normalizeState/init/#settleIfEnded`/契约测试、`settleGameResults/userStats/XP/gacha`。

---

## 16.1 当前剩余关注点(as-built)

- **transport 类型泛型化**:`ConnectionManager`/`IRealtimeTransport`/`IRoomService` runtime 已复用,但类型仍偏 `GameState`;第三个游戏前应移除组合根里的 state cast。
- **客户端 registry**:当前是 `GameFacade` + `FibFacade` 两套 provider/route。第三个游戏前应抽 `RoomModeAdapter` 或 facade factory registry,避免继续新增 provider。
- **action helper**:`FibFacade` 直接 `cfPost('/fib/*')`;`defineGameAction`/`apiUtils` 仍绑定狼人 store context。下一步应抽 game-agnostic action caller。
- **E2E 覆盖**:已有模式选择和 Fib 单客户端入口;还需要 Fib 4 人 sit/start/reveal、输房号 join、冷启动 deep link 的多人 e2e。
- **URL 策略**:当前输房号会按 D1 `game_type` 分流;链接层仍有 `/room/:code` 与 `/fib/room/:code`。若产品要单一链接,需加 resolver screen。

---

## 17. 非目标 / 明确不做

- 不新增 `RoleId`、不动三层表与契约测试。
- 不碰狼人 `GameState`/`gameReducer`/`normalizeState`/`init`/`#settleIfEnded`/夜晚逻辑。
- **不把狼人迁进 engine registry(未来可选)**:狼人保留 bespoke RPC + `#processAction` + legacy create。待 fib + 你画我猜两个真实 engine 跑通、且重复确实造成维护痛点后,再单独评估回迁(Rule of Three;在那之前回迁是零用户价值、最大爆炸半径的重构)。
- 不接 growth/scoring;计分纯线下展示文本。
- 不做跨夜/多轮持久统计;App 不记分。

---

## 18. 测试计划

- **game-engine 单测**(注入 `createSeededRng`):`assignFibRoles`(种子→精确 roleBySeat,各档恰好 1+1+(N-2));`normalizeFibState`(phase 判别必填:Playing 缺 word 即抛);NEXT_ROUND 重置完整性;UPDATE_CONFIG(Lobby-only、缩容 fail-fast);`parseWordResponse`(围栏/非法/超长/黑名单);`FIB_WORD_BANK` 窗口耗尽重置;**seating kernel** + fib 座位 adapter。
- **去重/多样性**(注入 RNG + mock LLM):`buildWordPrompt` 每次注入不同领域/部首/nonce;硬性后置去重(连回重复词判废重试≤2 再降级);`pickFallbackWord` 不出重复、耗尽重置;断言不设固定 seed。
- **worker/DO**(mock `generateFibWord`):`createInitialState` 服务端权威构造;start-round 两段式;双击被 `'BEGIN_DRAW'` 守卫挡;`engineAction` 与狼人 bespoke 隔离、**未知 gameType/actionType fail-fast**;**fibEngine 不触达 `#settleIfEnded`**(spy);抽词来源矩阵。
- **回归(证零污染)**:狼人 `test:all` 全绿;**「fib 全生命周期 0 次 `settleGameResults`」断言**(spy env);狼人契约测试不受 `common.ts` 重构影响;`/room/create` 狼人 legacy 路径行为不变;狼人座位回归(adapter 后 sit/leave/kick/clear 不变)。
- **冷启动/深链**:join fib 房号 → 查 D1 gameType → 路由 `FibRoom`;拿错 mode fail-fast。
- **e2e(后续)**:模式卡建房 → 选人数 → 坐满 → 开始本轮 → 各座查看身份校验过滤 → 公布 → 下一轮。
- **收口**:本轮以 `pnpm run quality` 为完成条件;Fib 多人 e2e 后续独立补。

---

## 19. 库验证(2026)

- **Gemini 结构化输出**:OpenAI 兼容层支持 `response_format`;flash-lite 上 `json_schema` strict 仍 beta → `{type:'json_object'}` + 强 prompt + 健壮解析。
- **Zod 4**:`z.email()` 等顶层校验器;`z.string().min(1)` 取代已移除的 `.nonempty()`;`safeParse` 返回 discriminated union。
- **Expo / RN / React 19**:查看身份用 `Pressable` + Modal;动画 `react-native-reanimated` v4。实现阶段对具体 API 再按文档核对。

---

## 20. 开放问题(等确认)

1. 玩法文案:用 §15 草稿,还是贴原文替换?
2. 实现顺序:确认按 P0 → P1 → P2 一次性端到端交付。

---

## 21. 已定决策(本轮确认)

- **`createInitialState` 服务端权威构造**:采纳。客户端只 POST 最小 config(`{ numberOfPlayers }`),服务端 engine 构造初始 blob,对齐「服务端唯一权威」铁律(§5 / §6.3)。
- **文档**:本文为唯一权威设计文档(早期 v1 已废弃,不再保留)。
