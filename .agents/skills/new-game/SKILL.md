---
name: new-game
description: 'Add a new party minigame to WerewolfGameJudge end-to-end via the new-game generator: design doc, preset pick, generator run, integration report disposition, gameplay fills, capabilities wiring, word supply, tests, acceptance. Use when: adding a game, new game request, minigame proposal.'
---

# New Game Skill

> **输出语言：执行本 skill 过程中，所有面向用户的输出（进度报告、询问、完成通知、错误提示）一律使用中文。**

End-to-end addition of a new party minigame (e.g. 瞎掰王 / 你画我猜 / 故事接龙 / 谁是卧底同级),
from design discussion to merged PR. The single biggest failure mode is inventing a parallel
infrastructure for the new game instead of reusing the existing one — this skill exists to
prevent exactly that.

新游戏从模板长出来：**设计走 Phase 1，落地走生成器**（`pnpm new-game`，Phase 2），
生成后按接入报告补完（Phase 3）。不许手抄任何现有游戏的目录起家，不许人肉同步
注册清单——注册由生成器代办、由 contract 遍历注册表兜底校验。参照物是仓库里的
`demo` 游戏：它由生成器亲手产出、全注册、标记不投产，是骨架的活样本。

## Non-Goals

- 不做狼人杀新角色/新板子（用 `new-role` / `new-board` skill）。
- 不做已有游戏的玩法改动（那是普通 feature，不是新游戏）。

## Phase 0 — 先读这些，再谈设计

动手前必须读完（只读，不改）：

1. 本 skill 全文。
2. `docs/room-shell-contract.md` —— 跨游戏 UI 与房间外壳契约（组件归属 + 验收矩阵）。
3. `docs/roomscreen-state-machine.md` —— RoomScreen 状态机。
4. 仓库 `AGENTS.md` —— 质量门禁、协作规则、核心原则。
5. 至少通读一个现有小游戏的 `docs/<game>-game-design.md`（如 `docs/undercover-game-design.md`），
   理解 design doc 的颗粒度。
6. `packages/game-engine/src/games/demo/` 与 `src/games/demo/` —— 生成器产出的参照游戏，
   骨架的文件布局、填空标记与接线形态以它为准。

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
| 词库需求   | 是否需要词/题库、形态与首批数量  | `需要，库供给型，首批 200 个可画名词`              |

另有两项在设计阶段就定死（Phase 2/3 照此执行，不许留到实现期现定）：

- **原型预设**：有秘密身份、发牌与身份查看 → `identity`（身份推理型）；
  无秘密身份、按回合/舞台推进、自带阶段截止 → `stage`（舞台回合型）。
  判据与两预设的差异见 Phase 2。混血形态（如身份 + 轻回合）在 1c 里注明
  选哪个预设起步、之后逐项改哪些能力声明。
- **词库形态**：不需要词 / 局内准备型（对局内要从库里选词，瞎掰王/卧底形态）/
  库供给型（后台持续生成审核灌库，你画我猜形态）。两种词形态可叠加
  （局内准备型的词源头就是供给链）。接法见 3d。

### 1b. 输出设计文档

在仓库外工作稿起草，生成器会产出骨架、定稿后随 PR 提交到仓库：`docs/<game-id>-game-design.md`。
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
- [ ] 预设与能力：按 1a 的判据定预设；逐项过能力开关表（Phase 2），
      与预设默认值不同的每一项写明接法（见 3e），不许只写"到时候再看"。
- [ ] 词库：按 1a 定的形态写明接入面（3d）；首批种子词数量定死。

**输出完整方案（含改动点、影响范围、备选），等待用户明确批准后才能进入 Phase 2。**

## Phase 2 — 跑生成器 + 审接入报告

设计批准后，一条命令生成骨架并完成全部注册接线：

```bash
pnpm new-game <gameId> --preset identity|stage --name <中文名> --subtitle <一句话玩法> \
  [--icon <ionicon-name>] [--tier main|mini] [--xp <n>] [--draws <n>] [--daily-target <n>]
```

- `gameId`：小写字母/数字、字母开头、单个词（类名由它派生 PascalCase，
  如 `drawguess` → `Drawguess`）；不许与现有游戏或生成器测试夹具（`demoproto`）重名。
- 生成器产出 40（identity）/ 37（stage）个文件：引擎包、worker 模块、客户端模块、
  design doc 骨架、migration 骨架、e2e spec 骨架（`.spec.ts.tmpl`，默认不进 CI）。
