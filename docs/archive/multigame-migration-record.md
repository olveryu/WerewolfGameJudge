# 多游戏平台迁移记录（已完成，归档）

> 本文从 [multigame-platform-design.md](../multigame-platform-design.md) 拆出，保留 2026-09 至 2026-10 多游戏重构的阶段计划、删除清单、决策汇总、DoD 与逐提交实施记录。
> 仅供追溯；现行架构与新游戏接入清单以主文档 §1–28 及 [room-shell-contract.md](../room-shell-contract.md) 为准。

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

| 阶段    | 状态   | 已完成                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 尚未完成             |
| ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| Phase 0 | 完成   | `main` 行为 contract、characterization test、四个 Werewolf E2E shard                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | -                    |
| Phase 1 | 完成   | canonical identity、shared roster/session/catalog、Werewolf UI/profile/cosmetic/audio/assets/Home/navigation 归位                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | -                    |
| Phase 2 | 完成   | concrete engine、exhaustive catalogs、Worker schema、完整 Werewolf E2E                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | -                    |
| Phase 3 | 完成   | generic command、atomic DO storage、receipt/outbox、client cutover、durable user event                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | -                    |
| Phase 4 | 完成   | creation saga、immutable locator、单一 deep link、resolver、定时 reconciliation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | -                    |
| Phase 5 | 完成   | shared shell/controllers、单一 RoomSession、entry/connection/command 下沉、runtime 归位                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | -                    |
| Phase 6 | 完成   | compact Fib state、implicit bots、word outbox、engine/Worker catalog、DO 恢复测试                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | -                    |
| Phase 7 | 完成   | Fib client module、shared RoomShell、完整 round、真实 cold deep link、20 人边界与 320px 响应式 E2E                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | -                    |
| Phase 8 | 进行中 | engine/Worker/client ownership、Worker vertical features、migration-backed Worker tests、storage/room creation、navigation capability、scope 中性化、单一插件组合点、开放 module contract、Pictionary 编译门禁、严格 request boundary、Wrangler binding 单一权威、JWT principal 单一认证边界、provider payload runtime parsing、Worker test type-honesty、gacha atomic mutation ledger、Cloudflare request metadata 单一边界、game-engine 精确 subpath exports、client facade 身份删除、resolver 单一 outcome/reveal contract、daily reward canonical timestamp、显式 disabled-feedback button contract、debug log 单一 store、production 普通类型断言清零、shared view capture、HTTP response runtime contract、canonical auth session、共享 gacha response contract、狼人杀 role/night-step/action registry 闭包、Worker Wrangler 命令配置归属、底牌物理发牌与 v2 状态不变量、handler 纯 event contract、canonical board harness、exact recent-room projection、lossless client command decision、exact acceptance/reveal snapshot、测试 fixture 命名收口、local migration/seed、shared seat 视觉与 profile 行为基线、Fib sparse bot exclusion v2、CI E2E spec coverage gate、Fib 四类候选与 bounded player word history、Fib 客户端拼音展示 | CI 完整 E2E 最终验收 |

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
- Seat confirmation 使用 `take | move` 判别联合。未入座点空位是“入座”，已入座点另一空位是“换座”；本人
  profile 的“离座”先关闭 profile 后直接提交。换座只提交一次权威 `room.seat.take`，由 engine
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
  提供的 label，不解释狼人杀 night/role（该 model 与状态条已于 2026-10-16 房间提示面重设计
  PR-A 整删：原状态信息归位到主持台 caption、玩家底部 message 与底部进度行，口径见各游戏
  设计文档的 D21 记录）。旧文件、test ID、style type 和 import 不保留 alias。
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
- `ConnectionManager` 只重试可恢复的网络故障。WebSocket 1002、无效 snapshot、同步 request ID 不匹配、
  state/event callback 破坏 contract 都立即进入 protocol failure，关闭 socket 并停止 retry；同步发送失败或
  10 秒无响应会关闭 socket 并进入统一重连。异步建连使用 generation 隔离，旧 token refresh 失败不能改变
  当前连接。
- `useRoomEntryController` 和 `RoomEntryBoundary` 是唯一 auth/entry/retry/reconnect/exit 边界。
  等价 `RoomRecord` 按所有 identity field 稳定化，不因 React object identity 重连；并发手动重连
  直接 fail fast。Game-owned hooks 只在 boundary ready 后 mount，因此狼人杀 `gameState` 和 status 是必填，
  已删除 `no_game_state` 分支与为未初始化状态准备的 fallback UI/policy。
- Room directory 使用 `IRoomDirectoryService`；权威 state 恢复不再暴露 HTTP port 或 adapter，只通过
  WebSocket `STATE_SYNC_REQUEST/STATE_SYNC_RESPONSE` 返回完整 snapshot。`/room/create` 只返回 directory
  metadata，creation saga 内部校验 state；游戏 codec 不再泄漏到 game-neutral directory port。
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
  `isValidFibPlayerCount` 校验：默认 8，范围 4–20。
- Fib lifecycle 使用 shared `lobby/preparing/ongoing/ended` 映射；`startRound` 先提交 preparing state 和 durable
  word-generation effect，system completion 才进入 ongoing。主持人可以取消 preparing；ended 提供保留座位与
  used-word history 的“下一轮”和“结束游戏”，后者返回 lobby 并恢复共享 setup 操作。
- Fib role assignment 使用常数空间的无偏抽样，权威 round view 统一投影所有视角：大聪明与瞎掰者都能看词，
  只有老实人能在 ongoing 看定义；ended 后所有角色都能看完整答案。bot takeover 只改变客户端控制视角，不把
  controlled seat 写入 room command actor。
- Worker 通过 exhaustive game catalog 注册 Fib module、exact command/config/state schema 和 post-commit effect。
  word provider port 支持 local 与 Gemini structured output；provider response
  严格解析、trim、去重后才提交 internal completion。effect identity、candidate result 和 retry ledger 持久化，
  alarm 中断后复用同一结果，不重新生成词条；stale effect 和 identity 冲突直接失败。
