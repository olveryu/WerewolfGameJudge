# 多游戏平台架构设计

> 状态：现行平台架构参考（多游戏重构已于 2026-10 完成）
> 范围：game-engine、API Worker、Durable Object、客户端服务、导航、共享房间 UI 及所有游戏模块

> 阅读边界：§1–3 的"基线"与 branch 结论是 2026-09 的历史起点，不代表当前代码；§4–28 描述的目标架构已落地，
> 是当前边界与不变量的权威来源。新游戏接入采用第 25 节清单；跨游戏 UI 契约见
> [room-shell-contract.md](room-shell-contract.md)，视觉基准见 [DESIGN.md](DESIGN.md)。
> 迁移阶段、删除清单、决策汇总、DoD 与逐提交实施记录已拆到
> [archive/multigame-migration-record.md](archive/multigame-migration-record.md)。
> 文中示例与当前实现冲突时，先核对所属模块源码，不复制旧路径或旧 API。

## 1. 文档目的

这个仓库最初只服务狼人杀。因此在 `main` 中，很多狼人杀实现使用了看似通用的名字，例如 `GameState`、`GameStore`、`GameFacadeContext`、`GameRoom` 和 `engine/`。加入瞎掰王后可以确认：这些名字大多不是多游戏抽象，而是狼人杀业务实现。

本文定义把仓库改造成多游戏平台的最终目标。目标不是为每个游戏复制一套房间、连接、座位和 UI，而是明确区分：

1. 所有游戏真正共用的平台能力。
2. 每个游戏独立拥有的规则和界面。
3. 在 Worker、客户端和 engine 三个运行环境中如何完成类型安全的组合。

本文是后续重构的权威设计文档，描述的是目标状态，不表示 `main` 已经实现这些结构。

目标必须支持：

- 狼人杀现有行为零回归。
- 瞎掰王默认 8 人，支持 4–20 人。
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
- 共享房间视觉组件：header actions、seat tile/board、player profile、QR 分享、bot control banner、seat confirmation、bottom action panel（主持台 + 底部进度行）。
- 游戏 adapter 只负责本游戏的摘要、身份、规则、配置和特殊操作。
- 从用户卡片直接移出座位，不再弹第二个确认窗。
- 入座和换座使用确认弹窗；本人从 profile 离座直接提交，不增加第二个确认窗。

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
- 狼人杀和瞎掰王使用同一套 header 几何、seat board、profile、分享和 bottom panel（主持台 + 底部进度行）。
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
│       │   ├── RoomHostManagementPanel.tsx
│       │   ├── RoomProgressIndicator.tsx
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
│       ├── link/
│       │   ├── roomCommandResult.ts
│       │   └── LinkRoomAccountCapability.ts
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

1. Host 发送 `fibking.roles.assign`。
2. Engine 验证 phase 和满座条件。
3. Engine 转为 `preparing`，保存 `roundId`，发出 `fibking.word.select` effect。
4. Outbox worker 从 D1 全局题库按玩家曝光历史和稳定 seed 选词；空库时使用确定性本地兜底。
5. 它使用同一个 `roundId` 发送 internal `fibking.round.complete`，附带 word、definition、source。
6. Engine 拒绝过期或重复 `roundId`。
7. Complete 成功后分配身份并转为 `ongoing`。
8. D1 选题失败通过 outbox retry，第七次失败进入显式 `selectionFailed` 终态。
9. 产品需要恢复操作时，host 可以发送 `fibking.round.cancelPreparing`。

不再使用“先 `BEGIN_DRAW`，等待外部调用，再希望第二个 action 成功”的流程。

### 18.3 Provider boundary

瞎掰王拥有自己的 `FibWordProvider`：

```ts
interface FibWordProvider {
  generateBatch(request: FibWordRequest): Promise<readonly FibWordCandidate[]>;
  reviewBatch(
    request: FibWordRequest,
    candidates: readonly FibWordCandidate[],
  ): Promise<readonly FibWordReview[]>;
}
```

Gemini 是后台题库供给 adapter，不是开局链路或全 App 的 LLM compatibility API。Cloudflare Cron 每日只读检查库存；
低于阈值且距上次完整补货至少 15 天时启动 campaign，每次 invocation 最多处理 10 个候选批次，所有 Gemini 调用
统一以 5 RPM 节流并跨日续跑。每批先生成 6 个候选，再发起不继承生成上下文的独立 structured-output 审核；只有
审核通过的候选进入 active 题库，每类达到 200 个 active 词后完成 campaign。