- 生成器同时改 13 处共享文件完成注册：注册元数据（`games/registry.ts`，含 rewards
  一节）、`GAME_TYPES`、引擎/worker/客户端三层 catalog、包 `exports` 与
  architecture 期望、引擎 contract 期望表（骨架/能力/装配）、worker 路由期望、
  奖励参数表、测试用 catalog、bot 派发登记、migration 的 `game_type` 名单。
  **这些位置不再是人肉清单**：不许手改期望列表去"对齐"——期望由注册表派生
  或与注册表互钉，漏接时 contract 会逐项报出缺失位置（见 Phase 4 门禁）。
- 生成器写完后自带两道整形：仓库 prettier 格式化 + 对新建文件跑 `eslint --fix`
  （成员排序依赖渲染后的真实标识符，静态模板无法对所有 id 预排序）。
  产出即应过格式与 lint 门；生成器报错中止时先看它的输出，不许改生成物绕过。
- 生成结束时仓库根出现接入报告 `new-game-<gameId>-report.md`：生成参数、
  能力声明表、文件清单、共享文件清单、7 项人工步。**逐项处置完才许删报告**，
  处置结果写进 PR 描述（Phase 5）。

### 预设选择判据

两预设是同一副骨架的两个初始提交，只差四项能力声明与其预置接线：

| 能力              | identity（身份推理型） | stage（舞台回合型） | 说明                                        |
| ----------------- | ---------------------- | ------------------- | ------------------------------------------- |
| `identityViewing` | 开                     | 关                  | 发牌 + 身份查看检查点（3c-3 标准件）        |
| `revealAnimation` | 开                     | 关                  | 开卡动画 + 装备特效（依赖 identityViewing） |
| `stageDeadline`   | 关                     | 开                  | 阶段截止 + 定时结算接线（3e）               |
| `botTestScaffold` | 开                     | 关                  | 批量标记命令（无查看记录可标，故舞台型关）  |

其余六项两预设相同：`botsAndTakeover`、`hostConfig` 开；
`nightPhase`、`audioOrchestration`、`wordLibrary`、`gallery` 关
（词库按 3d 在生成后打开并接线）。选预设只看游戏的**主形态**：
有秘密身份与查看阶段选 identity；靠阶段截止推进回合选 stage。
混血游戏选更接近的预设起步，差的那几项在 Phase 3 逐项改声明 + 接线（3e），
不许为了迁就预设改玩法设计。

### 接入报告 7 项人工步的处置规程

1. **设计定稿**：把 design doc 骨架的 10 项需求表填成 Phase 1 批准稿；
   骨架里的展示名、副标题、图标、默认人数都是占位值，逐个核。
   identity 另需把 `TODO_IDENTITY` 占位身份换成真实身份表，并按仓库立绘
   流程生产角色立绘与图鉴素材（prompt 文档先给用户审、生成图先过目点头
   才入库、抠图走既定工具），图鉴接共享图鉴机器（`src/features/encyclopedia/`），
   不许自建第二份图鉴或说明页手写第二份角色文案。
2. **玩法填空**：grep `TODO(gameplay)`（限定新游戏的引擎/worker/客户端三处目录）
   逐个填掉：玩法状态机接 `domain/decision.ts` 与 `engine.ts` 的 TODO 接缝，
   `domain/visibility.ts` 补齐按 viewer 的隐私裁剪。未填的玩法命令显式抛
   「未实现」是骨架的预期形态，不是可交付状态——填空没清零不许开 PR。
3. **奖励数值确认**：报告里的三数是命令参数的占位值（或默认值 5/1/5）。
   定稿后改两处——注册表 `games/registry.ts` 的 rewards 一节与参数表
   `product/rewards/earnings.ts`——contract 验两处一致。新游戏一律 `flat`
   policy；`levelRoll`（按等级浮动）是狼人杀的独立结算管线，新游戏不得援引，
   真需要先走设计评审改注册表口径。
4. **审 migration**：生成的 migration 是从上一份注册 migration 机械派生的
   （只扩 `game_type` 名单）。应用前人工核对重建表集合与现行 schema 一致；
   游戏自有表按文件末尾 TODO 补进**同一份** migration，不许另开一份。
   本地 `db:migrate:local` 跑通才算处置完。
5. **e2e 启用需用户批准**：spec 骨架默认不进 CI。启用 = 先报告请示用户
   （Phase 4 的 E2E 硬规矩），获批后改名为 `<gameId>.spec.ts` 并把文件名
   加进 `.github/workflows/ci.yml` 的 e2e 分片矩阵（覆盖 contract 会验一致）。
   未获批就保持 `.tmpl`，在 PR 描述里写明未启用。