- 新增 D1 migration `0037_add_fibking_game_type.sql` 与 `0038_fib_word_generation_results.sql`，并在本地 D1
  实际执行。Worker integration test 覆盖 catalog 建房、sparse state、outbox alarm 中断恢复和 provider replay。
- 客户端新增 Fib module、config、rules、summary、identity 与 room adapter，但不增加 Fib facade/context/store。
  Fib 和狼人杀共用同一个 `RoomSession`、`RoomShell`、seat/profile/share/header/status/bottom controllers；游戏层只
  投影 Fib phase action、身份内容和规则。座位使用 lazy seat source，DOM 只渲染当前可见内容。
- 建房和房内编辑统一使用 shared room-flow navigation：创建成功以 `replace` 移除 Config，编辑完成以 `popTo`
  返回当前 Room。真实 navigator contract 同时覆盖狼人杀，避免 root stack 残留两个 Config screen。
- Playwright 新增 Fib 专用 page object，只保留 Fib phase/identity 操作；seat、profile 和直接踢人沿用 shared room
  page contract。`createColdRoomContext` 使用全新 browser context 首次直达 `/room/:code`，不再先访问 Home
  预热认证或 product catalog；shared 用户设置入口也有稳定 test ID，不借用狼人杀底部设置按钮。
- E2E Worker 使用独立 composition root：第一次 provider effect 把真实 local provider 结果写入 D1 ledger 后，
  在 internal completion 前中断；alarm 重放必须读取同一持久结果并推进 `preparing -> ongoing`。该故障注入只存在于
  E2E `GameRoom` 装配，不在 production module 中增加环境分支、retry helper 或吞错。
- 定向 Playwright 覆盖 20 人产品边界、8 人四个真人加 implicit bot 的完整 round，以及
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
  `/api/games/werewolf/ai-chat`。Gemini 是狼人杀 AI chat 的内部 provider；Fib provider
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
  ID 先由精确 Zod enum 拒绝并返回 400，不能把不可信输入推入 engine。XP 与 level 必须是非负 safe integer，
  等级阈值也必须可精确表示，非法值不再投影成 0 级或最高称号。未知角色名在 engine 查询处失败，过期揭晓特效在
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
- 词库后台的支持列表、`GameWordGame`、`GameWordsStats` 和 `TriggerSupplyResult` 统一由
  `packages/game-engine/src/product/wordSupply/index.ts` 提供；该模块不依赖 D1、Workflow 或 UI。
  Worker 的 `gameWordGameSchema`、客户端 exact codec 和 `GamesTab` 使用同一支持列表。
  新增词库游戏时，在该列表登记，并补齐 `features/admin/gameWords.ts` 的 `GAME_WORD_ADAPTERS`、
  `GamesTab` 的名称及分类映射；缺项由类型检查拦截。统计 SQL、配额和 Workflow 绑定仍留在 Worker，
  不为不使用词库的游戏创建空 adapter，也不将未知游戏默认分发到已有游戏。
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
  provider、Analytics Engine、version metadata 或 secret；第二份 `worker-globals.d.ts` 已删除。
- 删除从未被 `pnpm dev` 选中的 `[env.dev]`。该 named environment 让 Wrangler 2026 multi-environment type generation
  把只存在于 production config 的资源错误地生成为 optional，却没有为实际 local command 提供任何覆盖。local command
  现在显式传入 `ENVIRONMENT=development` 与空 Sentry DSN，不复制 resource binding。
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
- Fib provider adapter 在 candidate parser 前验证 required response envelope；word effect 的 committed result helper
  保留 `FibState`，不再擦成
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

### 当前提交：Phase 8.12F resolver 单一 outcome 与 typed reveal

- 删除 `ResolverResult.result` 的 role-specific 可选字段集合。`savedTarget`、`poisonedTarget`、
  `guardedTarget`、`swapTargets`、`idolTarget` 等字段没有 reducer 或 UI 消费者，只把已经存在于
  `updates` 或 `ProtocolAction.targetSeat` 的数据复制到第二条通道；对应 resolver 和测试不再生成或验证这些
  no-op 输出。
- resolver outcome 改为 `ResolverSuccess | ResolverRejection` 可判别联合。拒绝分支必须提供中文
  `rejectReason`，handler 删除 `invalid_action` fallback；成功分支只允许 authoritative `updates` 与
  `factionCheck`、`identityCheck`、`wolfRobotLearn` 三种 typed reveal。
- `WriteSlotEffect.slot` 从任意 `string` 收紧为七个实际允许写入的 `CurrentNightResults` seat slot。schema 拼错
  slot 会在编译期失败，`buildRevealPayload` 遇到 schema/reveal kind 不一致、缺少 reveal 或无 reveal schema
  携带 reveal 时直接 fail fast。
- 大聪明 resolver 只报告学到的角色；完整 `GameState` 所需的猎人技能状态仍由 action handler 通过
  `computeCanShootForSeat` 唯一计算。新增 handler 回归覆盖正常与大聪明中毒两种结果，防止 resolver 再次维护
  一份并行死亡判断。
- `slackerChooseIdol` 的选择已由 `ProtocolAction.targetSeat` 持久化并供夜间回顾读取，因此删除此前仅为触发
  空 `APPLY_RESOLVER_RESULT` 而存在的 `idolTarget`；batch contract 现在明确验证 record-only action sequence。
- 删除只在测试内手写旧大聪明 payload、完全不引用生产类型的伪 type contract；生产 contract 由
  `ResolverReveal` 判别联合、handler 回归与 TypeScript 编译共同约束，不再维护平行 test-only model。
- 完整 `pnpm run quality` 通过：root 221 suites / 9557 tests、game-engine 85 suites / 2508 tests、Worker
  26 files / 163 tests；只保留已记录的 Expo teardown/forced-exit 噪声。Phase 8.12 下一批迁移每日奖励旧日期
  数据并删除 runtime compatibility reader，然后继续客户端 compatibility API 与剩余 fail-fast/命名清理。

### 当前提交：Phase 8.12G 每日奖励 canonical timestamp

