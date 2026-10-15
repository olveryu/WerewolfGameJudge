---
name: new-game
description: 'Add a new party minigame to WerewolfGameJudge end-to-end: design doc, module registration, infrastructure alignment, bots, word supply, tests, acceptance. Use when: adding a game, new game request, minigame proposal.'
---

# New Game Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

End-to-end addition of a new party minigame (e.g. 瞎掰王 / 你画我猜 / 故事接龙 / 谁是卧底同级),
from design discussion to merged PR. The single biggest failure mode is inventing a parallel
infrastructure for the new game instead of reusing the existing one — this skill exists to
prevent exactly that.

本 skill 的形态是「模板操作规程」：新游戏的骨架不靠人手搭，而是由生成器 CLI
（`pnpm new-game`，见 Phase 2）从 identity / stage 两套模板生成，注册由生成器
代办；`demo` 是这套模板的在册参照实现（全注册、不投产），任何拿不准的接法
先看 demo 怎么接。执行者的工作是填玩法（模板里的 `TODO(gameplay)`）、核对
生成器 report、补生成器不管的手工项——不是照清单人肉同步十几处注册点。

## Non-Goals

- 不做狼人杀新角色/新板子（用 `new-role` / `new-board` skill）。
- 不做已有游戏的玩法改动（那是普通 feature，不是新游戏）。

## Phase 0 — 先读这些，再谈设计

动手前必须读完（只读，不改）：

1. 本 skill 全文。
2. `docs/room-shell-contract.md` —— 跨游戏 UI 与房间外壳契约（组件归属 + 验收矩阵）。
3. `docs/multigame-platform-design.md` 第 25 节 —— 新增游戏接入清单（模块注册）。
4. `docs/roomscreen-state-machine.md` —— RoomScreen 状态机。
5. 仓库 `AGENTS.md` —— 质量门禁、协作规则、核心原则。
6. 至少通读一个现有小游戏的 `docs/<game>-game-design.md`（如 `docs/undercover-game-design.md`），
   理解 design doc 的颗粒度。
7. `demo` 的三层骨架各扫一遍（`packages/game-engine/src/games/demo/`、
   `packages/api-worker/src/games/demo/`、`src/games/demo/`）与它在
   `packages/game-engine/src/games/registry.ts` 的注册条目——它是模板的
   参照实现，Phase 2/3 的接法以它为准。

## Phase 1 — 设计（先给方案，用户批准后才能动手）

### 1a. 需求收集

从用户输入中提取已知项，对照下表**主动追问**所有缺失的必填项，**不许猜**：

| 必填项     | 说明                             | 示例                                               |
| ---------- | -------------------------------- | -------------------------------------------------- |
| 游戏中文名 | 2-6 字，不带人数后缀             | `你画我猜`                                         |
| 一句话玩法 | 给 game picker 展示用            | `一人作画，其余人聊天框猜词`                       |
| 人数范围   | 最小–最大，默认人数              | `4–12，默认 6`                                     |
| 核心循环   | 一局内重复的最小单元             | `选词 → 作画 → 猜词 → 结算`                        |
| 回合结构   | 每人几轮、谁先手、顺序           | `每人画 2 轮，按入座顺序轮流`                      |
| 计时       | 各阶段秒数、超时行为             | `作画 90s，超时按未猜中结算`                       |
| 计分       | 公式必须精确到可实现             | `猜中：50 + round(100 × 剩余毫秒 / 90000)`         |
| 终局条件   | 什么情况下结束、排名规则         | `全部轮次结束，同分按 1,2,2,4 竞赛排名`            |
| 机器人策略 | 是否支持、谁可接管、未接管时行为 | `支持，仅房主接管；无人接管则等 deadline 超时结算` |
| 词库需求   | 是否需要词/题库、首批数量        | `需要，首批 200 个可画名词`                        |

### 1b. 输出设计文档

在仓库外工作稿起草，定稿后必须提交到仓库：`docs/<game-id>-game-design.md`。
**Design doc 进仓库是交付的一部分**，不是可选的 —— PR 里必须包含它，且后续 UI 文案/语义
变化时同步更新（grep 查旧文案）。

Design doc 至少包含：玩法概述、人数与开局、房间大厅行为、配置项、完整状态机、
每条命令的输入/输出/权限/失败文案、计时与超时、计分公式、机器人行为、词库（如有）、
XP/结算、测试计划。

### 1c. 对齐评审（设计阶段就做，不要等到写代码）

