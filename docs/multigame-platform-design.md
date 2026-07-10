# 多游戏平台架构设计

> 状态：目标架构提案  
> 基线：`main`，commit `caf6d25b`  
> 已核对的参考实现：`feat/fibking-engine-registry`，commit `fd6d4a96`  
> 最后更新：2026-07-10  
> 范围：game-engine、API Worker、Durable Object、客户端服务、导航、共享房间 UI、瞎掰王及未来游戏

## 1. 文档目的

这个仓库最初只服务狼人杀。因此在 `main` 中，很多狼人杀实现使用了看似通用的名字，例如 `GameState`、`GameStore`、`GameFacadeContext`、`GameRoom` 和 `engine/`。加入瞎掰王后可以确认：这些名字大多不是多游戏抽象，而是狼人杀业务实现。

本文定义把仓库改造成多游戏平台的最终目标。目标不是为每个游戏复制一套房间、连接、座位和 UI，而是明确区分：

1. 所有游戏真正共用的平台能力。
2. 每个游戏独立拥有的规则和界面。
3. 在 Worker、客户端和 engine 三个运行环境中如何完成类型安全的组合。

本文是后续重构的权威设计文档，描述的是目标状态，不表示 `main` 已经实现这些结构。

目标必须支持：

- 狼人杀现有行为零回归。
- 瞎掰王默认 8 人、最少 4 人、没有人为设置的产品人数上限。
- 以后加入你画我猜时，不再复制房间连接、座位、分享、用户卡片、header 或机器人接管代码。
- 只有一条服务端权威的命令执行路径。
- 所有游戏的房间第一眼都保持狼人杀现有房间的布局、位置和交互语言。

## 2. 最终决策

目标架构分成三层：

1. **Platform 层**：拥有游戏无关的执行管线、房间持久化、连接、通用座位协议和共享房间 UI。
2. **Game module 层**：每个游戏拥有自己的状态、命令、事件、规则、effect、UI adapter 和特殊页面。
3. **Composition catalog 层**：在每个运行环境中把游戏 module 组合起来。每个运行环境只有一个穷尽式 catalog，不再分别维护 create registry、engine registry、effect registry、navigation registry 和 display registry。

实现应从 `main` 新建分支开始。`feat/fibking-engine-registry` 只作为需求和实验参考，不应整批 merge 或按 commit 直接 cherry-pick。原因是这个 branch 的部分 commit 同时混合了目录移动、engine contract、UI 重写、E2E 修改和兼容决策，无法独立证明行为安全。

可以迁移 branch 中经过验证的代码，但迁移文件不等于保留它现在的 API 和目录位置。

## 3. 当前基线与 branch 结论

### 3.1 `main` 当前事实

基线 commit 中：

- `packages/game-engine/src/engine/`、`models/`、`resolvers/` 和 `protocol/types.ts` 实际上都是狼人杀业务代码。
- `packages/api-worker/src/durableObjects/GameRoom.ts` 直接 import 狼人杀 handler，并暴露狼人杀专用 RPC。
- `packages/api-worker/src/durableObjects/gameProcessor.ts` 固定依赖 `GameState`、`gameReducer` 和 `normalizeState`。
- `src/contexts/GameFacadeContext.tsx` 只注入一个狼人杀 facade。
- `src/screens/RoomScreen/` 同时负责房间基础壳和狼人杀交互规则。
- Home 的建房流程和房间 deep link 默认全是狼人杀。

这套结构在单游戏时期是自洽的。它应该作为狼人杀行为基线，而不是直接当作多游戏抽象。

### 3.2 branch 中应该保留的方向

以下方向正确，目标实现应重新落地：

- 使用显式、稳定的游戏 ID：`werewolf`、`fibking`。
- 每个游戏有独立的纯 engine strategy。
- 狼人杀和瞎掰王拥有独立 state machine。
- 座位不变量由纯共享 seating kernel 处理。
- 初始游戏状态由服务端创建。
- 共享房间视觉组件：header actions、status ribbon、seat tile/board、player profile、QR 分享、bot control banner、seat confirmation、bottom action panel。
- 游戏 adapter 只负责本游戏的摘要、身份、规则、配置和特殊操作。
- 从用户卡片直接移出座位，不再弹第二个确认窗。
- 入座、换座和本人离座仍使用确认弹窗。

### 3.3 branch 中必须废弃的方向

目标架构不得保留：

- 对外暴露 `Record<string, GameEngine<unknown, unknown, unknown>>`。
- engine、建房、effect 三套可以互相漏注册的 registry。
- `initState(gameType: string, blob: unknown)` 这种 RPC。
- SQL state 之外再单独存一个 KV `game_type`。
- shared room 反向 import 狼人杀 `GameStatus`。
- 先把瞎掰王 phase 映射成狼人杀 status，再让 shared UI 工作。
- 一个接收大量 callback、copy、selector 的巨大通用 hook，同时仍泄漏狼人杀类型。
- 瞎掰王叫 `sit`、狼人杀叫 `takeSeat` 之类的平行 API。
- 名义上使用虚拟列表，但渲染前先 `Array.from({ length: N })` 生成全部座位 view model。
- 瞎掰王按总人数存全部 bot 和全部 role map。
- `BEGIN_DRAW -> 外部 LLM -> START_ROUND` 的两段请求，使 Worker 中断后房间永久卡在 `Starting`。
- game type 缺失或未知时默认进入狼人杀。
- 以 compatibility、legacy、adapter 名义无限期保留旧架构。

## 4. 设计目标

### 4.1 架构目标

- 新增游戏时不修改 Durable Object action pipeline。
- 新增游戏时不修改 `HomeScreen`、`RoomShell` 或共享房间 controller。
- 漏注册游戏应尽量在编译期失败。
- 持久化损坏、未知游戏 ID、schema 不一致、state version 不一致必须 fail fast。
- `unknown` 只允许存在于外部输入解析边界，不得穿过 engine 或 UI API。
- 相同基础行为只实现一次，不同游戏规则保持独立。
- 目录按所有权划分，不按历史形成过程划分。

### 4.2 产品目标

- 首页点击创建房间后，使用现有 centered modal 视觉选择游戏模式。
- 狼人杀和瞎掰王使用同一套 header 几何、seat board、status ribbon、profile、分享和 bottom panel。
- 房间配置只在本游戏允许配置的阶段出现。
- 基础房间操作位置和文案一致。
- 瞎掰王可以手动填充机器人，房主可以接管 bot 进行手动测试。
- 大聪明能看见词，但看不见真释义。
- 下一轮保留座位。

### 4.3 质量目标

- 狼人杀现有 unit、integration 和 E2E 是迁移基线。
- 文件或 hook 移动时，测试随行为迁移，不能因为重构就删除覆盖。
- E2E helper 必须表达真实 UI 操作，不能通过自动关 alert、forced click 或泛化 retry 绕过产品回归。
- 每个迁移阶段都能单独验证、单独 review。

## 5. 非目标

- 不引入防作弊私有状态架构，继续采用同桌面杀的信任模型。
- 不加入 P2P 消息。
- 不扩展狼人杀跨夜规则。
- 不建立包含所有游戏 phase 和 action 的共享基类。
- 不从远程动态加载游戏代码，游戏在 build 时静态注册。
- 不尝试用任意 JSON 自动生成所有游戏 UI。
- 不无限期兼容旧 route、context、package export 或旧房间 state。

## 6. 不可违反的不变量

1. Worker 和 Durable Object 是游戏状态转换的唯一权威。
2. 房主仍是玩家，只多操作权限，不是另一套权威。
3. 一个房间只有一个持久化游戏状态作为事实来源。
4. 房间初始化后，`gameType` 永远不变。
5. 命令只能交给持久化 `gameType` 对应的 module 解释。
6. 被拒绝的命令不修改状态。
7. 每次提交成功的状态变化只增加一次 revision。
8. 先持久化，再广播。
9. post-commit effect 失败不能让已经提交的命令对调用方表现成“没有提交”。
10. shared platform 不 import 具体游戏 module。
11. 游戏 module 之间不能互相 import。
12. 客户端遇到未知游戏类型时不得默认狼人杀。
13. 必填状态直接读取；只有类型确实允许缺失时才使用 optional access。

## 7. 目标目录树

物理目录可以继续叫 `packages/game-engine` 和 `packages/api-worker`。workspace package scope 最终应从 `@werewolf/*` 一次性改为中性名称，例如 `@game-judge/*`。改名完成后不保留 alias。