6. **词库（如需要）**：按 3d 接。打开 `wordLibrary` 声明时必须同时在注册表
   `workerWorkflows` 登记供词 workflow（capabilities contract 验两者一致），
   词表与种子词按设计定稿的数量灌满，不许空表上线。
7. **门禁复跑**：按 Phase 4 第 1 条全量跑一遍本地门禁，全绿才进入 Phase 3
   的收尾与开 PR。（生成直后的绿只证明骨架成立，填空后必须复跑。）

## Phase 3 — 生成后补完

### 3a. 分层

- **game-engine** (`packages/game-engine/src/games/<game>/`)：纯逻辑，服务端权威。
  状态机、命令处理、计时、计分、机器人默认行为全部在这里。
- **api-worker** (`packages/api-worker/src/games/<game>/`)：路由 + schema
  （`z.strictObject`）+ workflow（如供词）。Worker 只做读写-计算-广播，
  不写玩法逻辑。
- **client** (`src/games/<game>/`)：screens / room / components，只做展示与意图上报。
  遵守 screens.instructions.md 的三层分离（policy / orchestrator / presentational）。

### 3a-2. 骨架形态（生成器产出，contract 钉死）

生成器产出的引擎目录即骨架定版；权威清单是
`platform/__tests__/engineSkeleton.contract.test.ts` 的 `REQUIRED_MODULES`（11 项）：
`engine.ts`（`GameEngineDefinition`）、`public.ts`（公开面）、`commands/types.ts`
（公开/内部命令分开）、`domain/decision.ts`（Decision 别名 + commit 拼装 +
事件词汇与拒绝码——生成器把 events/reasons 收在这里，不另建文件）、
`domain/evolve.ts`、`domain/visibility.ts`（按 viewer 投影，隐私边界之家；
按座投影函数只许住这里）、`state/version.ts`（`X_STATE_VERSION` +
`X_STATE_IDENTITY`）、`state/codec.ts`（薄轨 codec 壳）、`state/parseState.ts`
（严格 parser + 持久化迁移，legacy 名册物化用平台 `materializeLegacyRoster`）、
`state/normalize.ts`（用平台 `createStateInvariant`/`assertStateIdentity` 开头）、
`state/types.ts`（状态形状、config、派生助手）。外加 `__tests__/engine.test.ts`
（一律走平台 harness `platform/engine/__tests__/engineSession.ts` 的
`createEngineSession`，只许命令流、不许注入进度状态）。

- `effects/types.ts` 是**按需件**，不在必含清单里：有独立 effect 词汇
  （结算/领域 effect，除内联在 decision.ts 的形态外还要单独成册）才建；
  现有七家只有 fibking / pictionary / werewolf 三家有。结算 effect 一律
  `<game>.game.completed`，不许与事件同串。effect 词汇的第一个成员按
  decision.ts 模板的注释长成判别联合，消费方（引擎测试、Worker schemas）
  一律按 `type` 窄化读 payload。
- 登记例外**只有两家**（contract 的 `REGISTERED_EXCEPTIONS`，评审新游戏时照此核）：
  狼人杀（reducer 架构：evolve 在 `domain/reducer/`、normalize 与状态构造在
  `domain/state/`、状态类型在 `domain/models`+`domain/protocol/`、无单一
  visibility 模块）与故事接龙（visibility 住 `domain/relay.ts`，因其跑在
  平台接龙链机上、投影由链机绑定模块产出）。新游戏不得援引为例外；
  确需偏离必含清单，先改 contract 登记并走评审，再写代码。
- 平台共享件（先查再造，不许各游戏重写）：`buildGameCompletionPayload`
  （结算 payload 拼装）、`parseChoice`（runtimeDecoder）、身份查看协议
  （`platform/room` 的 identityViewing）。

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
骨架的房主面板装配已按此产出，补完时只核对、不重写。

除非设计评审中明确推翻，否则采用以下模式：

- `supportsBots: true`；大厅房主管理面板提供"填充机器人"。
- 配置页**不设**机器人前置开关。
- 开局要求**坐满**：已入座席位（真人+机器人）必须等于配置人数，与故事接龙等现有小游戏一致
  （`occupiedSeatCount !== config.numberOfPlayers → reject('请先坐满所有座位，或填充机器人。')`；
  客户端开始按钮条件同理，禁用文案 `'座位尚未坐满'`）。不许自创"达到最小人数即可开"的放宽口径。
- 仅房主可接管/释放机器人席位；受控席位有 banner/hint。
- 机器人无自主 AI；无人接管时按超时/deadline 默认行为结算，不自动跳过。