逐项回答，**每一项都要有结论**（对齐 / 合理差异+理由 / 待实现）：

- [ ] 大厅：复用 `RoomShell` + 共享房主管理面板（填充机器人、清空座位、配置、踢人），
      不自建第二套大厅 UI。
- [ ] 配置页：复用 `GameSettings` / `GameSettingsStepper` / `GameScreen`；
      人数之外的配置项说明为什么不能复用现有模式。
- [ ] 规则说明：复用 `GameGuide`；玩法介绍写清目标、流程、房主职责、工具边界。
- [ ] 机器人：开局门槛计数方式（真人+机器人如何计）、接管权限（仅房主？）、
      受控席位提示、未接管时的默认行为，与现有小游戏一致。身份型游戏另有
      身份查看检查点：每座位（含 bot）查看齐全才能开始、bot 记录只许房主
      用手动脚手架填（见 3c-3），设计阶段就定死，不许留到实现期自创。
- [ ] 房间外壳：`RoomShell` 的 `content` 用 `seats` 还是 `workspace`，
      参照 contract 中各游戏的选择并说明理由。
- [ ] 结算：XP/完成效应、再来一局、返回大厅、终局排名、匿名玩家显示。
- [ ] 失败文案：命令失败有中文映射，走 `AlertModal`（`Alert.alert` 在 web 上是空实现，禁用）。

**输出完整方案（含改动点、影响范围、备选），等待用户明确批准后才能进入 Phase 2。**

## Phase 2 — 注册：生成器代办，注册表是单一事实源

注册不再是人肉同步的白名单。注册事实收敛在一处：**注册元数据层**
`packages/game-engine/src/games/registry.ts` 的 `GAME_REGISTRY`（以
`GameType` 为键的穷尽映射），每条含 `enginePublicExport`、
`clientModulePath`、`isProduction`（是否投产）、`rewards`（policy 显性化，
见下）、`workerWorkflows`、`httpRoutes`；其余注册点要么与它同为穷尽
映射、要么由它派生、要么被 contract 焊死对账。落地动作只有一件：跑生成器。

```bash
pnpm new-game <game-id> --preset identity|stage \
  --name <中文名> --subtitle <一句话玩法> --icon <ionicon> --tier main|mini \
  --xp <n> --draws <n> --daily-target <n>
```

生成器一次办妥：两套骨架文件（引擎 / Worker / 客户端 / design doc /
e2e spec 模板）、注册表条目、`GAME_TYPES`、三家 catalog、奖励参数表、
package exports 与各 contract 期望清单（architecture / engineSkeleton /
capabilities / engine contracts / botDispatchDiscipline）、注册 migration
（两处 `game_type CHECK` 同步加新 ID），收尾跑 prettier 与
`eslint --fix` 并验证产出零警告。产出 `new-game-<id>-report.md` 列明
已办事项与还差的人工步骤——**report 是本阶段的核对清单，逐项核完才
进 Phase 3**。

注册点按性质分四类，核对时按类用力：

| 类                          | 注册点                                                                                                                                                                                                                                                                                           | 口径                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| 穷尽映射（tsc 兜底）        | `GAME_REGISTRY`；engine catalog（`defineGameEngineCatalog`）；worker catalog（`defineWorkerGameCatalog(GAME_ENGINE_CATALOG, …)`）；client catalog（mapped type `satisfies`）                                                                                                                     | 以 `GameType` 为键穷尽，漏接 = tsc 红，不需要人肉数               |
| 派生（改源头一处自动对账）  | worker `catalog.test.ts` 的 httpRoutes 期望 ← 注册表 `httpRoutes` 派生；api-worker `index.ts` 的 workflow 导出 ← 注册表 `workerWorkflows`，由根 architecture contract 焊死；`GAME_COMPLETION_REWARDS` 三数 ← 注册表 `rewards`（flat）由 contract 焊死                                            | 只改注册表源头；对账失败 CI 会点名游戏                            |
| 生成器代办（人工核 report） | `GAME_TYPES`、注册表条目、奖励表行、engine `package.json` exports + `EXPECTED_PACKAGE_EXPORTS`、engineSkeleton / capabilities / engine contracts / botDispatchDiscipline 的期望清单、三家 catalog、测试 catalog 条目（逐家显式条目，生成器逐个加，仅 navigation 借生产 catalog）、注册 migration | 生成器已办 ≠ 已核对：migration 必须人工审（见 report 的人工步骤） |
| 仍手工（生成器不管）        | ①词供给 workflow：workflow 类 + wrangler `[[workflows]]` binding + 注册表 `workerWorkflows` 声明（声明后 index 导出被 contract 焊死，见 3d）②新依赖 → `pnpm-lock.yaml` 同步 ③e2e spec 启用（Phase 4 的请示口径，生成器只产模板不启用）④上线时把注册表 `isProduction` 翻 `true`                   | 漏办不报错的都在这一类，逐项对着 report 与本表核                  |