```text
packages/
├── game-engine/
│   └── src/
│       ├── platform/
│       │   ├── engine/
│       │   │   ├── types.ts
│       │   │   ├── decision.ts
│       │   │   └── catalog.ts
│       │   ├── protocol/
│       │   │   ├── gameTypes.ts
│       │   │   ├── roomSnapshot.ts
│       │   │   ├── commands.ts
│       │   │   └── reasons.ts
│       │   ├── room/
│       │   │   ├── lifecycle.ts
│       │   │   ├── roster.ts
│       │   │   └── seating/
│       │   │       ├── kernel.ts
│       │   │       └── types.ts
│       │   └── store/
│       │       ├── SnapshotStore.ts
│       │       └── types.ts
│       ├── games/
│       │   ├── werewolf/
│       │   │   ├── commands/
│       │   │   ├── state/
│       │   │   │   ├── codec.ts
│       │   │   │   └── version.ts
│       │   │   ├── domain/
│       │   │   │   ├── handlers/
│       │   │   │   ├── models/
│       │   │   │   ├── reducer/
│       │   │   │   ├── resolvers/
│       │   │   │   └── state/
│       │   │   ├── engine.ts
│       │   │   └── public.ts
│       │   └── fibking/
│       │       ├── commands/
│       │       ├── domain/
│       │       │   ├── roles.ts
│       │       │   ├── reducer.ts
│       │       │   ├── state.ts
│       │       │   └── wordHistory.ts
│       │       ├── engine.ts
│       │       └── public.ts
│       ├── product/
│       │   ├── growth/
│       │   └── rewards/
│       └── index.ts
│
├── api-worker/
│   └── src/
│       ├── platform/
│       │   ├── room/
│       │   │   ├── GameRoom.ts
│       │   │   ├── IGameRoomRPC.ts
│       │   │   ├── actionPipeline.ts
│       │   │   ├── roomCreationSaga.ts
│       │   │   ├── roomRepository.ts
│       │   │   └── effectOutbox.ts
│       │   ├── http/
│       │   │   ├── roomRoutes.ts
│       │   │   └── commandRoute.ts
│       │   └── realtime/
│       │       ├── webSocketAttachment.ts
│       │       └── messages.ts
│       ├── games/
│       │   ├── werewolf/
│       │   │   ├── module.ts
│       │   │   ├── schemas.ts
│       │   │   └── effects.ts
│       │   ├── fibking/
│       │   │   ├── module.ts
│       │   │   ├── schemas.ts
│       │   │   ├── effects.ts
│       │   │   └── wordProviders/
│       │   │       ├── types.ts
│       │   │       ├── gemini.ts
│       │   │       ├── workersAI.ts
│       │   │       └── localBank.ts
│       │   └── catalog.ts
│       ├── growth/
│       ├── db/
│       └── index.ts
│
src/
├── features/
│   └── room/
│       ├── components/
│       │   ├── RoomShell.tsx
│       │   ├── RoomHeaderActions.tsx
│       │   ├── RoomStatusRibbon.tsx
│       │   ├── RoomSeatBoard.tsx
│       │   ├── RoomSeatTile.tsx
│       │   ├── RoomBottomActionPanel.tsx
│       │   ├── PlayerProfileCard.tsx
│       │   ├── RoomSeatConfirmModal.tsx
│       │   ├── ControlledSeatBanner.tsx
│       │   └── QRCodeModal.tsx
│       ├── controllers/
│       │   ├── useRoomConnection.ts
│       │   ├── useRoomSeatController.ts
│       │   ├── useRoomProfileController.ts
│       │   ├── useRoomShareController.ts
│       │   └── useRoomBotControl.ts
│       ├── model/
│       │   ├── RoomUiAdapter.ts
│       │   ├── RoomCapabilities.ts
│       │   ├── RoomSeatDataSource.ts
│       │   └── RoomShellModel.ts
│       ├── services/
│       │   ├── RoomSession.ts
│       │   └── roomCommandClient.ts
│       └── screens/
│           ├── GameRoomHostScreen.tsx
│           ├── GameConfigHostScreen.tsx
│           ├── GameRulesHostScreen.tsx
│           └── RoomResolverScreen.tsx
├── games/
│   ├── werewolf/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── werewolfRoomAdapter.ts
│   │   └── module.ts
│   ├── fibking/
│   │   ├── components/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── fibRoomAdapter.ts
│   │   └── module.ts
│   └── catalog.ts
├── screens/                 # 只放非游戏页面
├── services/                # auth、transport、settings、stats、storage
├── components/              # 产品级组件，不放 room/game 业务
└── navigation/
```

### 7.1 所有权规则

- `platform/` 不得 import `games/`。
- `games/werewolf/` 和 `games/fibking/` 可以 import `platform/`，但不能互相 import。
- Worker game module 只 import 对应游戏的 game-engine public API。
- `src/features/room/` 不得 import `src/games/*` 或 game-engine 的具体游戏路径。
- `src/games/*` 可以 compose room feature 和产品级组件。
- growth/rewards 属于产品能力，不属于某个游戏规则。狼人杀通过自己的 Worker effect module 选择使用它们。
- 角色翻牌动画是客户端 cosmetic。如果服务端规则不依赖它，就不应放进 generic engine protocol。狼人杀专用 reveal 组件放在 `src/games/werewolf/components/`。

## 8. 唯一游戏身份

协议层只有一个有效游戏 ID 来源：

```ts
export const GAME_TYPES = ['werewolf', 'fibking'] as const;
export type GameType = (typeof GAME_TYPES)[number];
```

规则：

- trusted code 内部的 `gameType` 不是 `string`。
- 外部 string 只解析一次，成功后才成为 `GameType`。
- 从 D1 和 DO 读取的值也要验证。
- 新增游戏时，`GAME_TYPES`、state codec、engine 和各运行环境 catalog 必须在同一个
  vertical-slice change 中原子注册。开发中的编译错误用来提示漏项，但主干不允许出现只有 ID、
  没有实现的占位游戏类型。
- 在瞎掰王 vertical slice 合入前，`GAME_TYPES` 只包含 `werewolf`；最终状态才包含
  `werewolf` 和 `fibking`。
- create、join、deep link、state parse 和 command dispatch 都没有默认游戏类型。

## 9. 纯 Game Engine contract

### 9.1 Contract

每个游戏定义自己的 state、config、command union 和 event union：

```ts
interface BaseGameState<TGameType extends GameType> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
  readonly roomCode: string;
  readonly hostUserId: string;
}

type CommandContext =
  | {
      readonly actor: { readonly kind: 'user'; readonly userId: string };
      readonly controlledSeat: number | null;
      readonly nowMs: number;
      readonly commandId: string;
      readonly randomSeed: string;
    }
  | {
      readonly actor: { readonly kind: 'system'; readonly effectId: string };
      readonly controlledSeat: null;
      readonly nowMs: number;
      readonly commandId: string;
      readonly randomSeed: string;
    };

type Decision<TEvent, TEffect> =
  | {
      readonly kind: 'commit';
      readonly events: readonly TEvent[];
      readonly effects: readonly TEffect[];
      readonly broadcast: 'state' | 'none';
      readonly outcome:
        | { readonly kind: 'success'; readonly reason?: string }
        | { readonly kind: 'domainRejected'; readonly reason: string };
    }
  | {
      readonly kind: 'reject';
      readonly reason: string;
    };

interface GameEngineDefinition<
  TGameType extends GameType,
  TState extends BaseGameState<TGameType>,
  TConfig,
  TCommand,
  TEvent,
  TEffect,
> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
  createInitialState(config: TConfig, context: CreateGameContext): TState;
  decide(state: TState, command: TCommand, context: CommandContext): Decision<TEvent, TEffect>;
  evolve(state: TState, event: TEvent): TState;
  normalize(state: TState): TState;
  getLifecycle(state: TState): CommonGameLifecycle;
}
```

`decide` 和 `evolve` 用来明确责任，不表示要引入 event sourcing。这里的 event 就是现有 reducer action 的类型安全内部状态转换，不新增 append-only event log。

### 9.2 Engine 规则

- `createInitialState`、`decide`、`evolve`、`normalize`、`getLifecycle` 都是纯函数。
- Engine 不 import Cloudflare binding、Zod、React、navigation、logger、Sentry 或 HTTP client。
- Engine 不接收 `unknown` payload。
- Engine 使用权威 state 和 `CommandContext` 校验 host 及 actor 权限。
- Engine 不信任客户端传入的 actor seat。
- `randomSeed` 由 Worker 在首次执行 command 时用安全随机源生成，不接受客户端值；纯 engine 从该 seed
  派生确定性 RNG。`commandId` 只负责幂等，不能兼任随机源。
- `commit` 表示命令已被权威 engine 接受并进入 command receipt/effect transaction；幂等 no-op 可以是
  零 event，只有 state event 时才增加 state revision。