### 3c-2. 名册与接管（平台统一结构，不允许各游戏自建）

七个现有游戏已全量统一（名册全统一，2026-10），骨架已按此产出，新游戏只填玩法、不许改结构：

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
口径定死（平台单一实现 `packages/game-engine/src/platform/room/identityViewing.ts`）。
identity 预设的骨架已整套包含本节标准件（协议接线、`markAllBotsViewed`
命令、房主面板装配、协议 contract），生成后要做的是填身份表与玩法，
**不许改检查点口径**：

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
  面板；不许给脚手架另设产品门（见 3c-2 的 debugMode 禁令）。

### 3d. 词库（按 1a 定的形态接，两形态可叠加）

先判形态，照对应形态接现成机制——**不许从零搭供词链**：

- **局内准备型**（对局内要从库里选词发给本轮，瞎掰王/卧底形态）：
  引擎接词准备协议 `packages/game-engine/src/platform/room/preparation.ts`
  （平台 decide 骨架 + 协议谓词）。游戏只注入三样：本家能发的失败码子集
  （协议全集 `PREPARATION_FAILURE_CODES`：`selectionFailed` /
  `inventoryEmpty` / `inventoryExhausted`，按本家库存语义选）、准备阶段
  词汇（无阶段门就传空）、重试策略（复用失败轮还是新开一轮，二选一并
  在 design doc 写明）。流程固定：房主开始冻结 pending 轮 → 进
  `preparing` 时恰好发一次选词 effect（带 roundId + 已用集快照）→
  worker 带外选词 → 系统内部命令按 roundId 回填（complete / fail）→
  失败落 `preparationFailed`。状态联合与 reason 文案各家自有，协议
  骨架不许自写第二份。
- **库供给型**（词库在后台持续生成/审核/灌库，你画我猜形态）：
  接 worker 侧共享供给运行时 `packages/api-worker/src/platform/wordSupply/`
  （`wordSupplyWorkflow.ts` 的 durable 编排：enable 门/容量/预留/生成/
  审核/发布，+ `wordPackLedger.ts`）。各家只供 config（env 开关、批次
  上限、模型、历史形状、provider、候选解析）与本家 publication 函数；
  文件五件套以 drawguess 为准：`wordDeal.ts` / `wordEditorial.ts` /
  `wordProvider.ts` / `wordPublication.ts` / `wordSupplyWorkflow.ts`
  （workflow 类本体与 wrangler binding 留在各家模块，运行时共享；
  undercover 的选词件名为 `wordSelection.ts`，是同一位的变体）。
  Admin 触发走现有 `gameWords` 模式，供词 workflow 注册到 api-worker
  `index.ts` exports 并在注册表 `workerWorkflows` 登记（报告第 6 步）。
- 局内准备型的词源头就是供给链：两形态叠加时（如卧底/瞎掰王），
  准备协议管对局内选词，供给链管库存补充，各接各的，不许合并成自创流程。
- 首批种子词数量在设计阶段定死（如 200），上线前灌满 —— 空表上线是未完成交付。

### 3e. 能力声明与接线对齐（改声明的规程）

能力开关的声明只有一处：引擎 `engine.ts` 的 `capabilities`
（`GameEngineCapabilities`），生成器按预设写默认值。声明是**接线声明**，
不是玩法配置：声明开 ⇒ 底盘接线必须真实存在；声明关 ⇒ 不许私接一份。
生成后要改任何一项，三步缺一不可：

1. **先动接线**：接上或拆掉对应的底盘能力（命令、effect、worker hook、
   客户端消费），声明跟着接线走，不许先改声明凑数。
2. **改声明**：`engine.ts` 的 `capabilities` 改对应项。
3. **同步期望行**：`packages/game-engine/src/platform/engine/__tests__/capabilities.contract.test.ts`
   里本游戏的期望行同步改。contract 双向验（声明与接线标记逐项对照），
   只改一处必红——红了是 contract 在干活，不许改 contract 放行。

范例（demo，PR-4 落地）：identity 预设的 `stageDeadline` 默认关，demo 为
全链路验收接了截止——引擎 `game.begun` 进 `playing` 时带 `deadlineAt`
并武装一条 `settle.due` effect、加内部命令 `phase.settleExpired`
（系统身份 + effect-id 门 + deadline 门）、worker module 的
`getEffectDeliveryAt` 把 settle effect 泊车到 `deadlineAt` 由 outbox
定时投递——接线齐了才把声明翻 `true` 并同步期望行。**stageDeadline 的
接法以此形态为准**（定时投递 + 内部 settle 命令），不许客户端轮询或
本地计时冒充；stage 预设已按此形态预置，identity 游戏要截止照此补。
`wordLibrary` 同理：开声明的同时必须登记 `workerWorkflows`（3d）。