奖励（原「第 13 处」）已进注册表且 policy 显性化：生成器按
`--xp/--draws/--daily-target` 写 `rewards: { policy: 'flat', …三数 }`
并在 `GAME_COMPLETION_REWARDS` 同步一行（contract 焊两处一致），条目带
`TODO(new-game)` 注释——**金额未与用户确认前不许删 TODO**，漏填/错填
仍然只会静默无完成奖励。`levelRoll`（按等级浮动，如狼人杀）是注册表里
的显性 policy 值，登记结算模块路径（`settlementModulePath`），不走
flat 表；新游戏默认 flat，不要自创第三种。

生成器默认 `isProduction: true` 写注册表条目；压后上线的游戏先改
`false`——大厅/开房面按此过滤、不投产游戏不许露面，contract 钉死
（demo 即 `false` 的在册样例）。

通用兜底找法仍然成立：grep 现有游戏名（如 `pictionary`）在**测试文件**
里的所有出现，逐个确认生成器是否已覆盖——覆盖不到的就是新的手工项，
先报告再补，不许静默手改本应由生成器/注册表管的清单。

## Phase 3 — 实现

### 3a-0. 从生成骨架起步

实现从 Phase 2 的生成骨架长出来：玩法逻辑填进模板的 `TODO(gameplay)`
标记处；骨架的接线（注册、名册、身份查看、接管、结算 effect）是模板
标准件，不许重写或绕开。拿不准某个接法时对照 demo 的同一文件——demo
与模板同形，是「填完 TODO 的骨架」长什么样。骨架装不下的需求先报告，
不许在骨架外另起平行结构。

### 3a. 分层

- **game-engine** (`packages/game-engine/src/games/<game>/`)：纯逻辑，服务端权威。
  状态机、命令处理、计时、计分、机器人默认行为全部在这里。
- **api-worker** (`packages/api-worker/src/games/<game>/`)：路由 + schema
  （`z.strictObject`）+ workflow（如供词）。Worker 只做读写-计算-广播，
  不写玩法逻辑。
- **client** (`src/games/<game>/`)：screens / room / components，只做展示与意图上报。
  遵守 screens.instructions.md 的三层分离（policy / orchestrator / presentational）。

### 3a-2. 引擎骨架清单（game-engine 侧，AU-34 定版，contract 钉死）

`packages/game-engine/src/games/<game>/` 必须包含以下模块（新游戏照单全建，
`platform/__tests__/engineSkeleton.contract.test.ts` 会逐项校验；其中
contract 的 `REQUIRED_MODULES` 11 项是硬必含，表中标「按需」的按需建）：

| 模块                                     | 职责                                                                                                                                                                                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `engine.ts`                              | `GameEngineDefinition`（createInitialState/decide/evolve/normalize/getLifecycle）                                                                                                                                                   |
| `public.ts`                              | 包的公开面（codec、parse、migrate、投影、常量从这里出）                                                                                                                                                                             |
| `commands/types.ts`                      | 命令词汇（公开命令与内部命令分开）                                                                                                                                                                                                  |
| `domain/decision.ts`                     | `XDecision` 类型别名 + `commitX` 拼装点                                                                                                                                                                                             |
| `domain/evolve.ts`                       | 事件应用（definition 的 evolve 本体）                                                                                                                                                                                               |
| `domain/visibility.ts`                   | 按 viewer 的投影（隐私边界之家；按座投影函数只许住这里，不许放 state/types）                                                                                                                                                        |
| `domain/events.ts` / `domain/reasons.ts` | 事件词汇 / 拒绝码（按需）                                                                                                                                                                                                           |
| `effects/types.ts`                       | effect 词汇（**按需**：`REQUIRED_MODULES` 不含此项，effect 类型默认住 `domain/decision.ts`；只有 effect 词汇成规模才独立成文件，现仅 fibking/pictionary/werewolf 三家有。结算 effect 一律 `<game>.game.completed`，不许与事件同串） |
| `state/version.ts`                       | `X_STATE_VERSION` + `X_STATE_IDENTITY`（codec 一律 `{...IDENTITY, parse}`）                                                                                                                                                         |
| `state/codec.ts`                         | 薄轨 codec 壳（约 11 行）                                                                                                                                                                                                           |
| `state/parseState.ts`                    | 严格 parser + 持久化迁移（legacy 名册物化用平台 `materializeLegacyRoster`）                                                                                                                                                         |
| `state/normalize.ts`                     | 语义不变量（用平台 `createStateInvariant`/`assertStateIdentity` 开头）                                                                                                                                                              |
| `state/types.ts`                         | 状态形状、config、状态派生助手                                                                                                                                                                                                      |
| `__tests__/engine.test.ts`               | 引擎主干测试：一律走平台 harness `platform/engine/__tests__/engineSession.ts` 的 `createEngineSession`，只许命令流、不许注入进度状态                                                                                                |