AI provider 每次按指定类别生成 6 个候选：书面/古典词、仍在使用的网络用语、三字以上的新概念或复合表达、
可向普通人解释的冷门生活/文化/专业概念。候选必须是 2–12 个汉字；目标是新鲜且有描述空间，不接受一眼可解释的
基础词、过时烂梗或无明确含义的缩写。在线 Worker 使用 `roundId` 派生的稳定 seed 在 active 题库中选择。

Provider-facing schema 使用 Gemini structured output 支持的 JSON Schema 子集。字符、长度、候选类别完整性、候选
重复和类别由 Worker 的 Zod/runtime validator 再次严格校验。审核结果必须与原候选数量、词语和顺序逐项一致；漏项、
增项、乱序或未知字段都会让整批失败。`fib_word_candidate_reviews` 保存首次审核结论和具体原因，历史 rejected 词即使
后来被模型接受也不能进入 active 题库；generation cycle 分别记录 accepted、rejected 和 duplicate 数量。

客户端不会通过 Gemini proxy 来开始一轮。

### 18.4 玩家词语历史

当前房间 `usedWords` 仍是 authoritative 50 词硬去重窗口。除此之外，D1 为每名真人保留最近 200 个实际进入
authoritative round 的词；新一轮选题优先使用所有当前真人均未见过的词。词史由 `fibking.word.recordUsage` effect 在
`fibking.round.complete` committed success 后写入；选中但未完成的 round 不计入曝光。

`fib_word_exposures` 以 `(user_id, word)` 为主键，重复看到同一词只更新时间。写入与按用户 `ROW_NUMBER()` 裁剪在一个
D1 batch 中执行，因此表大小按用户有界；已删除账号先与 `users` 相交，不会让一个 stale participant 阻断其他玩家
的历史。若写入在 command commit 后失败，独立 usage outbox effect 重试相同幂等账本，再补写 exposure。

## 19. 客户端链路架构

### 19.1 Shared RoomLink

连接、snapshot store、command dispatch、重连和在线表全部通用（`src/platform/realtime/`，设计见
`docs/realtime-link-redesign.md`）：

```ts
interface RoomLink<TState, TCommand> {
  getSnapshot(): LinkSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  connect(identity: RoomIdentity, signal: AbortSignal): Promise<void>;
  dispatch(command: TCommand, options: DispatchOptions): Promise<DispatchOutcome<TState>>;
  retryNow(): void;
  close(): void;
}
```

只有一个实现。狼人杀可以在它外面 compose audio orchestration，但不能重新实现 connection 和基础 room command。瞎掰王也不再建立一套平行 facade 去重复 link status mapping。

### 19.2 Composition root

App composition root 提供 infrastructure 和 `RoomLinkFactory`，不再每加入一个游戏就新增一个 provider 和一个 context accessor：

```ts
interface RoomLinkFactory {
  create<TState, TCommand>(codec: GameStateCodec<TState>): RoomLink<TState, TCommand>;
}
```

Active room host screen 使用已解析的 game module 的 codec 创建 typed link；`RoomLease` 保证同一时刻只有一条 link 持有房间。测试注入相同 contract（`src/test-utils/roomLink.ts`）。

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
- 横幅位（内容区上方，一次一条）：Connection 横幅优先，其次 Controlled-bot 接管横幅。
- Seat board。
- Bottom action panel（玩家行动 + 主持台 + 底部细进度行）。
- Seat confirmation modal。
- Player profile card。
- QR code modal。
- 统一 spacing、尺寸、z-index 和 safe-area 行为。

游戏 screen 不得复制这段 JSX 后把复制品称为 adapter。

### 20.2 Room shell model

```ts
interface RoomShellModel {
  readonly roomCode: string;
  readonly capabilities: RoomCapabilities;
  readonly header: RoomHeaderModel;
  readonly connection: RoomConnectionViewModel;
  readonly seats: RoomSeatBoardModel;
  readonly seatConfirmation: RoomSeatConfirmationModel | null;
  readonly profile: RoomProfileCardModel | null;
  readonly share: RoomShareModel;
  readonly bottomActions: RoomBottomActionModel;
  readonly hostManagement: RoomHostManagementModel | null;
  readonly controlledSeat: RoomControlledSeatModel | null;
}
```

主持侧不设独立状态面：`hostManagement` 是主持台的唯一数据源（收起态主行动与展开态
面板渲染同一份动作数据），步进进度由 `bottomActions.progress` 承载、在底部面板顶部
渲染共享细进度行。

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
- 相同主持台（收起态主行动 + 展开面板）与底部进度行的位置和信息密度。
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