- `commit + domainRejected` 是明确的 domain transition：例如写入只对目标玩家可见的
  `actionRejected` event。它会提交 event，但 command response 仍携带稳定的业务拒绝 reason。
- `reject` 表示权限、phase 或参数前置条件失败；它没有 event/effect，不写 command receipt 的成功结果，
  不增加 revision。
- 不允许用 `reject` 表示已经修改状态的命令，也不允许 Worker 在 engine 返回后补写 rejection state。
- 所有 event evolve 完成后统一执行 `normalize`，发现损坏直接抛错。
- State version 显式存在；不支持的版本直接失败或走正式 migration，不猜默认值。

### 9.3 Runtime state codec

网络 JSON 和 SQLite JSON 都是 `unknown`，不能通过类型断言直接变成游戏 state。每个游戏必须提供
一个版本化 codec：

```ts
interface GameStateCodec<TState extends BaseGameState<GameType>> {
  readonly gameType: TState['gameType'];
  readonly stateVersion: number;
  parse(value: unknown): TState;
}
```

规则：

- codec 属于对应游戏模块，狼人杀和瞎掰王各自理解自己的 state shape。
- HTTP snapshot、WebSocket update 和 DO SQLite 读取调用同一个 codec；不能各写一套浅校验。
- shared protocol parser 只校验 envelope、revision 和 discriminator，然后调用 codec。
- codec 拒绝未知字段、缺失 required field、非法 enum、错误 game type 和不支持的 state version。
- codec 可以调用该游戏的 normalize，但 normalize 只接收已经解码的 typed state；不能用
  `as GameState` 把 `unknown` 塞进去。
- `GameEngineDefinition.decide/evolve/normalize` 仍不接收 `unknown`。codec 是进入纯 engine 前的
  protocol boundary，不把 runtime parsing 混进规则函数。

### 9.4 跨游戏 lifecycle

平台为了 analytics 和通用退出行为，可以使用一个粗粒度 lifecycle：

```ts
type CommonGameLifecycle = 'setup' | 'ongoing' | 'ended';
```

它由 `getLifecycle` 派生，不和 game phase 一起重复存储。游戏自己的 phase 仍是权威。

| 游戏   | Domain phase/status                       | 派生 lifecycle |
| ------ | ----------------------------------------- | -------------- |
| 狼人杀 | `Unseated`、`Seated`、`Assigned`、`Ready` | `setup`        |
| 狼人杀 | `Ongoing`                                 | `ongoing`      |
| 狼人杀 | `Ended`                                   | `ended`        |
| 瞎掰王 | `lobby`                                   | `setup`        |
| 瞎掰王 | `preparing`、`ongoing`                    | `ongoing`      |
| 瞎掰王 | `ended`                                   | `ended`        |

Shared UI 不通过这个 lifecycle 猜全部操作权限，而是直接消费 game UI adapter 给出的 capabilities。

## 10. 统一基础房间命令

含义相同的命令在所有游戏中使用同一个协议名字：

```ts
type RoomSeatCommand<TProfile> =
  | { type: 'room.seat.take'; seat: number; profile: TProfile }
  | { type: 'room.seat.leave' }
  | { type: 'room.seat.kick'; seat: number }
  | { type: 'room.seat.clear' }
  | { type: 'room.seat.fillBots' };
```

协议边界不再出现：

- `sit` 对 `takeSeat`
- `kick` 对 `kickPlayer`
- `clearSeats` 对 `clearAllSeats`
- `fillBots` 对 `fillWithBots`

每个 engine 的 command union 包含这组共享命令，并把座位不变量委托给 seating kernel。游戏仍需要一个很薄的 adapter，原因是：

- 狼人杀和瞎掰王 state shape 不同。
- 允许操作的 phase 不同。
- bot representation 可以不同。
- reducer event 不同。
- 用户文案属于 game/client 层。

这个 adapter 不是平行实现。各游戏重新实现找座位、换座、座位占用检查、actor 检查才是平行实现，必须禁止。

## 11. Runtime catalogs

### 11.1 为什么仍然需要多个 catalog

game-engine、Worker 和客户端依赖不同。Zod 和 Cloudflare effect 不应进入纯 engine；React component 也不应进入 Worker。因此目标是每个运行环境一个穷尽式 catalog，而不是整个 monorepo 强行放一个包含所有依赖的对象。

它们不是多套事实来源：

- `GAME_TYPES` 是合法 ID 的唯一来源。
- engine catalog 提供纯 engine definition。
- Worker catalog 为每个 engine 补充 runtime schema 和 effect handler。
- client catalog 为每个游戏补充 UI 和 navigation metadata。
- state codec 由游戏模块提供，Worker persistence、HTTP client 和 realtime client 引用同一个实例。

同一个运行环境内部不再分别维护 create、dispatch、effect 和 display registry。

### 11.2 Engine catalog

```ts
export const GAME_ENGINE_CATALOG = defineGameEngineCatalog({
  werewolf: werewolfEngine,
  fibking: fibEngine,
} satisfies Record<GameType, AnyGameEngineDefinition>);
```

如果异构 module 按 runtime ID 选择时必须做 type erasure，它只能隐藏在 `defineGameEngineCatalog` 内部。具体 module 始终保持完整类型，不能把 `GameEngine<unknown, unknown, unknown>` 当成应用层常规 contract 对外暴露。

### 11.3 Worker module

```ts
interface WorkerGameModule<TEngine extends AnyGameEngineDefinition> {
  readonly gameType: TEngine['gameType'];
  readonly engine: TEngine;
  readonly stateCodec: GameStateCodec<StateOf<TEngine>>;
  readonly createConfigSchema: ZodType<ConfigOf<TEngine>>;
  readonly commandSchema: ZodType<CommandOf<TEngine>>;
  readonly effectHandlers: EffectHandlerMap<EffectOf<TEngine>>;
}
```

`defineWorkerGameModule` 在编译期绑定 schema output 和 engine input，避免 command schema 产出的 shape 与 engine command union 静默分叉。

```ts
export const WORKER_GAME_CATALOG = defineWorkerGameCatalog({
  werewolf: werewolfWorkerModule,
  fibking: fibWorkerModule,
} satisfies Record<GameType, AnyWorkerGameModule>);
```

### 11.4 Client module

```ts
interface GameUiModule<TState extends BaseGameState<GameType>> {
  readonly gameType: TState['gameType'];
  readonly stateCodec: GameStateCodec<TState>;
  readonly displayName: string;
  readonly iconName: IconName;
  readonly createConfig: React.ComponentType<GameConfigProps>;
  readonly roomContent: React.ComponentType<GameRoomContentProps<TState>>;
  readonly rules: React.ComponentType<GameRulesProps>;
  readonly createRoomAdapter: (session: RoomSession<TState>) => RoomUiAdapter<TState>;
}
```

首页 mode option、generic host screen 和 room resolver 都从这个 catalog 生成。未知 ID 显示明确错误并上报 telemetry，绝不导航到狼人杀。

## 12. Durable Object 持久化

### 12.1 一个原子 room row

DO 在同一个 SQLite row 存 routing 和 state：