平台共享件（先查再造，不许各游戏重写）：`buildGameCompletionPayload`
（结算 payload 拼装）、`parseChoice`（runtimeDecoder）、身份查看协议
（`platform/room` 的 identityViewing）。登记例外有两家（以
`engineSkeleton.contract.test.ts` 的 `REGISTERED_EXCEPTIONS` 为准）：
狼人杀四项（reducer 架构：evolve→`domain/reducer/gameReducer.ts`、
visibility→`domain/playerHelpers.ts`、normalize→`domain/state/normalize.ts`、
状态类型→`domain/protocol/types.ts`）；故事接龙一项（visibility→
`domain/relay.ts`，因其跑在 E1 共享接龙链机 `platform/room/relay` 上、
投影在绑定模块装配）。新游戏不得援引为例外。

### 3b. 铁律（违反即返工）

- 服务端是玩法逻辑的唯一权威；客户端完全对等，不许藏逻辑。
- 生产代码不许普通 `as`（只许 `as const`）；样式值必须用 theme token
  （`noHardcodedStyleValues.contract.test.ts` 会扫）。
- 确认框用 `AlertModal`，不用 `Alert.alert`。
- 用户可见文案全中文；`showAlert` 标题用具体动作（如 `'创建失败'`）。
- 命名先 grep：已有概念必须复用已有名字，不许另起一套。
- UI 文案/语义变化时同步更新 design doc（grep 查旧文案）。
- 不把已 revert 的内容带回来：合并前以 `main` 为准核对。

### 3c. 机器人与房主面板（与现有小游戏对齐的默认模式，不允许 drift）

狼人杀是房主面板的基准。标准按钮只有两个：`填充机器人`（key `fill-bots`）+
`清空座位`（key `clear-seats`，variant `danger`）。**不许自创"移除机器人"按钮**
（故事接龙/卧底曾有，已统一移除）——想清机器人就用清空座位，真人重进。

除非设计评审中明确推翻，否则采用以下模式：

- `supportsBots: true`；大厅房主管理面板提供"填充机器人"。
- 配置页**不设**机器人前置开关。
- 开局要求**坐满**：已入座席位（真人+机器人）必须等于配置人数，与故事接龙等现有小游戏一致
  （`occupiedSeatCount !== config.numberOfPlayers → reject('请先坐满所有座位，或填充机器人。')`；
  客户端开始按钮条件同理，禁用文案 `'座位尚未坐满'`）。不许自创"达到最小人数即可开"的放宽口径。
- 仅房主可接管/释放机器人席位；受控席位有 banner/hint。
- 机器人无自主 AI；无人接管时按超时/deadline 默认行为结算，不自动跳过。

### 3c-2. 名册与接管（平台统一结构，不允许各游戏自建）

七个现有游戏已全量统一（名册全统一，2026-10），新游戏必须直接接入同一套：

- **占用名册只有一份结构**：引擎持久化状态必须含 platform 的
  `roster: RosterMap<THumanSeat>`（`packages/game-engine/src/platform/room/seating`），
  座位占用值只有三种：真人 occupant `{seat, userId}`、机器人 occupant
  `{seat, kind: 'bot'}`、无键=空位。游戏数据（如角色）与占用分开存，
  不许把 userId/isBot 塞进玩家记录，更不许自建 `botSeats` /
  `excludedBotSeats` / 隐式推导（如"有局内数据但不在真人表里就是 bot"）。