| 目标               | Capability        | 结果                                              |
| ------------------ | ----------------- | ------------------------------------------------- |
| 空座，用户未就座   | `canTakeSeat`     | 打开 centered `入座` 确认                         |
| 空座，用户已在别处 | `canMoveSeat`     | 打开 centered `换座` 确认                         |
| 本人座位           | `canViewProfiles` | 打开 profile，允许时显示 `离座`                   |
| 其他真人座位       | `canViewProfiles` | 打开 profile；允许时 host 看到直接 `移出座位`     |
| Bot 座位           | `canViewProfiles` | 打开 bot profile；允许时 host 看到直接 `移出座位` |
| Bot 座位长按       | `canTakeOverBots` | 接管或释放 bot                                    |
| 任意 locked seat   | capability false  | 不存在隐藏 mutation path；需要时显示具体反馈      |

Kick 与本人离座都从 `PlayerProfileCard` 直接执行，不经过 seat confirmation modal。只有入座和换座需要先确认目标座位。

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

按钮归属是声明式合同（详见 [room-shell-contract.md](room-shell-contract.md#action-ownership)）：

- `RoomShellModel.viewer`（`{ userId, isHost, seat }`）是唯一身份声明；`resolveRoomViewerAudience`
  投影为 `host | seated | spectator`，各游戏不得自派生。
- 底部面板只放观看者**自己的**动作：每个底部按钮必填 `audience: 'participant' | 'anyone'`，
  `participant` 需有效座位，`createRoomShellModel` 逐按钮校验并抛错。底部没有 host 档：host 命令
  永不出现在底部面板（含步骤条、hint）。
- host 命令一律进 `hostManagement`；adapter 提供 `buildHostManagement`，由工厂按 `viewer.isHost` 决定
  是否调用。adapter 内不再写 `if (!isHost) return null`。
- host 的"下一步"只有一个出口——**主持任务卡**：`RoomHostManagementModel.task`（`action` / `choice` /
  `message`，可带 `steps`、`note`、`remedyActionKey`）只按 `key` 引用面板动作，自身没有 `onPress`；
  `resolveHostTaskView` 在组装期校验引用并解析出卡片视图。动作不再有 `isPrimary` /
  `remedy` / `consoleBlockedReason`，模型不再有 `hasPendingAction`。
- 渲染层不读角色：`RoomBottomActionPanel` 对 host / player / spectator 的布局完全一致。

### 21.7 Modal 和 menu

- 选择游戏模式使用现有 centered modal，不使用侧边弹层或自造浮层。
- 入座、换座使用同一个 centered seat confirmation modal；profile 离座和移出座位直接执行。
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

Config screen 由 `src/features/room/config/` 按引擎 `GameConfigSchema` 生成（见 [game-config-schema-design.md](game-config-schema-design.md)）：数值使用 stepper + numeric input，开关用 switch，枚举和时长用 radio pill；越界在字段下内联提示并禁用提交，不弹 alert。游戏不再手写 config 页面。

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
- Fib lobby 4 人、8 人、20 人：desktop、mobile。
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
- 最大人数：20。
- 只有 `lobby` 可以修改配置。
- 缩容时，如果被移除范围中存在真人座位，直接失败。
- UI 使用 stepper + numeric input。
- Engine、Worker 与客户端统一复用 `FIB_MIN_PLAYERS` 和 `FIB_MAX_PLAYERS`，只接受 4–20 的整数。

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

座位仍使用 sparse human map 与 implicit bot，避免保存可从配置推导出的空座和 bot：

```ts
interface FibSeatingState {
  readonly numberOfPlayers: number;
  readonly realSeats: Readonly<Record<number, FibHumanSeat>>;
  readonly fillEmptySeatsWithBots: boolean;
  readonly excludedBotSeats: readonly number[];
}
```

规则：

- 普通空座不存储；只有房主明确踢出的 implicit bot 座位写入稀疏 `excludedBotSeats`。
- `fillEmptySeatsWithBots` 为 true 时，未被明确排除的空座派生为 bot。
- Bot ID 和 display name 由 room code + seat number 确定性生成。
- Lobby 中真人可以坐到 implicit bot seat，只替换那个派生 bot。
- 房主从 bot profile 直接移出某个 implicit bot 时只排除目标座位，其他 bot 保留；再次“填充机器人”清空排除列表。
- 排除列表按座位升序且不重复；真人占用被排除座位期间该座计为 occupied，离座后恢复为空座。
- 清空座位会清除真人并关闭 implicit bot fill。
- Occupied count 只遍历真人与显式排除，不 materialize 全部 seat。
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

Fib 上限为 20，adapter 仍通过同一个 lazy source contract 投影座位，不额外维护完整 view-model 数组。

### 22.5 Phase 与按钮

| Phase       | Host action（`hostManagement`）  | Player action（`bottomActions`，`participant`） | Spectator（`bottomActions`，`anyone`） | Seat change |
| ----------- | -------------------------------- | ----------------------------------------------- | -------------------------------------- | ----------- |
| `lobby`     | 配置、填 bot、清空座位、开始本轮 | 入座、换座、离座（座位盘）；底部只有等待句      | 无                                     | 允许        |
| `preparing` | 需要时取消准备                   | 等待                                            | 等待                                   | 锁定        |
| `ongoing`   | 公布答案、查看身份、接管 bot     | 查看本人身份                                    | 查看题目                               | 锁定        |
| `ended`     | 下一轮、结束游戏                 | 查看公开结果                                    | 查看公开结果                           | 锁定        |

`下一轮` 保留座位和 used-word history，创建新 `roundId`、抽新词、重新分配身份。`结束游戏` 清除当前公开结果并返回 lobby，同样保留座位和 used-word history，让共享清空座位、移出玩家和房间设置能力恢复。

如果需要在 `preparing` 或 `ongoing` 中 destructive reset，必须作为明确恢复操作，文案说明会丢弃什么，不能冒充正常下一轮或 ended 阶段的结束游戏。

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
入口先由纯 `werewolfConfigFlow.ts` 严格解析，再映射到内部初始 route。`Config` 只负责板子（角色增减）并校验，
`Rules` 是创建 / 保存的最后一步，承载全部房规开关（首日警长竞选、女巫可自救、黑死病模式）与提交；板子提案
模式没有房规，在 `Config` 直接提交。首日警长竞选与女巫可自救切换后立即写入本地偏好，作为下次新房默认；
黑死病模式每局单独选择。跨出 flow 的行为只有三个显式回调：

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

## 25. 新增游戏接入清单

你画我猜接龙已是现有游戏，其玩法、计时、媒体契约见[你画我猜接龙设计](./pictionary-game-design.md)。
后续游戏沿用以下清单，不把每个游戏当作重新设计房间 UI 的机会。

新增游戏需要：

1. 把 ID 加入 `GAME_TYPES`。
2. 实现纯 game-engine module。
3. 为 state、command、event、normalize、lifecycle 添加 engine test。
4. 实现一个 Worker module，包含 create/command schema 和 effect。
5. 加入穷尽式 Worker catalog。
6. 实现一个 client game module、Home contribution、room adapter 和玩法 screen；lobby config 通过引擎 `<GAME>_CONFIG_SCHEMA` + `defineClientGameModule({ config: (define) => define({...}) })` 声明，不写 config 页面（狼人杀的角色选择 flow 是唯一例外）。
7. 加入穷尽式 client catalog。
8. 添加 create、join、deep link、room shell 和主玩法测试。
9. 按 [跨游戏 UI 契约](room-shell-contract.md) 列出 config、guide、房间各阶段及关联弹窗的组件归属和状态矩阵；以狼人杀为视觉基准。
10. 优先复用完整设置控件、房间摘要、详情容器和共享房间模型；游戏专属工作区仍需对齐工具栏、状态和操作层级。差异必须由功能需要解释，不能仅因文件属于游戏目录而另建样式体系。
11. 完成契约中的定向验证和集中页面验收，分别记录已通过与未执行项；只有导入共享组件或通过单测不能声明 UI 已统一。
12. 有持久化结构变更时提供必要迁移并保留既有房间业务数据；仅支持当前客户端不等于允许发布后旧房间无法进入。

接入文档应记录：现有共享组件选择、确需新增的能力、各游戏阶段的可见信息和操作、验证命令及结果。
通用 UI 规则只维护在 [room-shell-contract.md](room-shell-contract.md) 与 [DESIGN.md](DESIGN.md)；
游戏设计文档引用它们，不复制一套容易过期的尺寸表或控件 API。

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

- 最少 4、默认 8、最多 20；20 接受而 21 拒绝。
- 20 人 initial state 大小保持 bounded。
- 不存在 N 大小的 empty-seat、bot、role structure。
- 恰好一个 guesser 和一个 honest seat。
- 大聪明 word visibility。
- 高位真人占座时 config shrink 失败。
- 真人替换 implicit bot。
- Start、provider complete、reveal、next round。
- Stale/duplicate `roundId` 拒绝。

### 28.3 Worker/DO tests

- Unknown game type 在 initialization write 前失败。
- Worker create/update config schema 由 `configSchemaToZod(<GAME>_CONFIG_SCHEMA)` 生成，与 engine `isValid<Game>Config` 同源。
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