- 新增 `0040_normalize_daily_reward_timestamp.sql`：只把可验证的 `YYYY-MM-DD` 存量转换为 UTC 午夜
  `Date.toISOString()` 形式；migration guard 遇到其余脏值直接中止，不猜时区或日期。insert/update trigger 从数据库
  写边界阻止新的非 canonical 值。该做法遵循 Cloudflare 当前
  [D1 migration](https://developers.cloudflare.com/d1/reference/migrations/) 的顺序记录与失败回滚语义。
- 新增 Worker `platform/time/canonicalIsoTimestamp.ts` 作为 persisted ISO timestamp 的唯一 parser。
  `roomDirectory` 删除自己的同构实现；gacha cooldown 和匿名账号合并在读取 D1 值后都先做精确格式及 round-trip
  校验，损坏值进入统一 500 invariant failure，不再由 `Date` 宽松解析。Worker architecture contract 明确登记
  `time` shared owner，并把目录内容锁定为该唯一 parser，不能借新增目录绕开精确 ownership gate。
- `POST /api/gacha/daily-reward` 的 request schema 从未使用的 `{ localDate }` 改为严格空对象 `{}`；
  `GET /api/gacha/status` 不再暴露服务端内部 cooldown timestamp。客户端删除本地日期判断，每个 app session 只发起
  一次 claim，由服务端 20 小时规则唯一裁决；response 改为 `claimed` 可判别联合，成功分支不再用默认奖励数掩盖缺字段。
- migration integration test 直接执行 Vitest `TEST_MIGRATIONS` 中真实的 0040 queries，覆盖合法存量转换、ISO 保持、
  非法日历日期中止和 trigger 拒写；Worker route 回归覆盖绕过 trigger 后的损坏存量仍会 fail fast。完整
  `pnpm run quality` 通过：root 221 suites / 9564 tests、game-engine 85 suites / 2508 tests、Worker
  28 files / 172 tests；只保留已记录的 Expo/workerd test-runner 噪声。Phase 8.12 下一批删除客户端
  disabled-press compatibility API，再继续全仓 residual audit。

### 当前提交：Phase 8.12H 显式 disabled feedback button contract

- `PressableScale` 删除 ActionButton meta callback union 和 disabled metadata 注入，只接受无参数 intent；真正把
  `disabled` 传给 React Native `Pressable`，由平台 press state machine 阻断 interaction。`Button` 删除
  `fireWhenDisabled` 与空函数 fallback，改为互斥的正常 `onPress`、显式 `onDisabledPress` 和永久 disabled display
  contract；loading 无条件阻断两类动作。实现按 React Native 当前
  [Pressable contract](https://reactnative.dev/docs/pressable) 区分平台 disabled 与产品层 disabled feedback。
- Werewolf `ButtonConfig` 改为判别联合：enabled 分支必须有一个 typed behavior，disabled 分支只能有
  `onDisabledBehavior` 或 `null`。`audioWaiting` 成为真正的 display-only entry，不再伪造一个随后被 adapter 丢弃的
  static action；`StaticButtonAction` 在类型上排除该 display-only ID，screen switch 对真实 action 保持穷尽。
- Shared `RoomBottomActionPanel` 直接按 `RoomBottomButton` 判别分支渲染，不再把 disabled callback 塞回 `onPress`。
  Appearance preview、equip 和 confirm 同样拆分正常动作与不可用反馈；正常 handler 收到不满足前置条件的调用时直接
  fail fast，不再把错误调用解释成普通用户操作。
- 新增 Button interaction 回归并补 Werewolf adapter disabled-feedback 执行测试；architecture contract 扫描全部生产
  client 文件，禁止 `fireWhenDisabled` 标识符重新出现。完整 `pnpm run quality` 通过：root 222 suites / 9570
  tests、game-engine 85 suites / 2508 tests、Worker 28 files / 172 tests；只保留已记录的 Expo/workerd test-runner
  噪声。下一批继续全仓 residual audit。

### 当前提交：Phase 8.12I 删除 mobile debug facade

- 删除只为保留旧 `log/warn/error/debug/show/hide/toggle/clear/isVisible` API 而存在的 `mobileDebug.ts`，以及只验证
  该旧表面的测试。logger transport 直接写入 `debugLogStore`，hidden admin trigger 直接切换同一个 store；新增架构
  contract 同时锁定旧文件不存在且生产代码没有该 identifier，不能再次长出转发对象。
- 新增 `debugLogTransport.ts`，使用安装中的 `react-native-logs@5.6.0` 公开 `transportFunctionType` 和
  `ConsoleTransportOptions` 配型。logger 删除 generic `any`、`as unknown as T`、`rawMsg` cast 和 level cast；未知 level
  不再默认成普通日志，而是在 transport boundary fail fast。
- React Native `DebugPanel` 不再继承旧 DOM 实现留下的 native no-op；通过管理员验证后，各平台都操作同一个 external
  store。store/transport 回归覆盖订阅、visibility、四种 level 映射和未知 level 拒绝；相关失真 Facade、legacy
  compatibility 注释和测试标题同步改为当前 owner/contract。定向验证 6 suites / 4600 tests 通过；完整
  `pnpm run quality` 通过：root 222 suites / 9563 tests、game-engine 85 suites / 2508 tests、Worker 28 files /
  172 tests；只保留已记录的 Expo/workerd test-runner 噪声。下一批继续全仓 residual audit。

### 当前提交：Phase 8.12J production type escape 与重复截图边界清理

- Sentry integration 列表直接从 `ReactNativeOptions['integrations']` 提取 SDK contract，browser tracing、browser
  replay、mobile replay 不再伪装成 react-navigation integration。iOS PWA standalone 使用 Apple 明确提供的
  `Navigator.standalone` 类型扩展；Gacha 无历史栈时直接调用 typed `navigate('Home')`，不再用 `as never` 绕过 route
  contract。`sentryIntegrations.ts` 直接使用的 `@sentry/browser@10.53.1` 也从 React Native SDK 的隐式 transitive
  dependency 改为 manifest 直接依赖。
- 狼人杀 reveal 读取删除 `${kind}Reveal` 动态索引和双重断言，按全部八个 `RevealKind` 穷尽读取对应 typed state
  字段；新增 kind 而未补 mapping 会在编译期和 fail-fast default 同时暴露，不会读取任意 state key。
- QR 房间分享与狼人杀夜间战报删除两套重复的 `html2canvas` / `captureRef` 分支，统一使用 shared room owner 的
  `captureViewPngBase64`。Web ref 从 `unknown` runtime boundary 精确验证为 `HTMLElement`，native 交给
  `react-native-view-shot`；未挂载 ref、错误 host element 和非 base64 data URL 都立即失败。`html2canvas@1.4.1`
  从隐式 transitive import 改为 manifest 直接依赖，并通过 Web-only lazy loader 避免进入 native startup。
- 夜间战报 Canvas 2D context 删除非空断言，浏览器不给 context 或输出非 base64 data URL 时直接失败，不再返回损坏
  payload。新增 Web 成功、错误 ref、错误 data URL、native delegation 和未挂载 ref 回归。
- architecture contract 使用 TypeScript AST 扫描 client、game-engine、Worker 全部 production 文件，禁止
  `as any`、`as never` 和任意双重 assertion 恢复；当前三端均为零。定向验证 5 suites / 4654 tests 与 root
  TypeScript 通过。Knip 删除 `@sentry/browser`、`html2canvas`、`lint-staged` 与 `.husky/**` 四条已失效 ignore，当前
  执行零 warning/零 configuration hint。完整 `pnpm run quality` 通过：root 223 suites / 9587 tests、game-engine
  85 suites / 2508 tests、Worker 28 files / 172 tests；只保留已记录的 Expo/workerd test-runner 噪声。下一批把
  `cfFetch` generic response assertion 改为 owner-provided runtime codec，并继续普通 assertion/旧命名审计。

### 当前提交：Phase 8.12K HTTP runtime response 与 canonical auth session

- `cfGet/cfPost/cfPut/cfUpload` 的成功响应必须在 transport boundary 经过 endpoint owner 提供的 runtime decoder，
  不再允许 generic type argument 把 `Response.json()` 直接声明成业务类型。HTTP 非成功响应统一归一为
  `CloudflareHttpError`，成功状态但非 JSON 或 decoder 拒绝的 payload 统一归一为
  `CloudflareResponseProtocolError`；Worker 现有 `{ reason }` 与 Hono middleware `{ error }` envelope 只允许二选一，
  malformed 或 ambiguous envelope 不再猜测业务错误。
- client access token 使用严格的 `sub/ver/iat/exp` parser，并把 30 秒刷新窗口修正为过期时间之前而不是之后。
  auth Worker 的 anonymous/signup/signin/reset/claim/current-user 全部通过同一个 canonical user serializer 返回
  `id/email/is_anonymous/has_wechat/user_metadata`；client 不再从 endpoint 或缺失字段推断匿名、邮箱和 WeChat 状态。
  离线恢复只接受与 token subject 一致的已持久化 identity，缺字段或 subject 不一致会清空 session。
- `CFAuthService` 只把精确的 `refreshed` 结果当作 refresh 成功；`expired`、`offline` 与 protocol failure 走各自明确
  分支。signin/signup/reset/claim 都从同一个 canonical response 更新内存、MMKV 与 Sentry principal，避免 token、
  user ID 和身份 flags 分开写入后漂移。
- account 与 feedback response 使用各自 owner 的 strict Zod codec。Gacha status/draw/daily-reward/exchange contract
  归入 game-engine product owner，由 Worker producer、D1 mutation replay 与 client 共同消费同一 parser；engine 保持
  无 Zod 依赖，reward ID、rarity、type、duplicate/new invariant 与 shard 总和在一个边界校验，不保留 Worker/client
  平行 schema。
- CI 暴露旧 GameRoom outbox test 仍把 command RPC、alarm 取消和手动 delivery 拆在三个事件：immediate alarm 可在
  RPC 返回后、测试取消前先领取 effect，随后手动 `alarm()` 只能看到 watchdog lease，导致 outbox 偶发仍为 pending。
  Werewolf 原子提交 contract 现在于同一个 `runInDurableObject` 事件内提交 command、检查 state/receipt/outbox 并取消
  测试 alarm；Fib interrupted word fixture 同样在一个事件内完成 seat/fill/start、lease mutation 与 alarm 取消，之后
  才在没有第二调度源时调用真实 `GameRoom.alarm()`。没有 sleep、轮询、重试或生产逻辑改动；两个文件 15 tests 的四
  runtime 并发压力验证全部通过，完整 Worker 28 files / 172 tests 通过。
- architecture contract 使用 TypeScript AST 扫描全部 client production 调用，禁止带 generic type argument、缺少
  decoder 或 identity decoder 的 Cloudflare request。完整 `pnpm run quality` 通过：root 229 suites / 9631 tests、
  game-engine 86 suites / 2515 tests、Worker 28 files / 172 tests；只保留已记录的 Expo/workerd test-runner 噪声。
  Phase 8 下一批继续普通 assertion、旧命名与 compatibility/legacy residual audit，完成后再执行 local migration、seed
  与完整 E2E 最终验收。

### 当前提交：Phase 8.12L 狼人杀 registry 与 action contract 闭包

- 新增唯一的 `nightStepIds.ts`，集中拥有全部夜间步骤 ID 与顺序，并从常量推导 `NightStepId`。role spec、action
  schema、night plan 与 handler step spec 统一引用该类型；schema/plan/night-step registry 在启动构造时拒绝重复、缺失、
  未知或 kind 不匹配的步骤，不再通过字符串索引、非空断言或类型断言掩盖不完整注册。
- `RoleSpec`、ability effect、paired role、display role 与 custom resolver 全部按 registry key 泛型闭包。`RoleId` 直接从
  role definitions 的 key 推导，跨角色引用必须是已注册角色；`getRoleSpec`、`getRoleDisplayAs`、`isValidRoleId` 与
  `getAllRoleIds` 删除 cast，并在运行时拒绝被外部污染的 registry key。
- `SubmitActionIntent` 只携带完整的 typed `ActionInput`，client decoder、handler、resolver 与测试 factory 不再平行维护
  `target`、`extra` 和字段重建逻辑。handler 会拒绝与当前步骤 schema 不一致的 action；bottom-card chosen identity、
  actor seat、hunter/dark-wolf seat、Avenger faction、Ongoing results、投票 seat key 与参与狼人集合缺失时均 fail fast，
  不再默认 faction、返回 false 或静默跳过状态变更。
- resolver registry 改为精确 `Record`，generic effect processor 采用穷尽 switch；schema-specific resolver 通过
  `getSchemaOfKind` 取得窄化 contract。template resize 不再静默清除已分配角色，typed `RoleId[]` 也不再重复解析成
  自己已经承诺的类型。
- game-engine architecture contract 使用 TypeScript AST 禁止 production 普通 `as` 与 angle-bracket assertion，仅允许
  `as const`；负向 fixture 验证两种绕过写法都会被门禁拒绝。完整 engine 86 suites / 2516 tests 通过。Phase 8 下一批
  处理审计确认的游戏规则不变量、server-only export/旧测试协议，以及 client/Worker 普通断言和命名残留；随后执行
  local migration、seed 与完整 E2E 最终验收。

### 当前提交：Phase 8.12M Worker Wrangler 命令配置归属

- 根目录 Pages `wrangler.jsonc` 与 `packages/api-worker/wrangler.toml` 分别拥有 Pages 和 Worker 配置。Worker package
  的 `dev`、`deploy`、本地/远端 D1 migration 命令全部显式绑定 `wrangler.toml`，不再依赖 Wrangler 从当前目录向上
  搜索配置文件，避免 Pages 配置把 Worker migration 目录错误解析为仓库根目录。
- 本地直接执行 `pnpm -F @game-judge/api-worker run db:migrate:local`，成功应用 0039 与 0040；再执行 CI
  Playwright API 前置命令 `node scripts/setup-e2e-api.mjs`，正确读取 Worker migration ledger 并报告无待执行 migration。
  Phase 8 下一批继续处理底牌角色与状态不变量；最终验收仍需执行 local seed、完整 quality 与完整 E2E。

### 当前提交：Phase 8.12N 底牌物理发牌与 v2 状态不变量

- 新增 `domain/models/BottomCards.ts` 作为盗贼/盗宝大师底牌数量、合法牌组和物理分牌组合的唯一规则所有者。
  发牌按卡牌下标枚举合法 partition，重复角色仍代表不同物理牌；随后从合法组合中使用 command-scoped seeded RNG
  选择并分别洗乱座位牌与底牌。删除最多重试 100 次的 rejection sampling，合法模板必然发牌，非法模板在命令前
  验证或发牌边界立即失败。
- 模板同时选择盗贼与盗宝大师、重复选择任一底牌角色，或重复选择普通狼人以外的夜间单例行动者时直接拒绝。
  `getRoleDealPool` 成为普通/黑死病发牌牌池的单一转换函数，handler 与状态校验不再各写一份狼人替换规则。
- 删除 `GameState` 顶层 `treasureMasterChosenCard` / `thiefChosenCard`、resolver 的 `effectiveTeam` 与
  `bottomCardStepRoles`。选择结果只存在于 `currentNightResults`；UI 与 engine 的 effective-role helper 直接接收该
  aggregate，不再把两个 chosen-card 值复制成并列参数。
- `assertWerewolfStateInvariants` 在 normalize/persist/broadcast 边界验证：生命周期与 `currentNightResults` 同步、底牌
  数量与阵营组成、actor seat 与原始身份、选择牌属于底牌、盗宝大师不得选择狼人、盗贼有狼必选狼，以及
  “全部已分配座位身份 + 底牌”与 `getRoleDealPool` 的多重集完全一致。黑死病盗宝大师没有运行时底牌状态；黑死病
  盗贼仍从替换后的物理牌池发两张底牌。
- 狼人杀 state version 从 1 升至 2，不提供旧字段 reader 或迁移兼容层；persisted/realtime payload 必须使用 exact v2
  codec。snapshot 协议负向测试改为从当前 codec 版本构造 `+1`，不再以硬编码版本制造会随升级失真的 fixture。
- 纯村民板子不再从 `Ready` 直接写 `END_NIGHT`。空 night plan 显式产生
  `START_NIGHT(nightStep=exhausted) -> END_NIGHT`，先建立 canonical `currentNightResults`，再进入 `Ended`，避免
  reducer 或 normalize 暗中补默认状态。
- 新增底牌物理组合、模板歧义、状态多重集、选择限制、黑死病盗贼、空夜晚和 bottom-card actor routing 测试；
  `@game-judge/game-engine` 88 suites / 2542 tests 全绿，根项目 `tsc --noEmit` 通过。
- Phase 8 下一批删除 handler 的 `BROADCAST_STATE` / `SAVE_STATE` no-op side-effect contract；持久化与广播只由
  platform decision/runtime 决定，音频改为明确的 authoritative state event。之后迁移测试 harness 到 production
  command pipeline，再做 client/Worker residual audit 与最终 local migration/seed/quality/E2E 验收。

### 当前提交：Phase 8.12O handler 纯 event contract

- 删除 Werewolf `HandlerResult.sideEffects`、`SideEffect`、`STANDARD_SIDE_EFFECTS` 与转换器。handler 现在只返回
  `StateAction` 和明确的 success/rejection/error outcome；是否持久化、是否广播以及 outbox effect 均由 platform
  `Decision`、Worker command pipeline 与 room runtime 唯一决定，游戏 domain 不再描述 `BROADCAST_STATE`、
  `SAVE_STATE` 或预留的 `SEND_MESSAGE`。
- `HandlerContext.state` 改为必需的 `GameState`。未初始化房间已经由 `GameRoomRuntime` / `dispatchRoomCommand` 在进入
  concrete engine 前返回 `no_state`，因此删除全部 handler 内 nullable guard、`NonNullState` 别名和只靠手写 null
  context 才能触发的测试。system actor 与未入座用户仍只通过 `myUserId` / `mySeat` 的真实 nullable contract 表达。
- 新增 `domain/audioQueue.ts`，把 Host 音频批次直接写成 `SET_PENDING_AUDIO_EFFECTS` 与
  `SET_AUDIO_PLAYING` 两个 authoritative state event。start/advance/end-night handler 不再返回 `PLAY_AUDIO` 描述；
  inline progression 从 event 序列提取并合并同一请求内的音频批次，在最后统一关闭 progression gate，保持既有
  “可立即完成的 transition 先原子提交、Host 再顺序播放”语义。
- engine architecture contract 使用 TypeScript AST 扫描全部 Werewolf production handler，禁止重新出现
  `SideEffect` / `sideEffects` / `STANDARD_SIDE_EFFECTS` 标识符，以及四种已删除 effect type；负向 fixture 同时验证
  identifier 与 string-literal 绕过都会失败。
- root TypeScript 与 game-engine TypeScript 全绿；完整 engine 为 88 suites / 2503 tests。下一批把跨包 board test
  factory 从 `PlayerMessage` / direct handler 路径迁移到 production `WerewolfCommand -> decide -> evolve -> normalize`
  pipeline，随后收紧 public/testing exports 并删除旧命名。

### 当前提交：Phase 8.12P canonical board harness 与建房入口修复

- 跨包 board fixture 现在从 `werewolfEngine.createInitialState` 开始，依次 dispatch 真实入座、发牌、看牌、开夜、
  action、audio/reveal/group/Wolf Robot ACK 与 progression command；每条命令统一经过
  `decide -> evolve -> normalize`。revision 只在该命令产生 event 时增加一次，与 Worker receipt 语义一致；删除 direct
  handler/reducer、手动 `advanceNight/endNight`、message capture 与重复 lead-wolf action。
- 无底牌 fixture 通过反演生产 Fisher-Yates permutation 保留测试指定的座位身份，但最终发牌仍由
  `werewolf.roles.assign` 产生。盗贼和盗宝大师测试不再注入 `bottomCards` 或 assignments；它们使用可复现的生产 seed，
  从 authoritative deal 读取 card index 与实际 actor/target seat，覆盖三组合法物理牌堆。
- 删除 `PlayerMessage`、`games/werewolf/testing` package export 和测试专用 handler/reducer/state-builder API。跨包协议、
  service、Worker 与 board tests 只通过 concrete engine 的 `public` entrypoint 构造或推进状态；architecture contract
  同步把每个 game 的唯一公开 entrypoint 收紧为 `public`。
- `RoomCreationService` 不再把含 `hostUserId/createdAt` 的宽 `RoomRecord` 交给 strict recent-room codec，而是在创建成功
  边界显式投影 `{ roomCode, roomId, gameType }`。这修复了 `/room/create` 返回 200 后客户端因 exact schema 拒绝本地
  recent-room 写入而不导航、继而令 E2E 全部超时的问题。
- 更新 test/service/game-engine/TypeScript path rules：删除旧 `PlayerMessage` compatibility、nullable handler state 与
  handler `sideEffects` 指南，明确 authoritative command result、纯 event handler 和 canonical scenario driver 边界。
- 本地验证：完整 `pnpm run quality` 通过，其中 game-engine 88 suites / 2501 tests、Worker 28 files / 172
  tests、root 228 suites / 9613 tests；board engine + UI 62 suites / 585 tests。最小 `entry-flow`、`seating` 与完整
  `night-2p` Playwright 均通过。下一提交删除 client `ActionResult` 的 lossy 平行结果，收口普通 assertion/旧命名后
  执行 local migration、seed、完整 quality 与全量 E2E。

### 当前提交：Phase 8.12Q authoritative client command decision

- 删除 `platform/protocol/actionResult`、`RoomCommandOutcome`、`RoomOperationResult` 与
  `roomOperationCommandClient` 四层 lossy 平行结果。客户端 command boundary 只保留 canonical
  `RoomCommandResult`；transport 只在拿不到权威决定时增加 `notDecided` 或 `deliveryUnknown`，不能把 committed
  domain rejection、pre-commit rejection 和 delivery failure 压成同一个布尔值。
- `RoomSession.dispatchPrepared` 在 committed decision 返回调用方前先应用同一 envelope 内的 snapshot，并原样返回
  Worker decision。只有 `decided` 才从 pending intent 中删除命令；session epoch 已变化时直接 fail fast，不能伪造
  `superseded` command result。shared seat、profile、host、account controller 和 Fib/Werewolf runtime 全部消费同一
  lossless outcome。
- UI acceptance 统一定义为 `decided -> committed -> outcome.success`。multi-select、confirm callback、role reveal、
  group confirm、Wolf Robot gate、board/config、profile sync 和 audio acknowledgement 都按 exact branch 决策；reveal
  直接读取成功 command snapshot，不再轮询稍后到达的 broadcast，也不再用时间窗口掩盖状态竞态。
- 删除无消费方的 public `werewolf.audio.gate` command、schema、catalog 和 handler 分支；游戏内部仍通过
  `SET_AUDIO_PLAYING` authoritative state event 表达 progression gate。测试统一用 canonical command-result factory，
  新增 success/domain rejection/pre-commit rejection/两种 transport 未决与 snapshot reveal 覆盖。Worker command
  schema contract 改为以 discriminant 为 key 的 exhaustive fixture map；删除 production schema 的 test-only count export
  和手填命令数量，命令增删由 TypeScript 集合闭包直接校验。
- 源码契约测试改用 TypeScript AST 定位 variable declaration 与 interface method，直接验证 controlled-seat 参数和
  command outcome 返回类型，不再依赖固定字符窗口或 Prettier 排版。架构门禁禁止重新引入三种已删除的平行结果名。
- 本提交执行完整 `pnpm run quality` 并通过；本阶段到此暂停。Phase 8 仍剩普通 assertion/旧命名清理、local
  migration/seed 与完整 E2E 最终验收，不能提前标记完成。

### 当前提交：Phase 8.12R production assertion 与测试命名收口

- 客户端 55 个 production 文件中的 100 个普通 TypeScript assertion 全部删除；game-engine 与 Worker production
  同样保持零普通 assertion。Metro Web asset、OpenAI-compatible SSE、错误对象和其他外部值通过 `unknown` 属性守卫
  收窄；registry、React Native style、动态 module 与固定 tuple 通过类型注解、`satisfies`、typed builder 或标准库
  返回类型表达，不把同一个 assertion 换成另一种语法。
- 狼人杀 reveal animation 的 `RoleData.id` 从任意字符串收紧为 `RoleId`，12 个动画消费者直接透传 typed role。
  Config 的 `RoleSlot`、variant override、反向映射、role-info state 与 `RoleCardSimple` props 贯穿同一个 `RoleId`；
  非法 variant 在声明或调用处编译失败，不再到 AI 按钮点击时才用 cast 或重复 runtime parsing 补救。
- `findMatchingPresetName`、`computeFactionStats` 等只读查询接受 `readonly RoleId[]`，调用方不再为了满足错误的 mutable
  参数契约复制 authoritative nomination roles。Metro bundler 声明与 Web 运行时 asset 形态的差异集中在 boot owner 的
  单一 `unknown` parser，字符串 URL、`{ uri }` 与 native numeric asset 三种输入仍保持原行为。
- 仓库 architecture contract 使用 TypeScript AST 扫描 client、game-engine 与 Worker 全部 production 文件，只允许
  `as const`；负向 fixture 同时证明单层 `as T` 与 `<T>value` 都会被拒绝。门禁定向为 1 suite / 4617 tests，root
  TypeScript、RoleCard/Config 4 suites / 34 tests 均通过。
- 狼人杀 room UI fixture 的 `createGameRoomMock`、`createReactiveGameRoomMock`、`mockUseGameRoomReturn` 和
  `makeBaseUseGameRoomReturn` 等旧泛化名字全部改为 `WerewolfRoom` 所有权命名；mock shape 与断言不变，完整 room test
  slice 为 48 suites / 712 tests。agent source path rules 同步删除已不存在的 `RoomOperationResult` 指南，改为 canonical
  `RoomCommandResult` 加唯一 lossless `RoomCommandDispatchOutcome`。
- `legacy` / `compat` / 已删除 API 残留审计只剩 migration 与 malformed payload 负向 fixture、架构防恢复名单，以及
  iOS Safari audio player 复用的当前平台行为说明；production 不存在旧 reader、route、facade、result DTO 或 forwarding
  export。完整 `pnpm run quality` 通过；Phase 8 只剩 local migration/seed 与完整 E2E 最终验收。

### 当前提交：Phase 8.12S local D1 seed 配置归属

- `packages/api-worker` 的 migration、dev、deploy 与 types 命令已经显式绑定 Worker `wrangler.toml`，但
  `scripts/seed-local.mjs` 内部启动的 `wrangler d1 execute` 仍依赖 workspace 配置发现。在根 Pages
  `wrangler.jsonc` 与 Worker 配置并存时，这条嵌套命令可能选择错误配置并找不到 `werewolf-db`；seed 现在与其他 Worker
  D1 命令一致，显式传入 `--config=wrangler.toml`。
- root architecture contract 使用 TypeScript AST 定位 seed 中唯一的 `execFileSync` 调用，要求 literal argument array
  同时包含 `werewolf-db`、`--local` 与 `--config=wrangler.toml`。测试不依赖 Prettier 排版，也不允许后续脚本重新退回
  ambient config discovery。
- 本地 `db:migrate:local` 确认无待执行 migration；修复后的 `db:seed:local` 成功执行两条 statement。随后通过同一 Worker
  配置查询 D1，确认 `dev@test.local` 为 level 99 且 `unlocked_items` 包含 1018 项；architecture contract 为 1 suite /
  4618 tests 全绿。完整 `pnpm run quality` 通过，其中 game-engine 88 suites / 2492 tests、Worker 28 files / 172
  tests、root 230 suites / 9634 tests；Phase 8 只剩全量 E2E 最终验收。

### 当前提交：Phase 8.12T shared seat 行为与视觉基线修复

- `RoomSeatBoard` 不再用包含 content padding 的 `VirtualizedList` 外框宽度重算 cell；零高宽度 probe 在 padding 内测量
  实际 grid content，恢复 `main` 狼人杀的 4/5/6 列 tile 几何。回归测试显式触发 layout，要求首帧与测量后 tile
  宽度一致，防止共享化后 cell 再次放大或跳动。
- 新增 game-neutral `RoomSeatTap` pure intent，统一 blocked、occupied profile、empty take/move 的基础点击语义；狼人杀
  只在 ongoing action/audio gate 保留游戏特有 routing，Fib 只负责把 sparse human/implicit bot 投影成 shared target。
- 恢复 `main` profile 行为基线：入座/换座继续走 centered confirmation；本人离座和房主移出真人或 bot 都先关闭
  profile 再直接提交，不出现 seat confirmation。`useRoomSeatController` 删除 `leave` 分支，`useRoomProfileController`
  统一拥有 direct leave/kick 的 single-flight、authoritative rejection 与异常反馈。
- Fib state 升至 exact v2，新增严格升序、去重的 sparse `excludedBotSeats`。房主踢 implicit bot 或 bot-fill 下的真人时，
  只让目标座位为空；其他 implicit bot 不受影响。再次填充 bot 清空排除，配置缩容移除越界排除，20 人 bulk fill
  仍不 materialize 空座或 bot。v1 和 malformed exclusion payload 由 codec fail fast，不保留 compatibility reader。
- Playwright `RoomPage` 已改为离座/踢出后直接等待 authoritative seat update，并断言没有 seat confirmation；Werewolf
  seating 覆盖 direct leave，Fib 完整 flow 覆盖单 bot 踢出、其他 bot 保留及重新填充。按验收约定不在本地运行 E2E，
  由 CI shard 提供最终证据。
- 完整 `pnpm run quality` 通过：game-engine 88 suites / 2495 tests、Worker 28 files / 173 tests、root 231 suites /
  9653 tests；Pages/Worker types、三套 TypeScript、engine build、Knip、ESLint 与 Prettier 全绿。E2E TypeScript 单独通过，
  Phase 8 只剩 CI full E2E 结果回填。

### 当前提交：Phase 8.12U CI full E2E spec coverage

- CI 的显式四 shard matrix 在新增游戏后没有同步更新，遗漏 `fibking.spec.ts`、`fibking-responsive.spec.ts` 与
  `night-roles-hidden-wolf-crow.spec.ts`；因此旧 run 即使全绿也不能作为 full E2E 证据。上一次成功 run 的四个 shard
  实测约 13:40–15:06，继续塞入任一现有 shard 会扩大最长路径。
- 新增第 5 shard 专门运行三个遗漏 spec，保留已有四组的实测平衡。blob artifact、report merge 与 Pages 发布仍按
  matrix shard 编号工作，不增加第二套 Playwright 入口或改变 spec/helper 行为。
- 新增 `ciE2eCoverage.contract.test.ts`，枚举 `e2e/specs/*.spec.ts` 并与 workflow `e2e` job 中的 spec token 集合
  比较；任何漏跑或重复分配都会在 root Jest 失败。门禁修改前精确报告三个遗漏，修改后 24 个 spec 恰好覆盖一次。
- 完整 `pnpm run quality` 通过：game-engine 88 suites / 2495 tests、Worker 28 files / 173 tests、root 232 suites /
  9654 tests；Pages/Worker types、三套 TypeScript、engine build、Knip、ESLint 与 Prettier 全绿。
- Phase 8 最后退出条件仍是新 commit 对应 CI run 的 quality、五个 E2E shard 与 report merge 全绿；不使用本地 E2E
  代替该远端证据。

### 当前提交：Phase 8.12V Fib 词语多样性与玩家历史

- Gemini 不再生成单个宽泛的“不太常见”词，而是通过 structured output 一次返回四类候选：
  `literary`、`internet`、`compound`、`niche`。词语允许 2–12 字符的多字表达、网络用语、字母与数字组合；prompt
  排除基础词、过时烂梗、无意义缩写和只有专家能理解的术语，runtime 再验证字符、长度、四类完整性与重复。
- `roundId` 经 SHA-256 派生稳定选择位置；effect 重试仍读取 D1 memoization ledger，不会因重试换题。本地 provider
  同样使用 seeded rotation，并把明显常见的两字词替换为偏难书面词，再加入电子榨菜、情绪价值、信息茧房、数字游民、
  Citywalk 等多字或网络表达，不再让每个新房固定从词库第一项开始。
- migration `0041_fib_word_exposures.sql` 新增 `(user_id, word)` exposure 表。每名真人只保留最近 200 词；本局参与者
  历史并集在 generation 前传入 provider，只有 authoritative round complete success 后才幂等写入。set-based
  `json_each` + window pruning 避免按人数发 N 次 D1 请求，已删除账号不会阻断有效玩家写入。
- Gemini 官方文档确认 array structured output；provider schema 只保留 Gemini 支持的 JSON Schema
  object/array/required/enum/minItems/maxItems 等字段，字符串长度和字符集不依赖 provider 保证。定向 Worker 验证为
  3 files / 18 tests，独立 provider contract 为 1 file / 13 tests，D1 table ownership contract 为 4629 tests。
  完整 `pnpm run quality` 通过：game-engine 88 suites / 2495 tests、Worker 29 files / 177 tests、root 232 suites /
  9660 tests；Pages/Worker types、三套 TypeScript、engine build、Knip、ESLint 与 Prettier 全绿。

### 当前提交：Phase 8.12W Worker deploy 配置归属

- `main` merge 后 CI run `30679798231` 的 remote D1 migration 失败；原始 job 日志确认
  `wrangler-action@v4` 从 workspace 根执行 `pnpm exec wrangler d1 migrations apply werewolf-db --remote`，因此选中
  Pages `wrangler.jsonc` 并报告找不到 `werewolf-db`。migration `0041_fib_word_exposures.sql` 本身未开始执行。
- `deploy-api-worker` 改为调用 `@game-judge/api-worker` 的 `db:migrate:remote` 与 `deploy` package scripts；两条 script
  都显式传入 Worker `wrangler.toml`。认证使用 Wrangler 官方支持的 `CLOUDFLARE_API_TOKEN` 与
  `CLOUDFLARE_ACCOUNT_ID` job environment，不再依赖 action 的 working-directory 行为。
- 独立 contract test 同时锁住 package script 的 `--config wrangler.toml` 与 workflow 的 package-owned command，并
  禁止 API Worker deploy job 重新使用 ambient-config `wrangler-action`。完整 `pnpm run quality` 待执行。

### 当前提交：Phase 8.12X Fib 词语拼音展示

- `FibIdentityModal` 在本轮词语下方显示带声调符号的拼音；大聪明、老实人、瞎掰王和 ended 公开结果使用同一展示。
  多字词和网络中文词按完整词组转换，混合词保留原有字母/数字，例如 `AI绘画` 显示为 `AI huì huà`；纯英文词不重复
  渲染一行相同文本。
- 拼音由 Fib 客户端 presentation helper 使用 `pinyin-pro` 从 authoritative `word` 派生，不进入 `FibRound`、snapshot、
  command、provider 或 D1。这样注音改进不触发 state version 升级，也不存在 provider 拼音与真实词语漂移。
- `FibIdentityModal` 定向测试覆盖普通中文、多字网络词、纯英文与三种 ongoing 身份。完整 `pnpm run quality` 通过：
  game-engine 88 suites / 2495 tests、Worker 29 files / 177 tests、root 234 suites / 9673 tests；Pages/Worker types、
  三套 TypeScript、engine build、Knip、ESLint 与 Prettier 全绿。