- **座位变更全走 platform roster 决策函数**（decideRosterTakeSeat /
  LeaveSeat / KickSeat / ClearSeats / FillBots + applyRosterChanges）；
  "谁是 bot"只用 platform 选择器（getBotSeats / isBotSeat）。
  七家（含狼人杀）已全部直调 platform 决策函数、无一例外——不存在
  "某家在 handler 内手写等价逻辑"的存量例外，新游戏更不许自写。
  微语义（七家一致）：真人坐 bot 位一律拒绝（seat_taken）、离座不复活、
  踢 bot 变空位。改人数分两种：config 人数（卧底/阿瓦隆/瞎掰王/你画我猜/
  故事接龙/drawguess）是任一越界占用（真人或 bot）即拒绝；狼人杀改板子
  是截断越界座位（等于踢出），不要混为一谈。
- **状态版本与迁移**：状态带 stateVersion；任何形状变更必须 bump 版本、
  写真 migratePersisted 并在 api-worker 模块注册（未注册 migrate 时版本
  bump 会砖化存量房间）、配逐座位迁移等价测试。
- **接管入口唯一**：有座位表的游戏 = 房主长按机器人座位，走共享
  `useBotTakeoverLongPress`；无座位表的游戏 = 走共享 `BotTakeover`
  菜单/浮钮。接管 capability 只有房主条件、文案统一
  `'只有房主可以接管机器人'`——**接管全程无阶段条件**：只要有 bot
  座位，房主随时可接管（含大厅、任意阶段），**不许给接管加任何
  阶段/模式/音频条件**。也不许引入 debugMode 或任何同类产品门充当
  条件——debugMode 已整个删除（含状态字段），只许存在于迁移测试的
  历史样本里。
- **自动释放只走共享守卫** `useBotTakeoverGuard`（必填 canControlBots +
  seatStillBot）：失去房主身份、或被接管座位不再是机器人时释放；
  不许手写等价 effect。
- **不许做"替换机器人入座"类菜单**：bot 座位点击就是普通座位行为（看资料）。
- 防退化 contract 已锁定以上结构（引擎
  `rosterUnification.contract.test.ts`、客户端同名 contract +
  `botTakeoverGuard.contract.test.ts`）：新游戏的 state types 与房间 hook
  必须补进这些 contract 的消费者/类型清单，contract 不绿不许合并。

### 3c-3. 身份查看检查点与 bot 测试脚手架（身份型游戏标准件，必含）

有发牌/身份的游戏，发牌后必须有独立的身份查看阶段，且开局门按狼人杀
口径定死（平台单一实现 `packages/game-engine/src/platform/room/identityViewing.ts`）：

- **检查点**：每个座位（**含 bot**）的查看记录齐全才能开始——开局谓词
  只许用平台 `haveAllViewed`（参与者构造用 `buildIdentityViewingParticipants` /
  `buildRosterViewingParticipants`）。不许自创"真人看完即可"的谓词
  （`haveAllHumansViewed` 已废止）、不许自创门控。
- **bot 记录只许手动填**：bot 没有客户端，其查看记录只许房主用手动
  脚手架「标记机器人已查看」补齐（平台 `planMarkBotsViewed` /
  `decideMarkBotsViewed` 骨架，命令名 `<game>.bots.markAllBotsViewed`）。
  **引擎永不自动落 bot 标记**——发牌、开局、超时、任何路径都不许。
- **脚手架是标准件**：填充机器人、标记机器人已查看等批量推进动作随
  模板原样包含，仅房主可用、按名册有无 bot 显示，接进共享房主管理
  面板；不许给脚手架另设产品门（见 3c-2 的 debugMode 禁令）。identity
  模板骨架已原样下发整套接线（`botTestScaffold` capability、
  `<game>.bots.markAllBotsViewed` 命令、`haveAllViewed` 检查点，demo
  同形），生成后逐项核其在，不许重写或删改接线。

### 3d. 词库（如需要）：先判形态，两套共享机制二选一或叠加

词供给已经协议化，不许从零搭平行供词链。先判断新游戏属哪种词形态
（一款游戏可以两种都要，如瞎掰王/卧底：局内每轮选词 + 词库批量供给）：

- **局内准备型**（每轮要选一个词/题）：接引擎侧 **Word Preparation
  Protocol**（`packages/game-engine/src/platform/room/preparation.ts`）。
  流程骨架（房主开局冻结 pending → 进 `preparing` 发恰好一个选词
  effect → Worker 带外选词 → 系统内部命令按 roundId 回填
  complete/fail）由协议的 decide 骨架提供，各家只注入三样：失败码
  子集（协议超集 `PREPARATION_FAILURE_CODES` 的子集，D-2）、阶段词汇
  （D-5，可为空）、重试策略（D-1，故意不统一）。状态形状与 reason
  仍各家自有。不许各写一份 prepare 流程。
