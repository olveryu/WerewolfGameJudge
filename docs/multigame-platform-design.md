# 多游戏平台架构设计

> 状态：目标架构提案  
> 基线：`main`，commit `caf6d25b`  
> 已核对的参考实现：`feat/fibking-engine-registry`，commit `fd6d4a96`  
> 最后更新：2026-07-15
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

物理目录继续使用 `packages/game-engine` 和 `packages/api-worker`。workspace package scope 统一使用中性名称
`@game-judge/*`；旧的具体游戏 scope 已原子删除，不保留 alias。

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
│       │   ├── identifiers/
│       │   │   └── index.ts
│       │   └── random/
│       │       ├── random.ts
│       │       └── shuffle.ts
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
│       │   │   └── level.ts
│       │   └── rewards/
│       │       ├── catalog.ts
│       │       ├── earnings.ts
│       │       ├── gacha.ts
│       │       ├── revealAnimation.ts
│       │       └── unlocks.ts
│       └── index.ts
│
├── api-worker/
│   ├── src/
│   │   ├── app/
│   │   │   ├── GameRoom.ts
│   │   │   └── scheduled.ts
│   │   ├── db/
│   │   │   └── index.ts
│   │   ├── e2e/
│   │   │   ├── GameRoom.ts
│   │   │   ├── fibRecoveryModule.ts
│   │   │   └── index.ts
│   │   ├── features/
│   │   │   ├── account/
│   │   │   │   ├── authRoutes.ts
│   │   │   │   ├── avatarRoutes.ts
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── profile.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── schemas.ts
│   │   │   ├── admin/
│   │   │   │   └── routes.ts
│   │   │   ├── auth/
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── passwordHash.ts
│   │   │   │   ├── passwordResetEmail.ts
│   │   │   │   ├── routes.ts
│   │   │   │   ├── schemas.ts
│   │   │   │   ├── tokenAuth.ts
│   │   │   │   └── wechat/
│   │   │   │       ├── WeChatAuthProxy.ts
│   │   │   │       └── weChatAuthStub.ts
│   │   │   ├── feedback/
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── schemas.ts
│   │   │   ├── gacha/
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── maintenance.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── schemas.ts
│   │   │   └── sharing/
│   │   │       ├── routes.ts
│   │   │       └── schemas.ts
│   │   ├── games/
│   │   │   ├── werewolf/
│   │   │   │   ├── module.ts
│   │   │   │   ├── schemas.ts
│   │   │   │   ├── effects.ts
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── aiChat/
│   │   │   │   └── settlement/
│   │   │   ├── fibking/
│   │   │   │   ├── module.ts
│   │   │   │   ├── schemas.ts
│   │   │   │   ├── effects.ts
│   │   │   │   ├── dbSchema.ts
│   │   │   │   └── wordProviders/
│   │   │   ├── catalog.ts
│   │   │   └── publicStatsRoutes.ts
│   │   ├── platform/
│   │   │   ├── crypto/
│   │   │   ├── gameModules/
│   │   │   │   ├── effectCommandId.ts
│   │   │   │   ├── runtimeGameModule.ts
│   │   │   │   └── workerModule.ts
│   │   │   ├── http/
│   │   │   │   ├── callDurableObject.ts
│   │   │   │   ├── jsonBody.ts
│   │   │   │   └── requestMetadata.ts
│   │   │   ├── observability/
│   │   │   │   └── logger.ts
│   │   │   ├── room/
│   │   │   │   ├── GameRoomRuntime.ts
│   │   │   │   ├── IGameRoomRPC.ts
│   │   │   │   ├── actionPipeline.ts
│   │   │   │   ├── dbSchema.ts
│   │   │   │   ├── effectOutbox.ts
│   │   │   │   ├── roomRepository.ts
│   │   │   │   ├── roomSaga.ts
│   │   │   │   ├── routes.ts
│   │   │   │   └── webSocketRoutes.ts
│   │   │   ├── telemetry/
│   │   │   │   ├── routes.ts
│   │   │   │   └── schemas.ts
│   │   │   └── userEvents/
│   │   │       ├── dbSchema.ts
│   │   │       └── inbox.ts
│   │   ├── env.ts
│   │   ├── index.ts
│   │   └── worker-globals.d.ts
│   └── test/
│       ├── applyMigrations.ts
│       ├── bindings.d.ts
│       ├── clearRoomAlarms.ts
│       └── uploadTestSupport.ts
│
src/
├── features/
│   ├── account/
│   │   ├── controllers/
│   │   ├── queries/
│   │   └── services/
│   ├── auth/
│   │   ├── controllers/
│   │   └── queries/
│   ├── feedback/
│   │   └── services/
│   ├── gacha/
│   │   ├── queries/
│   │   └── services/
│   ├── home/
│   │   ├── controllers/
│   │   └── model/
│   │       └── GameHomeContribution.ts
│   ├── navigation/
│   │   └── model/
│   │       └── GameNavigationContribution.ts
│   ├── product/
│   │   ├── hooks/
│   │   └── model/
│   │       ├── AudioClip.ts
│   │       ├── BgmCatalog.ts
│   │       ├── GameProductUi.ts
│   │       └── GameAudioPreview.ts
│   ├── settings/
│   │   └── services/
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
│       ├── session/
│       │   ├── GameSessionFactory.ts
│       │   └── RoomSession.ts
│       └── screens/
│           └── RoomResolverScreen.tsx
├── games/
│   ├── catalog.ts
│   ├── home.ts
│   ├── navigation.ts
│   ├── model/
│   │   └── ClientGameCatalog.ts
│   ├── ClientGameCatalogContext.tsx
│   ├── werewolf/
│   │   ├── assets/
│   │   ├── audio/
│   │   ├── components/
│   │   ├── home/
│   │   ├── hooks/
│   │   ├── navigation/
│   │   │   ├── WerewolfConfigFlowScreen.tsx
│   │   │   ├── types.ts
│   │   │   └── werewolfConfigFlow.ts
│   │   ├── profile/
│   │   ├── realtime/
│   │   ├── room/
│   │   │   ├── components/
│   │   │   ├── executors/
│   │   │   ├── hooks/
│   │   │   ├── policy/
│   │   │   ├── seatTap/
│   │   │   └── WerewolfRoomScreen.tsx
│   │   ├── runtime/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── state/
│   │   ├── werewolfRoomAdapter.ts
│   │   └── module.ts
│   ├── fibking/
│   │   ├── home/
│   │   ├── navigation/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── room/
│   │   ├── screens/
│   │   ├── services/
│   │   ├── state/
│   │   ├── fibRoomAdapter.ts
│   │   └── module.ts
├── screens/                 # 只放非游戏页面
├── services/                # Cloudflare adapter、connection、audio/storage infra、transport port
├── components/              # 产品级组件，不放 room/game 业务
└── navigation/
    ├── AppNavigator.tsx
    ├── GameHostRoutes.tsx
    └── types.ts