```sql
CREATE TABLE room_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  game_type TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  game_state TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

不再使用 `storage.put('game_type', ...)`。engine selection、state、state version 和 revision 来自同一次读取、同一个 transaction。

### 12.2 初始化

公开 RPC 接收 initialization command，不接收已经构造好的 blob：

```ts
interface InitializeRoomCommand {
  readonly roomCode: string;
  readonly gameType: GameType;
  readonly hostUserId: string;
  readonly config: unknown;
  readonly creationId: string;
}
```

`config` 在这里仍属于外部数据。DO 的流程是：

1. 从 Worker game catalog 解析 module。
2. 使用该 module 的 schema 解析 config。
3. 调用 typed engine 创建初始 state。
4. 执行 normalize。
5. 验证 `state.gameType` 与命令完全一致。
6. 写入完整 SQL row。

初始化规则：

- 使用 `INSERT`，禁止 `INSERT OR REPLACE`。
- 相同 `creationId` 的重复调用是 idempotent，返回同一结果。
- 已初始化的 DO 收到不同 room metadata 或 game type 时直接 conflict。
- 未知 game type 在任何写入前失败。
- state 和 game type 不能分开写入。

### 12.3 State read

每次读取 state 都验证：

- SQL row shape。
- `game_type` 是合法 `GameType`。
- `state_version` 等于 engine 当前版本，或者存在显式 migration。
- JSON state 内的 `gameType` 和 SQL column 一致。
- engine `normalize` 接受该 state。

这些检查位于权威边界，发现损坏就报错，不用 optional field 或默认值掩盖。

## 13. 通用 Command pipeline

### 13.1 HTTP endpoint

所有游戏和基础房间命令走一个 endpoint：

```http
POST /room/command
```

```json
{
  "roomCode": "4722",
  "commandId": "client-generated-uuid",
  "command": {
    "type": "room.seat.take",
    "seat": 0,
    "profile": {}
  },
  "controlledSeat": null
}
```

Dispatch 时客户端不发送 `gameType`。DO 从不可变的持久化 room row 读取 game type，防止客户端为已有房间选择另一套 parser 或 engine。

### 13.2 Pipeline 顺序

1. 认证请求，获得真实 `actorUserId`。
2. 解析通用 command envelope。
3. 按 room code 获取 DO。
4. 读取原子 room row。
5. 按持久化 `game_type` 解析 Worker game module。
6. 使用 module 的 runtime schema 解析 command。
7. 检查 `commandId` 是否已经完成。
8. 首次执行时生成并持久化 server `randomSeed`，调用 typed engine `decide`，传入 actor context。
9. `reject` decision 不写入。
10. 在内存中 evolve 全部 event。
11. normalize 新 state。
12. 在一个 SQLite transaction 中更新 state/revision、保存 command receipt、写入 effect outbox。
13. decision 要求广播时，广播已提交 state。
14. 返回 committed revision 和 domain result。
15. effect 独立 drain，不能改变已提交命令的返回语义。

### 13.3 Idempotency

HTTP retry 和连接恢复可能重复发送 command。`commandId` 是结构性方案，不是客户端用时间戳 debounce 的补丁。

```sql
CREATE TABLE command_receipts (
  command_id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  random_seed TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

相同 ID 返回存储结果，新 ID 才按当前 state 执行。旧 receipt 使用确定的 bounded policy 清理。

### 13.4 Result model

公共 HTTP 边界只返回一个由 platform protocol 编解码的结果 envelope：

```ts
type RoomCommandResult<TState> =
  | {
      success: true;
      snapshot: RoomSnapshot<TState>;
      reason?: string;
    }
  | {
      success: false;
      reason: string;
    };
```

- 成功结果必须携带 committed snapshot；零 event 的幂等命令返回当前 revision 的 snapshot。
- `sideEffects`、event、outbox row 和 engine decision 都是 Worker/DO 内部数据，禁止序列化到公共 HTTP 响应。
- Worker encoder 和客户端 decoder 必须引用 `platform/protocol/commandResult.ts` 的同一个 contract。
- 客户端在应用 snapshot 后只把 domain outcome 交给 UI，UI 不读取 transport metadata。
- 未知字段、缺失 snapshot、非法 state 或 revision 都是协议错误，直接 fail fast，不改写成 domain rejection。

预期业务拒绝返回稳定 reason code：

- `room.not_initialized`
- `room.game_type_mismatch`
- `room.seat.taken`
- `room.seat.invalid`
- `room.seat.locked`
- `room.host_required`
- `fib.round.not_full`
- `fib.round.already_ongoing`

持久化损坏、未注册 module、非法 persisted JSON、unsupported state version 直接抛错并上报 Sentry，不在 domain 层转换成笼统的“请稍后重试”。

## 14. 权限模型

HTTP middleware 负责认证身份，engine 负责授权游戏命令。

Worker 不能只在 D1 判断 host，然后用 `state.hostUserId` 代替真实调用者调用 engine。DO 必须传入
discriminated principal：

```ts
type CommandActor = { kind: 'user'; userId: string } | { kind: 'system'; effectId: string };
```

规则：

- Host-only command 使用 authoritative `state.hostUserId` 对比 user actor 的 `userId`。
- 普通玩家使用 state 中与自己 user ID 绑定的 seat 行动。
- 只有游戏允许 bot control、调用者是 host、目标当前确实是 bot 时，才接受 `controlledSeat`。
- 接管真人 seat 直接失败。
- `controlledSeat` 只改变有效 actor seat，不改变 user identity 和 host ownership。
- System actor 只允许执行 engine 明确定义的 internal command，并且 `controlledSeat` 在类型上固定为 null；
  public HTTP command schema 不包含 internal command。
- D1 的 `rooms.host_user_id` 是目录 metadata，可以用于列表，不是 command authority。

## 15. D1 Room Directory 与建房 Saga

D1 和 DO 不能共享 transaction。因此建房必须使用显式 saga，不能宣称 catch 中删一次 D1 就实现了跨存储原子性。

### 15.1 D1 status

```ts
type RoomDirectoryStatus = 'creating' | 'active' | 'deleting' | 'failed';
```

D1 room row 保存 `game_type`、`host_user_id`、`creation_id` 和 status。

### 15.2 Create flow

1. 解析显式 `gameType` 和通用 create envelope。
2. 以 `creating` 状态插入唯一 room code 和 `creationId`。
3. 使用相同 `creationId` 调用 DO `initializeRoom`。
4. DO 成功后把 D1 标记为 `active`。
5. 正常 get/join 只返回 active room。
6. 请求 retry 时按 `creationId` 恢复，不创建第二个房间。
7. Scheduled reconciliation 处理长时间停留在 `creating`、`deleting`、`failed` 的 row。

这是一条可以向前恢复的 workflow，不依赖一次 catch rollback。

### 15.3 Delete flow

1. 根据 authoritative room state 验证 host。
2. D1 标记 `deleting`。
3. Idempotent 清理 DO storage。
4. 删除或 tombstone D1 row。
5. Reconciliation 重试未完成删除。

Cleanup 失败必须记录 room code 和 creation ID。不能吞掉异常后只写“cron 会处理”，除非对应 reconciliation 已实现并有测试。

## 16. Realtime protocol

WebSocket state message 必须带 game discriminator：

```ts
interface StateUpdateMessage<TState> {
  readonly type: 'STATE_UPDATE';
  readonly gameType: TState['gameType'];
  readonly stateVersion: number;
  readonly revision: number;
  readonly state: TState;
  readonly lastCommandType: string | null;
}
```

客户端规则：

- Game session 只接受预期 game type。
- Revision 只能单调增加。
- Game type 不同、revision 倒退、state version 不支持都属于明确 connection failure。
- Reconnect 获取的 snapshot envelope 与 WebSocket update 使用同一 contract。
- 不创建每个游戏独立的 realtime transport。

## 17. Effect 与 transactional outbox

### 17.1 Platform 行为与 domain effect

持久化和正常 state broadcast 属于 platform pipeline，不需要 engine 发出假的 `PERSIST_STATE` effect。

Domain effect 包括：

- 狼人杀 growth settlement。
- 不能合理表示在 state 中的狼人杀 audio delivery metadata。
- 瞎掰王词语生成。
- Analytics event。

### 17.2 Transactional outbox

Accepted decision 在写 state/revision 的同一个 SQL transaction 中写 effect intent：

```sql
CREATE TABLE effect_outbox (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  available_at INTEGER NOT NULL,
  created_revision INTEGER NOT NULL
);
```

Effect 以 outbox ID 和 game-specific business key 保证 idempotent。Alarm handler 是 generic scheduler，按持久化 game type 调用 module effect handler。

一个 DO 只有一个 alarm，因此 settlement 和 word generation 都通过同一个 outbox scheduler，不再各自维护不相关的 alarm key 和 retry loop。

### 17.3 Commit 语义

- State 一旦 commit，effect delivery 失败也不能把 command response 改成失败。
- Effect 失败记录 attempt 并安排 retry。
- Retry 用尽后保留 failed outbox row 和 telemetry，不静默删除。
- Effect handler 可以发送 internal idempotent command，但不能绕过 command pipeline 直接改 state。

## 18. 瞎掰王出题 workflow

瞎掰王 start flow 必须能从 Worker 中断中恢复。

### 18.1 State

```ts
type FibPhase = 'lobby' | 'preparing' | 'ongoing' | 'ended';

interface PendingFibRound {
  readonly roundId: string;
  readonly requestedAt: number;
}
```

### 18.2 Command 与 effect

1. Host 发送 `fib.round.start`。
2. Engine 验证 phase 和满座条件。
3. Engine 转为 `preparing`，保存 `roundId`，发出 `fib.word.generate` effect。
4. Outbox worker 调用配置好的 word source。
5. 它使用同一个 `roundId` 发送 internal `fib.round.complete`，附带 word、definition、source。
6. Engine 拒绝过期或重复 `roundId`。
7. Complete 成功后分配身份并转为 `ongoing`。
8. Provider 失败通过 outbox retry。
9. 产品需要恢复操作时，host 可以发送 `fib.round.cancelPreparing`。

不再使用“先 `BEGIN_DRAW`，等待外部调用，再希望第二个 action 成功”的流程。

### 18.3 Provider boundary

瞎掰王拥有自己的 `FibWordProvider`：

```ts
interface FibWordProvider {
  generate(request: FibWordRequest): Promise<FibWordCandidate>;
}
```

Gemini、Workers AI、本地词库都是瞎掰王内部的 provider adapter，不是全 App 的 LLM compatibility API。Provider selection policy 放在 `games/fibking/wordProviders/`，并显式返回 source。

客户端不会通过 Gemini proxy 来开始一轮。

## 19. 客户端 Session 架构

### 19.1 Shared RoomSession

连接、snapshot store、command submission 和 reconnect 全部通用：

```ts
interface RoomSession<TState, TCommand> {
  getSnapshot(): RoomSnapshot<TState> | null;
  subscribe(listener: () => void): () => void;
  connect(roomCode: string, userId: string): Promise<void>;
  disconnect(): void;
  reconnect(): void;
  dispatch(command: TCommand, options?: DispatchOptions): Promise<RoomCommandResult>;
}
```

只有一个实现。狼人杀可以在它外面 compose audio orchestration，但不能重新实现 connection 和基础 room command。瞎掰王也不再建立一套平行 facade 去重复 connection status mapping。

### 19.2 Composition root

App composition root 提供 infrastructure 和 game-session factory，不再每加入一个游戏就新增一个 provider 和一个 context accessor：

```ts
interface GameSessionFactory {
  create<TGameType extends GameType>(gameType: TGameType): SessionFor<TGameType>;
}
```

Active room host screen 使用已解析的 game module 创建或选择 typed session。测试注入相同 contract。

### 19.3 Deep link

对外只有一个 room URL：

```text
/room/:roomCode
```

`RoomResolverScreen` 先读取 room metadata，再选择 client game module。用户和 QR code 不需要知道 `/fib/room` 与 `/room` 的区别。

失败行为：

- 房间不存在：显示“房间不存在”，不进入任何 game screen。
- Game type 未知：显示“暂不支持该游戏类型”，记录准确类型并停止。
- Metadata 与 state 类型不一致：显示房间完整性错误并停止。

## 20. Shared Room UI 架构

### 20.1 `RoomShell` 拥有稳定视觉框架

狼人杀和瞎掰王都渲染同一个 `RoomShell`。Shell 负责：

- Safe area container。
- 左侧返回按钮、中间 room code、右侧 overflow menu 的稳定三列 header。
- Connection 和 host status ribbon。
- Controlled-bot banner。
- Seat board。
- Bottom action panel。
- Seat confirmation modal。
- Player profile card。
- QR code modal。
- 统一 spacing、尺寸、z-index 和 safe-area 行为。

游戏 screen 不得复制这段 JSX 后把复制品称为 adapter。

### 20.2 Room shell model

```ts
interface RoomShellModel {
  readonly roomCode: string;
  readonly connection: RoomConnectionViewModel;
  readonly statusRibbon: RoomStatusRibbonModel;
  readonly capabilities: RoomCapabilities;
  readonly seats: RoomSeatDataSource;
  readonly header: RoomHeaderModel;
  readonly bottomActions: RoomBottomActionLayout;
  readonly controlledSeat: ControlledSeatModel | null;
}
```

Game adapter 从 typed state、登录用户和本地 controller state 派生这个 model。

### 20.3 显式 capabilities

Shared UI 直接接收权限：

```ts
interface RoomCapabilities {
  readonly canTakeSeat: boolean;
  readonly canMoveSeat: boolean;
  readonly canLeaveSeat: boolean;
  readonly canKickSeat: boolean;
  readonly canClearSeats: boolean;
  readonly canFillBots: boolean;
  readonly canConfigureGame: boolean;
  readonly canViewProfiles: boolean;
  readonly canTakeOverBots: boolean;
  readonly canShareRoom: boolean;
  readonly shouldConfirmExit: boolean;
}
```

Shell 不 import `GameStatus` 或 `FibPhase`，也不根据 generic `ongoing` 猜 `canKickSeat`。Game adapter 按自己的 phase 和 actor 穷尽式派生 capabilities。

Capabilities 同时控制可见性和执行入口。一个 capability 如果计算出来却没有 production consumer，architecture contract test 必须失败。

### 20.4 Controller 边界

共享 controller 按功能拆分：

- `useRoomConnection`：connect、reconnect、disconnect、connection status。
- `useRoomSeatController`：入座/换座/离座 pending confirmation 和 submission state。
- `useRoomProfileController`：当前 profile、直接 kick、本人确认离座。
- `useRoomShareController`：QR、copy、native share、share image。
- `useRoomBotControl`：当前 controlled bot seat 和 release。

不得建立一个同时接收所有 selector、copy、command callback、header factory、bottom-layout factory 和 phase adapter 的大 hook。允许有一个很薄的 composition hook，但它只能组合上述 controller，不能新增游戏语义。

### 20.5 Game-specific slot

`RoomShell` 可以接受清晰的 slot：

- `beforeSeatBoard`：游戏摘要或规则入口。
- `afterSeatBoard`：本游戏公开结果。
- `identityModal`：本游戏身份内容。
- `extraHeaderActions`：确实没有共享语义的操作。

Slot 不能重新渲染 header、seat board、bottom panel 或 shared modal。

## 21. UI 视觉和交互 contract

### 21.1 视觉基线

狼人杀当前 RoomScreen 是房间视觉基线。抽 shared UI 时应先让狼人杀使用 `RoomShell` 并保持截图一致，再接入瞎掰王。

必须保持：

- 相同 header 高度、左右按钮尺寸和 room code 居中方式。
- 相同 status ribbon 位置和信息密度。
- 相同 seat tile 外形、头像、外框、名字样式、座位特效和本人 badge。
- 相同 seat grid 间距及响应式列数策略。
- 相同 bottom panel 层级和 safe-area padding。
- 相同 profile card、QR modal 和 alert/modal 行为。
- 使用现有 theme token，不建立 Fib 专属的一整套颜色和 spacing。

瞎掰王可以有自己的 role badge、摘要内容和 identity sheet，但这些内容必须落在 shared layout 中，不能形成另一种房间页面。

### 21.2 Header

Header 使用稳定三列：

- 左列固定容纳返回 icon button。
- 中列自适应但保持 room code 真正居中。
- 右列固定容纳 overflow icon button。
- 左右列宽相同，防止标题因右侧菜单内容变化而偏移。
- Icon button 使用现有 icon library，不手画 SVG。
- 所有 icon button 有可访问 label 和测试 ID。

Shared overflow items：

| Item       | 可见条件                | 行为                        |
| ---------- | ----------------------- | --------------------------- |
| 分享房间   | platform 允许分享       | 打开共享 QR/share modal     |
| 用户设置   | 已登录                  | 打开产品用户设置            |
| 填充机器人 | host 且 `canFillBots`   | 使用共享确认 alert          |
| 清空座位   | host 且 `canClearSeats` | 使用 destructive 确认 alert |

游戏配置不是 generic header item。它在 setup phase 的 bottom action 区出现，因为它修改的是本游戏设置，不是用户工具。

只有不存在共享语义时才允许追加 game-specific header item。例如狼人杀音频控制属于合理特例。

### 21.3 Seat board

- Seat tile 使用稳定 aspect ratio 和尺寸约束，名字、badge、hover、loading 不得改变 grid geometry。
- 文本必须换行或截断，不能覆盖相邻 tile。
- 空座、真人、bot、本人、controlled bot 的视觉状态彼此清晰。
- 角色只在 game adapter 允许时出现。
- `RoomSeatBoard` 使用 lazy data source，不能要求调用者预先创建所有 seat model。
- Mobile、tablet、desktop 使用同一列数算法和明确 breakpoint。
- 超大房间采用 window/range rendering，不能因为滚动尺寸溢出导致页面空白。

### 21.4 Seat tap

| 目标               | Capability        | 结果                                          |
| ------------------ | ----------------- | --------------------------------------------- |
| 空座，用户未就座   | `canTakeSeat`     | 打开 centered `入座` 确认                     |
| 空座，用户已在别处 | `canMoveSeat`     | 打开 centered `换座` 确认                     |
| 本人座位           | `canViewProfiles` | 打开 profile，允许时显示 `离座`               |
| 其他真人座位       | `canViewProfiles` | 打开 profile；允许时 host 看到直接 `移出座位` |
| Bot 座位           | `canViewProfiles` | 打开 bot profile                              |
| Bot 座位长按       | `canTakeOverBots` | 接管或释放 bot                                |
| 任意 locked seat   | capability false  | 不存在隐藏 mutation path；需要时显示具体反馈  |

Kick 从 `PlayerProfileCard` 直接执行，没有 kick confirmation modal。入座、换座、本人离座继续确认，因为它们改变当前用户座位上下文。

### 21.5 Profile action

`PlayerProfileCard` 接收 target-specific action，而不是只接收宽泛的 `isHost`：

```ts
interface PlayerProfileActions {
  readonly canKick: boolean;
  readonly canLeave: boolean;
  onKick(): void;
  onLeave(): void;
}
```

Active flow 中如果不能 kick，不能只隐藏按钮却仍保留可调用 callback。

### 21.6 Bottom action panel

共享 panel 保持狼人杀现有层级：

- Primary：下一步最重要的游戏操作。
- Secondary：参与者常用操作，例如查看身份。
- Ghost：低频设置或恢复操作。

每个游戏只生成 typed button model，由 `RoomShell` 渲染。Game screen 不在 shell 周围另放按钮。

### 21.7 Modal 和 menu

- 选择游戏模式使用现有 centered modal，不使用侧边弹层或自造浮层。
- 入座、换座、离座使用同一个 centered seat confirmation modal。
- QR 和 profile 使用共享 modal primitive。
- Overflow menu 保持狼人杀当前 anchor、宽度、分组和 destructive item 位置。
- Modal 打开时底层不可 action，关闭后事件不能穿透。
- 不用时间戳 debounce 修复 modal 穿透。

### 21.8 Rules 和 config

Rules 入口使用共享 icon row：icon、title、supporting text、chevron 对齐一致，不能在内容流里放一个裸文字“玩法说明”。

Rules screen 使用相同的：

- `ScreenHeader`
- section header
- rule item spacing
- typography hierarchy
- safe-area 和滚动 padding

Config screen 也使用统一 screen shell。数值使用 stepper + numeric input，不用普通文本按钮替代增减 control。

### 21.9 响应式和可访问性

- Web 内容区域居中，并遵守现有 max content width。
- Mobile 第一屏同时看见 header、status、部分房间内容和 bottom action，不让一个摘要 card 占满首屏。
- Bottom panel 不遮挡最后一行座位。
- 不使用 viewport width 动态缩放字体。
- 字体、line height、spacing、radius、shadow 全部来自 theme token。
- 所有操作满足现有最小 touch target。
- Button、menu、modal、seat 都有可访问名称。
- Dynamic text 不得与 icon、badge 或下一段内容重叠。

### 21.10 视觉验收

至少保存并审查以下 Playwright screenshot：

- Werewolf lobby：desktop、mobile。
- Werewolf ongoing：desktop、mobile。
- Fib lobby 4 人、8 人、大人数窗口：desktop、mobile。
- Fib ongoing：本人为 guesser、honest、fibber。
- Fib bot takeover banner。
- Header menu、seat modal、profile card、QR modal、rules、config。

视觉验收同时检查：

- 无重叠。
- 无裁切。
- Header title 居中。
- Seat grid 对齐。
- Bottom panel 不跳动。
- Modal 不超出 viewport。
- Werewolf 与 Fib 的 shared component 几何一致。

## 22. 瞎掰王 Domain 设计

### 22.1 配置

- 默认人数：8。
- 最少人数：4。
- 无人为设置的产品最大人数。
- 只有 `lobby` 可以修改配置。
- 缩容时，如果被移除范围中存在真人座位，直接失败。
- UI 使用 stepper + numeric input。
- Server 要求 finite safe integer 且不小于 4。Safe integer 是数据表示不变量，不是产品人数上限。

### 22.2 身份

N 个有效座位中：

- 1 个 `guesser`（大聪明）。
- 1 个 `honest`（老实人）。
- 其余全部是 `fibber`（瞎掰王）。

State 使用紧凑表示：

```ts
interface FibRoleAssignment {
  readonly guesserSeat: number;
  readonly honestSeat: number;
}
```

所有其他有效座位派生为 `fibber`，不存 N 大小的 `roleBySeat`。

| 身份   | 看见词 | 看见真释义 | 本轮公开身份 |
| ------ | ------ | ---------- | ------------ |
| 大聪明 | 是     | 否         | 是           |
| 老实人 | 是     | 是         | 否           |
| 瞎掰王 | 是     | 否         | 否           |

`ended` 后公开词、释义、大聪明、老实人和所有派生的瞎掰王身份。

### 22.3 Sparse seats 与 implicit bots

为了满足无产品人数上限，state size 不能随空座或填充 bot 数量线性增长：

```ts
interface FibSeatingState {
  readonly numberOfPlayers: number;
  readonly realSeats: Readonly<Record<number, FibHumanSeat>>;
  readonly fillEmptySeatsWithBots: boolean;
}
```

规则：

- 空座不存储。
- `fillEmptySeatsWithBots` 为 true 时，所有空座派生为 bot。
- Bot ID 和 display name 由 room code + seat number 确定性生成。
- Lobby 中真人可以坐到 implicit bot seat，只替换那个派生 bot。
- 清空座位会清除真人并关闭 implicit bot fill。
- Occupied count 不通过 materialize 所有 seat 计算。
- 身份分配只随机选择两个不同 seat number，不枚举全部座位。

### 22.4 Lazy seat data source

```ts
interface RoomSeatDataSource {
  readonly seatCount: number;
  getSeat(seat: number): RoomSeatViewModel;
  getVersionKey(): string;
}
```

`RoomSeatBoard` 按 seat index lazy 生成 row。Adapter 不创建完整 `RoomSeatViewModel[]`。

人数非常大时，board 在相同 contract 后面使用 windowed page 或 indexed range，避免 native/web scroll dimension 超出表示范围。

### 22.5 Phase 与按钮

| Phase       | Host action                      | Player action    | Seat change |
| ----------- | -------------------------------- | ---------------- | ----------- |
| `lobby`     | 配置、填 bot、清空座位、开始本轮 | 入座、换座、离座 | 允许        |
| `preparing` | 需要时取消准备                   | 等待             | 锁定        |
| `ongoing`   | 公布答案、查看身份、接管 bot     | 查看本人身份     | 锁定        |
| `ended`     | 下一轮                           | 查看公开结果     | 锁定        |

`下一轮` 保留座位和 used-word history，创建新 `roundId`、抽新词、重新分配身份。它是 `ended` 后唯一正常操作，不再同时显示一个含义重复的“重新开始”。

如果需要 destructive reset，只能作为 `preparing` 或 `ongoing` 的明确恢复操作，文案必须说明会丢弃什么，不能冒充正常下一轮。

### 22.6 Bot takeover

- 只有 bot perspective 有意义的 phase 才显示 takeover。
- Host 长按 bot seat，通过共享 controller 接管。
- Identity display 使用 effective controlled seat。
- 如果 bot 是大聪明，它和真人大聪明一样看见词但看不见释义。
- 真人 seat 不能被接管。
- Release 后恢复 host 自己的 seat perspective。

## 23. 狼人杀 Module 边界

狼人杀移动到 `games/werewolf/`，但现有规则不能借目录迁移改变。

迁移要分开：

- Generic room execution 与狼人杀 handler。
- Common seat command 与狼人杀 seat-state adapter。
- 狼人杀 phase 与 shared room capability。
- 狼人杀 audio、role action、night progression、settlement 与 generic platform。

狼人杀专属内容包括：

- Board/template selection。
- Role registry 和 schema。
- Night-step plan 和 resolver。
- Audio orchestration。
- Role reveal 和 night review。
- Debug bot progression。
- Growth settlement policy。

移动文件不代表可以重命名 domain concept 或改变 transition。迁移前先用 characterization test 和 E2E 固定行为。

## 24. 模式选择、配置、房间和规则 Host

### 24.1 Mode picker

Home 的创建命令打开现有 centered modal。选项来自 `GAME_UI_CATALOG`，包含 icon、游戏真名和简短类别。

Home 不再维护 `handlePickWerewolf`、`handlePickFib`。它只把所选 `gameType` 交给 generic create route。

### 24.2 Generic host screens

Navigation 使用稳定 host route：

```ts
type RootStackParamList = {
  GameConfig: { gameType: GameType; existingRoomCode?: string };
  GameRoom: { roomCode: string; gameType: GameType; isHost: boolean };
  GameRules: { gameType: GameType };
  RoomResolver: { roomCode: string };
};
```

Host screen 解析 UI module，把 typed content 放进共享 screen shell。新增游戏时不修改 `AppNavigator` 和 Home。

### 24.3 Screen folder 一致性

每个游戏采用相同内部结构：

```text
games/<game>/
├── components/
├── screens/
│   ├── ConfigContent.tsx
│   ├── RoomContent.tsx
│   └── RulesContent.tsx
├── services/
├── <game>RoomAdapter.ts
├── module.ts
└── __tests__/
```

允许游戏有特殊 screen，但必须留在 game slice，并通过 client module 注册。

## 25. 以后加入你画我猜

新增游戏需要：

1. 把 ID 加入 `GAME_TYPES`。
2. 实现纯 game-engine module。
3. 为 state、command、event、normalize、lifecycle 添加 engine test。
4. 实现一个 Worker module，包含 create/command schema 和 effect。
5. 加入穷尽式 Worker catalog。
6. 实现一个 client game module、room adapter、config content、game content、rules content。
7. 加入穷尽式 client catalog。
8. 添加 create、join、deep link、room shell 和主玩法测试。

新增游戏不应修改：

- `GameRoom.ts`
- `actionPipeline.ts`
- `RoomShell.tsx`
- Shared room controllers
- `HomeScreen.tsx`
- Generic room/config/rules host screens
- 已有游戏 module

如果确实要改其中一个文件，必须先说明缺少的能力为什么是多个游戏真正共用的能力，不能加入按游戏名判断的条件分支。

## 26. Error handling 与 fail-fast

### 26.1 Boundary 分类

| Failure                          | 处理                                              |
| -------------------------------- | ------------------------------------------------- |
| HTTP JSON 或 command schema 非法 | 400 + 稳定 reason                                 |
| 未认证 command                   | 401                                               |
| 预期权限/phase 拒绝              | 403/409 + 稳定 reason + 中文 UI feedback          |
| Create 输入的 game type 未知     | 400                                               |
| Persisted game type 未知         | Throw + log + Sentry + room integrity response    |
| State game type 不一致           | Throw + log + Sentry                              |
| State version 不支持             | Throw 或正式 migration                            |
| Effect provider 不可用           | 保存 outbox retry；必要时 UI 显示 preparing/retry |
| Realtime game type 不一致        | 断开 session 并显示完整性错误                     |

### 26.2 禁止 fallback

- Unknown game type 不变成狼人杀。
- Missing config 不变成默认 config。
- Missing required state 不变成空 object/array。
- Unsupported command 不返回 generic success。
- LLM parse failure 不接受 malformed content。
- Seat action 失败不关闭 modal 假装成功。
- Test helper 不关闭 unexpected alert 以便下一次 click。

## 27. Observability

每条 room log 在可用时包含：

- `roomCode`
- `gameType`
- `revision`
- `commandId`
- `commandType`
- `actorUserId`
- `effectId`
- `roundId`

不记录隐藏身份、词语释义、认证 token 或完整 state snapshot。

Metrics 区分：

- 按 game/type 分类的 command accepted/rejected/error。
- DO initialization conflict。
- State normalization failure。
- Outbox retry 和 exhausted effect。
- WebSocket reconnect 和 snapshot mismatch。
- 瞎掰王 word provider source 和失败类别。
- 按 status 分类的 room creation saga age。

## 28. 测试策略

### 28.1 Architecture contract tests

以下情况必须让静态 contract test 失败：

- Platform import game module。
- 一个 game import 另一个 game。
- Shared room UI import 狼人杀或瞎掰王类型。
- 合法 `GameType` 在任一 catalog 漏注册。
- Home 或 generic host 按 literal game name 分支。
- 迁移完成后仍存在旧 context、route、export 或 compatibility adapter。
- `unknown` 出现在允许列表之外的 parse/serialization boundary。
- Capability 定义后没有 production consumer。

### 28.2 Engine tests

每个游戏覆盖：

- Initial state construction。
- 每个 command 的 accepted/rejected phase。
- Actor/host authorization。
- Reducer/event completeness。
- Normalize corruption failure。
- Lifecycle derivation。
- Common seat command behavior。
- 随机分配使用可注入 deterministic RNG。

瞎掰王额外覆盖：

- 最少 4、默认 8。
- 大人数 initial state 大小保持 bounded。
- 不存在 N 大小的 empty-seat、bot、role structure。
- 恰好一个 guesser 和一个 honest seat。
- 大聪明 word visibility。
- 高位真人占座时 config shrink 失败。
- 真人替换 implicit bot。
- Start、provider complete、reveal、next round。
- Stale/duplicate `roundId` 拒绝。

### 28.3 Worker/DO tests

- Unknown game type 在 initialization write 前失败。
- Config schema 与 engine config type 一致。
- Initialization 按 `creationId` idempotent。
- 使用不同 metadata 重复初始化失败。
- State/game-type mismatch fail fast。
- Command schema 按 persisted game type 选择。
- Duplicate `commandId` 只产生一个 revision。
- Rejection 不写入、不广播。
- Accepted command 先 persist 后 broadcast。
- Effect failure 不改变 command result。
- Alarm 可恢复瞎掰王 word generation 和狼人杀 settlement。
- Create/delete saga reconciliation。

### 28.4 Shared UI tests

- Werewolf 和 Fib adapter 使用相同 shell geometry。
- Header item 按 capability 显示。
- 入座/换座/离座 confirmation。
- Direct kick 不出现 confirmation modal。
- Locked phase 没有 seat operation。
- Profile action 按 target 控制。
- Bot takeover 和 release。
- Shared QR/copy。
- Rules entry layout。
- 每个 phase 的 bottom action matrix。
- Lazy seat source 只请求 rendered index。

### 28.5 E2E gates

狼人杀现有 E2E 是迁移 gate。加入 Fib 前必须保持全绿。

Fib E2E 包含：

- Mode modal -> config -> room。
- 4 个真人 join 并入座。
- Host 填满剩余 bot。
- Host 手动接管相关 bot 身份。
- Start round，并模拟 provider retry 恢复。
- 大聪明看见词但看不见释义。
- 老实人看见词和释义。
- 瞎掰王看见词但看不见释义。
- Reveal、next round 保留座位。
- 输入 room code 按 game type 路由。
- Cold deep link 通过单一 room URL resolve。
- Config UI 没有人为最大值。

修改 E2E helper 必须说明产品 contract 为什么变化。禁止添加 generic retry、unexpected alert dismissal、forced click 或 locator broadening 来隐藏 `main` 不存在的 regression。

### 28.6 验证命令

每个实现阶段执行：

```bash
pnpm run quality
pnpm run e2e
```

可以先跑 targeted test，但不能替代完整 gate。

## 29. 从 `main` 迁移的阶段

在开始 Fib vertical slice 前，所有阶段都必须保持狼人杀行为不变。每个阶段应形成独立、可 review 的 commit series。

### Phase 0：固定行为基线

交付：

- 记录 `main` unit/E2E baseline。
- 补足 room create、seat operation、header action、deep link、DO dispatch、settlement、bot takeover 的 characterization test。
- 加入 architecture test，并暂时列出 `main` 当前 exception。

退出条件：

- Full quality/E2E 通过，不使用 helper workaround。
- 每个将被移动的行为都有测试 owner。

### Phase 1：建立中性目录和 protocol ID

交付：

- 在 game-engine 建 `platform/`、`games/werewolf/`、`product/`。
- 只移动狼人杀，不改变行为。
- 加 canonical `GameType` 和 snapshot envelope。
- 加 game-owned state codec，并让 HTTP、WebSocket 和 DO persistence 共用同一解析入口。
- 把客户端狼人杀专属文件移动到 `src/games/werewolf/`。

退出条件：

- Import-boundary test 通过。
- Generic platform 不 import Werewolf。
- 外部或持久化 JSON 到具体 state 的路径中没有 `as GameState` / `as never`。
- 狼人杀测试和 E2E 语义不变。

### Phase 2：Typed engine 与 exhaustive catalogs

交付：

- 定义 `GameEngineDefinition` 和 decision contract。
- 把狼人杀接到该 contract 后面。
- 加 engine/Worker catalog helper。
- Runtime schema 与 engine command/config type 静态绑定。

退出条件：

- 不公开 `GameEngine<unknown, unknown, unknown>`。
- 漏 catalog entry 时 typecheck 失败。
- 狼人杀行为继续全绿。

### Phase 3：用 generic command pipeline 替换狼人杀专用 RPC

交付：

- 新 DO atomic room row。
- Initialization command、command receipt、generic dispatch。
- Settlement 迁入 Worker module effect/outbox。
- 所有狼人杀 client action 改走 generic command endpoint。
- Engine 收到真实 actor identity。

退出条件：

- 删除狼人杀专用 public RPC 和旧 processor。
- 同一个 deployable change 中删除旧 HTTP action route。
- 不留 compatibility route。
- Full Werewolf E2E 通过。

### Phase 4：Room creation saga 与单一 deep link

交付：

- D1 room status 和 `creationId`。
- Create/delete reconciliation。
- `RoomResolverScreen` 和唯一 room URL。
- Missing/unknown game type 明确失败。

退出条件：

- Interrupted create/delete test 可恢复。
- Navigation 不默认狼人杀。
- 原狼人杀链接在同一次 release migration 后通过 canonical route 解析。

### Phase 5：从稳定狼人杀 UI 抽取 shared room feature

交付：

- 从狼人杀行为抽 `RoomShell` 和 focused controllers。
- Capability 和 lazy seat-source contract。
- 狼人杀 interaction policy 留在 game adapter。
- 移动 profile、QR、status、header、seat、bottom panel 等共享组件。

退出条件：

- 狼人杀首先真实使用 shared shell。
- Screenshot 和 interaction test 证明无意外 UI 回归。
- Shared room 没有 Werewolf import。
- 被删除的狼人杀 hook test 已有等价或更强的 shared/game-adapter test。

### Phase 6：加入瞎掰王 engine 和 Worker module

交付：

- Compact Fib state、command、role assignment、normalize。
- Implicit bots 和 sparse real seats。
- Word provider port 和 outbox workflow。
- 在 engine/Worker catalog 穷尽式注册 Fib。

退出条件：

- Fib domain/DO integration test 通过。
- Fib state size 不随空座或 implicit bot 数增长。
- 模拟 word generation 中断后可恢复。

### Phase 7：加入瞎掰王 UI module

交付：

- Mode option、config content、rules content、summary content、identity sheet、room adapter。
- Fib 通过同一个 `RoomShell` 渲染。
- Header、seat、profile、bot takeover、share、status、bottom action 全部走 shared contract。

退出条件：

- 没有复制 room-shell JSX。
- 本文 UI matrix 已覆盖。
- Fib E2E 通过。

### Phase 8：删除过渡代码并中性化 workspace scope

交付：

- 删除旧 context、facade、route、processor、directory、export、migration-only adapter。
- 批准后一次性修改 workspace package scope。
- 删除 architecture test 临时 allowlist。
- 更新仓库文档。

退出条件：

- 搜索 `legacy`、`compat`、旧 path、旧 API 没有架构残留。
- Full quality/E2E 通过。
- Compile-only Pictionary module 不改 platform 文件即可接入。

## 30. 明确删除清单

最终实现必须删除，而不是无限期 deprecated：

- 作为 app-wide room context 的狼人杀命名 `GameFacadeContext`。
- 每个游戏独立的 connection lifecycle 实现。
- 每个游戏重复的 seat service API。
- `GameRoom` 上的狼人杀专用 RPC。
- Generic command migration 完成后的旧狼人杀 per-action HTTP route。
- 独立 create/effect registry。
- 单独 DO `game_type` KV。
- Unknown game fallback to Werewolf。
- Shared UI 对狼人杀 `GameStatus` 的 import。
- 旧 game-engine path 的 compatibility export barrel。
- 不属于具体游戏 feature 的 LLM provider compatibility layer。
- 只验证已删除 compatibility 行为的测试。

旧模型创建的 production room 必须做一次明确 release 决策：

- 执行一次性 state migration；或者
- Deployment 时使旧 active room 失效。

代码不能永久同时接受两个格式并猜测输入属于哪一种。

## 31. 架构决策汇总

| 主题               | 决策                                                       |
| ------------------ | ---------------------------------------------------------- |
| Game ID            | 一个 canonical `GameType` union                            |
| Engine API         | 每个游戏完整 typed strategy                                |
| Runtime validation | Worker game module schema                                  |
| Registration       | 每个 runtime 一个 exhaustive catalog                       |
| DO routing         | game type 与 state 同一个 SQL row                          |
| Dispatch           | 一个 authenticated generic command endpoint                |
| Authorization      | Engine 用真实 actor + authoritative state 判断             |
| Request retry      | Idempotent `commandId` receipt                             |
| Effect             | Transactional outbox + generic alarm scheduler             |
| Client transport   | 一个 generic `RoomSession`                                 |
| Shared UI          | 一个真实 `RoomShell` + focused controllers                 |
| UI permission      | Game-derived explicit capabilities                         |
| Navigation         | Catalog-driven host + 单一 room resolver URL               |
| Seat command       | 同一命名 + seating kernel                                  |
| Fib scale          | Sparse humans + implicit bots + compact roles + lazy seats |
| Fib 出题           | Recoverable outbox workflow                                |
| Compatibility      | 同 release migration 后删除                                |
| Future game        | Vertical game module，不在 platform 加条件                 |

## 32. Definition of Done

只有全部满足才算多游戏重构完成：

- 狼人杀和瞎掰王使用同一个 DO command pipeline。
- 狼人杀和瞎掰王使用同一个 room session 实现。
- 狼人杀和瞎掰王渲染同一个 `RoomShell`。
- Shared room 不 import 任何 game-specific type。
- Game-specific phase 留在自己的 module。
- 所有基础 seat command 使用同一协议名和 kernel invariant。
- Create 时显式传 `gameType`，并和 state 原子持久化。
- Unknown game path 不默认狼人杀。
- Public engine boundary 不使用 `unknown` state、command、config 或 event。
- Worker schema 与 engine type 静态绑定。
- Command retry idempotent。
- Post-commit effect 可恢复且不改变 commit reporting。
- Fib 默认 8、最少 4、没有人为产品上限，同时不存 N 大小的空座、bot、role state。
- Fib 的大聪明 visibility、bot takeover、next round、config、rules UI 符合本文。
- 所有被删除测试都有等价或更强覆盖。
- `pnpm run quality` 通过。
- 狼人杀和瞎掰王 full E2E 通过。
- 不存在架构 compatibility layer。
- 加入 compile-only 第三个游戏不需要修改 platform execution 或 shared room UI。

## 33. 实施进度

每个实现提交都必须更新本节，并在提交前运行完整 `pnpm run quality`。阶段状态只按退出条件判断，不能因类型或局部测试通过而提前标记完成。

| 阶段      | 状态   | 已完成                                                                   | 尚未完成                                                               |
| --------- | ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Phase 0   | 进行中 | `main` 行为 contract、room/seat/DO characterization test、架构边界测试   | 当前分支完整 Werewolf E2E gate                                         |
| Phase 1   | 进行中 | canonical game identity、版本化 Werewolf codec、snapshot/result envelope | client game-owned 目录迁移、全部边界 exception 清零                    |
| Phase 2   | 待 E2E | concrete `werewolfEngine`、exhaustive catalogs、Worker schema 静态绑定   | 推送后的完整 Werewolf Playwright gate                                  |
| Phase 3-8 | 未开始 | -                                                                        | generic pipeline、creation saga、shared room、Fib vertical slice、清理 |

### 当前提交：authoritative Werewolf engine 与 exhaustive catalogs

- 新增 concrete `werewolfEngine`，25 个 canonical command 通过 exhaustive switch 映射到唯一规则实现；actor identity、host authority 和 bot takeover seat 均从 `CommandContext.actor` 与权威 state 推导。
- 五类 action input 只携带玩法输入，seat、role 和 reveal acknowledgement owner 由 engine 从当前 state 解析；非法 schema/input 组合显式拒绝，状态不变量破坏时 fail fast。
- 把 audio ack、progression、reveal ack、group confirm、bot group confirm、roster level 六组规则移入 game-owned pure handlers；当前 DO 与新 engine 调用同一实现，不复制规则。
- 新增 exhaustive engine catalog 与 Worker catalog；Zod 4 strict schemas 的 output type 与具体 engine config/command 静态绑定，不公开 `GameEngine<unknown, unknown, unknown>`。
- `SAVE_STATE`/`BROADCAST_STATE` 留作 platform commit 行为，`PLAY_AUDIO` 转为 state event，未建模的 `SEND_MESSAGE` 直接 fail fast。
- 定向验证：game-engine 3 个 suites、88 条测试通过；Worker catalog 4 条测试通过。
- 迁移边界：狼人杀专用 RPC 和 `gameProcessor` 仍是当前生产入口，将在 Phase 3 generic pipeline 接通后于同一个 deployable change 删除；不保留 compatibility route。
- 提交门禁：完整 `pnpm run quality` 通过；root 183 个 suites、4818 条测试，game-engine 78 个 suites、2313 条测试，api-worker 10 个 files、94 条测试。
- 阶段状态：代码与本地 quality 退出条件已完成；推送后由 CI 执行完整 Werewolf Playwright gate，通过后 Phase 2 才标记完成。
- 下一步：Phase 3 新增 atomic room row、command receipt 与 generic dispatch，再原子删除旧 RPC/HTTP action path。