### 3f. 接龙链接线（stage 预设未预接，人工接）

平台接龙链机在 `packages/game-engine/src/platform/room/relay/`
（assignment / clock / evolve / gallery / tasks / types，E1 抽取，
pictionary 与 storyrelay 在用）。**stage 预设没有预接它**——骨架里
只有通用舞台阶段与截止。做接龙类新游戏（一棒接一棒的链式回合）时
人工接线，不许把链机逻辑抄进游戏目录：

- 引擎 `domain/relay.ts` 建绑定模块：import 链机的 assignment/clock/
  gallery/tasks/types，注入本家的 `RelayTaskHooks`（任务词汇、计时、
  画廊口径）；逐项参照 pictionary / storyrelay 的同名 `domain/relay.ts`。
- `engine.ts` 接链机入口：`buildRelayChains` / `buildRelayParticipants`
  （assignment）与 `relayDeadline`（clock），阶段推进走链机 evolve。
- 隐私投影由绑定模块的 tasks 产出：若 visibility 因此不住
  `domain/visibility.ts`，先在骨架 contract 的 `REGISTERED_EXCEPTIONS`
  登记（故事接龙先例）再写，不许绕过 contract。
- 客户端舞台区按链的当前棒渲染（参照两家房间屏的链进度呈现），
  座位盘与房主面板仍走骨架装配，不自建。

## Phase 4 — 测试与验收

1. **本地**（push 前必须过）：改动文件 prettier + `tsc --noEmit`（三层：
   根 + game-engine + api-worker）+ 改动文件 eslint（零警告）+ knip
   （直接跑、查 exit code，不许用管道吞码）+ architecture /
   noHardcodedStyleValues / engineSkeleton / capabilities 等 contract tests +
   相关单测。骨架自带测试（引擎 engine.test、migration 等价、identity
   协议 contract、worker schemas 穷尽、客户端测试状态工厂自检）必须全绿。
   全量 `pnpm run quality` 的 test 部分交给 PR 的 CI（本地跑不下）。
2. **room-shell-contract 验收矩阵**：逐行记录证据（config/lobby/active/overlays/recovery/layout），
   不适用的行写理由，不许静默跳过。
3. **E2E**：新游戏**默认不新建 spec**——e2e 只更新已存在的 spec；
   认为新游戏需要 e2e 覆盖时，先报告请示用户，获批后才建（生成器产的
   spec 骨架启用流程见 Phase 2 报告第 5 步）。已有 spec 的改动一次只改
   一个、一个 commit + push 逐个验证；除狼人杀外一律多 browser context
   真人模拟凑人数，**禁用 bot 凑数**（fill bots / 接管 bot 只给人工测试用，
   机器人机制由单测覆盖）；断言可见行为，不只断言 import 了共享组件。
4. **Design doc** 已进仓库且与代码一致（抽查 3 处文案/语义）。
5. PR 合并后检查 main 的 CI 全绿才能收尾。

## Phase 5 — 收尾

- 工作稿 design doc 已复制进 `docs/` 并提交（生成器产的骨架填完即是它）。
- 接入报告 7 项人工步逐项处置完，报告文件删除、不进 commit。
- PR 描述列出：生成命令与预设、接入报告 7 步的处置结果（e2e 未启用要
  写明）、能力声明与预设默认值的差异及接线、对齐评审结论、验收矩阵
  证据链接。
- 分支清理；`docs/<game>-game-design.md` 与实现一致。

---

## Key Constraints（速查）

- 新游戏一律走生成器，不许手抄现有游戏目录起家；注册期望列表不许手改，
  漏接让 contract 报、不让人肉对清单。
- 新游戏不许自建第二套大厅/配置/房间外壳；先查 `src/features/room/` 和共享组件。
- 新游戏不许复制角色卡或动画组件；角色展示用共享 `RoleCardSimple`/`RoleCardContent`（`src/features/room/components/`），动画用共享 `RoleRevealAnimator` + 自写 `RevealConfig` + `toRevealRoleData` adapter（见 `src/features/room/components/RoleRevealEffects/`）。
- `docs/room-shell-contract.md` 是 UI 集成的唯一权威，细节不复制到本 skill。
- 方案先行：用户明确批准前不写代码；design doc 先行，代码随后。
- 词库表不许空表上线。
- main 为准，不复活 revert 内容；merge 后盯 main CI 全绿。