```

### 7.1 所有权规则

- `platform/` 不得 import `games/`。
- `games/werewolf/` 和 `games/fibking/` 可以 import `platform/`，但不能互相 import。
- Worker game module 只 import 对应游戏的 game-engine public API。
- `src/features/room/` 不得 import `src/games/*` 或 game-engine 的具体游戏路径。
- `src/features/home/` 和 `src/features/navigation/` 只定义 contribution contract，不注册具体游戏。
- 非游戏产品 API、query 和 controller 放在对应 `src/features/<feature>/`；screen/component 不直接 runtime import
  `src/services/`。`src/services/` 只保留基础设施 adapter 与 port。
- `src/navigation/GameHostRoutes.tsx` 只能按 canonical `gameType` 查询 client catalog，不能出现具体游戏 ID、
  config mode 或具体 screen import。
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

- 生产运行时、持久化、路由和 catalog 内部的 `gameType` 必须是 `GameType`，不能退化成裸 `string`。
- module authoring contract 使用 `TGameType extends string` 保留未注册 literal 的完整类型；这只是编译期扩展面，
  不能直接进入生产 resolver、storage 或 routing。
- engine、Worker、client 各自只有一个 production registration boundary。只有 `TGameType extends GameType`
  且 engine/catalog identity 完全匹配的 module 才能在该边界擦除为生产 runtime shape。
- 外部 string 只解析一次，成功后才成为 `GameType`。
- 从 D1 和 DO 读取的值也要验证。
- 新增游戏时，`GAME_TYPES`、state codec、engine 和各运行环境 catalog 必须在同一个
  vertical-slice change 中原子注册。开发中的编译错误用来提示漏项，但主干不允许出现只有 ID、
  没有实现的占位游戏类型。
- Compile-only 第三游戏 fixture 只能调用开放的 authoring helper；把它赋给 `GameType`、注册到生产
  Worker/client catalog 或按未知 key 读取生产 catalog 都必须编译失败。
- create、join、deep link、state parse 和 command dispatch 都没有默认游戏类型。

## 9. 纯 Game Engine contract

### 9.1 Contract

每个游戏定义自己的 state、config、command union 和 event union：

```ts
interface BaseGameState<TGameType extends string> {
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
  TGameType extends string,
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
- Worker runtime 必须显式保留 `hasStateEvents`，并校验它和 `broadcast === 'state'` 完全一致。revision
  按已提交 state event 递增，不能通过比较序列化 JSON 猜测；同值 profile update 仍是一条已接受的
  state event，必须产生新 revision，避免客户端收到旧 revision 后关闭 socket。
- `commit + domainRejected` 是明确的 domain transition：例如写入只对目标玩家可见的
  `actionRejected` event。它会提交 event，但 command response 仍携带稳定的业务拒绝 reason。
- `reject` 表示权限、phase 或参数前置条件失败；它没有 event/effect，不增加 revision，但 platform 会写
  绑定 actor/request 的 terminal rejection receipt，保证 retry 不会在新 state 上重新解释同一命令。
- 不允许用 `reject` 表示已经修改状态的命令，也不允许 Worker 在 engine 返回后补写 rejection state。
- 所有 event evolve 完成后统一执行 `normalize`，发现损坏直接抛错。
- State version 显式存在；不支持的版本直接失败或走正式 migration，不猜默认值。

### 9.3 Runtime state codec

网络 JSON 和 SQLite JSON 都是 `unknown`，不能通过类型断言直接变成游戏 state。每个游戏必须提供
一个版本化 codec：

```ts
interface GameStateCodec<TState extends BaseGameState<string>> {
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

`GameEngineDefinition<TGameType extends string, ...>` 是开放的 authoring contract；
`defineGameEngineCatalog` 是生产闭集边界，只接受 `GameType` 的精确键集和 identity 一致的 engine。具体 module
始终保持完整类型，不能把 `GameEngine<unknown, unknown, unknown>` 当成应用层常规 contract 对外暴露。

### 11.3 Worker module

```ts
interface WorkerGameModule<TEngine extends AnyGameEngineDefinition, TPublicUserStats> {
  readonly gameType: TEngine['gameType'];
  readonly engine: TEngine;
  readonly stateCodec: GameStateCodec<StateOf<TEngine>>;
  readonly createConfigSchema: ZodType<ConfigOf<TEngine>>;
  readonly commandSchema: ZodType<CommandOf<TEngine>>;
  readonly effectHandlers: EffectHandlerMap<EffectOf<TEngine>>;
  readonly httpRoutes: readonly WorkerGameHttpRoute<TEngine['gameType']>[];
  readonly parsePublicUserStats: (value: unknown) => TPublicUserStats;
  readonly getPublicUserStats: (
    userId: string,
    bindings: WorkerBindings,
  ) => Promise<TPublicUserStats>;
}
```

`defineWorkerGameModule` 是开放的 authoring helper，在编译期绑定 literal game ID、schema output、codec 和 engine
input，避免 command schema 产出的 shape 与 engine command union 静默分叉。它返回具体 state/effect/stats 的
typed runtime module，不能直接交给 `GameRoom`。
游戏专属 HTTP 能力也必须由 module 显式贡献；路径只能位于 `/api/games/<gameType>/*`。Worker catalog
按 canonical `GAME_TYPES` 投影全部 route，并在启动时拒绝重复路径。Worker entry 只遍历投影结果，不 import
狼人杀或瞎掰王 route。

```ts
export const WORKER_GAME_CATALOG = defineWorkerGameCatalog({
  werewolf: registerWorkerGameModule(werewolfWorkerModule),
  fibking: registerWorkerGameModule(fibWorkerModule),
});
```

`registerWorkerGameModule` 只接受 canonical `GameType` 且 engine 必须等于对应 engine catalog entry。它验证
effect context state，并用同一个 module codec 解析 internal dispatch result，然后才擦除成
`RuntimeWorkerGameModule`。`GameRoom`、persistence 和 routing 始终只看到这个生产闭集接口，不接受开放字符串。

### 11.4 Client module

```ts
interface ClientGamePluginDefinition<TGameType extends string> {
  readonly gameType: TGameType;
  readonly navigation: GameNavigationDefinition<TGameType>;
  createModule(dependencies: ClientGameModuleDependencies): ClientGameModule<TGameType>;
}
```

client session/transport、navigation definition、`RoomRecord<TGameType>`、room account capability 和具体 room screen
都保留同一个 literal ID。`registerClientGameModule` 只接受 `GameType`；它先核对 resolved room identity，再重建
精确 `RoomRecord<TGameType>` 并调用具体 screen，不用 component cast 绕过 React props 方差。首页 mode option、
generic host screen 和 room resolver 都从同一个 `CLIENT_GAME_PLUGIN_CATALOG` 投影。未知 ID 显示明确错误并上报
telemetry，绝不导航到狼人杀。
`GET /api/games/:gameType/users/:userId/stats` 只负责认证、解析 canonical game type 和 catalog dispatch；
统计查询、响应类型与严格 parser 由对应 Worker/game-engine module 所有。`/api/user/stats` 与
`/api/user/:userId/profile` 不携带任何具体游戏字段。

## 12. Durable Object 持久化

### 12.1 一个原子 room row

DO 在同一个 SQLite row 存 routing 和 state：

```sql
CREATE TABLE room_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  creation_id TEXT NOT NULL UNIQUE,
  initialization_json TEXT NOT NULL,
  game_type TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  game_state TEXT NOT NULL,
  revision INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

不再使用 `storage.put('game_type', ...)`。engine selection、state、state version 和 revision 来自同一次读取、同一个 transaction。
`initialization_json` 保存经过 game module schema 解析后的 canonical initialization command，用于
`creationId` replay 校验；它不是第二份 game state。`roomCode` 和 `hostUserId` 只以 typed state 为权威，
不在同一 row 再复制一份可能漂移的列。

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
7. 检查 `commandId` 是否已经完成，并验证 receipt 绑定的 actor、controlled seat 和 request JSON。
8. 首次执行时生成并持久化 server `randomSeed`，调用 typed engine `decide`，传入 actor context。
9. `reject` decision 不写 state/event/effect，但写入绑定请求的 terminal rejection receipt；否则相同
   `commandId` 在 state 改变后重试可能变成一条新动作。
10. 在内存中 evolve 全部 event。
11. normalize 新 state。
12. 在一个 Durable Object storage transaction 中更新 state/revision、保存 command receipt、写入
    effect outbox，并通过 `setAlarm()` 安装最早调度；任一步失败则全部回滚。
13. decision 要求广播时，广播已提交 state。
14. 返回 committed revision 和 domain result。
15. effect 独立 drain，不能改变已提交命令的返回语义。

### 13.3 Idempotency

HTTP retry 和连接恢复可能重复发送 command。`commandId` 是结构性方案，不是客户端用时间戳 debounce 的补丁。

```sql
CREATE TABLE command_receipts (
  command_id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  actor_kind TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  controlled_seat INTEGER,
  command_type TEXT NOT NULL,
  request_json TEXT NOT NULL,
  decision_kind TEXT NOT NULL,
  revision INTEGER NOT NULL,
  random_seed TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
```

相同 ID 且 actor/request 完全相同才返回存储结果；相同 ID 配另一 actor 或 body 返回
`command_id_conflict`。新 ID 才按当前 state 执行。当前 bounded policy 是七天，并且只清理没有任何
outbox row 引用的过期 receipt；terminal failed effect 的 origin receipt 会继续保留。

客户端由 `RoomCommandSession` 持有当前 `(roomCode, userId)` 身份及待决命令。一个用户意图通过 canonical
JSON key 只 prepare 一次 immutable command envelope；并发的同一意图共享 in-flight promise。普通 HTTP
retry、401 refresh、连接恢复和用户再次触发仍重发同一个 envelope。只有收到 canonical command decision
才释放 ID；404 `no_state`、网络、timeout、5xx、overload 和协议解析异常都保留原 envelope。离开房间或切换
用户会增加 session generation，旧请求即使晚到也不能把 snapshot 写进新 session。

音频 gate 这类跨连接 acknowledgement 由 orchestrator 持有 prepared command，并通过同一个 session
发送；它和普通 action 服从相同的 command ID 生命周期，不维护第二套 retry 语义。

### 13.4 Result model

公共 HTTP 边界只返回一个由 platform protocol 编解码的结果 envelope：

```ts
type RoomCommandResult<TState> =
  | {
      kind: 'committed';
      commandId: string;
      snapshot: RoomSnapshot<TState>;
      outcome: { kind: 'success'; reason?: string } | { kind: 'domainRejected'; reason: string };
    }
  | {
      kind: 'rejected';
      commandId: string;
      reason: string;
    };
```

- `committed` 必须携带 snapshot；零 event 的幂等命令返回当前 revision 的 snapshot。
- `rejected` 表示没有 state transition，但对应 actor/request 的 terminal receipt 已持久化。
- `sideEffects`、event、outbox row 和 engine decision 都是 Worker/DO 内部数据，禁止序列化到公共 HTTP 响应。
- Worker encoder 和客户端 decoder 必须引用 `platform/protocol/commandResult.ts` 的同一个 contract。
- 客户端在应用 snapshot 后只把 domain outcome 交给 UI，UI 不读取 transport metadata。
- 客户端必须验证 response `commandId` 等于 immutable prepared command 的 ID。
- 未知字段、缺失 snapshot、非法 state 或 revision 都是协议错误，直接 fail fast，不改写成 domain rejection。
- `no_state` 是“尚无权威 room state”的 availability 结果，HTTP 返回 404，不能伪造成 receipt-backed
  `RoomCommandResult`。客户端保留原 command ID，待房间可用后仍可重发同一 envelope。
- D1 room code 路由到的 DO 若持久化了另一 room identity，属于目录/存储完整性损坏，直接抛错并上报；不能
  返回可被 UI 当成业务拒绝的 `room_code_mismatch`。

预期业务拒绝返回稳定 reason code：

- `command_id_conflict`
- `seat_taken`
- `invalid_seat`
- `game_in_progress`
- `not_host`
- `room_effects_pending`
- `fib_round_not_full`
- `fib_round_already_ongoing`

Reason code 全仓使用 lower snake case；Worker、engine、client translation 和测试引用同一常量，不允许同一含义
再出现 `ROOM_NOT_FOUND`、点分名或游戏自造别名。

持久化损坏、未注册 module、非法 persisted JSON、unsupported state version 直接抛错并上报 Sentry，不在 domain 层转换成笼统的“请稍后重试”。

狼人杀 action input 也必须只有一种 canonical 表示：跳过统一为 `{ kind: 'skip' }`，确认执行统一为
`{ kind: 'confirm' }`。`target: null` 只保留给 `wolfVote` 的合法空刀；空多选、全空 witch input 或
`confirmed: false` 都不能再充当第二种跳过协议。Worker schema 和 engine adapter 在边界拒绝这些重复表示。

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

D1 room row 保存不可复用的 `room_instance_id`、`game_type`、`host_user_id`、`creation_id` 和
status。四位 `roomCode` 只是可复用的公开目录 key，不能同时充当 Durable Object identity：目录 row
消失后，旧 DO storage 仍可能存在；若新房继续按 room code 路由，就会把两个房间错误地绑定到同一个
authoritative state。

新 room instance 使用 `GAME_ROOM.newUniqueId()` 分配，字符串形式持久化到 D1；command、state、revision、
delete 和 WebSocket upgrade 都先解析 active directory row，再用 `idFromString()` 取得同一个 stub。任何
绕过目录、直接按 room code 构造 DO ID 的路径都属于架构错误。

### 15.2 Create flow

1. 解析显式 `gameType` 和通用 create envelope。
2. 分配不可复用的 room instance ID，以 `creating` 状态插入唯一 room code、instance ID 和
   `creationId`。
3. 使用该 instance ID 路由 DO，并以相同 `creationId` 调用 `initializeRoom`。
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
  origin_command_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  game_type TEXT NOT NULL,
  effect_type TEXT NOT NULL,
  business_key TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL,
  attempt_count INTEGER NOT NULL,
  available_at INTEGER NOT NULL,
  created_revision INTEGER NOT NULL
);
```

Effect 以 outbox ID 和 game-specific business key 保证 idempotent。Alarm handler 是 generic scheduler，按持久化 game type 调用 module effect handler。

一个 DO 只有一个 alarm，因此 settlement 和 word generation 都通过同一个 outbox scheduler，不再各自维护不相关的 alarm key 和 retry loop。

### 17.3 Commit 语义

- State 一旦 commit，effect delivery 失败也不能把 command response 改成失败。
- 每次投递前原子增加 `attempt_count`、把 `available_at` 移到 watchdog 时间并安装 alarm；Worker 在外部
  I/O 中断时，watchdog 会重新取得该 row。
- Effect 失败记录错误和指数 backoff，再安排同一个 row；不创建第二套 retry key。
- Retry 用尽后保留 failed outbox row 和 telemetry，不静默删除。
- Effect handler 可以发送 internal idempotent command，但不能绕过 command pipeline 直接改 state。
- 只要 outbox 存在 `pending`、`processing` 或 `failed` row，房间删除就返回
  `room_effects_pending`，不能先删 DO 再丢失尚未完成的业务 effect。

狼人杀 growth effect 使用 D1 `game_settlement_results(effect_id, user_id)` 保存精确 XP、等级和票券结果。
奖励 RNG 从 `effectId + userId + rewardType` 确定性派生；stats、阵营记录和结果 ledger 在一个 D1
`batch()` transaction 内提交。DO 在重试时读取原结果，使用稳定 internal command ID 更新 roster。

### 17.4 Durable user event inbox

Settlement UI 通知不是 best-effort WebSocket side effect。Worker 先把每名用户的确定性 event ID 与完整
payload 写入 D1 `user_event_inbox`，相同 `(userId, eventId)` 只允许完全相同的 payload。然后才尝试推送给
在线 socket：

1. WebSocket 建连后读取该认证用户最早的未确认 event。
2. 客户端 facade 消费事件后发送严格的 `USER_EVENT_ACK`。
3. Worker 只按 socket 身份删除该用户自己的 row，再发送下一条，形成顺序 backpressure。
4. listener 抛错、断线或 ACK 丢失都不删除 row；重连后至少一次重放。
5. 客户端按 `eventId` 去重展示，但重复投递仍再次 ACK；同 ID payload 改变属于协议损坏。

该 inbox 属于 user scope，不依赖房间 DO 生命周期，因此房间删除不会丢失已提交的 settlement 通知。

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

Shared UI 直接接收权限。实现使用判别联合强化最初的 boolean 草图：不允许时类型上不存在
`execute`，防止“按钮隐藏但 mutation callback 仍可调用”的双重权限通路。

```ts
type RoomCapability<Args extends readonly unknown[] = [], Result = void> =
  | { readonly isAllowed: false; readonly reason: string | null }
  | { readonly isAllowed: true; readonly execute: (...args: Args) => Result };

interface RoomCapabilities {
  readonly canTakeSeat: RoomCapability<[seat: number]>;
  readonly canMoveSeat: RoomCapability<[seat: number]>;
  readonly canLeaveSeat: RoomCapability;
  readonly canKickSeat: RoomCapability<[seat: number]>;
  readonly canClearSeats: RoomCapability;
  readonly canFillBots: RoomCapability;
  readonly canConfigureGame: RoomCapability;
  readonly canViewProfiles: RoomCapability<[target: RoomProfileTarget]>;
  readonly canTakeOverBots: RoomCapability<[seat: number]>;
  readonly canShareRoom: RoomCapability;
  readonly shouldConfirmExit: boolean;
}
```

Shell 不 import `GameStatus` 或 `FibPhase`，也不根据 generic `ongoing` 猜 `canKickSeat`。Game adapter 按自己的 phase 和 actor 穷尽式派生 capabilities。

Capability 的 `execute` 表示一个完整 UI intent，不暴露 raw room mutation。比如 `canMoveSeat.execute(5)`
打开明确的“换座”确认，确认后才由 `useRoomSeatController` 私有调用原子的 `room.seat.take`；不能在 UI
组合 `leave + take`。Mutation result、submission lock、reason mapping 和异常反馈都属于 controller，不能再由
screen、dispatcher 或 component 建第二条提交路径。

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
- `gameOverlays`：choose-card、night-review、nomination 等不属于 shared modal 的游戏弹窗。

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
- `RoomSeatBoard` 使用 lazy data source，不能要求调用者预先创建所有 seat model。实现采用 React Native
  `VirtualizedList` 的 opaque data + `getItem` + `getItemCount` contract，只读取当前 window 的 seat。
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
Disabled button 使用 `isEnabled: false` 分支，只能携带显式 `onDisabledPress` 反馈或 `null`；不能保留可提交
mutation 的 `onPress` 再通过 `fireWhenDisabled` 绕过 disabled 状态。

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

Home 的创建命令打开现有 centered modal。选项来自 `ClientGameModule.home.mode`，由
`createClientGameHome()` 穷尽聚合，包含 icon、游戏真名和简短类别。即使当前 catalog 只有一个游戏，也保留
显式选择；Home 不用“只有一个选项”作为默认进入狼人杀的理由。

Home 不再维护 `handlePickWerewolf`、`handlePickFib`。它只把所选 `gameType` 交给 generic create route。

随机角色、板子发布公告等 concrete game 内容也属于 `GameHomeContribution`：

```ts
interface GameHomeContribution {
  mode: GameModePresentation;
  spotlight: React.ComponentType | null;
  announcementTabs: readonly GameAnnouncementTabContribution[];
}
```

因此 `HomeScreen` 不 import role、template、game asset 或具体 game module。公告 modal 只渲染 catalog
提供的 tab content；tab key 使用 `<gameType>:<localId>`，重复注册立即 fail fast。

### 24.2 Generic host screens

Root navigation 使用稳定、游戏中性的 host route：

```ts
type RootStackParamList = {
  GameConfig: GameConfigRouteParams;
  GameGuide: GameGuideRouteParams;
  GameNotepad: GameNotepadRouteParams;
  Room: { roomCode: string; entryReason?: 'created' };
};
```

每个游戏在自己的 `navigation/` 中声明一个 `GameNavigationDefinition`。客户端唯一的
`CLIENT_GAME_PLUGIN_CATALOG` 同时注册 module factory 和 navigation definition；它是唯一允许同时 import
多个具体游戏的客户端文件。`config/guide/notepad` 每项只能是
`{ kind: 'screen', parseParams }` 或 `{ kind: 'unsupported' }`；`bindGameNavigation()` 根据 definition 在编译期
精确要求受支持 screen，禁止给 unsupported route 绑定 screen。`null` screen、`never` route extension 和另一张
capability boolean 表都不存在。

`src/games/navigation.ts` 只从上述 plugin catalog 投影 route contract：`GameConfigRouteParams/
GameGuideRouteParams/GameNotepadRouteParams` 直接从已注册 definition 的 parser 返回类型推导，不再维护第二份
具体游戏清单。`GameHostRoutes.tsx` 从
`ClientGameCatalog` 读取同一个已绑定 capability 并先执行其 parser 再渲染；`AppNavigator` 的 deep-link parent
stack 也通过组合后的同一个 definition 解析。游戏不支持某 route 时，类型联合不会包含该游戏，外部 deep link
在进入 screen 前 fail fast，不 fallback 到狼人杀。`Room` 继续是唯一公开房间 URL，并由
`RoomResolverScreen` 读取权威 metadata 后选择 module。

Root stack 不注册 `BoardPicker`、`Config`、`GameRules`、`Encyclopedia` 或 `Notepad` 等狼人杀页面。狼人杀的
`BoardPicker -> Config -> Rules` 是 `WerewolfConfigFlowScreen` 内部 native stack；创建、编辑、板子提案三种
入口先由纯 `werewolfConfigFlow.ts` 严格解析，再映射到内部初始 route。跨出 flow 的行为只有三个显式回调：

- 退出配置 flow。
- 返回权威 `Room` route。
- 用服务端确认的 room code 进入新房。

子页面的业务完成路径不通过 `as never`、root route 名或隐式 action bubbling 访问其他游戏/产品页面。新增游戏
只注册自己的 flow contribution 和 exhaustive route extension，不修改 `AppNavigator` 或 `HomeScreen`。

Canonical linking path 为：

```text
/game/:gameType/config/:mode/:roomCode?
/game/:gameType/guide/:roomCode?
/game/:gameType/notepad/:roomCode
/room/:roomCode
```

`gameType` 与 room code 在外部输入边界解析；config `mode` 由对应游戏 flow 解析，避免 generic navigator
枚举 `nominate` 等游戏专属意图。旧 `/config`、`/board-picker`、`/encyclopedia`、`/notepad/*` 不保留 alias。

### 24.3 Screen folder 一致性

每个游戏采用相同内部结构：

```text
games/<game>/
├── components/
├── home/
├── navigation/
├── screens/
├── room/
├── runtime/
├── services/
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
6. 实现一个 client game module、Home contribution、game-owned config flow、room adapter 和玩法 screen。
7. 加入穷尽式 client catalog。
8. 添加 create、join、deep link、room shell 和主玩法测试。

新增游戏不应修改：

- `GameRoom.ts`
- `actionPipeline.ts`
- `RoomShell.tsx`
- Shared room controllers
- `HomeScreen.tsx`
- `AppNavigator.tsx` 与 `GameHostRoutes.tsx`
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
- workspace package scope 一次性改为中性命名且不保留 alias。
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

| 主题               | 决策                                                                       |
| ------------------ | -------------------------------------------------------------------------- |
| Game ID            | 一个 canonical `GameType` union                                            |
| Engine API         | 每个游戏完整 typed strategy                                                |
| Runtime validation | Worker game module schema                                                  |
| Registration       | 每个 runtime 一个 exhaustive catalog                                       |
| DO routing         | D1 room code → immutable instance ID；game type 与 state 同一个 DO SQL row |
| Dispatch           | 一个 authenticated generic command endpoint                                |
| Authorization      | Engine 用真实 actor + authoritative state 判断                             |
| Request retry      | Idempotent `commandId` receipt                                             |
| Effect             | Transactional outbox + generic alarm scheduler                             |
| Client transport   | 一个 generic `RoomSession`                                                 |
| Shared UI          | 一个真实 `RoomShell` + focused controllers                                 |
| UI permission      | Game-derived explicit capabilities                                         |
| Navigation         | Catalog-driven host + 单一 room resolver URL                               |
| Seat command       | 同一命名 + seating kernel                                                  |
| Fib scale          | Sparse humans + implicit bots + compact roles + lazy seats                 |
| Fib 出题           | Recoverable outbox workflow                                                |
| Compatibility      | 同 release migration 后删除                                                |
| Future game        | Vertical game module，不在 platform 加条件                                 |

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

| 阶段    | 状态   | 已完成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | 尚未完成                         |
| ------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| Phase 0 | 完成   | `main` 行为 contract、characterization test、四个 Werewolf E2E shard                                                                                                                                                                                                                                                                                                                                                                                                                   | -                                |
| Phase 1 | 完成   | canonical identity、shared roster/session/catalog、Werewolf UI/profile/cosmetic/audio/assets/Home/navigation 归位                                                                                                                                                                                                                                                                                                                                                                      | -                                |
| Phase 2 | 完成   | concrete engine、exhaustive catalogs、Worker schema、完整 Werewolf E2E                                                                                                                                                                                                                                                                                                                                                                                                                 | -                                |
| Phase 3 | 完成   | generic command、atomic DO storage、receipt/outbox、client cutover、durable user event                                                                                                                                                                                                                                                                                                                                                                                                 | -                                |
| Phase 4 | 完成   | creation saga、immutable locator、单一 deep link、resolver、定时 reconciliation                                                                                                                                                                                                                                                                                                                                                                                                        | -                                |
| Phase 5 | 完成   | shared shell/controllers、单一 RoomSession、entry/connection/command 下沉、runtime 归位                                                                                                                                                                                                                                                                                                                                                                                                | -                                |
| Phase 6 | 完成   | compact Fib state、implicit bots、word outbox、engine/Worker catalog、DO 恢复测试                                                                                                                                                                                                                                                                                                                                                                                                      | -                                |
| Phase 7 | 完成   | Fib client module、shared RoomShell、完整 round、真实 cold deep link、百万级人数与 320px 响应式 E2E                                                                                                                                                                                                                                                                                                                                                                                    | -                                |
| Phase 8 | 进行中 | engine/Worker/client ownership、Worker vertical features、migration-backed Worker tests、storage/room creation、navigation capability、scope 中性化、单一插件组合点、开放 module contract、Pictionary 编译门禁、严格 request boundary、Wrangler binding 单一权威、JWT principal 单一认证边界、provider payload runtime parsing、Worker test type-honesty、gacha atomic mutation ledger、Cloudflare request metadata 单一边界、game-engine 精确 subpath exports、client facade 身份删除 | fail-fast/命名残留清理、最终验收 |

Phase 0 与 Phase 2 的远端证据是 commit `16edbe4c` 对应 CI run `29124207971`：quality 和四个
Playwright shard 全部通过。该 run 的 `merge-reports` job 在零 step 时失败，属于报告聚合 job 配置问题，
不改变四个测试 shard 的通过事实；后续单独修 CI 配置，不把它混进游戏架构提交。

### 当前提交：Phase 3 delivery 与 protocol hardening

- Generic `GameRoom` 只接受 fresh storage 或当前 schema version。`0034_room_instance_identity_cutover.sql`
  已在同一 release 使旧 active room 失效，因此删除旧 `room_state` / `settle_pending` 猜测迁移；未版本化或
  future version 的 DO storage 直接 fail fast，不保留兼容 reader。
- 所有 public command 从 JWT actor 进入同一 pipeline；receipt 绑定 game/version、actor、controlled seat、
  command type 和 canonical request。accepted 与 engine rejection 都持久化，ID 换 actor/body 直接冲突。
- `no_state` 从 command decision 中分离为 404 availability；DO room identity 不一致改为完整性异常。所有
  canonical decision 使用 HTTP 200 返回并校验 exact command ID，避免 transport status 绕过协议验证。
- 新增 session-owned `RoomCommandSession`：canonical intent key、immutable envelope、同意图并发合并、未知
  delivery 保留 ID、room/user generation 隔离晚到 snapshot。普通 action、seat action 与 audio ACK 共用该
  生命周期，不再由每个 action 临时生成 retry ID。
- 狼人杀跳过协议收敛为唯一 `{ kind: 'skip' }`；engine 按权威 schema 转换到纯 handler intent，并拒绝
  `target:null`、空多选、全空 witch 和 `confirmed:false` 等重复表示。狼人空刀仍保留明确的
  `wolfVote + target:null` 语义。
- state、receipt、outbox row 与最早 alarm 在一个 DO storage transaction 提交；delivery claim 使用 watchdog
  lease，失败按同一 row backoff，达到上限保留 failed row。存在任何 outbox row 时禁止删除房间。
- 狼人杀结束 effect 使用 D1 精确 settlement ledger 与确定性 reward RNG；stats、camp 和 reward result 在一个
  D1 batch 提交，重试读取原结果，再用稳定 internal command ID 更新 roster。
- Settlement 通知改为 D1 `user_event_inbox` 的 authenticated at-least-once delivery：持久化后推送、socket
  identity ACK、逐条 replay；客户端只在 listener 成功后 ACK，并对重复 event 重发 ACK 而不重复展示。
- 删除狼人杀专用 `GameRoom`、public RPC、`gameProcessor`、`/game/*` 与 night routes；建房只发送
  `gameType + config + creationId`，客户端不再构造或上传初始 state。
- 客户端所有狼人杀 action 改走 authenticated `/room/command`，玩法 input 不携带 actor seat/role；response
  校验 exact command ID，committed snapshot 先应用再返回 domain outcome，协议损坏直接失败。
- 音频 ack 在首次发送与 reconnect/online recovery 间复用同一个 prepared envelope；收到 terminal result
  后才释放。房主进入新房只接受 connection sync 的服务端快照，缺失或 identity 不符立即失败。
- Worker runtime 以 committed state event 推进 revision，即使 event 的最终 JSON 值相同；同时强制 state
  event 与 broadcast 一致，防止同 revision 广播触发客户端 protocol close。
- 公共 room code 与 DO identity 已分离：D1 `rooms.id` 保存 `newUniqueId()`，所有 HTTP/WS 路径先查目录再
  `idFromString()` 路由。`0034_room_instance_identity_cutover.sql` 明确使旧 routing model 的 active room
  失效，不保留按 room code 访问旧 DO 的兼容分支。
- Realtime 对每个 socket 要求 revision 严格递增；durable user event 使用独立 event ID/ACK contract，不把
  user notification 混进 state revision。
- 本提交完整 `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全部通过；root
  183 suites/4823 tests、game-engine 79 suites/2352 tests、api-worker 10 files/81 tests 全部通过。
- 额外定向门禁：game-engine command/adapter 52 条、client Piper/skip/facade 28 条通过；本地
  `piper skips -> night ends normally` Playwright 1/1 通过。
- commit `fa281458` 对应 CI run `29130480914` 的 quality 与 shard 1/2/4 通过；shard 3 的唯一失败被 trace
  定位为旧 UI 用 `{kind:'target',target:null}` 表示 multi-select skip，新 engine 正确拒绝为
  `action_input_mismatch`。本提交从协议根部消除重复表示，推送后的完整四 shard 仍是 Phase 3 退出门禁。
- commit `055b4a1f` 对应 CI run `29132638988`：quality 与四个 Werewolf Playwright shard 全部
  通过。workflow 总状态失败仍只来自零 step 的 `merge-reports` job，不是产品或测试失败；Phase 3
  据此满足退出条件并标记完成。

### 当前提交：Phase 4 room directory saga 与 canonical entry

- D1 `rooms` 现在是显式 saga directory：`creating | active | deleting | failed`、唯一
  `creationId`、canonical `configJson`、失败操作、错误、重试次数和下次 reconciliation 时间都在同一
  authority row。建房码只由 Worker 分配，客户端不再生成或提交 public code。
- 创建流程按 `creationId + actor + gameType + canonical config` 精确重放；DO 初始化成功但 D1 未激活时，
  五分钟 cron 会继续 activate。删除先由 DO 校验房主和 outbox，再把 D1 标记 deleting，最后删除 DO storage
  和 exact directory row；任一步中断都由同一 saga 向前恢复，不 catch-delete、不回滚已提交的另一存储。
- `0036_room_directory_saga.sql` 把 participant/game-start 外键从可复用 `room_code` 改到 immutable
  `room_id`。本分支的 `0034_room_instance_identity_cutover.sql` 已明确清空旧 routing model；两者在同一
  未发布 release 顺序执行，因此不保留旧房间兼容 reader。`wrangler d1 migrations apply --local` 已验证
  0036 的 14 条命令全部成功。
- `RoomLocator = {roomCode, roomId}` 成为共享协议。只有 `/room/get` 用 public code 做一次 discovery；
  command、state、revision、delete 和 WebSocket 全部要求 exact locator。Worker 再把 D1 的 `creationId`
  注入 DO RPC，DO 同时核对 `ctx.id`、room code 和 creation identity。四位 code 被复用后，旧 tab 返回
  `room_instance_mismatch`，不会进入新房或把旧 effect 写给新房。
- Active D1 row 若读不到 DO snapshot/revision，按跨存储完整性错误返回 500，不伪装成“房间不存在”。
  所有 authority read 都解析 DO ID、game type、canonical JSON、状态组合、时间和计数；损坏行立即失败。
- 客户端把 canonical creation intent 与 `creationId` 持久化到 MMKV。网络结果未知或 App 重启时复用同一
  ID；Config 先持久化可恢复的 recent-room 入口，再 acknowledge 并发出 Room navigation，terminal 4xx
  才删除。
- 新 `RoomResolverScreen` 先读取 metadata，再通过 exhaustive client catalog 选择游戏 UI；唯一 URL 是
  `/room/:roomCode`，navigation 不携带 host/template，不对 missing 或 unknown game 回退狼人杀。Pages OG
  handler 同样只接受四位 canonical code，并使用游戏中性的中文标题。
- Reconciliation cron 每五分钟执行；daily cleanup 中 room expiry、room reconciliation、anonymous user、
  login attempt、idempotency 和 WeChat claim cleanup 分别执行并最后聚合错误，一个失败不会阻止后续任务。
- 新增 interrupted create/delete、outbox-blocked delete、stale room instance、active-row/missing-DO、
  noncanonical D1 row、daily task isolation、locator/canonical JSON、resolver 和 creation-intent restart tests。
- 本提交完整 `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全部通过；root
  183 suites/4834 tests、game-engine 82 suites/2373 tests、api-worker 12 files/88 tests 全部通过。首次完整
  gate 暴露 7 个 RoomScreen test fixture 仍把 `useGameRoom.enterRoom` mock 成 `Promise<void>`；测试现已按
  `RoomInitResult` 的真实 contract 返回显式 success，没有给生产初始化路径增加 fallback。
- commit `a517b88f` 对应 CI run `29135328507`：quality 与四个 Werewolf Playwright shard 全部通过。
  workflow 总状态仍只因零 step 的 `merge-reports` job 失败；Phase 4 据此满足退出条件并标记完成。
- 阶段状态：Phase 4 已完成。Phase 5 从稳定狼人杀 UI 反向抽取真实 shared room feature，不先造第二套壳。

### 当前提交：Phase 5 shared room shell 第一批 cutover

- 新建 game-neutral `RoomCapabilities`、`RoomSeatDataSource`、`RoomBottomActionModel` 和
  `RoomShellModel`。Capability 使用 allowed/denied 判别联合，denied 分支没有 `execute`，权限同时约束
  可见性和执行入口。
- 狼人杀 adapter 负责把 `GameStatus`、角色名、wolf highlight、night progress、bottom layout 和真实 command
  转成中性模型；`src/features/room` 新增 import-boundary gate，禁止反向 import 狼人杀 model、旧 RoomScreen
  或 `src/games/*`。
- 狼人杀已经真实渲染 `RoomShell`，共享 header、connection/status ribbon、controlled-bot banner、seat board
  和 bottom panel；原组件已从旧目录移动，没有 compatibility export 或第二套 JSX。
- `RoomSeatBoard` 改为 windowed indexed source。10,000 座位 component test 证明只读取 rendered window；
  狼人杀继续从现有 12/15 人 view model 生成 source，后续 Fib 不需要创建 N 个空座对象。
- Bottom button 把 enabled mutation 与 disabled feedback 分成互斥类型；host action submitting 时不再保留第二次
  submit callback，只有“等待房主”可携带明确的只读提示行为。
- 本地定向门禁：shared/adapter/RoomScreen 77 suites/1019 tests 通过；运行中补齐 `stateRevision` fixture 后，
  mock-shape contract 已在新进程独立复跑 1 suite/3 tests 全部通过。浏览器
  `single player manual seat shows green seat badge` Playwright 1/1 通过，并人工检查 1280×720 截图的 header、
  六列 seat geometry 和 bottom safe-area。
- 最终 gate 暴露 api-worker 旧测试把 `Date.now()` immediate alarm 当成可由
  `runDurableObjectAlarm()` 独占触发：runtime 先领取 alarm 时 helper 返回 false，测试却直接读 D1，与 effect
  drain 形成竞态；同文件的其他测试还会把 alarm 留到测试结束。现在 delivery contract 在
  `runInDurableObject` 的事件边界内调用真实 `GameRoom.alarm()` 并断言 pending outbox 被清空；统一
  `afterEach` 使用 `listDurableObjectIds()` 删除本文件创建的 GameRoom alarm，符合 Cloudflare 当前测试隔离
  约束，不加 sleep、轮询或重试。相关 2 files/22 tests 通过，完整 api-worker 12 files/88 tests 连续三轮通过。
- 下一批删除 profile、seat、share、bot、connection 的重复本地状态，完成 take/move/leave 三态确认和 direct
  kick，再把剩余狼人杀 screen/hooks/policy/tests 一次性归位到 `src/games/werewolf`。

### 当前提交：Phase 5 focused room controllers 与 capability 单通路

- 新增 `useRoomSeatController`、`useRoomProfileController`、`useRoomBotControl`、`useRoomConnection` 和
  `useRoomShareController`。每个 controller 只拥有一个功能域的 state/transition；没有接收 `GameStatus`、角色、
  night schema 或 Fib phase，也没有新建一个聚合所有 selector/command 的大 hook。
- Seat confirmation 使用 `take | move | leave` 判别联合。未入座点空位是“入座”，已入座点另一空位是“换座”，
  本人 profile 的“离座”先关闭 profile 再走同一个离座确认。换座只提交一次权威 `room.seat.take`，由 engine
  seating kernel 原子清旧座并占新座，客户端不拼接两条命令。
- `RoomCapabilities.execute` 改为完整 UI intent，dispatcher 不再持有 raw `takeSeat`、`leaveSeat`、`kickPlayer`
  或 profile primitive state。Seat/profile/bot interaction 只执行 capability；denied capability 若仍被狼人杀 policy
  产出则按内部一致性错误 fail fast。
- Profile 的本人身份只比较 authoritative `target.userId === myUserId`，不再按 seat 猜测；occupant kind 由房间
  roster 显式提供，不再用 `userId.startsWith('bot-')`。移出座位是 profile controller 的 direct kick，不存在
  `KICK_CONFIRM` producer/type/switch；本人离座必须执行 `canLeaveSeat`。
- Controlled bot seat 的唯一 local state 已移到 shared bot controller；狼人杀仍独占 Host/debug/audio phase gate、
  effective role、actor identity 和 command envelope。重开游戏只在确实控制 bot 时 release，不再暴露可写任意
  `number | null` 的 setter。
- `RoomShell` 现在直接拥有 `RoomSeatConfirmModal` 和 `QRCodeModal`。旧 `useRoomSeatDialogs`、`useRoomInit`、
  screen-local QR state、旧 modal 路径和对应 mock 已删除，没有 re-export 或 compatibility layer。Share copy/title
  接收 game display name，不再硬编码“狼人杀”；QR pre-capture 改由 layout 与 logo load 事件驱动，分享 loading
  跟随真实 Promise，不再使用 500ms/2000ms timer。
- Connection entry 用 React 19.2 `useEffectEvent` 分离 callback freshness 与 room/retry synchronization；callback
  identity 变化不会重新进房，retry generation 会丢弃 superseded attempt。Web Share 的 cancellation/error 分类与
  file capability check 按当前 MDN contract 实现，React Native share 保留 `dismissedAction` 语义。
- 定向门禁：focused controller 4 suites/12 tests、adapter/policy/profile/share 4 suites/61 tests、代表性
  RoomScreen/board/shared component 10 suites/79 tests、architecture contract 340 tests 全部通过。完整
  `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全绿；root 187 suites/4812 tests、
  game-engine 82 suites/2373 tests、api-worker 12 files/88 tests 全部通过。
- Phase 5 仍未完成：`PlayerProfileCard` 还需拆成 shared frame/query/actions 与狼人杀 camp details slot，shared
  profile 必须由 `RoomShell` 直接渲染；随后把剩余 Werewolf screen/hooks/policy 归位并完成截图与 interaction gate。

### 当前提交：Phase 1/5 Werewolf client ownership 与 shared profile

- `PlayerProfileCard`、测试和 profile model 已移入 `src/features/room`，并由 `RoomShell` 直接渲染。
  shared card 只拥有 query、基础资料、装备和 capability action；狼人杀阵营分布与内置角色头像名通过
  `WerewolfProfileDetails` extension 注入。Bot 身份只读取 roster 的 `occupantKind`，不按 user ID 前缀猜测。
- 原 `src/screens/RoomScreen` 的 123 个生产/测试文件完整移动到
  `src/games/werewolf/room`。公开入口改为 `WerewolfRoomScreen`，screen state 与 helper/style 文件使用
  Werewolf 所有权命名；没有旧路径 export 或转发层。
- 根目录中直接绑定 `IGameFacade`、`GameStatus`、`RoleId` 或狼人杀 action 的 room/action/debug/BGM/
  ack/settlement hooks 已移动到 `src/games/werewolf/hooks` 并使用 `useWerewolf*` 名称；state projection
  移到 `src/games/werewolf/state/toWerewolfLocalState.ts`。generic `useConnectionStatus` 暂留根目录，下一批
  随 shared `RoomSession` 一起中性化。
- ActionIntent execution 删除 mutable registry、重复 registration 和第二份 exhaustive check，改为一个
  `satisfies CompleteExecutorMap` 的静态穷尽表。缺少 variant 直接 typecheck 失败，不再存在“未处理再走旧
  switch”的返回协议。
- `toGameRoomLike` 只接受 `LocalGameState.wolfVotes` 的必填 `Map`；删除 plain-object 旧状态 cast、转换分支
  和对应兼容测试。`lastNightDeaths` 同样按 `LocalGameState` 必填类型读取，不再为无效 null fixture 加 fallback。
- Architecture contract 现在扫描 `src/games/werewolf`，禁止 services 反向 import game UI、跨 game import，
  并锁定旧 `RoomScreen`、根级 Werewolf hooks 和旧 state adapter 必须不存在。`agents/path-rules`、new-role
  skill 与现行设计文档路径已同步。
- 定向验证：`pnpm exec tsc --noEmit` 通过；移动后的 room 67 suites/950 tests、profile/hooks/state/policy
  14 suites/341 tests，以及 executor/helper 20 suites/279 tests 全部通过。
- 测试发现范围做了迁移前后对账：同一提交基线的 root Jest 为 187 suites/4812 tests；把 authority、style
  contract 的扫描根从 `screens/components` 扩展到 `features/games` 后，当前为 187 suites/4927 tests。
  `hooks.boundary` 对缺失文件直接抛错，不再用 `existsSync` 静默跳过，因此目录归位不会减少实际执行覆盖。
- 浏览器 interaction gate 原样通过 4/4：手动入座并打开本人 profile、房主直接移出、原子换座、本人离座。
  首次运行复用旧 Metro 时首页 bundle 返回 HTTP 500；没有修改 timeout/helper，bundle 重建后同一测试和
  完整四条均通过。成功截图已检查 header、配置区、六列 seat board 和 bottom panel 几何。
- Phase 1/5 仍未完成：auth entry、seat transport、connection status 仍由 Werewolf facade hook 承担。
  下一批建立 shared `RoomSession`，再删除 app-wide `GameFacadeContext` 的 runtime 组合方式。

### 当前提交：Phase 5 shared contract 与 game-owned public stats

- `NightProgressIndicator/currentRoleName/nightProgressIndicator` 完整改为
  `RoomProgressIndicator/currentLabel/progressIndicator`；`RoomStatusRibbonModel` 继续只接收 game adapter
  提供的 label，不解释狼人杀 night/role。旧文件、test ID、style type 和 import 不保留 alias。
- Shared seat contract 只暴露 `danger | selected | controlled`、`badgeText` 和 `seatPetId`。`RoomSeatTile`
  不再出现 `wolfRing/wolfVoteBadge/playerRoleRevealEffect/colors.wolf`；Werewolf adapter 负责把
  `isWolf/wolfVoteBadge/roleRevealEffect` 映射为中性 presentation model。
- `/api/user/stats` 与 `/api/user/:userId/profile` 删除 `campStats`；公开 profile 的产品特效字段从
  `roleRevealEffect` 直接切为 `revealEffect`，没有双字段读取。阵营统计迁入
  `packages/api-worker/src/games/werewolf/publicUserStats.ts`，继续统一执行两小时可见性规则。
- Worker module 新增必填 `parsePublicUserStats/getPublicUserStats` contract。通用
  `/api/games/:gameType/users/:userId/stats` 在 `isGameType` 后从唯一 catalog dispatch；未知 type 返回 404，
  module output 由 game-engine `parseWerewolfPublicStats` 校验 identity、四个 bucket、非负整数和总数一致性。
- `CampDistributionBar/campVisual` 移入 `src/games/werewolf`。`GameUiModule` 必填注册
  `accountStatsSection`，Settings 枚举 exhaustive client catalog 渲染，不 import Werewolf component，也不新增
  game type 条件；room profile 的 extension 只接收 React content，不读取 game-specific profile DTO。
- Architecture contract 禁止 shared room 再出现 `campStats`、`roleRevealEffect`、`wolfVoteBadge`、
  `wolfRing`、`NightProgressIndicator` 或 `currentRoleName`。全仓旧路径和 shared semantic 扫描为零。
- 定向验证：root typecheck、game-engine build 通过；game-engine 1 suite/5 tests、api-worker 12 files/90
  tests、root 12 suites/456 tests 全部通过。单独 api-worker `tsc --noEmit` 被该 package 现有 TypeScript 6
  `baseUrl` deprecation gate 拒绝；未添加 ignore flag，最终以标准 `pnpm run quality` 验收。
- Phase 5 下一批：把 auth/entry/connection/seat command 下沉为 shared `RoomSession`，删除
  `useWerewolfRoomLifecycle` 中的平台职责和 root `useConnectionStatus` 的 `IGameFacade` 绑定。

### 当前提交：Phase 5 单一 RoomSession 与 game-owned runtime 收口

- `src/features/room/session/RoomSession.ts` 是唯一 active-room session 实现，也只在
  `src/app/createAppServices.ts` 实例化一次。它的 immutable snapshot 同时表达 room identity、session
  epoch、connection phase、authoritative snapshot、last committed command 和 terminal error；UI 不再组合
  facade state、connection hook 与 room record 三份状态。
- `RoomSession` 拥有 command ID、prepared intent、同意图并发去重、epoch 隔离、delivery-unknown retry
  与 user-event ACK。Seat command 只使用 `room.seat.take/leave/kick/clear/fillBots` 一套协议名，
  狼人杀不再保留 `takeSeat/leaveSeat` 等平行 transport。Command outcome 明确区分 committed、
  domain rejected、not decided、delivery unknown 和 superseded，不用 boolean 猜测服务端是否提交。
- `ConnectionManager` 只重试可恢复的网络故障。WebSocket 1002、无效 snapshot、active room 返回
  null state、state/event callback 破坏 contract 都立即进入 protocol failure，关闭 socket 并停止 retry；
  prefetch grace race 会清理未命中 timer，不留 open handle。Abort 会立即使 connect/reconnect 失效并
  断开当前 epoch，不等待底层 request 自行结束。
- `useRoomEntryController` 和 `RoomEntryBoundary` 是唯一 auth/entry/retry/reconnect/exit 边界。
  等价 `RoomRecord` 按所有 identity field 稳定化，不因 React object identity 重连；并发手动重连
  直接 fail fast。Game-owned hooks 只在 boundary ready 后 mount，因此狼人杀 `gameState` 和 status 是必填，
  已删除 `no_game_state` 分支与为未初始化状态准备的 fallback UI/policy。
- Room directory 与 state 读取拆成 `IRoomDirectoryService` / `IRoomStateService` 及对应 Cloudflare
  adapter。`/room/create` 只返回 directory metadata，creation saga 内部校验 state；游戏 codec 不再泄漏到
  game-neutral directory port。
- 原 app-wide `GameFacadeContext`、`IGameFacade`、`src/services/facade`、`IRoomService`、
  `CFRoomService`、`useRoomConnection`、`useConnectionStatus` 和 `useWerewolfRoomLifecycle` 已删除，没有
  alias、re-export 或 compatibility adapter。狼人杀 command/audio orchestration、client contract 与 context 全部归入
  `src/games/werewolf/runtime`；shared room 和 production services 对 `src/games` 的反向 import 为零。
- Architecture contract 锁定上述已删除路径必须不存在、全仓只有一个 `class RoomSession`、shared
  room 不得出现 game semantic type。Room UI test 通过 ready-content harness 测试真实 game content，不伪造
  第二个 provider/session 来绕过 entry contract。
- 最终 `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全绿；root
  188 suites/4966 tests、game-engine 83 suites/2378 tests、api-worker 12 files/90 tests 全部通过。
  Phase 5 Playwright 回归 `entry-flow` 6、`seating` 6、`rejoin` 2、`reconnect` 4，共 18/18 通过；
  包含 30 秒离线恢复和 5 次 online/offline flapping，没有修改 helper、timeout 或 retry 规则。
- Phase 5 至此收口；Phase 6 未启动。

### 当前提交：Phase 1 shared roster 所有权收口

- `RosterEntry` 从狼人杀 `protocol/types.ts` 移到 `platform/room/roster.ts`，成为房间展示资料的唯一类型来源；
  狼人杀 state 继续组合该 shared 类型，不保留旧路径 re-export 或 compatibility alias。
- game-engine root export 与 package subpath 直接指向 shared roster；严格 Werewolf state parser、reducer、bot
  roster 和客户端 state projection 全部切换到新所有权，wire shape 和运行时行为不变。
- game-engine architecture contract 枚举 `games/*` 生产目录，禁止相对路径或 package subpath 导入其他游戏
  module，也禁止 game module 反向导入 games catalog。新增第三个游戏时该边界自动进入测试范围。
- 定向验证：Werewolf state parser、template reducer 与 architecture contract 共 3 suites/44 tests 通过。
- Phase 1 仍进行中：config/notepad/AI chat 的 Werewolf 所有权与剩余边界 exception 尚未收口；Phase 6
  仍未注册 `fibking`，继续遵守 engine、Worker、client catalogs 原子启用规则。

### 当前提交：Phase 1 单一客户端装配根

- 新增 game-neutral `GameSessionFactory` contract；生产端只有
  `CloudflareGameSessionFactory` 可以实例化 `RoomSession`，并统一绑定 state codec、user-event codec、
  Cloudflare state adapter、realtime transport 与 command ID。`createAppServices` 不再 import Werewolf codec、
  event、facade 或 state type。
- Client catalog 从 module-level singleton 改为 composition root 创建的 immutable runtime catalog。
  `createWerewolfUiModule` 在一个位置创建 typed session 和 `WerewolfGameFacade`，room screen 与 app overlay
  都绑定同一个 client，不存在第二个 session、provider 或 hidden singleton。
- App 只注入一个 `ClientGameCatalogProvider`；原 `WerewolfGameContext`、`WerewolfGameProvider` 和
  `useWerewolfGame` 已删除，没有 alias 或 compatibility export。导航 resolver、Settings 统计枚举及暂未归位的
  Werewolf 页面都通过同一个 catalog 读取已注册 module。
- Werewolf room composition 改为显式接收 module-bound client；`useWerewolfRoom`、room screen state、board
  nomination 与 AI chat overlay 不再依赖 per-game React context。App 不再读取 `GameStatus` 或直接渲染
  Werewolf overlay，game-owned overlay 作为 module contribution 挂载。
- Architecture contract 锁定 `RoomSession` 只有一个 class 且只由生产 session factory 构造；App/app composition
  root 禁止 import concrete game，具体 game slice 禁止创建 React context 或 `*GameProvider`。
- 完整 `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全绿；root
  188 suites/4984 tests、game-engine 83 suites/2393 tests、api-worker 12 files/90 tests 全部通过。
- Phase 1 仍进行中：Config、Notepad、AI chat 文件本体与 role UI 仍需归入 Werewolf slice，Settings/Appearance
  还需改用 game-neutral active-room profile capability；完成这些边界后才能开始 Fib 原子 vertical slice。

### 当前提交：Phase 1 Werewolf UI 与 client service 所有权归位

- `BoardPickerScreen`、`ConfigScreen`、`EncyclopediaScreen`、`GameRulesScreen`、`NotepadScreen` 连同测试完整
  移入 `src/games/werewolf/screens/`。根 `src/screens/` 只保留产品页面；旧目录不存在，也没有 index 转发或
  navigation compatibility route。
- AI chat、board strategy、faction UI、notepad panel、role card/description、role reveal effects、shader warmup
  与 reveal animation registry 全部移入 `src/games/werewolf/components/`。AI chat service/bridge 与 notepad hook
  分别归入 game-owned `services/`、`hooks/`；`LocalGameState` 从根 `src/types` 归入 Werewolf state。
- `triggerHaptic` 与 native capability detection 不含游戏语义，抽到产品级 `src/utils/haptics*.ts`；
  `PressableScale`、AI chat 与 role reveal 共用该实现，shared/product component 不反向 import game slice。
- Config 与 Notepad 不再从 `ClientGameCatalogContext` 查找自己的 runtime。Werewolf module 显式绑定同一个
  client 并注册 screen contribution；AppNavigator 只读取 module registration，不直接 import concrete screen。
- Architecture contract 锁定所有旧 screen/component/hook/service/type 路径必须不存在，并禁止根
  `src/components` import game module 或 concrete game-engine API。random、responsive layout、hardcoded style 与
  resolver authority 扫描都覆盖 `src/games`/`src/features`，目录移动不会降低测试覆盖。
- 定向验证：typecheck 通过；5 个 architecture/style suites 共 1084 tests、14 个移动后的 Config/AI chat/
  role reveal/component/service suites 共 171 tests 全部通过。
- Phase 1 仍进行中：Home 和 navigation param 仍含 Werewolf 模板/角色语义；Settings/Appearance/Gacha/Unlocks
  仍需通过 game-neutral profile/cosmetic contribution；AudioService registry、avatar role projection、role badge 与
  root engine integration tests 仍需按所有权收口。

### 当前提交：Phase 1 active-room account 与 product presenter 收口

- 新增 game-neutral `RoomAccountCapability`，只暴露 active room 的 `isSeated`、`canSwitchAccount`、
  `canSyncProfile`、`updateProfile`和 `leaveSeat`。`createActiveRoomAccountSource` 从穷尽式 client catalog
  选择唯一 active session；两个 session 同时 active 或 game type 不一致直接 fail fast。
- `WerewolfRoomAccountCapability` 在 game slice 内把 `GameStatus`、player map 和
  `WerewolfProfileUpdate` 投影为上述中性能力。Settings 与 Appearance 不再读 Werewolf session/facade/state；
  离座继续只 dispatch canonical `room.seat.leave`，资料更新改为单个 object command，无 positional
  overload。
- 账户 profile 是持久化权威，active-room roster 是明确的 projection。Settings/Appearance 现在同时处理
  rejected result 和 thrown error：记录原因并显示“资料已保存，房间内同步失败”，不再静默留下
  过期 roster，也不把 projection 失败误报为账户保存失败。
- 新增 strict `ClientProductUi`：generated avatar 名称属于 product catalog；手绘角色头像名和翻牌特效
  metadata/preview 由 Werewolf contribution 拥有。每个 item 必须恰好一个 owner，missing/duplicate
  都 fail fast。Appearance、Gacha、Unlocks、ShardExchange 已不再 import concrete game UI。
- 完整 quality 的 architecture contract 发现原始实现把 aggregate `GameUiModule` 放进 `features/room`，并让
  shared room 和 Werewolf slice 反向依赖 `games/model`。现已删除这两个错误路径：room feature 只拥有
  `RoomUiModule`，product feature 拥有 `GameProductUiContribution`，aggregate `ClientGameModule` 只存在于
  composition catalog。active-room 与 product resolver 直接接收 capability/contribution，不再用类型断言
  伪造残缺 module；architecture contract 锁定旧路径不得恢复。
- 定向验证：`pnpm exec tsc --noEmit` 通过；active source、product resolver、Werewolf adapter、Settings
  和 profile command 5 suites/27 tests 全部通过。
- Phase 1 仍进行中：Home 的 random role/board announcement 和建房入口仍是 Werewolf 语义；
  navigation 仍有 Werewolf route params；role/night audio registry、role avatar projection 和 role badge 还在
  product/infra root。下一批完成这些所有权后再判定 Phase 1 退出条件。

### 当前提交：Phase 1 game-owned narration 与 role assets 收口

- `AudioService` 只保留 `AudioClip` 播放、preload、音量和资源生命周期等平台原语，不再认识 `RoleId`、
  night step 或狼人杀音频 key。`WerewolfAudioPlayer` 在 game slice 内把 role/night 语义映射到平台端口，
  facade、action context 和 orchestrator 只依赖该 game-owned runtime。
- role、step、双预言家标签和 night narration registry 已完整移动到
  `src/games/werewolf/audio/`，原始资源集合逐项对比无差异。engine 产生但客户端未注册的 key 抛出
  `MissingWerewolfAudioError`，不会被普通设备播放失败通路吞掉；contract test 直接遍历
  `NIGHT_STEPS.audioKey/audioEndKey` 验证覆盖。preload 只收集实际有旁白的角色并按 clip key 去重。
- `ClientGameModule.audioPreview` 是 composition catalog 的必填 contribution；没有试听的游戏显式注册
  `null`。Music Settings 枚举 catalog contribution，不再硬编码狼人或 `wolf` key；每次试听使用独立
  invocation identity，停止后立即重播时，旧 Promise 完成不会清掉新一轮状态。
- role badge 的 native/Web registry 与 role-avatar projection 已归入 `src/games/werewolf/assets/`。
  product avatar 工具不再 import `RoleId`；底牌 modal 沿用 engine 已解析的 `readonly RoleId[]`，删除把
  domain type 降成 `string` 后再强转的通路。
- BGM 是产品级通用音频，独立保留在 `src/services/infra/audio/bgmCatalog.ts`。持久化 setting、播放控制和
  UI 共用 `BgmTrackId/BgmTrackSetting`；已选 track 使用 strict lookup，未知值不再静默退回随机列表。
- foreground 音量协议已从狼人杀专用的 `roleAudioVolume` 统一为 `gameAudioVolume`，设置页显示“游戏音效”，
  狼人杀仅在自己的 hook 中把该平台设置接到 narration player。MMKV 使用中性 `@user_settings` key；不读取
  旧 key 或旧字段，也不保留 migration/compatibility adapter。持久化 JSON 以 `unknown` 入站并逐字段解析，
  没有 `Partial<UserSettings>` 类型断言；运行时 setter 收到非有限音量会立即抛出 fail-fast error。
- Architecture contract 锁定旧 generic narration/badge 路径不得恢复，并禁止 `AudioService` 与 product
  avatar utility 重新出现狼人杀语义。`new-role` skill 已同步新的音频和 badge owner 路径。
- 定向验证：`pnpm exec tsc --noEmit` 通过；architecture、audio registry/player、orchestrator 共
  4 suites/819 tests 通过；Settings、Music Settings、AudioService 共 3 suites/30 tests 通过。
- Phase 1 仍进行中：只剩 Home 的 random role/board announcement/建房入口和 navigation params 中的
  Werewolf 语义。下一提交完成该边界并按 Phase 1 退出条件验收，随后暂停。

### 当前提交：Phase 1 Home contribution 与中性 navigation host 收口

- `ClientGameModule` 新增必填 `home` 与 `navigation` contribution。`createClientGameHome()` 从 exhaustive
  catalog 聚合模式选项、可用图鉴、spotlight 和公告 tab；空 catalog、重复 game contribution 或重复 tab key
  立即 fail fast。测试 fixture 同样必须提供完整 contribution，不允许用 optional field 绕过 production contract。
- Home 的创建入口始终打开 centered `GameModePickerModal`，选项只来自 catalog。Home 不再 import role、
  template、random、Werewolf avatar 或具体 game module；狼人杀随机角色卡与板子发布历史完整归入
  `src/games/werewolf/home/`。板子发布 metadata 与 `PRESET_TEMPLATES` 双向核对，漏项、悬空项、未知/空版本
  都会在渲染前失败。
- 公告 modal 只拥有产品更新日志与反馈，game tab 作为 typed content contribution 注入。原 generic
  `RandomRoleCard`、`BOARD_VERSION_MAP`、`BOARD_VERSIONS_DESC` 和 `@werewolf_last_seen_version` 已删除；
  announcement seen key 直接切到中性 key，不读取旧 key 或增加 migration/compatibility 分支。
- Root stack 只注册 `GameConfig`、`GameGuide`、`GameNotepad` 和 canonical `Room`。`GameHostRoutes.tsx`
  严格解析 `gameType` 后从 catalog 选择 screen，不 import/branch concrete game；旧 root
  `BoardPicker/Config/GameRules/Encyclopedia/Notepad` route 与 URL 全部删除，没有 alias、forwarding screen 或
  默认狼人杀 fallback。
- 狼人杀 `BoardPicker -> Config -> Rules` 已成为 module-owned nested native stack。纯
  `werewolfConfigFlow.ts` 从外部 `unknown` params 严格解析 create/edit/nominate 和 room code；创建完成、编辑
  返回、提案返回只通过显式 flow callback 跨 root 边界。Guide 的 role/tab 与 Notepad room code 同样在
  game-owned screen boundary fail fast，不再静默忽略 malformed deep-link params 或使用 `as never`。
- `GameConfig` 的 runtime decoder 由 exhaustive game composition 选择 concrete parser；狼人杀 parser 校验
  exact keys，并明确拒绝 create 携带 room code、edit/nominate 缺少 room code、未知 mode 和数组参数。
  Canonical URL matrix 同时断言 root stack 只在 edit/nominate 时注入权威 `Room` parent。
- Nested Config flow 的返回判断只读取当前 navigator 的 `state.index`；root history 不再被误判成 nested history。
  真实 `NavigationContainer + root native stack + nested native stack` contract 覆盖退出到 Home、创建后进入新
  Room、编辑后返回既有 Room 三条边界。Safe-area Jest mock 同步当前 5.7.0 Context/Provider 契约，只替代原生
  metrics，不 mock React Navigation。
- 全局 React Navigation Jest mock 只提供普通 screen 测试需要的 hooks/ref；真实 navigation contract 显式
  `jest.unmock`。禁止在全局 mock 中 `requireActual` 后展开整个模块，避免每个 room UI worker 重复加载完整
  navigator。修复后原超时的两个 board suites 连同 deep-link、nested navigation、Settings 共 5 suites/82
  tests 在并发模式下 7.85 秒全绿，没有增加 timeout、重试或降低 worker 数。
- `ClientGameCatalog` 中性 contract 与 exhaustive lookup 已归入 `games/model/ClientGameCatalog.ts`；
  `games/catalog.ts` 只做 application composition，并且是客户端唯一允许 import concrete game module 的文件。
  Context、App、Settings、Home 和 navigation host 不再因查询 catalog 而执行狼人杀 module 或创建 native stack；
  generic catalog 也不再公开 concrete `client` extension，没有 re-export compatibility 层。
- Home、room header/board nomination、Notepad、Encyclopedia 和 host settings 的所有 route consumer 已原子
  切到中性 host params。Playwright 的既有建房 helper 明确执行“点击创建 -> 选择 catalog game”，没有自动关闭
  expected modal、重试 click 或按测试环境跳过模式选择；所有原 Werewolf flow 在选择后继续走同一
  BoardPicker/Config/Room 行为。匿名登录 helper 只使用 canonical “进入房间”auth trigger；入口缺失立即失败，
  不再用“创建房间”兜底后暗中选择狼人杀。
- Architecture contract 锁定 generic Home/navigation 不得 import concrete game、按 literal game type 分支或
  恢复旧 root route/path；扫描范围包含 Home、shared feature、root navigator、catalog context 和 game home
  composition。Home/navigation 首轮门禁 10 suites/1208 tests 通过；最终 route boundary 审计 7 suites/916
  tests 与 root typecheck 通过；提交前以完整 `pnpm run quality` 全量通过作为最终证据。
- Phase 1 至此满足退出条件并标记完成：platform/protocol、Worker/client catalogs、客户端目录所有权、Home 与
  navigation 均已中性化，且没有 compatibility layer。按实施顺序暂停在 Phase 1 完成点，Phase 6
  `fibking` vertical slice 尚未开始。

### 当前提交：Phase 1 远端验收与 CI 报告发布边界

- commit `ca29c08f` 对应 CI run `29379097267`：quality 与四个 Playwright shard 全部通过；其中 shard 4
  覆盖 `entry-flow`、`db-recovery`、`seating`、room lifecycle 与 canonical navigation。Phase 1 的产品行为和
  架构门禁据此完成远端验收。
- 该 run 的最终红灯来自后置 `merge-reports` job 在零 step 时被拒绝。根因是报告聚合与 Pages 部署共处一个
  job，导致所有 PR 都在执行报告合并前申请受保护的 `github-pages` environment；允许
  `refs/pull/*/merge` 部署会削弱现有环境规则，不是正确修复。
- 按 GitHub 当前的
  [Pages custom workflow](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
  边界拆分：`merge-reports` 不绑定 deployment environment，使用仓库 lockfile 对应的 Playwright 合并并上传
  普通 artifact；新增 `deploy-e2e-report`，只在 `main` push 或 `workflow_dispatch` 时消费 Pages artifact，且
  只有该部署 job 绑定 `github-pages`。PR 因此可以完成报告聚合，同时仍受
  [deployment environment 保护规则](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
  约束，不能发布 Pages。
- 本提交只收口 CI 报告发布职责，不改变 Phase 1 产品代码，也不启动 Phase 6 `fibking` vertical slice。
- 提交前完整 `pnpm run quality` 通过：typecheck、game-engine build、knip、lint、format 全绿；root
  200 suites/5544 tests、game-engine 83 suites/2393 tests、api-worker 12 files/90 tests 全部通过。另从 run
  `29379097267` 下载四个真实 blob artifacts，使用仓库锁定的 Playwright 完成 merge 并生成 HTML report，验证
  新聚合步骤与现有 shard 产物兼容。

### 当前提交：Phase 6-7 瞎掰王完整垂直链路

- game-engine 新增 `games/fibking` concrete module。权威状态只保存真实玩家的 sparse seat map、两个特殊角色
  seat、当前/历史词条和 round metadata；空座、implicit bot 和普通角色不展开成 N 大小数组。人数统一使用
  `isValidFibPlayerCount` 校验：默认 8、最少 4、最大为 JavaScript safe integer，不添加产品上限。
- Fib lifecycle 使用 shared `lobby/preparing/ongoing/ended` 映射；`startRound` 先提交 preparing state 和 durable
  word-generation effect，system completion 才进入 ongoing。主持人可以取消 preparing；ended 只提供“下一轮”，
  保留 seats 和 used-word history，不再增加语义重复的 restart action。
- Fib role assignment 使用常数空间的无偏抽样，权威 round view 统一投影所有视角：大聪明与瞎掰者都能看词，
  只有老实人能在 ongoing 看定义；ended 后所有角色都能看完整答案。bot takeover 只改变客户端控制视角，不把
  controlled seat 写入 room command actor。
- Worker 通过 exhaustive game catalog 注册 Fib module、exact command/config/state schema 和 post-commit effect。
  word provider port 支持 local、Gemini structured output 与 Cloudflare Workers AI JSON Mode；provider response
  严格解析、trim、去重后才提交 internal completion。effect identity、candidate result 和 retry ledger 持久化，
  alarm 中断后复用同一结果，不重新生成词条；stale effect 和 identity 冲突直接失败。
- 新增 D1 migration `0037_add_fibking_game_type.sql` 与 `0038_fib_word_generation_results.sql`，并在本地 D1
  实际执行。Worker integration test 覆盖 catalog 建房、sparse state、outbox alarm 中断恢复和 provider replay。
- 客户端新增 Fib module、config、rules、summary、identity 与 room adapter，但不增加 Fib facade/context/store。
  Fib 和狼人杀共用同一个 `RoomSession`、`RoomShell`、seat/profile/share/header/status/bottom controllers；游戏层只
  投影 Fib phase action、身份内容和规则。百万级人数使用 lazy seat source 分页，DOM 不按总人数展开。
- 建房和房内编辑统一使用 shared room-flow navigation：创建成功以 `replace` 移除 Config，编辑完成以 `popTo`
  返回当前 Room。真实 navigator contract 同时覆盖狼人杀，避免 root stack 残留两个 Config screen。
- Playwright 新增 Fib 专用 page object，只保留 Fib phase/identity 操作；seat、profile 和直接踢人沿用 shared room
  page contract。`createColdRoomContext` 使用全新 browser context 首次直达 `/room/:code`，不再先访问 Home
  预热认证或 product catalog；shared 用户设置入口也有稳定 test ID，不借用狼人杀底部设置按钮。
- E2E Worker 使用独立 composition root：第一次 provider effect 把真实 local provider 结果写入 D1 ledger 后，
  在 internal completion 前中断；alarm 重放必须读取同一持久结果并推进 `preparing -> ongoing`。该故障注入只存在于
  E2E `GameRoom` 装配，不在 production module 中增加环境分支、retry helper 或吞错。
- 定向 Playwright 验证通过 3 条用例：1,000,001 人稀疏建房、8 人四个真人加 implicit bot 的完整 round，以及
  320×640 配置/房间/规则/身份布局。完整 round 同时覆盖缩容拒绝、换座、离座、直接踢人、机器人填充与接管、
  三种身份 visibility、公布和保留座位的下一轮；没有 force click、定时等待或失败后自动重试。
- 窄屏检查发现 AI chat pulse 的视觉缩放超出可拖动边界。bubble 样式、动画 scale 和 drag clamp 现在共用同一
  `BUBBLE_PULSE_MAX_SCALE` 几何常量，修复真实布局根因，并增加样式 contract test；没有在 Fib 页面加 overflow
  隐藏。狼人杀 overlay 只在自己的 `RoomSession` 为 ready 时挂载，不再泄漏到 Fib route。
- Shared seat board 只给 bot seat 绑定长按接管；真人座位没有会抛错的长按 handler。Fib config rejection 由
  game-owned failure presenter 穷尽映射，缩容时明确提示目标范围之外仍有真人，而不是显示 generic reason。
- Architecture contract 从 canonical `GAME_TYPES` 动态检查 client、engine、Worker 三端目录和 cross-game import，
  不再只对狼人杀写死断言；Worker config schema 使用 Zod 4 `z.int()` 校验 safe integer，非整数直接拒绝。
- 提交前完整 `pnpm run quality` 通过：typecheck、game-engine build、knip、ESLint、Prettier 全绿；root
  212 suites/5813 tests、game-engine 85 suites/2418 tests、api-worker 14 files/107 tests 全部通过。Fib 定向
  Playwright 另通过 chromium 2/2 与 small-mobile 1/1。
- Phase 6 与 Phase 7 的退出条件均已满足。Phase 8 仍未开始；下一提交按审计顺序处理 engine/Worker/client 物理
  所有权、一次性 storage migration、architecture allowlist、compile-only 第三游戏门禁与 workspace scope
  中性化，期间不保留 migration-only compatibility layer。

### 当前提交：Phase 8.1 game-engine 物理所有权收口

- 删除 `packages/game-engine/src/engine`、`models`、`resolvers`、`protocol` 四个伪通用目录。狼人杀的
  handlers、intents、models、protocol、reducer、resolvers 与 state 全部归入
  `games/werewolf/domain`；原来已经存在的 typed command handler 与旧 handler 实现合并到同一个
  `domain/handlers`，没有保留第二套 `domain/engine/handlers`。
- 原 `GameStore` 已没有 production consumer，只有自己的单元测试和 `store/types` 的 `GameState` 转发；本提交
  删除该 class、barrel 与测试，调用方直接使用权威 protocol type，不把死代码随目录迁移继续保留。
- 原 `protocol/ActionResult` 并不包含狼人杀语义，归入 `platform/protocol/actionResult`；座位显示规则归入
  `platform/room/formatSeat`。`audioKeyOverride` 与 `playerHelpers` 依赖狼人杀角色和状态，归入狼人杀 domain，
  不再以 generic `utils` 名义暴露。
- `games/werewolf/public.ts` 成为客户端与 Worker 唯一 production API，公开 state、config、commands、角色
  registry、codec 与必要的纯查询；跨 package 的规则集成测试使用单独的 `games/werewolf/testing.ts`。
  `package.json` 删除 `./engine/*`、`./models/*`、`./protocol/*`、`./resolvers/*` exports，根 `index.ts` 只聚合
  platform、product 与 engine catalog，不再充当狼人杀 compatibility barrel。无人使用的
  `./games/werewolf/commands` 与 `./games/werewolf/domain/handlers/commandHandlers` exports 也一并删除；每个游戏
  package 只允许暴露 `public` 与测试专用 `testing` 入口，不能绕过 facade 导入任意 domain 文件。
- 全仓 production consumer 已从 game-owned deep path 改到 `games/werewolf/public`。架构测试禁止 client/Worker
  production 导入 domain deep path 或 testing API，并禁止恢复旧顶层目录与旧 package exports；package export
  门禁按游戏目录动态匹配，因此新增游戏同样不能发布平行的 commands/domain 入口。
- 原先扫描旧目录而会 vacuous pass 的 dynamic-require、resolver/UI boundary 和唯一 `NIGHT_STEPS` hard gate
  同步指向新 domain；active path rules、role/board/E2E skills 与 preset 文档也改为 canonical 路径。
- 定向验证通过：game-engine build；root 与 Worker TypeScript；game-engine 84 suites/2458 tests；game-engine
  architecture 119 tests；client architecture 2567 tests；迁移后的三个 hard-gate suites 23 tests。
- 提交前完整 `pnpm run quality` 通过：root 212 suites/7403 tests、game-engine 84 suites/2458 tests、
  api-worker 14 files/107 tests 全绿。Phase 8 当前完成 game-engine 狼人杀 domain 与共享 protocol/room 原语的
  物理归位；Worker game-owned settlement/provider/schema/D1 所有权是下一提交，Phase 8 尚未完成。

### 当前提交：Phase 8.1 架构门禁补强

- 独立 delegated audit 在上一提交推送后发现三个门禁假阴性：root consumer 规则把 `werewolf` 写死；两套
  import regex 漏掉 side-effect import、re-export、dynamic `import()`、CommonJS `require()` 与 import type；
  package export 规则对 `games/catalog/*` 进行了过宽豁免。审计同时确认当前 production 没有实际越界代码，
  问题位于约束本身。
- 新增共享测试解析器，使用仓库当前 TypeScript compiler AST 读取 static/type/side-effect import、re-export、
  import-equals、import type、dynamic import、`require()`、`require.resolve()` 与 `module.require()`。计算式 module
  path 不再被静默跳过，而是以 `[FAIL-FAST]` 直接使架构测试失败。
- root 的 services、game-engine consumer、Worker platform、shared room、product component、game isolation、
  generic host 与 composition-root import 规则统一改用 AST 结果。game domain/testing 规则按权威 `GAME_TYPES`
  动态生成，FibKing 与后续注册游戏不再能绕过 Werewolf-only 断言。
- game-engine 的 platform/game dependency 规则同样改用 AST；package export 仅精确允许
  `./games/catalog`，`./games/catalog/internal` 一类路径会被拒绝。解析器有独立语法覆盖测试，避免门禁再次
  vacuous pass。
- 定向验证通过：root TypeScript；AST 与 engine architecture 2 suites/121 tests；root architecture
  1 suite/2561 tests。下一步仍是 Worker game-owned settlement/provider/schema/D1 所有权，Phase 8 尚未完成。
- 提交前完整 `pnpm run quality` 通过：typecheck、game-engine build、Knip、ESLint、Prettier 全绿；root
  212 suites/7403 tests、game-engine 85 suites/2460 tests、api-worker 14 files/107 tests 全部通过。

### 当前提交：Phase 8.2 Worker 游戏所有权归位

- `packages/api-worker/src/db/schema.ts` 已删除，不保留 named-export compatibility barrel。运行时
  `createDb` 使用官方支持的 schema-free `drizzle(d1)`；仓库没有 `db.query.*` relational consumer，因此平台
  query builder 不需要装载所有 game schema。Fib 的
  `fib_word_generation_results` 归入 `games/fibking/dbSchema.ts`，狼人杀的 `camp_settlements` 和
  `game_settlement_results` 归入 `games/werewolf/dbSchema.ts`。owner schema 只依赖 game-neutral
  application tables，不依赖 DB driver 或 aggregate，因此没有循环初始化，也没有 `platform -> db -> games`
  传递依赖。复杂 `INSERT ... SELECT`、CTE 与 D1 batch 继续使用参数化 SQL，但输入/结果类型由 owner table 的
  `$inferInsert/$inferSelect` 派生；Knip 不再把 schema model 识别为死文件或未使用 export。
- SQL migration 仍按 D1 历史顺序保留在 `migrations/`，没有移动、改号或重写。这里改变的是 TypeScript
  ownership，不是假装历史 migration 属于 runtime game module。[Drizzle D1 文档](https://orm.drizzle.team/docs/sqlite/connect-cloudflare-d1)
  明确支持 schema-free driver；如果未来启用 Drizzle Kit，再按
  [多文件 schema 文档](https://orm.drizzle.team/docs/sql-schema-declaration)把配置指向 owner files，而不是恢复
  runtime barrel。
- 狼人杀结算从伪通用 `src/growth/settleGameResults.ts` 归入
  `games/werewolf/settlement/settleGameResults.ts`。它继续消费产品级 growth 算法，但 effect、camp、participant
  fingerprint、result ledger 与 internal roster command 全部由狼人杀 Worker module 所有。
- 原 `/gemini-proxy` 连同 generic handler/schema 已删除，客户端和 Worker 在同一次提交切到
  `/api/games/werewolf/ai-chat`。Gemini 与 Workers AI 仍是狼人杀 AI chat 内部 provider policy；Fib provider
  继续只实现自己的 word-generation port，没有建立 app-wide LLM compatibility API，也没有旧 route 转发层。
- 四组 game-owned Worker tests 随实现归入 `games/*/__tests__`。Vitest 从只扫描根测试目录改为递归发现，生产
  TypeScript 则排除任意层级 `__tests__`，ESLint 对同一递归 glob 使用 `tsconfig.test.json`；目录迁移前后均为
  14 suites/107 tests，避免整理造成 vacuous pass。
  新增 game-owned AI route integration 后为 15 suites/110 tests，覆盖认证、request validation 与旧 route 404。
- Architecture contract 锁死旧 settlement/AI/test/aggregate 路径，递归解析每个 Worker platform 文件的相对
  import，禁止任何传递路径到 `games/`；同时禁止 game schema 反向依赖 DB driver，锁定 physical table owner，
  并验证 Worker 只挂载 game-owned AI route。root/Worker typecheck、Worker 15 suites/110 tests 与 root
  architecture 2599 tests 已通过。
- 提交前完整 `pnpm run quality` 通过：typecheck、game-engine build、Knip、ESLint、Prettier 全绿；root
  212 suites/7443 tests、game-engine 85 suites/2460 tests、api-worker 15 files/110 tests 全部通过。
- Phase 8 仍未完成。下一批处理 game-engine product/growth 与剩余 `utils` 所有权；之后处理客户端 storage、
  navigation contribution、shared mutation 归位，再收紧动态门禁、workspace scope 和第三游戏编译证明。

### 当前提交：Phase 8.3 product 与 platform primitive 归位

- 删除 game-engine 顶层 `growth/` 与 `utils/`，不保留 package alias 或 compatibility barrel。XP/level 归入
  `product/growth`；奖励目录、抽券收益、抽奖策略、揭晓动画和解锁查询归入 `product/rewards`；随机数、洗牌、
  request ID 与 hex ID 分别归入 `platform/random`、`platform/identifiers`。原 level 文件里的普通/黄金券收益已拆到
  rewards，不把产品奖励策略留在 growth。无生产消费者的自动升级发物品 API、rejection ID helper 与永久 noop 的
  engine logger 连同孤立测试一起删除。
- `package.json` 只暴露 `./platform/identifiers`、`./platform/random`、`./product/growth`、
  `./product/rewards` 等精确入口；`platform/protocol/*` wildcard 也改成实际消费者使用的逐项 export。架构门禁要求
  `games/` 目录名与 `GAME_TYPES` 完全相等、每个游戏包含生产模块、每个 package export 指向存在源码，并用负向
  fixture 证明 platform 不能依赖 product/game、product 不能依赖 game、游戏不能互相依赖、根 API 不能导出具体
  游戏。
- 所有随机选择统一消费 `Rng` 的 `[0, 1)` 契约。整数范围必须由 safe integer 表示，非法 RNG、空数组与非法 hex
  长度直接失败；`newRequestId` 明确要求标准 `crypto.randomUUID()`，不再用时间戳拼接降级。揭晓动画删除自己的
  hash 实现，改用 `createSeededRng`，并以固定 seed 向量锁定 settlement replay 与动画映射。
- 抽奖只从 roll 命中的精确 rarity pool 选择，重复物品按 rarity 转碎片；目录缺少任一 rarity、selector RNG
  越界或目录 ID 未注册都会 fail fast。Worker 删除 `% max` 随机索引与“可能少抽几次”的死分支，严格扣除已校验
  的 `count`。分享图和头像沿用 shared `randomHex`，路由集成测试分别锁定 12/8 位 hex key，防止 byte/hex
  语义迁移改变公开 URL。
- 新增唯一 `parseUnlockedRewardIds`，在产品边界验证 D1 JSON、数组元素、可抽奖励池成员与重复 ID；auth、stats、
  gacha 的 9 个读取点不再使用 `JSON.parse(...) as string[]`。unlock query 与 persisted parser 共用必需的
  reward-pool lookup，不再把缺失映射静默当成其他奖励类型。Catalog 从同一份全目录索引派生 rarity、type 与
  drawable pool，并在模块初始化时拒绝重复 ID；unlock target 收到未知或错类型 ID 时失败。外部 profile cosmetic
  ID 先由精确 Zod enum 拒绝并返回 400，不能把不可信输入推入 engine。XP 必须是非负 safe integer，level 必须在
  `0..51`，非法值不再投影成 0 级或“传奇”。未知角色名在 engine 查询处失败，过期揭晓特效在
  `GameState -> LocalGameState` 投影处失败，RoomScreen 不再把错误数据静默改成 `none`。
- `seed-local.mjs` 不再用正则读取已删除文件，而是用 TypeScript AST 解析 `product/rewards/catalog.ts` 的字符串
  数组与命名 spread；不支持的表达式、循环 spread 和重复 ID 都会终止 seed。Wrangler 4.95.0 本地 migration
  验证无待执行项，seed 实际解析 196 头像、200 头像框、210 座位特效、200 名字样式、12 揭晓特效与 200 入座
  动画，共 1018 个唯一 ID，并成功执行两条 D1 写入。
- 仓库内 AGENTS、path rules、delegate/new-role skill 及其镜像已同步 Expo 56、TypeScript 6 与新目录；活跃代码、
  脚本和说明不再指导 agent 恢复旧 growth/utils/logger 路径。定向验证已通过 game-engine build、engine 5 suites/
  218 tests、root 3 suites/3375 tests、Worker 16 files/116 tests、root/Worker TypeScript 与 Knip。
- 提交前完整 `pnpm run quality` 通过：typecheck、game-engine build、Knip、ESLint、Prettier 全绿；root
  212 suites/8213 tests、game-engine 86 suites/2511 tests、api-worker 16 files/116 tests 全部通过。
- Phase 8 仍未完成。下一批处理客户端 storage/navigation/shared mutation 的物理所有权，然后完成动态门禁、
  workspace scope 中性化、compile-only 第三游戏证明与全量 E2E 验收。

### 当前提交：Phase 8.4 客户端持久化与房间创建所有权

- 删除 `src/lib/storage.ts`，MMKV 只能由 `src/services/infra/localStorage.ts` 创建；production consumer 必须位于
  owner 的 `services/` 目录。头像上传的 `IStorageService` / `CFStorageService` 误名也已删除，改为
  `IAvatarUploadService` / `CFAvatarUploadService`，不再把单一 R2 头像能力描述成 app-wide storage abstraction。
- Product storage 按 feature 归位：announcement receipt 属于 `features/home/services`；admin credential、HTTP
  client、response contracts 和 exact runtime codec 属于 `features/admin`。Admin API 不再在 screen 目录访问
  MMKV，也不再把 `response.json()` 直接断言为 UI 类型；未知字段、非法 game type、负数统计与错误 envelope
  直接失败。原 `src/screens/AdminScreen/adminApi.ts` 已删除，没有 forwarding file。
- Recent rooms 从全局 room-code 数组切到 user-scoped、versioned immutable identity：每项必须同时包含
  `{ roomCode, roomId, gameType }`，按 `roomId` 判断同一个房间实例，公开 code 被复用时替换旧实例。登录切换只清理
  原用户自己的历史；modal 并发检查绑定 effect generation，旧用户或已关闭 modal 的 response 不能写回新视图。
- 狼人杀 notepad 由 `WerewolfNotepadState` 与 `notepadRepository` 所有，key 同时绑定 `userId + roomId`，payload
  再绑定显式 `first-round | restart:<nonce>` round ID。seat key 必须在当前 template 人数内，role guess 必须是
  canonical Werewolf role ID；owner、round 和 seat count 在任何 storage read/write 前校验。删除未被 UI 消费的
  `identityStates/cycleIdentity`，不迁移死状态，也不在 render 期间清理 storage。
- 狼人杀 AI chat message key 绑定 `userId + roomId`，bubble position 绑定 user；两者使用 version 1 exact
  envelope，拒绝 unversioned payload、未知字段、重复 message ID、非法 timestamp 和非有限坐标。发送前先核对
  active `RoomSession` 的 user/room identity，再产生 cooldown、message 或 streaming side effect；AI bridge 删除
  卸载后仍可能执行的零延迟 timer，pending debounced write 在清空与 unmount 时有唯一确定的提交路径。
- 本次明确采用一次性客户端 storage cutover：旧的全局 recent-room、notepad、AI chat 和 bubble-position key
  不读取、不猜测、不迁移；新 key 尚未发布，不增加 migration-only adapter 或 compatibility reader。格式损坏时
  repository fail fast，不把错误数据重置成默认值继续运行。
- Room creation contract 归入 `features/room/model/RoomDirectory.ts`。`CFRoomDirectoryService` 现在是纯 HTTP
  transport，只接受 application layer 明确提供的 `creationId` 并解析 exact response；它不再创建 request ID、
  访问 MMKV、维护 in-flight map 或暴露 acknowledge API。
- `RoomCreationService` 成为唯一 application saga：canonical request 对应一个持久 creation intent，同意图并发
  共用一个 operation；未知 delivery 和 429 保留 ID，确定的 4xx 清理 intent；成功时先提交 user-scoped recent
  room identity，再移除 intent。任一步骤中断后重放同一 ID，recent write 本身按 room identity 幂等，因此不会
  通过生成新 ID 掩盖未知 delivery。
- `useRoomCreationController` 只把 saga 接入 TanStack mutation 并暴露 `isCreating`。Fib 与 Werewolf config
  均调用这一 controller，删除各自的 `creatingRef/createSubmissionRef` 和 acknowledge helper；游戏层只组装自己
  的 config、显示错误并导航。Architecture contract 禁止 concrete game 直接 import creation service、intent
  store 或 Cloudflare adapter，并锁定唯一 `roomDirectory.createRoom()` consumer。
- 定向测试覆盖 strict storage codec、用户/房间隔离、notepad scope 切换与 stale round effect、AI stale-owner
  零副作用、creation intent 跨实例复用、同意图 single flight、unknown delivery retry、terminal rejection、
  recent commit failure、transport exact envelope 和 React mutation lifecycle。审计同时发现 Jest 的 TanStack
  mock 把 `mutateAsync` 错误实现为返回 `void` 的 `mutate`，
  且把 `isPending` 永久写死；mock 已按
  [TanStack Query v5 `useMutation` 官方契约](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation)
  重写 `mutate` 的 void、`mutateAsync` 的 Promise 与 pending transition，避免 controller test 假绿。
- 提交前完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；
  root 223 suites/8581 tests、game-engine 86 suites/2511 tests、api-worker 16 files/116 tests 全部通过。root Jest
  仍输出仓库已记录的 Expo late-log/forced-exit 噪声，但命令退出码为 0，没有为噪声修改 production 行为。
- Phase 8 仍未完成。下一批统一 navigation capability contribution 与 deep-link registration，然后删除过期
  hard gate/allowlist，完成 workspace scope 中性化、compile-only Pictionary 接入证明和最终 migration/E2E 验收。

### 当前提交：Phase 8.5 单一 navigation capability 与 route contract

- `GameNavigationContribution` 不再用 `configScreen/guideScreen/notepadScreen` 的 nullable 三元组表达能力。每个
  route 现在是 `kind: 'screen' | 'unsupported'` 判别联合；`bindGameNavigation()` 的 mapped binding 只要求
  definition 中受支持的 screen，缺 screen、给 unsupported route 绑定 screen 都在编译期失败，composition
  boundary 仍保留确定的 fail-fast invariant check。
- Werewolf 与 FibKing 分别在自己的 `navigation/werewolfGameNavigation.ts`、
  `navigation/fibGameNavigation.ts` 声明严格 definition。Config、guide、notepad 参数由 game-owned parser
  校验 exact key、canonical game type、room code、mode、role ID 与 guide tab；screen 不再维护另一套 route
  字段校验。
- `src/games/navigation.ts` 只做按 `GameType` 的穷尽组合。三个 root route 参数联合均从 definition 的
  `parseParams` 返回类型推导；FibKing notepad 由 `unsupported` 自动从 `GameNotepadRouteParams` 排除，删除
  `FibNotepadRouteParams = never` 和空 guide extension 这两种平行表示。
- `GameHostRoutes` 统一按 route kind 解析并渲染 catalog capability；Home 的玩法入口可见性读取同一 `kind`。
  `AppNavigator` 的 cold deep link 在构造 parent stack 前调用同一组合 parser，所以
  `/game/fibking/notepad/:roomCode`、FibKing `nominate`、非法 Werewolf role/tab 和游戏不认识的额外参数均在进入
  screen 前失败，不再等 nullable screen 分支兜底。
- 编译 contract 证明 FibKing 不能构造 `GameNotepadRouteParams`、不能漏绑 guide screen，也不能给 notepad
  绑 screen；runtime contract 覆盖两个游戏的 config parent stack、guide/notepad capability 与 malformed
  deep link。定向验证已通过 root TypeScript、navigation/Home 3 suites/56 tests 和 architecture
  1 suite/3654 tests。
- 提交前完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；
  root 224 suites/8611 tests、game-engine 86 suites/2511 tests、api-worker 16 files/116 tests 全部通过。root Jest
  仍只有仓库已记录的 Expo late-log/forced-exit 噪声，命令退出码为 0，没有因此修改 production 流程。
- Phase 8 尚余：用 TypeScript AST 替换易漂移的行级 import 门禁，删除过期 hard gate/allowlist，完成目录集合与
  workspace scope 中性化、compile-only Pictionary 接入证明，以及最终 migration、seed、quality、全量 E2E。

### 当前提交：Phase 8.6 狼人杀测试所有权与精确目录门禁

- `src/services/__tests__/boards` 中仍有效的 engine public/testing API 集成套件与 helper 全部归入
  `src/games/werewolf/__tests__/engine/boards`；night-step/schema/resolver 覆盖 contract 同步归入同一游戏 slice。
  狼人杀 UI vertical-slice 测试只从该 game-owned test harness 取真实状态，不再反向依赖 generic services 测试目录。
- 删除 `legacyRuntimeGate.contract.test.ts`、`hardGates.contract.test.ts`、旧 role-spec import gate 和
  `boundary.guard.test.ts`。前三者重复扫描已删除路径或历史 symbol；最后一个在目标目录不存在时直接 `return`，会把
  门禁缺失报告成通过。有效的 domain/public/testing 边界继续由 TypeScript AST architecture contract 强制执行。
- client、game-engine、api-worker 三层 `games/` 目录现在都按 canonical `GAME_TYPES` 做精确集合断言。client 只额外
  允许明确的 composition 目录 `__tests__` 与 `model`；未注册 concrete game 目录会立即失败，不再只检查两个已知目录
  “存在”。每个 concrete game 之间的禁止互相 import 断言保持不变。
- `new-board` skill 的唯一源文件更新到新的 game-owned 测试目录，并通过 `pnpm run sync:agents` 同步所有生成副本；
  resolver 注释改指向现行 package architecture contract，不再引用已经删除的旧 test path。
- 定向验证通过：root TypeScript；architecture、Werewolf engine integration 与 UI vertical-slice 共 35 suites、
  4048 tests 全部通过。
- 完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；root
  220 suites/8588 tests、game-engine 86 suites/2511 tests、api-worker 16 files/116 tests 全部通过。root Jest 仍只有
  仓库已记录的 Expo late-log/forced-exit 噪声，命令退出码为 0，没有为测试进程噪声修改 production 行为。
- Phase 8 尚余：把 screens runtime service import 的行级 allowlist 换成 AST ownership contract，收口 root
  hooks/lib/feature service 的物理归属，中性化 workspace scope，补 compile-only Pictionary 接入证明，最后执行
  migration、seed、quality 与全量 E2E。

### 当前提交：Phase 8.7 client feature ownership 与 AST runtime import 门禁

- 删除 root `src/hooks`、`src/lib` 和 `src/services/feature` 的生产模块所有权。boot/query-client/Sentry composition
  归 `src/app`；auth、account、gacha、feedback、settings、home 与 product controller/query/API 分别归对应
  `src/features/<feature>`；狼人杀夜间复盘图片上传归 `src/games/werewolf/services`。architecture contract 会拒绝这三个
  horizontal catch-all root 再出现 production module。
- `useUpdateProfile` 从 auth mutation 拆到 account controller；auth 不再为了 profile cache 反向依赖 account query。
  account/gacha query option 各自拥有 query key 与 query function，原有 `userStats`、`userProfile`、`userUnlocks`、
  `gachaStatus` key 和失效范围保持不变。
- `GachaScreen` 与 shared `PlayerProfileCard` 改用当前 `QueryClientProvider` 的 `useQueryClient()`；只有 `App.tsx`
  持有 application singleton。测试或嵌套 provider 不会再被模块级 singleton 绕过。
- `AudioAsset`/`AudioClip` 与 BGM catalog 归 product model；狼人杀 audio registry、settings feature 和 infra playback
  adapter 共同依赖这份值模型。infra `audio/types.ts` 只保留 adapter contract、转换与 native timeout，不再反向拥有
  product/game 需要的类型。
- `getRuntimeModuleSpecifiers()` 使用仓库当前 TypeScript AST 区分 declaration-level/specifier-level type import、
  mixed import/export、side-effect import、dynamic import 与 CommonJS loader；计算 module path 继续 fail fast。screen
  architecture gate 删除 symbol allowlist，直接断言 runtime `@/services/*` import 为零。
- `agents/path-rules/services.md`、debug skill、gacha design 和本设计的目标树同步新所有权；agent 规则不再指导新增
  `services/feature` 或 root `hooks` 文件。
- 定向验证通过：root TypeScript；AST parser 4 tests；auth/settings/BGM/Home/profile/architecture 共 8 suites、
  3711 tests。测试只输出仓库已记录的 Expo/React Native teardown 噪声，命令退出码为 0。
- 完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；root
  220 suites/8616 tests、game-engine 86 suites/2513 tests、api-worker 16 files/116 tests 全部通过。root Jest 仍只有
  仓库已记录的 Expo/React Native teardown 与 forced-exit 噪声，没有为测试进程噪声修改 production 行为。
- Phase 8 尚余：workspace scope 一次性中性化且不保留 alias，开放单个 game module contract 并补 compile-only
  Pictionary 接入证明，最后执行 migration、seed、quality 与全量 E2E。

### 当前提交：Phase 8.8 workspace package scope 中性化

- `packages/game-engine` 与 `packages/api-worker` 的 workspace 身份分别原子改为
  `@game-judge/game-engine`、`@game-judge/api-worker`；root app、Worker、engine、E2E 的 import、mock、TypeScript
  paths、Jest/Vitest mapper、pnpm filter 与 workspace dependency 同步迁移，不保留旧 scope alias。
- `pnpm-lock.yaml` 由 pnpm 10.32.1 按新 manifest 重算；`pnpm -r list --depth -1` 只枚举中性 scope 下的两个
  workspace package。仓库活动文件的旧 scope 搜索为零，`CHANGELOG.md` 与 `docs/archive/**` 仅保留历史事实。
- CI、README、部署命令、architecture contract、agent canonical sources 与 skill 示例统一使用新 scope，并通过
  `pnpm run sync:agents` 生成所有编辑器/代理镜像。Cloudflare Worker、D1、Pages 等已部署资源名不属于 package
  identity，本提交不改资源名、binding、URL 或迁移历史。
- client architecture contract 以唯一 `GAME_ENGINE_PACKAGE` 常量和 AST module specifier 统一判断 package root、
  shared `platform/product` 与 concrete `games/*` import，不再在多个 regex 中复制 scope。scope 迁移后的边界语义保持
  不变：shared 层只能读取 platform/product，package root 与任何 game implementation 仍会立即失败。
- 完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；root
  220 suites/8616 tests、game-engine 86 suites/2513 tests、api-worker 16 files/116 tests 全部通过。root Jest 仍只有
  仓库已记录的 Expo/React Native teardown 与 forced-exit 噪声，没有为测试进程噪声修改 production 行为。
- Phase 8 尚余：消除 client navigation 与 Worker HTTP 的双重 concrete-game 组合点，开放单个 game module
  contract 并补 compile-only Pictionary 接入证明，收紧三 workspace architecture gate，最后执行 migration、seed、
  quality 与全量 E2E。

### 当前提交：Phase 8.9 单一 client/Worker game plugin 组合点

- 客户端删除独立的 concrete navigation registry。`CLIENT_GAME_PLUGIN_CATALOG` 现在是唯一同时 import 多个具体
  游戏的 composition point，每个注册项原子提供 `gameType`、navigation definition 与 module factory；
  `createClientGameCatalog()` 和 generic route param/parser 都从同一个对象投影，新增游戏不再需要同步两张清单。
- catalog 的 metadata 读取保持无副作用。狼人杀 nested native stack 从 module import-time 初始化改为
  `createWerewolfConfigFlowScreen()`，只在 application composition 创建狼人杀 module 时构造一次；navigation
  parser、测试 catalog 或其他纯 metadata consumer 不会因 import catalog 提前创建 navigator。
- `WorkerGameModuleDefinition` 新增必填 `httpRoutes` contribution。狼人杀 AI chat route 归属狼人杀 module；瞎掰王
  显式贡献空数组。路径必须位于 `/api/games/<module.gameType>/*`，越界在 module 定义时 fail fast；Worker catalog
  按 canonical `GAME_TYPES` 投影 route 并拒绝重复路径，`index.ts` 只注册 catalog 输出，不 import concrete game。
- architecture contract 使用 TypeScript AST 检查 Worker entry 的 module specifier，禁止 concrete game import；客户端
  扫描全部 runtime source，断言只有 `src/games/catalog.ts` 同时 import 多个 concrete game。删除了依赖消费者文件
  allowlist 的旧 catalog gate，避免合法 projection consumer 被误判，同时保留更强的 concrete composition 唯一性。
- 定向验证通过：root typecheck；客户端 architecture、catalog context、deep-link 与 navigation 共 4 suites/3706
  tests；api-worker 全量 16 files/117 tests。完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine
  build、Knip、ESLint、Prettier 全绿；root 220 suites/8618 tests、game-engine 86 suites/2513 tests、api-worker
  16 files/117 tests 全部通过。root Jest 仍只有仓库已记录的 Expo/React Native teardown 与 forced-exit 噪声，
  没有为测试进程噪声修改 production 行为。
- Phase 8 尚余：把单个 game module contract 从 production `GameType` 闭集解耦并加入 compile-only Pictionary
  证明，继续收紧三 workspace 的非空 AST/目录门禁，完成 fail-fast 与残留命名清理，最后执行 local migration、
  seed、完整 quality 和全量 E2E。

### 当前提交：Phase 8.10 开放 module authoring 与封闭生产注册

- `BaseGameState`、state codec、command result 与 `GameEngineDefinition` 的 authoring 泛型统一为
  `TGameType extends string`，因此未注册游戏可以保留自己的 literal ID、state、config、command、event 和 effect
  类型；生产 `GAME_TYPES`、engine catalog、parser、routing 和 storage 仍是 `GameType` 闭集，没有新增第二份 ID union。
- client session/transport 链、`ActiveRoomIdentity<TGameType>`、`RoomRecord<TGameType>`、navigation definition、room
  capability 和具体 screen 贯穿同一个 literal ID。生产 `registerRoomUiModule` 会先核对 metadata 中的 game type，
  再重建精确 room record 调用具体 screen；错误路由立即抛出，不用 React component cast 或宽化 props 隐藏方差问题。
- Worker 把开放的 typed module runtime 与 `GameRoom` 消费的 `RuntimeWorkerGameModule` 分开。
  `defineWorkerGameModule` 允许第三游戏 authoring；`registerWorkerGameModule` 只接受 canonical `GameType` 且 engine
  与 module identity 必须一致，并在 effect context 与 internal dispatch result 两个方向用同一 codec 验证 state。
  production `defineWorkerGameCatalog` 同时接收唯一 `GAME_ENGINE_CATALOG` 与 Worker modules，在编译期逐 key 绑定 engine
  类型、在启动时检查 engine object identity；generic platform helper 不反向 import production game catalog。
- 新增三层 compile-only Pictionary fixture：engine 是真实纯 engine/codec，Worker 使用严格 Zod config/command/
  effect schema，client 创建 typed session、navigation、room account、room screen 和 plugin。fixture 不新增 production
  game ID、目录、route 或 catalog entry；`@ts-expect-error` 反向证明它不能赋给 `GameType`、不能跨 Worker/client
  registration boundary，也不能作为生产 catalog key 读取。
- `knip.json` 与 Worker `tsconfig.json` 显式纳入 type-test roots，保证 fixture 不是未编译死文件。定向验证已通过
  root/Worker typecheck、Room UI registration 2 tests 和 Worker catalog 9 tests。
- 完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、Prettier 全绿；root
  221 suites/8626 tests、game-engine 86 suites/2513 tests、api-worker 16 files/117 tests 全部通过。root Jest 仍只有
  仓库已记录的 Expo/React Native teardown 与 forced-exit 噪声，没有为测试进程噪声修改 production 行为。
- Phase 8 尚余精确 AST/目录/exports 门禁、fail-fast 与残留命名清理，以及 local migration、seed、最终 quality
  和全量 E2E。

### 当前提交：Phase 8.11 Worker vertical ownership 与 migration-backed tests

- 删除 Worker 根目录的 `handlers/`、`schemas/`、`lib/`、`durableObjects/` 和集中式 `__tests__/` 所有权。
  非游戏 HTTP capability 按 `features/account|admin|auth|feedback|gacha|sharing` 纵向归位；头像由 account、临时分享图
  由 sharing 所有，遥测属于 `platform/telemetry`，不再创建按存储介质命名的 `media` feature。WeChat proxy、token、
  password 和 profile 暂由 auth feature 持有，Wrangler 依赖的 `WeChatAuthProxy` export class name 保持不变。
- room HTTP route 与 request schema 归入 `platform/room`；JSON validator、Durable Object availability translator
  和 logger 分别归入 `platform/http` 与 `platform/observability`。原 `handlers/shared.ts` 已拆除，不保留旧 path
  export；DO error 的未知边界通过 `unknown` + `in` narrowing 检查，不再用 object cast 假装已验证。
- Worker tests 与生产 owner 共置，跨 owner 的测试基础设施放在 package-level `test/`。删除手写的第二份 D1 DDL；
  Vitest 按 Cloudflare 当前 `readD1Migrations()` / `applyD1Migrations()` 流程直接执行 production migrations，新增
  migration 不再要求同步维护 `testSchemaBootstrap.ts`。
- 根 architecture contract 新增 Worker `src`、`features`、`platform` 的精确非空目录集合，并明确禁止旧横向根
  恢复；Worker game composition test 作为 `games/__tests__` 例外，不会被误判为第三个游戏目录。
- room route 通过 composition 注入 `WorkerGameModuleResolver` 与认证 middleware；`platform/room` 不再为了选游戏
  反向 import `games/catalog`，新增 platform-to-games 门禁可以真实执行。
- 定向验证通过：Worker production typecheck 全绿，Vitest 17 files / 117 tests 全绿；architecture contract
  1 suite / 3683 tests 全绿。完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、
  ESLint、Prettier 全绿；root 221 suites / 8656 tests、game-engine 86 suites / 2513 tests、api-worker
  17 files / 117 tests 全部通过。root Jest 仍只有仓库已记录的 Expo teardown 与 forced-exit 噪声，没有为测试进程
  噪声修改 production 行为。
- Phase 8.11 下一批继续处理 Worker 的 `platform/gameModules`、DO composition、D1 schema ownership、scheduled
  maintenance、WebSocket route 与严格 owned request schema；之后再完成 engine/client 精确目录与 exports 门禁、
  fail-fast/命名残留清理，以及 local migration、seed、最终 quality 和全量 E2E。

### 当前提交：Phase 8.11B Worker runtime ownership 与 WebSocket admission

- `workerModule.ts`、`runtimeGameModule.ts` 与 `effectCommandId.ts` 统一归入 `platform/gameModules`。开放 authoring、
  canonical runtime 擦除、effect command ID 和 room authority port 现在由同一个 platform owner 维护；`games/` 根只保留
  唯一 concrete composition `catalog.ts`，没有 forwarding file。
- generic `workerModule.ts` 不再 type import game-engine 的 production `games/catalog`。`games/catalog.ts` 在 application
  composition 显式把 `GAME_ENGINE_CATALOG` 传给 `defineWorkerGameCatalog`；错误 engine 在编译期无法按 key 注册，即使绕过
  编译边界，启动时的 object identity 检查也会 fail fast。
- production Sentry DO wrapper 从 `games/GameRoom.ts` 归入 `app/GameRoom.ts`；共享 authority runtime 文件明确命名为
  `platform/room/GameRoomRuntime.ts`。Wrangler 看到的 `GameRoom` export class name、binding、production 和 E2E
  replacement 行为保持不变，旧路径全部删除。
- `/ws` 的 room identity 校验、token admission 后的 room resolution、DO URL 构造和 availability translation 全部移入
  `platform/room/webSocketRoutes.ts`。`index.ts` 只注册原 `/ws` 路径，并从 auth feature 注入
  `RoomWebSocketAuthenticator`；room platform 不依赖 JWT payload 或 auth implementation。
- architecture contract 精确锁定 `games/catalog.ts` 与 `platform/gameModules` 三个文件，并继续禁止所有 Worker
  platform production module import game composition。定向验证通过：Worker typecheck；Vitest 18 files / 120 tests；
  architecture contract 1 suite / 3693 tests。完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、
  Knip、ESLint、Prettier 全绿；root 221 suites / 8667 tests、game-engine 86 suites / 2513 tests、api-worker
  18 files / 120 tests 全部通过。root Jest 仍只有仓库已记录的 Expo teardown 与 forced-exit 噪声，没有为测试进程
  噪声修改 production 行为。
- Phase 8.11 尚余 D1 schema ownership、scheduled maintenance owner 拆分、严格 owned request schema、account/auth 路由
  边界与 Worker binding 类型收口；之后进入 engine/client residual cleanup 和最终验收。

### 当前提交：Phase 8.11C Worker D1 与 scheduled maintenance 所有权

- 删除 `db/applicationSchema.ts` 聚合 schema。17 张物理 D1 表现在只在自己的 owner 中声明：account 持有
  `users/user_stats`，auth 持有 token、login attempt 与 WeChat claim，gacha 持有 draw history 与 idempotency，
  feedback 持有 feedback/reply，room platform 持有 room directory、game start 与 participant，user-events platform
  持有 inbox，狼人杀与瞎掰王继续各自持有游戏专属表。`db/index.ts` 只创建 schema-free Drizzle driver，没有 barrel
  或兼容转发。
- 表拆分没有修改 migration SQL、列、索引或外键。跨 owner 的业务事务直接 import 权威表定义，例如 auth 的匿名账号
  升级会迁移 account stats 与 gacha history；这种显式依赖不复制 schema，也不隐藏跨 owner transaction。
- 原 `app/runScheduledMaintenance.ts` 改为薄的 `app/scheduled.ts`。匿名账号、认证记录、抽卡幂等记录和房间 saga 的
  maintenance 分别归 account、auth、gacha 与 room owner；app 只按 Cloudflare cron expression 组合任务。每日任务仍逐个
  隔离执行，全部结束后以 `AggregateError` 抛出完整失败，未知 cron 立即失败，不吞错、不重试、不改变保留期限。
- architecture contract 使用 TypeScript AST 读取全部 production `sqliteTable()` 调用，精确断言每张物理表的名称、唯一性
  和 owner path；同时锁定 `db/` 只有 `index.ts`，`app/` 只有 `GameRoom.ts` 与 `scheduled.ts`，防止聚合 schema 或第二套
  scheduler 再次出现。
- 定向验证通过：root/Worker TypeScript、architecture contract 1 suite / 3727 tests、Worker production migrations 与
  Vitest 18 files / 121 tests。完整 `pnpm run quality` 通过：root/Worker TypeScript、game-engine build、Knip、ESLint、
  Prettier 全绿；root 221 suites / 8710 tests、game-engine 86 suites / 2513 tests、api-worker 18 files / 121 tests
  全部通过。root Jest 仍只有仓库已记录的 Expo teardown 与 forced-exit 噪声，没有为测试进程噪声修改 production 行为。
- Phase 8.11 尚余严格 owned request schema、account/auth 路由边界与 Worker binding 类型收口；之后进入 engine/client
  residual cleanup 和 local migration、seed、最终 quality、全量 E2E 验收。

### 当前提交：Phase 8.11D Worker route 与 request boundary 所有权

- `/auth/user` 与 `/auth/profile` 的公开 URL 保持不变，但实现、schema、profile serialization 与测试归入
  `features/account`；`features/auth` 只保留身份建立、credential、session、claim 与 token 生命周期。WeChat
  provider adapter 归入 `features/auth/wechat`，旧路径直接删除，不提供 forwarding export。
- `/api/games/:gameType/users/:userId/stats` 从 account route 移入 `games/publicStatsRoutes.ts`，由 canonical
  `WORKER_GAME_CATALOG` dispatch 对应游戏的公开统计。account production code 不再 import game composition，
  architecture contract 对该依赖方向和 owner 根文件集合做精确断言。
- 所有客户端控制的 auth、account、feedback、gacha、telemetry 与狼人杀 AI chat JSON object schema 使用 Zod 4
  `strictObject`，未知 root 或 nested field 在 HTTP boundary 直接返回 validation error。GitHub webhook、微信 API 与
  Fib word provider 的第三方响应仍允许 provider 增加字段，并分别保存在明确命名的 provider schema/adapter 中。
- architecture contract 通过 TypeScript AST 扫描全部 Worker production file，只允许三个 external provider
  boundary 调用 permissive `z.object()`；新增 integration/schema tests 同时证明客户端未知字段被拒绝、第三方额外字段
  被接受。定向验证通过：root/Worker TypeScript、architecture contract 1 suite / 3751 tests、Worker
  21 files / 134 tests。
- 本批提交前完整 `pnpm run quality` 通过；没有修改公开 URL、数据库 schema、migration 或运行时响应 contract。
  Phase 8.11 只剩 Wrangler 生成 binding 类型的单一权威收口，之后进入 engine/client residual cleanup 与最终验收。

### 当前提交：Phase 8.11E Wrangler binding 单一类型权威

- `wrangler.toml` 成为 production binding 名称的唯一权威，提交 Wrangler 4 生成的
  `worker-configuration.d.ts`。`src/env.ts` 只导出 `Env = WorkerBindings` 与 Hono variables，不再手写 D1、R2、DO、
  Workers AI、Analytics Engine、version metadata 或 secret；第二份 `worker-globals.d.ts` 已删除。
- 删除从未被 `pnpm dev` 选中的 `[env.dev]`。该 named environment 让 Wrangler 2026 multi-environment type generation
  把只存在于 production config 的资源错误地生成为 optional，却没有为实际 local command 提供任何覆盖。local command
  现在显式传入 `ENVIRONMENT=development`、`FIB_WORD_PROVIDER=local` 与空 Sentry DSN，不复制 resource binding。
- Cloudflare 只读 secret inventory 证明 Worker 消费的十个 secret 已全部配置；`[secrets].required` 现在同时承担部署
  validation 与 type generation。代码删除 R2、WeChat、Resend、GitHub、Gemini 和 Analytics token 的请求期
  `NOT_CONFIGURED` 分支，配置缺失在 Wrangler boundary fail fast，不再伪装成业务 500/503。
- 类型生成使用 `--env-interface WorkerBindings --strict-vars=false`：binding key 及 required/optional 仍由
  `wrangler.toml` 精确生成；value 保持 `string`，因为同一 production source 还由 local、Vitest 与 E2E composition 以
  `development/test`、`local` 等值执行，具体 Fib provider 继续由 owner-local runtime parser 穷尽校验。
- api-worker 删除 `@cloudflare/workers-types` 和手写 crypto augmentation，改用生成的 workerd runtime types；Pages
  `functions/` 同样改用根 `wrangler.jsonc` 生成的 `functions/types.d.ts`，root 与 Worker manifest 都删除旧 runtime
  types package 的直接依赖。
  Worker 的 `types:check` 与 Pages 的 `types:pages:check` 都进入 root `typecheck`、`quality` 和 CI，配置或生成声明
  漂移会直接失败；两个 tsconfig 只加载各自兼容日期对应的生成声明，不让 runtime global 交叉污染。
  Pages tsconfig 显式只加载 `ES2022` lib，不再让 TypeScript 默认 DOM globals 与 workerd globals 合并冲突。
  Pages 生成声明是 tsconfig 的显式 source input，不通过只面向 package type library 的 `compilerOptions.types` 伪装路径。
- Cloudflare Dashboard 下载结果确认 Pages 项目的真实 production compatibility date 是 `2026-04-03`。根
  `wrangler.jsonc` 固化项目名、`dist` 输出目录与该日期，成为 Pages Functions 配置权威；下载结果中的两个无消费者
  Supabase 变量不进入新配置，Sentry DSN 仍由 CI build env 注入，不把 build-time public env 伪装成 runtime binding。
  类型命令显式读取空的 `env/pages-types.env`，因此不会把开发者本机 `.env` 中的 Expo build variable 推断成 binding。
- `wrangler.test.toml` 与 `wrangler.e2e.toml` 显式提供每次请求都会读取的 `CF_VERSION_METADATA` binding。第一次定向
  测试因此在 Sentry composition boundary fail fast；补齐 test composition 后 Worker 21 files / 134 tests 全绿，
  没有恢复 `CF_VERSION_METADATA?.id`。root/Worker/Pages TypeScript、两份 generated type check、Pages Functions
  bundle 与 architecture contract 1 suite / 3750 tests 同时通过。
- architecture contract 锁定 `Env` 只能 alias `WorkerBindings`、两份生成文件必须存在、root 与 api-worker manifest
  不得重新直接依赖 `@cloudflare/workers-types`，且两个 type check 必须属于 root quality。agent path rule 同步删除旧的
  `workers-types & Disposable` cast 指南。Phase 8.11 至此完成；Phase 8.12 处理 JWT/provider payload runtime parsing、
  test tsconfig 现存类型错误、剩余 cast/fallback/旧命名与 client/engine 精确 exports 门禁，然后执行最终验收。
- 生成的 workerd `FormDataEntryValue` 已让 avatar route 的字符串分支精确收窄到 `File`，旧双重断言删除。production、
  Vitest 与 E2E 的 CORS origin 原本全是同一个 wildcard，删除不存在环境差异的假 binding，直接注册 Hono 标准 wildcard
  middleware，避免 `cors()` 无泛型 option callback 的 `Context<any>` 污染 app context。架构测试先运行时解析 package
  scripts 为 string record，再断言命令内容，不通过 Jest asymmetric matcher 把 `any` 写回配置对象。
- 本批提交前完整 `pnpm run quality` 通过；root 仍只有仓库已记录的 Expo teardown 与 forced-exit 噪声，没有为测试
  进程噪声修改 production 行为。

### 当前提交：Phase 8.12A JWT principal 单一认证边界

- access token 只保留稳定的 `sub/ver/iat/exp`，不再携带会随匿名升级而过期的 `anon/email` 快照。
  `authenticateAccessToken` 在同一边界完成 HS256 algorithm allowlist、严格 Zod claims parsing、用户存在性、
  token-version 撤销检查，并从 D1 当前用户行构造 `userId/isAnonymous/tokenVersion` principal。JOSE 的签名、过期等
  预期错误映射为 invalid token；配置或 runtime 异常不再被无差别 `catch` 吞掉。
- Hono `requireAuth`、`GET /auth/user`、可选身份的 email signup 与 Worker WebSocket admission 全部消费同一个认证结果，
  删除只验签名的 `verifyToken` 平行入口。撤销 token 不能再进入 WebSocket 或升级匿名账号；账号是否匿名由 D1 当前行
  决定，旧 token 不会在账号升级后继续提供匿名权限状态。
- `issueTokenPair` 必须由调用方提供已读取的 token version，不再用 optional claims 和 `ver ?? 0` 掩盖漏传。
  `bumpTokenVersion` 要求 update 精确命中一行，用户不存在或更新后消失立即抛错；匿名升级、WeChat claim 与 account merge
  删除非空断言和重复 read-back，用已认证 principal 或已查询账号行传递版本。
- profile serialization 把“新插入用户的空资料”建模为显式 `createEmptyUserMetadata`，已存在用户则必须提供
  `ProfileRow`；`selectUserProfile` 查不到 required user 时 fail fast，不再让 `row?.field ?? null` 把数据不变量错误
  序列化成正常空资料。
- 新增 signed-but-invalid claims、signout 后 `/auth/user`、已删除 subject、撤销 token WebSocket、撤销匿名 token signup
  以及 missing-user token-version bump 回归测试。Worker 22 files / 140 tests 与 production Worker TypeScript 均通过。
  `tsconfig.test.json` 仍只剩审计前已记录的 daily-reward unknown JSON 与 Fib word-provider mock state 擦除，下一提交
  Phase 8.12B 负责把这两组连同 provider payload runtime parsing 一并收口。

### 当前提交：Phase 8.12B provider runtime contract 与 Worker test type-honesty

- Cloudflare Analytics Engine SQL 请求从 admin route 抽入 `features/admin/providers/analyticsEngine.ts`。adapter 按官方
  [JSON FORMAT](https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/statements/#format-clause)
  解析 required `data` envelope 与两种查询各自的 strict row schema，并把 API 可能返回的 number/string 数值显式规范成
  finite decimal number；空白、hex、Infinity、缺字段、非数字或非 2xx 都记录 provider failure 并返回 502。account ID 由
  production/test/E2E Wrangler composition 提供 `CLOUDFLARE_ACCOUNT_ID`，不再藏在 adapter 常量中。route 不再用
  `const data: { ... } = await response.json()` 假装外部 JSON 已可信，也不再用 `data ?? []` 把 malformed response 当空结果。
- GitHub issue、comment 与 state PATCH 从 feedback route 抽入 `features/feedback/providers/github.ts`，固定官方当前
  `2026-03-10` REST API version。create issue/comment 分别要求文档规定的 201 与正整数 `number/id`，state update 要求 200；
  provider 错误抛给 Worker 统一 logging/Sentry/500 管线，不再把失败 PATCH 静默当成功。参考 GitHub 官方
  [issue API](https://docs.github.com/en/rest/issues/issues) 与
  [comment API](https://docs.github.com/en/rest/issues/comments)。resolved feedback 的 reopen 先同步 GitHub，再创建 comment，
  最后用 D1 batch 原子写 reply 与本地 status；显式 resolve/reopen 同样在 provider 成功后才写本地状态。
- gacha idempotency 从“先改余额、后写 replay、冲突静默忽略”改为 `0039_gacha_mutation_ledger.sql` 支撑的原子 ledger。
  全局 key、owner、claim、operation 与 applied state 都持久化；draw 的 claim、全部 history、applied 标记、OCC stats update 和
  loser cleanup 在一个 D1 batch 中顺序执行，exchange 同样把 claim/stats/replay 放在同一 transaction。依据 Cloudflare 当前
  [D1 batch 文档](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)，batch 内 statement 顺序、非并发执行，
  任一失败会回滚整批。same-key 并发只应用 winner 一次并返回同一 response；different-key loser 不留下 claim/history，读取
  新 version 后重算。首次 daily reward 也删除 conflict-upsert 双发路径，只有 insert winner 获奖，loser 进入 cooldown。
- replay 读取先验证 applied、owner 与 operation，再由 draw/exchange 各自 Zod schema 解析持久化 JSON；语法损坏会被重新分类为
  服务端持久化不变量错误，不能落入 request `INVALID_JSON`，shape 损坏或未知 reward ID 同样立即失败。game-engine reward
  catalog 增加 `REWARD_TYPES/RARITIES` runtime tuple，Zod 与 TypeScript type 从同一来源生成，避免 Worker 再抄一份枚举。
- Fib Workers AI adapter 只依赖最小 `run(model, input)` port，并在 candidate parser 前验证 required `response` envelope；测试
  不再把普通 object 双重断言成整个 Cloudflare `Ai`。word effect 的 committed result helper 保留 `FibState`，不再擦成
  `BaseGameState<'fibking'>`。daily reward 测试用 discriminated Zod output contract 解析实际 response，不以 `unknown` 或泛型
  注解绕过。
- `tsconfig.test.json` 正式进入 Worker `typecheck` 和 root `quality`，production/test 两套 TypeScript 都必须为零错误。
  新增 Analytics Engine、GitHub provider 与 gacha replay 的成功、malformed、错误状态、跨用户、跨 operation、同 key/不同 key
  并发和 daily 首次并发测试；Worker 定向验证为 25 files / 159 tests。完整 `pnpm run quality` 在本提交前通过，root 仍只保留
  已记录的 Expo teardown/forced-exit 噪声。
  Phase 8.12 下一批删除 request metadata cast，并继续 engine/client 精确 exports 与 fallback/旧命名审计。

### 当前提交：Phase 8.12C Cloudflare request metadata 单一边界

- 新增 `platform/http/requestMetadata.ts`，直接消费 Wrangler 生成的 `Request.cf`，不再为 Worker runtime 手写
  `Request & { cf: ... }` 或断言 `country`。缺失 `cf` 是 local/scheduled 调用的合法状态；字段一旦存在却不是
  generated contract 规定的字符串，或 `continent` 不是 Cloudflare 七个洲代码之一，就在 HTTP platform boundary
  立即抛错，不把 malformed runtime metadata 静默改写成 `unknown`。
- Worker request log、auth geo persistence、load timing Analytics Engine、Werewolf AI usage 与 room DO placement
  全部消费同一个 parser。owner 仍负责目的地语义：D1 nullable column 写 `null`，Analytics 缺值写原有
  `unknown`/空串，结构化日志保留 `undefined` omission；scheduled room reconciliation 没有 incoming request，因此不传
  location hint。
- DO continent mapping 使用 `Record<ContinentCode, DurableObjectLocationHint | undefined>` 穷尽生成类型；`AN` 明确不提供
  hint，其余代码保持原有 `afr/apac/weur/enam/oc` placement。依据 Cloudflare 当前
  [Request 文档](https://developers.cloudflare.com/workers/runtime-apis/request/)与
  [Durable Object namespace 文档](https://developers.cloudflare.com/durable-objects/api/namespace/)，`cf` 属于 incoming
  Worker request，`locationHint` 属于 namespace stub lookup option，二者不进入 game-owned module。
- architecture contract 以 TypeScript AST 枚举 Worker production property access，规定 `.cf` 只能由该 parser 读取，
  并精确锁定 `platform/http` 的三个 production 文件，不能重新增加第二个 metadata boundary 或 forwarding helper。
  定向 architecture suite 为 1 suite / 3765 tests。
- 新增 present、local/scheduled absent、wrong-type 与 invalid-continent 回归测试。Worker production/test TypeScript
  全绿，Worker 全量 26 files / 163 tests 通过；production source 中不再存在 `IncomingRequestCfProperties`、`CfRequest`
  或 request metadata cast。完整 `pnpm run quality` 通过：root 221 suites / 8755 tests、game-engine 86 suites /
  2513 tests、Worker 26 files / 163 tests，类型生成、三套 TypeScript、engine build、Knip、ESLint 与 Prettier 全绿。
  Phase 8.12 下一批进入 engine/client 精确 exports、fallback 与旧命名审计。

### 当前提交：Phase 8.12D game-engine 精确 subpath exports

- 删除无人消费的 `packages/game-engine/src/index.ts` 聚合入口，以及 `package.json` 的根 `.`、`main`、`types`
  声明；客户端、Worker、E2E 和 engine 自身也删除对应的 TypeScript/Jest 根路径解析规则。仓库内调用方必须按
  `games/*/public`、`platform/*` 或 `product/*` 的所有权入口导入，不能借 package root 绕过边界。
- 删除零外部消费者的 `./platform/room/seating` package export。seating kernel 仍是 engine 内部共享 room primitive，
  concrete engines 继续用相对路径消费；它不再被误声明为跨 workspace package contract。完整 Knip 首次执行同时暴露
  `SEAT_OPERATION_REASONS` 只被旧聚合入口转发，因此删除该无消费者的 barrel export，不添加 ignore。
- engine architecture contract 精确锁定全部公开 subpath、校验每个 types/default 文件映射，并断言聚合 root 文件和
  package metadata 不得恢复；仓库 architecture contract 对全部 client/Worker production consumer 禁止 package-root
  import。依据 Node.js package entry-points 与 TypeScript package exports 规则，只有 `exports` 中列出的 subpath 才是
  workspace 对外 contract。
- engine architecture 定向 1 suite / 141 tests、仓库 architecture 定向 1 suite / 4566 tests、engine build 及
  root/Worker/E2E TypeScript 全绿。完整 `pnpm run quality` 通过：root 221 suites / 9556 tests、game-engine
  86 suites / 2512 tests、Worker 26 files / 163 tests；只保留已记录的 Expo teardown/forced-exit 噪声。
  Phase 8.12 下一批继续 client facade/旧命名与 fail-fast 残留清理。

### 当前提交：Phase 8.12E 删除 client facade 身份

- 审计 `WerewolfGameFacade` 的实际职责后确认：共享房间 entry、connection、seat、profile、share 与 user event 已由唯一
  `RoomSessionClient` 和 shared room controllers 所有；该类只剩狼人杀命令映射及音频生命周期。因此不再保留 facade
  身份，把实现和测试命名为 `WerewolfGameClientRuntime`，继续实现 UI 依赖的 `WerewolfGameClient` port。
- 狼人杀 module composition、room/config hooks、bot control、action delegation 与对应 tests 全部统一使用 `client` 命名；
  Fib 仍直接消费同一 `RoomSessionClient`，没有新增 Fib runtime、adapter 或第二套 shared room API。
- client architecture contract 使用 TypeScript AST 扫描全部 `src/games` production identifier，并检查文件名，禁止再次
  引入含 `Facade` 的 game-owned abstraction。旧 facade 文件、类、依赖名和调用变量均必须零残留。
- runtime/hook/config/bot delegation/architecture 定向 8 suites / 4645 tests 与 root TypeScript 全绿。完整
  `pnpm run quality` 通过：root 221 suites / 9557 tests、game-engine 86 suites / 2512 tests、Worker
  26 files / 163 tests；只保留已记录的 Expo teardown/forced-exit 噪声。Phase 8.12 下一批继续全仓
  fail-fast、compatibility 与旧命名残留审计。