- **库供给型**（词库要持续补货）：接 Worker 侧 **wordSupply 共享件**
  （`packages/api-worker/src/platform/wordSupply/`）。三家共同的硬
  接口只有一处：本家 `wordPublication.ts` 导出的 **publication
  五函数**（reserve / getReviewCandidates / storeCandidates /
  publish / fail），由 `wordSupply/__tests__/wordPublication.contract.test.ts`
  按共享 `WordSupplyPublication` 接口焊死（三家都要满足；瞎掰王有
  两处已登记的签名偏差，以 Exact pin 钉住）。编排分两种形态：
  **双队列编辑型**（卧底/你画我猜）用共享运行时
  `wordSupplyWorkflow.ts` 的 `runWordSupplyWorkflow`（enable 门/
  容量/预留/生成/审核/发布的 durable 编排，`wordPackLedger.ts` 管
  词包台账），各家只供 config（env 开关、批量上限、模型、history
  形态、provider、候选解析）与 publication 五函数，本家
  `wordSupplyWorkflow.ts` 只剩薄 WorkflowEntrypoint 类；
  **搜索供给型**（瞎掰王）自建 workflow 类编排（自带 maintenance
  与搜索证据链），只对齐 publication 接口、不走共享运行时。除
  wordPublication 与 workflow 类外，各家词文件集不强求同形
  （provider/editorial/selection/deal 按本家供给链取舍）。
  workflow 类与 wrangler `[[workflows]]` binding、注册表
  `workerWorkflows` 声明属 Phase 2 的「仍手工」类，逐项办齐。

两类共同的交付要求：

- 词表 + migration；Admin 触发接口走现有 `gameWords` 模式。
- 首批种子词数量在设计阶段定死（如 200），上线前灌满 —— 空表上线是未完成交付。

## Phase 4 — 测试与验收

1. **本地**（push 前必须过）：改动文件 prettier + `tsc --noEmit` +
   改动文件 eslint（零警告）+ knip（直接跑、查 exit code，不许用管道
   吞码）+ architecture/noHardcodedStyleValues contract tests + 相关单测。
   全量 `pnpm run quality` 的 test 部分交给 PR 的 CI（本地跑不下）。
2. **room-shell-contract 验收矩阵**：逐行记录证据（config/lobby/active/overlays/recovery/layout），
   不适用的行写理由，不许静默跳过。
3. **E2E**：新游戏**默认不新建 spec**——e2e 只更新已存在的 spec；
   认为新游戏需要 e2e 覆盖时，先报告请示用户，获批后才建。已有 spec
   的改动一次只改一个、一个 commit + push 逐个验证；除狼人杀外一律
   多 browser context 真人模拟凑人数，**禁用 bot 凑数**（fill bots /
   接管 bot 只给人工测试用，机器人机制由单测覆盖）；断言可见行为，
   不只断言 import 了共享组件。
4. **Design doc** 已进仓库且与代码一致（抽查 3 处文案/语义）。
5. PR 合并后检查 main 的 CI 全绿才能收尾。

## Phase 5 — 收尾

- 工作稿 design doc 已复制进 `docs/` 并提交。
- PR 描述列出：生成器 report 核对结果（注册四类逐项）、对齐评审结论、验收矩阵证据链接。
- 分支清理；`docs/<game>-game-design.md` 与实现一致。

---

## Key Constraints（速查）

- 新游戏必须从 `pnpm new-game` 生成的骨架起步；不许手抄现有游戏目录充当骨架，demo 是模板的参照实现。
- 新游戏不许自建第二套大厅/配置/房间外壳；先查 `src/features/room/` 和共享组件。
- 新游戏不许复制角色卡或动画组件；角色展示用共享 `RoleCardSimple`/`RoleCardContent`（`src/features/room/components/`），动画用共享 `RoleRevealAnimator` + 自写 `RevealConfig` + `toRevealRoleData` adapter（见 `src/features/room/components/RoleRevealEffects/`）。
- `docs/room-shell-contract.md` 是 UI 集成的唯一权威，细节不复制到本 skill。
- 方案先行：用户明确批准前不写代码；design doc 先行，代码随后。
- 词库表不许空表上线。
- main 为准，不复活 revert 内容；merge 后盯 main CI 全绿。
