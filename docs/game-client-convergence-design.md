# 七游戏客户端同构与狼人杀重建设计

> 状态：设计稿 v3（2026-10-29，v2 经对抗评审修订、v3 改为重建方案，见 §12），未实施。方向：**架构向平台看齐，行为向狼人杀看齐**——所有游戏客户端收敛到同一结构，狼人杀按该结构完全重建，狼人杀的用户行为是七家的基准，不保留 `LocalGameState` / `WerewolfGameClient` / 客户端规则重算。§1 记录现状供追溯；§4–§8 为目标实现；§9 为实施顺序；决策与待裁决见 §11。
> 关联：[multigame-platform-design.md](multigame-platform-design.md) §25、[room-shell-contract.md](room-shell-contract.md)、[roomscreen-state-machine.md](roomscreen-state-machine.md)、[game-review-share-design.md](game-review-share-design.md)（§5.1 / §8.2 的狼人杀复盘事实层由本设计 §6.5 提供）。

## 1. 现状

### 1.1 规模

| 层                      | 文件 | 行数  | 说明                                                                                                          |
| ----------------------- | ---- | ----- | ------------------------------------------------------------------------------------------------------------- |
| `src/features/room/`    | ~170 | 28.5k | 房间壳、座位盘、控制器、身份揭示动效、分享截图、配置表单                                                      |
| `src/features/drawing/` | 6    | 0.9k  | 画布、渲染器、媒体传输工厂                                                                                    |
| 六家非狼人杀游戏合计    | ~150 | 19.4k | demo 0.9k · storyrelay 1.7k · fibking 2.0k · undercover 2.0k · drawguess 2.6k · pictionary 3.6k · avalon 6.5k |
| `src/games/werewolf/`   | 175  | 32.5k | 其中 `room/hooks` 5.0k、`room/components` 4.3k、`room/` 4.5k、`hooks/` 1.6k、`runtime/` 1.1k                  |

### 1.2 六家已经同构的部分

每家只剩对共享工厂的薄声明：`*RoomCommandFailureMessage.ts`（映射表）、`*RoomSession.ts`（`RoomLink<State, Command>` 别名）、`home/index.ts` / `navigation/*.ts` / `module.ts`（`defineClientGameModule` 声明）、`*RulesScreen.tsx`（`GameGuide` 内容）、adapter 里的 `createRoomProfileTargetResolver` / `createRoomSeatTapIntentResolver` / `createRoomSeatDataSource` 调用。规则页、绘画域、音频编排核（`RoomAudioOrchestrator`）均已单源。

### 1.3 六家之间的残余漂移

| 维度                       | 现状                                                                                                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 机器人接管四件套           | 七个 room-state hook 逐字重复 `useRoomBotControl → resolveEffectiveSeat → useBotTakeoverGuard → createBotTakeoverCapability → useBotTakeoverLongPress`（~25 行/家），含同一个 `deniedReason` 三元                                                              |
| 就绪会话守卫 + submit 包装 | 五家重复 `useAuthContext + useRoomLinkSnapshot + throw + submission.submit(label, () => session.dispatch(command, { controlledSeat, label, durable: false }))`                                                                                                 |
| 座位控制器接法             | demo / storyrelay / drawguess / avalon 走 `useRoomSetupController` + `createRoomSeatPressHandler`；pictionary / fibking 仍手调 `useRoomRosterController` + `createControlledSeatModel` + `createRoomProfileCardModel` + `createRoomSeatConfirmationModel`      |
| 图片分享动作               | storyrelay / pictionary 各写一份 `setIsSharing → shareImagesBase64 → handleError → finally`；取消判定两套（`roomShare.isShareCancelled` 只认 `DOMException AbortError`，狼人杀 `isShareCancelledError` 宽松匹配字符串）                                        |
| 每秒 ticker                | drawguess `useDrawGuessNowMs` 与 `useStageDeadline` 并行两个 1s `setInterval`，前者未接 `useAppVisibility`                                                                                                                                                     |
| Bot userId                 | 平台 roster 里机器人是 `{ seat, kind: 'bot' }`，无 id；但共享 `RoomSeatPlayer.userId: string` 迫使每个游戏捏一个假 id：pictionary / fibking 引擎导出函数，另五家 adapter 两处字面量，狼人杀 `bot-${seat}` 写进引擎广播与 D1 指纹——7 种格式满足一个不诚实的类型 |
| 座位数据源默认文案         | `lockedSeatReason: '游戏进行中不能入座'`、`outOfRangeError` 五处相同                                                                                                                                                                                           |
| 卧底角色名表               | `平民 / 卧底 / 白板` 在 `undercoverRoomAdapter`、`UndercoverRoleCardAdapter`、`useUndercoverRoomScreenState` 三处重复                                                                                                                                          |
| 画布 props 接口            | `PictionaryDrawingCanvasProps` 与 `DrawGuessDrawingCanvasProps` 逐字相同；drawguess testID 为裸字符串                                                                                                                                                          |

### 1.4 狼人杀与平台的分歧（全部）

| #   | 维度           | 六家                                                                                                                       | 狼人杀                                                                                                                                                                                                                                  | 根源                                                                                                                                             |
| --- | -------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 客户端状态模型 | 直接消费引擎 `State`（含 `roster`）+ `getXViewModel(state, effectiveSeat)`                                                 | `GameState → LocalGameState`（`toWerewolfLocalState` 205 行）：`roster` 折进 `players: Map<number, LocalPlayer>`，另派生 `template` / `actions: Map<RoleId, RoleAction>` / `wolfVotes: Map`                                             | 早于多游戏平台的旧客户端形状                                                                                                                     |
| 2   | 行动身份       | `effectiveSeat` + `viewModel.myRole`                                                                                       | `effectiveSeat` + `actorSeatForUi`（恒等）；`effectiveRole`（A 链：`players.get(seat).role`）+ `actorRoleForUi`（恒等）+ `viewModel.myRole`（B 链，AU-39 后加）；`getActorIdentity` 的 drift 分支按构造不可达且软失败返回 `{null,null}` | AU-39 加 B 链后未删 A 链                                                                                                                         |
| 3   | 座位数据源     | `createRoomSeatDataSource(roster, …)`                                                                                      | `createWerewolfSeatDataSource` 自建（读 `LocalPlayer`）                                                                                                                                                                                 | #1                                                                                                                                               |
| 4   | 资料卡目标     | `createRoomProfileTargetResolver`                                                                                          | 从 `LocalPlayer` 推                                                                                                                                                                                                                     | #1                                                                                                                                               |
| 5   | 机器人谓词     | `isBotSeat(state.roster, seat)`                                                                                            | `isWerewolfLocalBotSeat`: `players.get(seat)?.isBot === true`                                                                                                                                                                           | #1                                                                                                                                               |
| 6   | 揭示动效解析   | `resolveEquippedRevealEffect` 在查看时解析                                                                                 | 入座时解析写进 `LocalPlayer.roleRevealEffect`                                                                                                                                                                                           | #1                                                                                                                                               |
| 7   | 模块注册       | `defineClientGameModule`                                                                                                   | 手写 `createWerewolfUiModule`，构造 `WerewolfGameClientRuntime`（392 行）并把 `client` 注入 5 个屏幕；`defineClientGameModule` 头注释明确"狼人杀不用此工厂"                                                                             | 自有 client 门面                                                                                                                                 |
| 8   | 命令派发       | `submit(label, command, control)` 一个包装，命令对象内联构造                                                               | `WerewolfGameClient` 接口 23 个方法 → `WerewolfGameClientRuntime` 实现 → `werewolfGameActions` 构造器（355 行）→ `useWerewolfGameActions` hook 包装（492 行）→ `useRoomActions`（560 行）→ executors                                    | 自有 client 门面                                                                                                                                 |
| 9   | 阶段到期       | 引擎 `settle.due` 效果 + Worker `settleDue` 投递（avalon / demo），客户端 `useStageDeadline` 只做显示 + 任意前台客户端加速 | `useStepDeadlineCountdown`：**host 客户端**到期后发 `werewolf.progress.request`，失败逐 tick 重试；引擎 `inlineProgression` 接 `nowMs` 判断；无 `settle.due`。host 离线 = 步进停摆                                                      | 时钟与播报绑在 host 客户端；引擎无效果管线（`WerewolfEffect` 仅 gameEnded / MVP，`stageDeadline: false`），`progress.request` host-only 且无 pin |
| 10  | 复盘事实       | —                                                                                                                          | `NightReview.helpers.ts`（1314 行）在客户端重算 `willDieTonight` / `canShootForSeat` 等规则；引擎已有 `DeathCalculator` 产出 `lastNightDeaths` + `deathReasons`                                                                         | 客户端重算规则，违反"服务端唯一权威"                                                                                                             |
| 11  | 音频编排       | `useAvalonAudioOrchestration` hook 绑定共享核                                                                              | `WerewolfAudioOrchestrator` 类绑定共享核，挂在 runtime 上                                                                                                                                                                               | #7（核已共享，只是宿主不同）                                                                                                                     |
| 12  | 身份卡剩余张数 | 共享公式                                                                                                                   | `+1` 修正（viewed 标记先于弹卡落地）                                                                                                                                                                                                    | 查看协议顺序不同                                                                                                                                 |
| 13  | 座位点击策略   | `createRoomSeatPressHandler`；阿瓦隆用 `seatPickHandlerRef` 在前面拦一层                                                   | `seatTap/SeatTapPolicy.ts`（179 行）自做 status 路由 + `ACTION_FLOW`；`RoomInteractionPolicy.ts`（233 行）客户端预判音频/状态/行动者门控                                                                                                | 两家各写一套"游戏先吃、共享回落"路由；狼人杀另在客户端预判引擎已有的拒绝                                                                         |
| 14  | 复盘 / 分享 UI | 各家自写                                                                                                                   | `NightReview*` 一整套                                                                                                                                                                                                                   | 由 [game-review-share-design.md](game-review-share-design.md) 处理                                                                               |

#3–#6、#11 由 #1 / #7 派生；#2 是历史残留；#9、#10 是权威边界问题；#12 是可消除的协议顺序差；#13 与 #8 之下还有一条六家没有对应物的房间交互链（intent → orchestrator → executors → dialogs → actions，~4,400 行命令式代码），是重建的主要对象（§6.5）。

## 2. 目标与非目标

### 2.1 目标

1. **一种客户端结构。** 七家都是：`defineClientGameModule` 声明 → `RoomEntryBoundary` 给 `session` → `useXRoomState` 组装共享控制器 → `createXRoomShellModel` 产出 `RoomShellModel` → `RoomShell` 渲染。新游戏模板（demo）就是全部游戏的形状，狼人杀不例外。
2. **引擎是唯一的状态与投影来源。** 客户端只消费 `State` 与 `getXViewModel(state, effectiveSeat)`；不存在第二份状态形状、第二条身份推导链、客户端规则重算。
3. **服务端是唯一的规则与时钟权威，host 是唯一的播报权威。** 谁死、谁能行动、倒计时是否到期由引擎与 Worker 决定；一段词念没念完只有 host 知道，经 durable `audio.ack` 告诉服务端。客户端不重算规则、不兼任秒表；用引擎广播的事实预先禁用会被拒绝的操作（§3 原则 6），但不自己算规则。
4. **接管、会话、分享、倒计时在共享层各只实现一次。**
5. **残留分歧全部登记。** 做完后狼人杀仍然特殊的部分（§8）写进契约测试，不靠注释散落。
6. **行为基准是狼人杀。** 狼人杀最早做、用户行为打磨最久；架构不完美是因为早于平台。重建把狼人杀的行为提升为平台行为，六家跟上（§5.3）：查看身份先确认后弹卡、播报中交互锁（平台 `audioPlaybackLock` 的来源就是狼人杀）、host 可见机器人身份、重连恢复对话框。

### 2.2 非目标

- 不改游戏规则、夜间步骤、角色设定、音频资源。
- 不改夜间步骤、角色技能、死亡规则的语义。到期命令协议会变（§6.2）：`werewolf.progress.request` 被带 pin 的 `phase.expire` / `phase.settleExpired` 替换。
- 不做 Night-1 之外的内容。
- 复盘 UI 与导出链路由 [game-review-share-design.md](game-review-share-design.md) 负责，本设计只提供事实层。

## 3. 原则

1. **单源。** 一个概念一个名字一条推导链。`effectiveSeat` 是行动座位的唯一名字；`viewModel.myRole` 是行动身份的唯一来源。
2. **Fail fast。** 不可达分支直接删除而不是返回 null；状态不一致抛错，不静默 NOOP。
3. **投影在引擎。** 任何"从 `State` 算给 UI 看"的纯函数住在 `packages/game-engine/src/games/<game>/domain/visibility.ts`，Worker 与客户端共用同一份。
4. **共享层收谓词不收形状。** 共享 hook 接 `(seat) => boolean`、`RoomViewer` 这类最小契约，不接 roster 形状，所以不存在"某家接不进去"。
5. **不建中间门面。** 客户端命令就是 `session.dispatch(command, options)`，不再有 `GameClient` 接口层。
6. **预先禁用是数据，不是预判。** 引擎拒绝是权威；UI 用引擎广播的同一事实（`isAudioPlaying`、`isActioner`、`status`）把会被拒绝的操作渲染为 disabled + 原因（平台 `RoomCapability { isAllowed, reason }` / `audioPlaybackLock` 口径），不发注定被拒的请求、不等服务端 toast。禁止的是**客户端重算规则**，不是预先禁用。

## 4. 目标结构（每个游戏相同）

```
src/games/<game>/
  module.ts                      defineClientGameModule 声明（含 audio / extras）
  model/<Game>RoomSession.ts     RoomLink<State, Command> 别名
  home/ navigation/ screens/     声明式贡献 + GameGuide 内容
  room/
    <Game>RoomScreen.tsx         RoomEntryBoundary → use<Game>RoomState → RoomShell
    <game>RoomAdapter.ts         createXCapabilities / SeatDataSource / HostManagement / BottomActions / ShellModel
    <game>GuidanceMatrix.ts
    <game>RoomCommandFailureMessage.ts
    hooks/use<Game>RoomState.ts  useReadyRoomSession → useRoomSetupController → useBotTakeover → 游戏推导 → ShellModel
    components/                  游戏自有 UI（弹窗、阶段视图）
    policy/ (可选)               游戏自有交互策略（纯函数，吃 effectiveSeat + viewModel）
```

`use<Game>RoomState` 的固定骨架（共享层提供前三行）：

```ts
const { user, state, revision, session, submit } = useReadyRoomSession(props.session, getXFailureMessage);
const viewer: RoomViewer = { userId: user.id, isHost: state.hostUserId === user.id, seat: getXUserSeat(state, user.id) };
const takeover = useBotTakeover({ viewer, isBotSeat: (seat) => isBotSeat(state.roster, seat), gameName });
const viewModel = useMemo(() => getXViewModel(state, takeover.effectiveSeat), [state, takeover.effectiveSeat]);
const setup = useRoomSetupController({ session, user, isSetup, isHost: viewer.isHost, mySeat: viewer.seat, … });
// 以下为游戏自有推导
```

## 5. 平台层改动

### 5.1 新增

| 文件                                                 | 内容                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/room/controllers/useBotTakeover.ts`        | 入参 `{ viewer: RoomViewer; isBotSeat: (seat) => boolean; gameName }`；出参 `{ controlledSeat, effectiveSeat, isDelegating, takeOver, release, capability, onBotSeatLongPress }`。内部固定顺序：`useRoomBotControl → useBotTakeoverGuard → resolveEffectiveSeat → createBotTakeoverCapability → useBotTakeoverLongPress`。`deniedReason` 三元收进来。`useBotTakeoverGuard` 头注释的"七家消费者"改为"唯一消费者 `useBotTakeover`" |
| `features/room/controllers/useReadyRoomSession.ts`   | `useAuthContext + useRoomLinkSnapshot`；非 ready 或未登录 **throw**；返回 `{ user, state, revision, session, submit }`，`submit(label, command, controlledSeat = null)` 即 `useRoomCommandSubmission(failureMessage).submit(label, () => session.dispatch(command, { controlledSeat, label, durable: false }))`                                                                                                                  |
| `features/room/hooks/useNowMs.ts`                    | 单一 1s ticker，接 `useAppVisibility`；`useStageDeadline` 改为基于它派生 `remainingSeconds`，并额外返回 `nowMs`                                                                                                                                                                                                                                                                                                                  |
| `features/room/controllers/useRoleViewing.ts`        | 查看身份协议（§5.3）：submit → 服务端确认 → 冻结快照 → 弹卡；`isPending` 供按钮 loading；被拒 → failure message，不弹                                                                                                                                                                                                                                                                                                            |
| `features/room/components/RoomAudioResumeDialog.tsx` | 重连恢复对话框（§5.3），文案与行为取自狼人杀 `WerewolfRoomScreen` 现有实现                                                                                                                                                                                                                                                                                                                                                       |
| `features/room/hooks/useScopedDraft.ts`              | 作用域化本地持久化：`useScopedDraft<T>({ userId, roomId, scope: Record<string, string \| number> }, initial)`；作用域键任一字段变化即清；解析失败即清（不回退）。承接狼人杀 `WerewolfActionDraftStore` 的规则，供夜间草稿 / 面板流程进度 / 记事本                                                                                                                                                                                |
| `features/room/controllers/useLastActionToast.ts`    | 非 host 对 host 命令的被动提示（被踢 / 清座 / 分身份 / 入夜 / 天亮 / 重开），文案表由游戏注入；取自 `useWerewolfLastActionToast`                                                                                                                                                                                                                                                                                                 |
| `features/room/controllers/useShareImageAction.ts`   | `{ isSharing, share }`；`share` 调 `shareImagesBase64`，结果 `'shared' \| 'cancelled'`，失败走 `handleError({ label, logger, alertMessage })`。取消判定迁入 `services/shareImage.ts`：只有 Web Share `DOMException AbortError`（`expo-sharing` 不报告关闭）；字符串匹配删除                                                                                                                                                      |

### 5.2 修改

| 文件                                                                                                         | 改动                                                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `features/room/model/createRoomSeatDataSource.ts`                                                            | `lockedSeatReason` 默认 `'游戏进行中不能入座'`；`outOfRangeError` 默认 `(seat) => \`${gameName} seat out of range: ${seat}\``（入参加 `gameName`）                                                                                                               |
| `features/room/services/roomShare.ts`                                                                        | `isShareCancelled` 与 `shareImage.ts` 共用同一个判定                                                                                                                                                                                                             |
| `features/drawing/components/DrawingCanvas.tsx`                                                              | 导出 `DrawingCanvasGameProps = Omit<DrawingCanvasProps, 'createElementPath' \| 'canvasBackground' \| 'gameName' \| 'testID' \| 'accessibilityLabel'>`                                                                                                            |
| `features/room/model/RoomSeatDataSource.ts` / `RoomCapabilities.ts`（`RoomSeatPlayer`、`RoomProfileTarget`） | `userId: string` + `occupantKind` → `occupant: { kind: 'human'; userId: string } \| { kind: 'bot'; seat: number }`；`createRoomSeatDataSource` / `createRoomProfileTargetResolver` 删 `botUserId` 参数；`getRoomProfileTarget.ts` 头注释"id 格式 game-owned"删除 |
| `features/room/controllers/createRoomSeatPressHandler.ts`                                                    | 增加可选 `inGameAction?: (seat: number) => boolean`：游戏进行中先交给它，返回 true 即已消费，否则走 `resolveRoomInGameSeatTap`。阿瓦隆的 `seatPickHandlerRef` 与狼人杀的 `SeatTapPolicy` 都变成传这个谓词                                                        |
| `game-engine/platform/room/phaseDeadline.ts` 契约测试                                                        | `phaseDeadlineVariants.contract.test.ts` 登记 werewolf 变体（§6.2）                                                                                                                                                                                              |
| `games/model/defineClientGameModule.ts`                                                                      | 增加可选 `extras: { productUi?, accountStatsSection?, appOverlay?, navigationScreens?: Record<route, Component> }`；删除头注释"狼人杀不用此工厂"                                                                                                                 |

### 5.3 从狼人杀提升为平台行为

| 行为                | 狼人杀现状                                                                                                                        | 六家现状                                                                                            | 平台实现                                                                                                                                                                                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 查看身份            | 先发 `role.viewed`，服务端确认后以确认时快照弹卡并播首看动画；被拒不弹 + failure message（`useInteractionDispatcher.ts:249-282`） | demo / avalon 先弹卡再发；fibking 确认关闭时发                                                      | `features/room/controllers/useRoleViewing.ts`：`{ isPending, open }`；`open` = submit → 确认 → 冻结 `{ shouldPlayAnimation, remainingCards }` → 弹卡；`remainingCards` 取确认前记录（本人的牌仍在桌上），`+1` 不再需要。fibking 的确认按钮 UX 改为同一协议 |
| 播报中交互锁        | `RoomInteractionPolicy` 本地 NOOP，不发请求                                                                                       | 平台 `audioPlaybackLock`（disabled + `语音播报中，请稍候`）已覆盖主持面板 / 座位 / 底栏；阿瓦隆在用 | 狼人杀 `NightInteractionModel` 加 `{ kind: 'blocked'; reason }`，由 `isAudioPlaybackLocked(state.isAudioPlaying)` 与 pending ack 推导；六家同字段                                                                                                          |
| host 可见机器人身份 | `showBotRoles = hasBots && isHost`                                                                                                | 无                                                                                                  | 每家 `getXViewModel(state, viewer: { seat, isHost })`，`isHost && seat.isBot` 时 `visibleRole` / `identity` 填充；共享座位工厂 `resolveSecondaryLabel` 读它                                                                                                |
| 草稿跨刷新          | 魔术师首选 / 多选集合按 `user, room, step, actor, nonce, seatCount` 持久化，作用域变即清                                          | 六家无；`useSeatPicking` 只有内存态                                                                 | `useScopedDraft`；阿瓦隆组队选人草稿、fibking 座位选择接入                                                                                                                                                                                                 |
| 被动 toast          | 非 host 收到 host 动作提示                                                                                                        | 六家无                                                                                              | `useLastActionToast`                                                                                                                                                                                                                                       |
| 提交单飞与按钮态    | 进行中按钮 disabled 显示"行动正在确认中"；再次提交 throw                                                                          | 六家只有 `isSubmitting` 布尔                                                                        | `useReadyRoomSession.submit` 单飞 + `RoomBottomActions.disabledReason`                                                                                                                                                                                     |
| ack 未落排他        | 上一步确认未落地时屏蔽其他交互，toast 节流                                                                                        | 六家无对应概念（阿瓦隆夜晚 confirm 有 durable ack 但未屏蔽）                                        | `blocked` 口径进 `RoomCapabilities`；阿瓦隆夜晚接入                                                                                                                                                                                                        |
| 重连恢复            | "游戏已恢复，点击继续并恢复音频"对话框 → `resumeAfterRejoin`                                                                      | 共享核有 `resumeInterrupted`，无 UI                                                                 | `features/room/components/RoomAudioResumeDialog.tsx` + 音频 hook 暴露 `wasAudioInterrupted / resume`；有播报的游戏（狼人杀、阿瓦隆）接入                                                                                                                   |

## 6. 狼人杀重建

重建而非改造：`src/games/werewolf/room/` 与 `hooks/` `state/` `runtime/` 按 §4 结构**从零写**，旧目录整体删除；只把纯数据 / 纯函数形式的领域知识搬进新树。§6.1–6.3 是引擎与平台侧前置，§6.4 是目标树，§6.5 是房间交互的新模型，§6.6 / §6.7 是搬运与删除清单。

### 6.1 引擎投影扩展（`domain/visibility.ts`）

客户端不再推导任何规则事实。`WerewolfViewModel` 补齐 UI 需要的全部裁剪后事实；资料字段走 `state.roster`，**不**进投影。

| 新增字段                                                                        | 来源                                                                                                                                                                                                             | 替代的客户端代码                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `template: GameTemplate`                                                        | `createTemplateFromRoles(templateRoles)`                                                                                                                                                                         | `toWerewolfLocalState` 的 `template`（21 处读取）                                                                                                                                                                                                                                                         |
| `night.actionSchema: ActionSchema \| null`                                      | `resolveCurrentStep(state).schema`（现只暴露 `stepSchemaKind`）                                                                                                                                                  | 客户端 `useWerewolfNightDerived` 的 `currentSchema` 推导                                                                                                                                                                                                                                                  |
| `night.currentActionRole: RoleId \| null`                                       | `resolveCurrentStep(state).roleId`                                                                                                                                                                               | 同上 `currentActionRole`                                                                                                                                                                                                                                                                                  |
| `night.isActioner: boolean`                                                     | `determineActionerState` 的规则部分（groupConfirm 全员 / 角色匹配 / 狼会参与 / 底牌排除）搬入；`showWolves` 已在（`wolfPackSeats`）                                                                              | `werewolfRoom.helpers.ts` 的 `determineActionerState`、`useActionerState`                                                                                                                                                                                                                                 |
| ~~`night.recordedActions`~~                                                     | 实施时否决：唯一消费者是 `determineActionerState`（→ 引擎 `isActioner` 直接读 `state.actions`）和 `NightReview.helpers`（→ 引擎 `getWerewolfNightReview` 直接读 `state.actions`）；投影后无客户端消费者 = 死代码 | —                                                                                                                                                                                                                                                                                                         |
| `seats[].visibleRole` 对 host 填机器人底牌                                      | `getWerewolfViewModel(state, viewer: { seat, isHost })`                                                                                                                                                          | `werewolfRoomAdapter.showBotRoles`                                                                                                                                                                                                                                                                        |
| `night.pendingReveal: WerewolfPendingReveal \| null`                            | 现 `policy/pendingRevealAck.ts` 的推导（`pendingRevealAcks` × 行动者座位 × 已记录 action）搬入                                                                                                                   | 客户端查验结果重入推导                                                                                                                                                                                                                                                                                    |
| `night.rejectionForViewer: { rejectionId; reason } \| null`                     | `actionRejected` 按 `targetSeat === viewerSeat` 裁剪                                                                                                                                                             | `useActionOrchestrator.ts:237-262` 的比对与他人拒绝过滤                                                                                                                                                                                                                                                   |
| `night.wolfVote: { votes; myVote; deadlineAt } \| null`                         | `wolfVotesBySeat` + `nightStep.stepDeadline`，仅参会狼可见                                                                                                                                                       | `useRoomActions.ts:338-360` 的票面 / 倒计时推导                                                                                                                                                                                                                                                           |
| `night.witchContext`、`night.wolfRobotReveal`                                   | 现有字段按观看者裁剪后暴露                                                                                                                                                                                       | 客户端直接读 `state.*`                                                                                                                                                                                                                                                                                    |
| `night.chooseCard: { cards: { roleId; isSelectable; reason }[]; hint } \| null` | 盗贼"有狼牌必须选狼"/ 宝藏大师"禁选狼牌"规则搬入                                                                                                                                                                 | `useWerewolfRoomScreenState.ts:978-1004` 的客户端规则重算                                                                                                                                                                                                                                                 |
| `seats[].disabledReason`                                                        | 本步 schema 的目标约束（不能选自己 / 空座），仅行动者非 null                                                                                                                                                     | `useRoomDerived.ts:80-107`                                                                                                                                                                                                                                                                                |
| （删除）机器人假 userId                                                         | —                                                                                                                                                                                                                | 引擎 `actionHandler.ts:302` `actionRejected.targetUserId` → `targetSeat`；`effects/gameEnded.ts:24` 参与者改 `{ kind: 'human'; userId } \| { kind: 'bot'; seat }`，Worker 结算指纹只算 human；客户端 `toWerewolfLocalState.ts:45` 随文件删除。`startingParticipants` / `mvpUserId` 本就只含真人，不受影响 |

已有且直接复用：`myRole` / `myEffectiveRole`、`night.confirmStatus`、`night.reveals`、`night.wolfVotesBySeat`、`viewedSeats`、`day.sheriffSeat / mvpSeat`。
可选目标 = `seats`（占座）；引擎 `actionHandler` 对目标无额外合法性规则，不新增 `selectableSeats`。
AU-39 golden 测试补新字段与 host 视角。

### 6.2 引擎：阶段到期（时钟归服务端，播报归 host）

| 事件     | 本质                                                  | 权威                                                                          | 阿瓦隆                                                             | 狼人杀现状                                               |
| -------- | ----------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------- |
| 播报结束 | host 念完一段词，物理动作，只有 host 知道             | host：durable `audio.ack`；引擎 `isAudioPlaying` 门挡住所有动作与推进直到 ack | host ack（`guardAudioPlayback`）                                   | host ack                                                 |
| 计时到期 | 全员投完后 5 秒倒计时走完，纯时钟事实，所有屏幕都在数 | 服务端：到了就是到了，不取决于谁的手机亮着；任意前台客户端可加速              | 引擎 `settle.due` → Worker 结算；客户端 `avalon.phase.expire` 加速 | **host 手机** `setInterval` 数到 0 发 `progress.request` |

`stepDeadline` 在三条路径被装上：狼投票全投后 5 秒（`actionHandler.ts:256-270`）、空底牌步随机延迟（`inlineProgression.ts:270-295`，inline progression 内部）、警长投票轮（`sheriffElectionHandler.ts:423-437`）。夜间到期 → 下一步播报入队、`isAudioPlaying = true` → `evaluateProgression` 首门拒绝；**警长结算在白天无音频门**（`inlineProgression.ts:193-205`），重复结算只能靠 pin。

引擎现状：`WerewolfEffect` 仅 gameEnded / MVP；`handlerResultToDecision` 不产效果；`stageDeadline: false`；`werewolf.progress.request` 走 `resolveHostActor`、无 pin、唯一调用者是 `useStepDeadlineCountdown`。新建：

- 命令：删 `werewolf.progress.request`；新 `werewolf.phase.expire`（public，uncontrolledUser）与 `werewolf.phase.settleExpired`（system）。两者与阿瓦隆同款**无 payload**：pin 只在效果上，由 Worker `isCurrent` 逐字段比对（`gameSequence` / `phase` / `deadlineAt` 对 `readArmedDeadline(state)`）；引擎侧 `guardPhaseExpiry` 只需"当前阶段有载体 + 已到期"——到期即应结算，与客户端以为在加速哪次装弹无关（v3 初稿写"命令带完整 pin"，实现时否决：命令上的 pin 不增加正确性）。Worker `schemas.ts` 同步。
- 游戏身份：`GameState.gameSequence`（首局 0，`RESTART_GAME` +1），状态 **v16**，v12–v15 迁移补 0。pin 形状 `{ gameSequence, phase: SchemaId | 'firstVote' | 'runoffVote', deadlineAt }`——夜一无 round。
- 效果：`WerewolfEffect` 加 `WerewolfSettleDueEffect`。`HandlerSuccess` 与 `InlineProgressionResult` 加必填 `effects: readonly WerewolfEffect[]`；三个装弹现场（`actionHandler` 狼投票、`inlineProgression` 空底牌步、`sheriffElectionHandler`）在返回 `SET_STEP_DEADLINE` / 警长 deadline 事件的同一处显式返回 `werewolfSettleDueEffect(state, phase, deadlineAt)`（`effects/settleDue.ts`，包 `buildSettleDueEffect`）——与阿瓦隆 `commitAvalon(events, [settleDueEffect(...)])` 同款。`handlerResultToDecision` 透传效果，不做派生。`domain/__tests__/phaseExpiry.test.ts` 断言不变量：任一 decision 的事件含 deadline 写入 ⇔ 效果含且仅含一条 pin 到该 deadline 的 `settle.due`。reducer 保持纯函数。
- 到期派发：`domain/phaseExpiry.ts#decidePhaseExpiry` = `guardPhaseExpiry` + `runInlineProgression`，夜间音频门（`isAudioPlaying`）仍在每次推进前；白天警长结算无音频门，pin 为唯一防线。
- 能力 `stageDeadline: true`；`phaseDeadlineVariants.contract.test.ts` 登记 werewolf（`dualChannel` / `none` / `sequence+phase+deadline` / `noneByDesign`），`__tests__/phaseDeadlineProtocol.contract.test.ts` 跑共享场景。
- Worker：`games/werewolf/effects.ts` zod schema + `createSettleDueHandler`（superseded = `phase_not_expirable` / `deadline_not_reached`）；`module.ts` business key `werewolf:settle:<seq>:<phase>:<deadline>` 与投递时间。
- 客户端（本步最小改动）：`postProgression` → `expirePhase` 发 `werewolf.phase.expire`，去掉 host 门（非 host 命令）；`useStepDeadlineCountdown` 仍只在 host 端加速，步骤 5 由 `useStageDeadline` 取代。

### 6.3 引擎：复盘事实

客户端 `NightReview.helpers.ts` 的 `willDieTonight` / `canShootForSeat` / `deriveDeathNotes` / `buildActionEntries` 重算死亡与开枪规则——第二份实现。

处置：复盘事实层整体迁入引擎 `domain/review/`，读侧只读引擎已有裁决，不重算。

- `domain/review/nightReview.ts` 的 `getWerewolfNightReview(state: GameState): WerewolfNightReview`：死亡读 `lastNightDeaths / deathReasons`；狼刀裁决读 `resolvedWolfKillVerdict`（不从票重计）；开枪资格调引擎步进时用的同一函数 `handlers/confirmContext.ts#computeCanShootForSeat`；行动条目读 `state.actions` + `currentNightResults`。不调用 `calculateNightDeaths*`。
- 不新增持久化字段：实现时发现 `computeCanShootForSeat` 已存在且与步进共用，`deathSources` 持久化（v3 初稿）无需求，撤回；状态版本不因本节变动。
- 警长发言顺序从字符串 `speakingInstruction` 改为结构 `speakingOrder: { startSeat, direction }`，文案由客户端 `formatSpeakingOrder` 渲染。
- `sheriffElectionRecord.ts` 同迁 `domain/review/`；两套测试以 `GameState` fixture 原样移植（151 用例）。

### 6.4 目标文件树

```
src/games/werewolf/
  module.ts                                defineClientGameModule({ audio, extras })
  model/WerewolfRoomSession.ts             RoomLink<GameState, WerewolfPublicCommand>
  home/ navigation/ screens/ profile/ config/   不动（非房间）
  components/                              不动（AIChatBubble、BoardStrategy、AccountStats、AppOverlay 改吃 session）
  audio/                                   不动
  services/                                不动（AI 聊天、记事本、草稿、panelFlow 存储）
  room/
    WerewolfRoomScreen.tsx                 RoomEntryBoundary → useWerewolfRoomState → RoomShell + 狼人杀弹窗
    werewolfRoomAdapter.ts                 createWerewolfCapabilities / SeatDataSource / HostManagement / BottomActions / BoardInfoSections / RoomShellModel
    werewolfGuidanceMatrix.ts              搬
    werewolfRoomCommandFailureMessage.ts   搬 + 补 audioPlaying / notActioner / deadline / phase 四个 reason 的中文
    hooks/
      useWerewolfRoomState.ts              §4 骨架 + 下列 hook 组合 + ShellModel
      useWerewolfAudioOrchestration.ts     共享核绑定（同 useAvalonAudioOrchestration），含 wasAudioInterrupted / resumeAfterRejoin
      useNightDraft.ts                     本地草稿：魔术师第一选、多选集合、底牌选择、待确认目标
      useWerewolfBgmControl.ts             搬
    night/
      NightInteractionModel.ts             类型（§6.5）
      resolveNightInteraction.ts           (viewModel, draft) → NightInteractionModel
      buildNightCommand.ts                 (model, confirmation) → WerewolfPublicCommand
      nightPrompt.ts                       schema.ui 模板 → 对话框文案（含 currentActorHint 覆盖、免疫目标附注）
    day/
      sheriffElectionViewModel.ts          搬，输入 GameState + WerewolfViewModel
      sheriffElectionDockModel.ts          搬
      sheriffElectionRecord.ts             搬
      panelFlow.ts                         搬
    review/
      toWerewolfReviewDocument.ts          随 review-share 设计；输入 WerewolfNightReview
    policy/
      werewolfInteractionPolicy.ts         本地不变量：pending ack 排他、播报中不开资料卡、host-only 对话框
    werewolfGuideMessage.ts                搬
    components/                            弹窗：按 NightInteractionModel 渲染；警长 / MVP / 板子提名 / 身份卡 / 分享授权
```

### 6.5 房间交互新模型

现状：点击 → `SeatTapPolicy` → `RoomInteractionPolicy` → `useInteractionDispatcher`(420) → `ActionIntent` → `useActionOrchestrator`(427) → `executors/`(885) → `useRoomActionDialogs`(237) → `useRoomActions`(560) → `proceedWithAction`；底栏另有 `bottomLayoutConfig`(445) → `resolveBottomLayout`(173) → `bottomActionBuilder`(323)。12 个 hook、12 个执行器、3 层 policy，命令式"弹框 → 回调里发命令"。六家没有这条链：底栏走 `RoomBottomActions` 声明式契约，交互是 adapter 里的数据。

新模型：**UI = f(viewModel, draft)**。四份行为清查（§6.9）证明旧链里真正的领域内容是：10 个 schema kind 的交互形状、每个 kind 的对话框文案来源、三类 ack 流、一个跨刷新草稿、一套拒绝定向。模型必须覆盖全部，不是"核心路径"。

```ts
/** 当前观看者在本步骤能做的事。 */
type NightInteractionModel =
  | { kind: 'idle' } // 非行动者 / 非夜间
  | { kind: 'blocked'; reason: string } // 播报中（平台 audioPlaybackLock）/ 上一步 ack 未落（"正在确认上一步，请稍候"，toast 节流）；离房与查看身份豁免
  | {
      kind: 'pickSeat';
      selectable: readonly number[];
      pending: number | null;
      prompt: NightPrompt;
      canSkip: boolean;
    } // chooseSeat（含 revealKind）
  | {
      kind: 'wolfVote';
      selectable: readonly number[];
      myVote: number | null;
      votes: Record<string, number>;
      countdownSeconds: number | null;
      prompt: NightPrompt;
    } // wolfVote：已投可改票；到期前显示倒计时；空刀 = target null；免疫目标附注
  | {
      kind: 'pickTwoSeats';
      selectable: readonly number[];
      first: number | null;
      second: number | null;
      prompt: NightPrompt;
      canSkip: boolean;
    } // swap：第二座延迟确认以显示双高亮；取消清两座
  | {
      kind: 'multiSelect';
      selectable: readonly number[];
      selected: readonly number[];
      max: number;
      prompt: NightPrompt;
      canSkip: boolean;
    } // multiChooseSeat：满额后再点无效；确认按钮带 {count}，0 选为 disabled
  | {
      kind: 'witch';
      killedSeat: number | null;
      canSave: boolean;
      canPoison: boolean;
      cannotSavePrompt: string | null;
      pendingPoison: number | null;
      prompt: NightPrompt;
    } // compound：信息框 → 救（按钮）/ 毒（点座位）/ 都不用
  | { kind: 'confirmStatus'; status: ConfirmStatusView; prompt: NightPrompt; canSkip: boolean } // confirm：猎人 / 黑狼王能否开枪、复仇者阵营、隐狼队友、种狼感染目标（可跳过）
  | {
      kind: 'chooseCard';
      cards: readonly { roleId: RoleId; isVacant: boolean }[];
      prompt: NightPrompt;
      canSkip: boolean;
    } // chooseCard：空牌 disabled + 原因；选牌需确认
  | { kind: 'ackGroupReveal'; reveal: WerewolfRevealView; text: GroupRevealText } // groupConfirm：种狼感染 / 石像鬼转化 / 丘比特情侣 / 吹笛者催眠
  | { kind: 'ackReveal'; reveal: WerewolfPendingReveal } // 查验类结果确认（预言家等）：刷新后重入；一次只弹一个
  | { kind: 'ackHunterStatus'; canShoot: boolean } // 机器狼学到猎人后的开枪状态确认门
  | { kind: 'skipOnly'; prompt: NightPrompt }; // skip
```

- 引擎投影供给（§6.1 补）：`night.actionSchema`、`night.isActioner`、`night.pendingReveal`（现 `policy/pendingRevealAck.ts` 的推导进引擎：`pendingRevealAcks` × 行动者座位 × 已记录 action）、`night.rejectionForViewer`（`actionRejected` 按 `targetSeat === viewerSeat` 裁剪，含 `rejectionId`）、`night.wolfVote`（票面、我的票、倒计时 deadline）、`night.witchContext`、`night.wolfRobotReveal`、`night.confirmStatus`。客户端不再从 `actions` / `currentNightResults` 推任何一项。
- `resolveNightInteraction(viewModel, draft)`：锁 → `blocked`；非行动者 → `idle`；否则按 `actionSchema.kind` 映射上表。`prompt` 由 `nightPrompt.ts` 从 `schema.ui` 模板 + `state.ui.currentActorHint`（可整体覆盖提示、可改为 skip-only / 空刀-only）+ 免疫目标规则渲染；缺模板 **throw**（现有 fail-fast 保留）。
- **自动弹一次**：行动者进入步骤时 prompt 自动弹出一次，去重键 = 草稿作用域键；rejoin 恢复覆盖层可见或命令恢复中时抑制。
- `buildNightCommand(model, confirmation)`：`WerewolfActionInput` 六种与 model kind 的映射是一张表；ack 三类分别产出 `reveal.ack` / `groupConfirm.ack` / `wolfRobot.ackHunterStatus`。
- **草稿跨刷新**：`useNightDraft` 以平台 `useScopedDraft({ userId, roomId, scope })` 持久化（§5.1 新增，把 `WerewolfActionDraftStore` 的作用域规则提升为平台：`scope = { stepId, actorSeat, roleRevealRandomNonce, seatCount }`，作用域变化即清）。持久化项：魔术师第一座、多选集合、女巫待确认毒杀目标。
- **单飞**：`submit` 进行中再次确认 → throw（现有 fail-fast）；底栏按钮 disabled 文案"行动正在确认中"。
- **拒绝定向**：`night.rejectionForViewer` 变化且 `rejectionId` 未见过 → alert（`showActionRejectedAlert`）；他人的拒绝不可见（引擎已裁剪）。
- 点座位：`createRoomSeatPressHandler({ inGameAction: (seat) => draft.pick(seat) })`；`pickSeat` / `wolfVote` 置待确认并弹确认框；`pickTwoSeats` 第一次置 first + 提示、第二次置 second 延迟一帧弹确认；`multiSelect` toggle；`witch` 置 pendingPoison + 确认；其余 kind 返回 false 走共享回落。座位约束（不能选自己 / 空座）来自 `viewModel.seats[].disabledReason`，仅行动者可见。
- 底栏：`createWerewolfBottomActions(viewModel, model)` 产出 `RoomBottomActions`；按 kind 给出确认 / 跳过 / 空刀 / 救 / 都不用 / 状态按钮 / 选牌；非行动者显示"等待 N 号行动"类等待语；Day 换警长 dock；Ended 换收尾流；播报中整体折叠。
- 对话框：`NightInteractionDialog` 按 `model.kind` 渲染；确认即 `submit(buildNightCommand(...))`；`ackReveal` 与 `ackGroupReveal` 的标题 / 正文来自 schema 模板（`revealTitlePrefix`、`loverText`、`hypnotizedText` 等）。

替代范围：旧链 ~4,400 行 → `night/` 三个纯函数文件 + `useNightDraft` + 一个对话框组件，估 ~1,500 行。测试：表驱动覆盖 13 个 model kind × 行动者 / 非行动者 × 草稿状态 × 锁状态；每个 kind 的 `buildNightCommand` 输出；刷新重入（草稿恢复、pendingReveal 重弹一次）；拒绝去重。

### 6.6 搬运清单（改输入后原样搬，带测试）

| 源                                                                                                                                                       | 目的地                                   | 输入变化                                                                                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `room/sheriffElectionViewModel.ts` `sheriffElectionDockModel.ts` `sheriffElectionRecord.ts` `panelFlow.ts`                                               | `room/day/`                              | `LocalGameState` → `GameState` + `WerewolfViewModel`                                                                                                                                        |
| `room/werewolfGuideMessage.ts`、`room/werewolfGuidanceMatrix.ts`、`werewolfRoomCommandFailureMessage.ts`                                                 | 原位                                     | 同上                                                                                                                                                                                        |
| `room/createWerewolfHostManagement.ts`（主持面板 sections / task 数据）                                                                                  | `werewolfRoomAdapter.ts`                 | 同上；命令改 `submit`                                                                                                                                                                       |
| `room/components/`：`SheriffElection*`、`BoardNominationList`、`MvpSelectionModal`、`ChooseBottomCardModal`、`WerewolfRoleCardModal`、`ShareReviewModal` | `room/components/`                       | props 改为 model 字段；testID 保持（55 个 `TESTIDS` 键为 e2e 契约）                                                                                                                         |
| `room/NightReview.helpers.ts` 呈现部分                                                                                                                   | `room/review/`                           | 输入 `WerewolfNightReview`                                                                                                                                                                  |
| `hooks/useWerewolfBgmControl.ts`、`hooks/useNotepad.ts`、`hooks/useWerewolfLastActionToast.ts`                                                           | `room/hooks/` / 原位                     | `client` → `session`                                                                                                                                                                        |
| `runtime/WerewolfAudioOrchestrator.ts` 的 player / ack 适配                                                                                              | `hooks/useWerewolfAudioOrchestration.ts` | 类 → hook，按 `session.epoch` 重建。生命周期由结构保证：`useRoomEntryController` 的 cleanup 在 Room 卸载时 `link.close()`，hook 与 ready link 同生命周期；native stack push 子屏不卸载 Room |
| `audio/`、`services/`、`components/`（非房间）、`screens/`                                                                                               | 不动                                     | `client` → `session`                                                                                                                                                                        |

### 6.7 删除清单（整文件 / 整目录）

| 目录 / 文件                                                                                                                                                                                                                                                                                                                                                                                                 | 行数   | 由什么替代                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------- |
| `state/`（`LocalGameState` `toWerewolfLocalState` `isWerewolfLocalBotSeat` `getWerewolfUserSeat`）                                                                                                                                                                                                                                                                                                          | 355    | `GameState` + `WerewolfViewModel`                        |
| `runtime/`（`WerewolfGameClient` `WerewolfGameClientRuntime` `werewolfGameActions`）                                                                                                                                                                                                                                                                                                                        | ~900   | `defineClientGameModule` + `submit`                      |
| `hooks/useWerewolfRoom` `useWerewolfGameActions` `useWerewolfBotControl` `useWerewolfDebugMode` `useWerewolfNightDerived` `useWerewolfAckMutation` `useWerewolfPendingAcks`                                                                                                                                                                                                                                 | ~1,050 | `useWerewolfRoomState` + 共享 hook + 投影字段            |
| `room/executors/`                                                                                                                                                                                                                                                                                                                                                                                           | 885    | `night/resolveNightInteraction` + `buildNightCommand`    |
| `room/seatTap/`、`room/policy/`（`SeatTapPolicy` `RoomInteractionPolicy` `actorIdentity` `types` `pendingRevealAck`）                                                                                                                                                                                                                                                                                       | 834    | `inGameAction` 谓词 + `werewolfInteractionPolicy` + 投影 |
| `room/hooks/`（全部 17 个：`useWerewolfRoomScreenState` `useRoomActions` `useActionOrchestrator` `useInteractionDispatcher` `useRoomModals` `useRoomDerived` `useRoomIdentity` `useStepDeadlineCountdown` `useActionerState` `useWerewolfActionDraft` `bottomLayoutConfig` `resolveBottomLayout` `bottomActionBuilder` `useBottomLayout` `actionIntentHelpers` `useSheriffElection` `useNightReviewShare`） | 4,997  | 新 `room/hooks/` 4 个文件 + `night/` + adapter           |
| `room/werewolfRoom.helpers.ts`、`useRoomActionDialogs.ts`、`useRoomHostDialogs.ts`、`useWerewolfHostControl.ts`                                                                                                                                                                                                                                                                                             | ~970   | 引擎 `isActioner` + `NightInteractionDialog` + adapter   |
| `room/components/`：`NightReviewReportBody` `NightReviewModal` `NightReviewShareCard` `ShareProgressModal`、`room/nightReviewLayout.ts` `shareNightReview.ts`                                                                                                                                                                                                                                               | ~2,000 | review-share 设计的共享渲染器                            |
| `werewolfRoomAdapter.ts` 现版                                                                                                                                                                                                                                                                                                                                                                               | 564    | 重写                                                     |

合计删除 ≈ 12.5k 行；新写估 ≈ 3.5k（adapter ~400、room-state ~450、night ~700、对话框 ~300、audio hook ~150、draft ~100、policy ~80、screen ~250、其余搬运改口）。`room/` 从 ~15k 降到 ~6k。

### 6.8 身份与查看协议

- 身份两个事实：`actorRole = viewModel.myRole`（raw：服务端角色匹配、身份卡）与 `actorEffectiveRole = viewModel.myEffectiveRole`（底牌派生：schema 分支、hint 匹配、底栏文案）。现客户端把 raw 当派生用，盗贼选到魔术师时 `=== 'magician'` 判断错——新模型里 `resolveNightInteraction` 只读 `isActioner` 与 `actionSchema`，这个分支消失；`actorEffectiveRole` 只剩文案用途。补盗贼 / 宝藏大师选牌用例。
- 查看身份：走平台 `useRoleViewing`（§5.3，协议取自狼人杀现有行为）。`+1` 消失是因为 `deriveRemainingRevealCards` 按确认后状态定义，不是因为改顺序。

### 6.9 行为契约：重建必须逐条保留的狼人杀行为

四份逐文件清查（room/hooks 209 条、room/components + adapter 111 条、hooks/runtime/services 31 条、executors/policy 全部 schema kind 流程 + 30 条门控）归并为下表。每行是一个验收项：重建后的实现必须复现，e2e / 单测必须覆盖。"保留方式"指向新结构里的承载位置。

**夜间动作（§6.5 `NightInteractionModel`）**

| 行为                                                                                                                                                               | 来源                                                                                 | 保留方式                                                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| 行动者进入步骤自动弹一次提示；播报中、非行动者、魔术师选第二座期间、女巫上下文未到、机器狼已学完不弹                                                               | `useRoomActions.ts:430-478`                                                          | `prompt.autoShow` + 作用域去重键；`blocked` / `idle` 不弹                               |
| `chooseSeat`：点座 → 用 `schema.ui.confirmText` 确认 → `target`；缺文案 throw；有 `revealKind` 的走查验结果确认                                                    | `useRoomActions.ts:181-187,300-318`                                                  | `pickSeat` + `nightPrompt` fail-fast                                                    |
| `wolfVote`：已投可改票；投完显示剩余秒数，到期后提示可改；免疫目标附注 `（该角色免疫狼人袭击）`；空刀 = `target: null`；非参会狼（石像鬼、机器狼、宝藏大师）不可投 | `useRoomActions.ts:233-294,338-360`、`wolfVoteExecutor.ts:42-55`                     | `wolfVote` kind；参会判定来自引擎 `isActioner`                                          |
| `swap`：第一座提示 → 第二座延迟一帧确认（双高亮可见）→ `multiTarget`；取消清两座；第一座跨刷新恢复                                                                 | `actionSubmitExecutor.ts:15-55`、`useWerewolfActionDraft.ts:53-108`                  | `pickTwoSeats` + `useScopedDraft`                                                       |
| `witch`：先弹信息框（被刀座位、药水状态）；救只走按钮且仅 `canSave`；毒走点座 + 确认；不能自救显示 `cannotSavePrompt`；"都不用"= `skip`；无通用跳过                | `useRoomActions.ts:208-258`、`promptExecutor.ts:37-44`                               | `witch` kind 全字段                                                                     |
| `multiChooseSeat`：toggle；满额再点无效；确认按钮文案带 `{count}`；0 选不可确认；选集跨刷新恢复；成功清草稿                                                        | `multiSelectExecutor.ts:15-58`                                                       | `multiSelect` + `useScopedDraft`                                                        |
| `confirm`：猎人 / 黑狼王能否开枪文案、复仇者阵营、隐狼队友座位 `{seats}`、种狼感染目标（可跳过）；点座无效                                                         | `promptExecutor.ts:73-157`                                                           | `confirmStatus` kind                                                                    |
| `chooseCard`：弹底牌 modal；空牌 disabled + 原因；盗贼有狼牌时非狼牌 disabled 并说明；宝藏大师狼牌 disabled 并说明；选牌需确认；作用域变化重置 modal               | `useWerewolfRoomScreenState.ts:431-443,969-1004`、`ChooseBottomCardModal.tsx`        | `chooseCard` kind；**可选性与说明由引擎 `night.chooseCard` 投影给出**（现为客户端重算） |
| `groupConfirm`：四种 reveal 各自标题 / 正文模板（含 `{seats}`、情侣对座）；确认发 ack；host 可一键标记全部机器人已确认                                             | `groupConfirmExecutor.ts:18-92`                                                      | `ackGroupReveal`；host 动作在 adapter HostManagement                                    |
| 查验结果确认：标题 `revealTitlePrefix：N号是结果`；刷新后重入只弹一次（claim guard）；结果未到不消耗 claim；只有记录的行动者座位才有                               | `revealExecutor.ts`、`presentRevealAckDialog.ts:55-137`、`pendingRevealAck.ts:35-60` | `ackReveal`；推导进引擎 `night.pendingReveal`                                           |
| 机器狼学到猎人：状态门 → 能否开枪文案 → ack；未看前提示语走猎人门模板                                                                                              | `wolfRobotExecutor.ts:18-57`、`useRoomDerived.ts:145-154`                            | `ackHunterStatus`                                                                       |
| 提交单飞：进行中再提交 throw；底栏按钮 disabled "行动正在确认中"                                                                                                   | `useActionOrchestrator.ts:190-214`、`werewolfRoomAdapter.ts:267-276`                 | 平台 `submit` 单飞 + `RoomBottomActions.disabledReason`                                 |
| 拒绝定向：只对本人 / 接管座位的 `actionRejected` 弹 alert；按 `rejectionId` 去重                                                                                   | `useActionOrchestrator.ts:237-262`                                                   | 引擎 `night.rejectionForViewer`（§6.1，`targetSeat`）                                   |
| 噩梦封锁不预判，提交后按服务端拒绝提示                                                                                                                             | `useRoomActions.ts:434-438`                                                          | 不变                                                                                    |
| 座位约束（不能选自己 / 空座）只对行动者显示；`wolfRobotLearn` 已学完后不再显示约束                                                                                 | `useRoomDerived.ts:80-107`                                                           | `viewModel.seats[].disabledReason`                                                      |
| 网络错误 toast 并保留对话框可重试；业务拒绝用 toast，网络失败用 alert                                                                                              | `useActionOrchestrator.ts:202-209`、`useWerewolfGameActions.ts:46-77`                | 平台 `handleError` 口径不变                                                             |

**门控（§3 原则 6）**

| 行为                                                                                  | 来源                                                                  | 保留方式                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 播报中：座位 / 底栏 / 主持面板 disabled 显示 `语音播报中，请稍候`；离房与查看身份豁免 | `RoomInteractionPolicy.ts:38-59`、平台 `audioPlaybackLock`            | `blocked` + 平台 `exemptActionKeys`                                                         |
| 上一步 ack 未落：除离房外全部屏蔽；toast `正在确认上一步，请稍候` 节流                | `RoomInteractionPolicy.ts:62-78`、`useInteractionDispatcher.ts:50-64` | `blocked` reason；toast 节流进 `werewolfInteractionPolicy`                                  |
| rejoin 恢复覆盖层可见 / 命令恢复中：抑制自动提示与 reveal 重入                        | `useActionOrchestrator.ts:322-337,393-411`                            | `autoShow` 抑制条件                                                                         |
| 非 Ongoing 状态点座走入座 / 资料回落；Day 点座无效                                    | `SeatTapPolicy.ts:91-133`                                             | 共享 `createRoomSeatPressHandler`                                                           |
| Ongoing / Day 不能看资料卡；Ongoing / Day 隐藏等级与装饰                              | `werewolfRoomAdapter.ts:91-96,328-332`                                | adapter capabilities + `createRoomSeatDataSource` 已有 `isLobby` 口径扩为 `showDecorations` |

**座位盘与底栏**

| 行为                                                                                                               | 来源                                                                | 保留方式                                                   |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------- |
| 高亮：接管座 / 选中座 / 狼队（danger）三种                                                                         | `werewolfRoomAdapter.ts:134-143`                                    | `resolveHighlight`                                         |
| 本座角色名；host 看机器人角色名；预言家编号标签（`seerLabelMap`）；伪装角色 `displayAs`                            | `werewolfRoomAdapter.ts:153-218`                                    | `resolveSecondaryLabel` 读 `visibleRole`（§6.1 host 视角） |
| 徽章优先级：警长 > 上警 / PK / 退水 > 狼已投票；已看 / 群确认 ready 徽章（与狼投票徽章互斥）                       | `werewolfRoomAdapter.ts:108-159`、`werewolfRoom.helpers.ts:415-420` | `resolveStatusBadge` / `resolveShowReadyBadge`             |
| 夜间进度条：仅 `inStep` 显示；标签用 `displayAs` 与预言家编号                                                      | `werewolfRoomAdapter.ts:195-248`                                    | `deriveWerewolfBottomProgress(viewModel)`                  |
| 底栏：Ongoing 非行动者显示"等待 N 号行动"；Day 换警长 dock；Ended 换收尾堆叠布局；播报中参与者消息折叠为 null      | `werewolfRoomAdapter.ts:445-484`                                    | `createWerewolfBottomActions`                              |
| 引导语：Unseated/Seated 等人坐满；Assigned 未看身份提示按钮、全看完消失、无座旁观者等待；Ready 等房主；host 无引导 | `werewolfGuideMessage.ts:18-46`                                     | 搬，输入 `viewModel`                                       |
| 板子信息分狼 / 神 / 特殊 / 村民，普通村民合成 `村民 ×N`；点角色芯片开技能卡；Ongoing/Day/Ended 折叠                | `werewolfRoomAdapter.ts:551-564`、`WerewolfRoomScreen.tsx:233-243`  | `createWerewolfBoardInfoSections`                          |

**主持台与白天流程**

| 行为                                                                                                                                                                                                                                                                       | 来源                                                                           | 保留方式                                             |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 分配身份：坐满才可用，disabled 显示缺座原因；确认框说明洗牌分发                                                                                                                                                                                                            | `createWerewolfHostManagement.ts:116-138`、`useWerewolfHostControl.ts:61-72`   | adapter HostManagement + 平台 `HOST_FLOW_CONFIRM`    |
| 开始游戏：全员看完身份才可用，disabled 显示进度；确认框提醒音量最大；瘟疫模式 Ready 不显示开始；独立 `isStartingGame` 状态                                                                                                                                                 | `createWerewolfHostManagement.ts:139-205`、`useWerewolfHostControl.ts:74-86`   | 同上                                                 |
| 中止：确认框说明保留座位清身份；中止 / 返回大厅 / 再来一局前停止已预载音频                                                                                                                                                                                                 | `useWerewolfHostControl.ts:88-106`、`WerewolfGameClientRuntime.ts:155-185`     | adapter + 音频 hook                                  |
| Ended：MVP（已选后 disabled）/ 再来一局 / 返回大厅；后两者先弹"分享战报"仪式（分享 / 取消 / 继续）                                                                                                                                                                         | `createWerewolfHostManagement.ts:162-181`、`useWerewolfHostControl.ts:112-140` | adapter HostManagement                               |
| 白天 / 终局 host 任务流：昨夜信息 → 警长竞选 → 本局复盘 → 分享给至少一座 → 收尾；完成 / 当前 / 待办三态；进度按 room/user/nonce 持久化                                                                                                                                     | `panelFlow.ts`、`panelFlowProgressStore.ts`                                    | `day/panelFlow.ts` 搬；持久化走平台 `useScopedDraft` |
| 昨夜信息：确认框 → 乌鸦诅咒单独弹框 → 标记流程步完成                                                                                                                                                                                                                       | `useRoomModals.ts:295-324`                                                     | `day/`                                               |
| 复盘入口：未终局先警告"可能影响警长竞选"；host 菜单 自己看 / 授权玩家 / 分享战报；被授权玩家可分享；未授权只能看；捕获进度显示在按钮文案；失败保留菜单                                                                                                                     | `useRoomModals.ts:150-278`                                                     | review-share 设计承接，行为不变                      |
| 分享授权：多选座位，预填已授权并过滤失效座；提交中禁止重复                                                                                                                                                                                                                 | `ShareReviewModal.tsx:47-153`                                                  | 保留组件                                             |
| MVP：仅 Ended 且未选；单飞；候选为开局真人，离房者标 `已离房`；显示金抽数与"仅注册账号可领奖"；<6 真人无奖励；一次性不可改                                                                                                                                                 | `useRoomHostDialogs.ts:71-119`、`MvpSelectionModal.tsx`                        | 保留组件 + adapter                                   |
| 警长竞选全套：报名 / 取消 / 退水 / 投票 / 弃票 / 改票文案三态；关闭报名需确认；自爆需确认并说明不追踪爆数；投票轮靠倒计时结算无 host 推进；报名期隐藏候选身份；HUD / 面板 / 只读记录 / 报告段；宽屏侧栏、窄屏底部抽屉；命令进行中全部 disabled；播报中 disabled 显示锁原因 | `useSheriffElection.ts`、`sheriffElection*.ts`、`SheriffElection*.tsx`         | `day/` 三个纯模型搬 + 组件保留                       |
| 板子提名：按赞数排序；一次只展开一张、首张默认展开；点赞 / 取消；本人可撤回；host 可采纳（人数不符先清座）；空态文案                                                                                                                                                       | `BoardNominationList.tsx`                                                      | 保留组件                                             |

**身份、音频、会话**

| 行为                                                                                                                         | 来源                                                                           | 保留方式                                 |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------- |
| 查看身份：先发命令显示 `正在确认身份…`，确认后弹卡；首看播动画、再看静态；接管机器人不播动画；被拒不弹；用本人装备的揭示动效 | `useInteractionDispatcher.ts:245-285`、`useWerewolfRoomScreenState.ts:151-164` | 平台 `useRoleViewing`（§5.3）            |
| 身份卡：头像预载；AI 问角色入口；`seerLabelMap`；动画拿完整公开角色池                                                        | `WerewolfRoleCardModal.tsx`                                                    | 保留组件                                 |
| BGM：Ongoing 自动起、Ended 停、天亮播报前停；rejoin 后在手势上下文恢复；设置持久化                                           | `useWerewolfBgmControl.ts`                                                     | 搬                                       |
| rejoin：host 见"游戏已恢复 点击继续"覆盖层；继续后重播当前步并 ack 中断批次、链式续播                                        | `useWerewolfRoom.ts:167-236`、`WerewolfAudioOrchestrator.ts`                   | 平台 `RoomAudioResumeDialog` + 音频 hook |
| 被动 toast：非 host 收到被踢 / 清座 / 分身份 / 入夜 / 天亮 / 重开等 host 动作提示                                            | `useWerewolfLastActionToast.ts`                                                | 平台 `useLastActionToast`（§5.3）        |
| 板子提名去重：重复建议提示并自动计为点赞                                                                                     | `useWerewolfGameActions.ts:333-337`                                            | adapter                                  |
| 记事本（按 room/user/round 持久化，换局过期）、AI 聊天（消息与气泡位置持久化、全局浮层、离开 setup 后脉冲）、账号统计段      | `services/*`、`components/*`                                                   | 不动，只换 `client → session`            |

**持久化作用域（平台 `useScopedDraft` 统一）**

| 项           | 作用域键                                                          | 过期规则          |
| ------------ | ----------------------------------------------------------------- | ----------------- |
| 夜间草稿     | `user, room, stepId, actorSeat, roleRevealRandomNonce, seatCount` | 任一变化即清      |
| 面板流程进度 | `room, user, roleRevealRandomNonce`                               | 换 nonce 即新分区 |
| 记事本       | `user, room, roundId`                                             | 换 round 视为过期 |

**TESTIDS 契约**：清查列出的 55 个键全部保留；`MvpSelectionModal` 的裸字符串 `mvp-selection-modal` 入 `TESTIDS`。

## 7. 六家收敛

| 游戏                                                | 改动                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 全部七家                                            | 接管四件套 → `useBotTakeover`；守卫 + submit → `useReadyRoomSession`；adapter 删 `lockedSeatReason` / `outOfRangeError` 字面量                                                             |
| demo / drawguess / storyrelay / undercover / avalon | adapter 两处 bot id 字面量删除（共享工厂不再收 `botUserId`）                                                                                                                               |
| pictionary / fibking                                | 引擎 `getPictionaryBotUserId` / `getFibBotUserId` 删除                                                                                                                                     |
| pictionary / fibking                                | `useRoomRosterController + createControlledSeatModel + createRoomProfileCardModel + createRoomSeatConfirmationModel` → `useRoomSetupController + createRoomSeatPressHandler`，与 demo 同构 |
| avalon                                              | `seatPickHandlerRef` 删除，改传 `createRoomSeatPressHandler.inGameAction`                                                                                                                  |
| storyrelay / pictionary                             | `useStoryRelayImageShare` / `PictionaryAlbumExport` 的 share 块 → `useShareImageAction`（最终形态由 review-share 设计接管）                                                                |
| drawguess                                           | `useDrawGuessNowMs` 删除，读 `useStageDeadline` 返回的 `nowMs`；`DrawGuessDrawingCanvasProps` → `DrawingCanvasGameProps`；testID 入 `TESTIDS`                                              |
| pictionary                                          | `PictionaryDrawingCanvasProps` → `DrawingCanvasGameProps`                                                                                                                                  |
| undercover                                          | 角色名表单源：引擎 `UNDERCOVER_ROLE_NAMES` 导出，三处改引用                                                                                                                                |

## 8. 完成后登记的合法分歧

写进 `src/games/__tests__/gameClientShape.contract.test.ts`（新建，穷举 `GAME_TYPES`）：

1. 每家 `module.ts` 必须通过 `defineClientGameModule`（源码断言不得 `import` `RoomLinkFactory`）。
2. 每家 `room/hooks/use*RoomState.ts` 必须调用 `useReadyRoomSession` 与 `useBotTakeover`，不得直接调用 `useRoomBotControl` / `useBotTakeoverGuard` / `useBotTakeoverLongPress` / `useRoomLinkSnapshot`。
3. 机器人是纯平台概念：`src/games/**` 与 `packages/game-engine/src/games/**` 不得出现 bot id 合成（`bot-` / `-bot:` 字面量或 `*BotUserId` 函数）；共享层 `RoomSeatPlayer` / `RoomProfileTarget` 的 bot 分支无 `userId` 字段。
4. 游戏自有纯交互策略合法（阿瓦隆 `avalonInteractionPolicy.ts`、狼人杀 `werewolfInteractionPolicy.ts`）；禁止的是客户端重算引擎规则——断言 `src/games/**/policy/**` 与 `room/night/**` 只读 `viewModel` / `state` 字段，不 import `packages/game-engine/.../domain/handlers` 或 `DeathCalculator` 等规则模块。狼人杀允许额外存在 `room/executors/`；任何游戏不得存在 `room/seatTap/`。
5. 任何游戏的 `useStageDeadline` 调用参数里不得出现 `isHost`（到期是服务端事实，客户端只加速）；`src/games/**` 不得直接调用 `setInterval`。

## 9. 实施顺序

前三步是引擎 / Worker / 平台前置，不改狼人杀客户端行为；第 4 步是狼人杀房间整体重建（一个 PR，内部可多 commit，但旧树与新树不并存合入）；之后六家与契约。每步 `pnpm exec tsc --noEmit` + 受影响测试；第 4、5、7 步后跑 `pnpm run e2e`。

| #   | 范围                     | 内容                                                                                                                                                                                                                                                                                                                                                                      | 前置    |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | engine + worker          | §6.1 投影扩展（`template` / `night.actionSchema` / `currentActionRole` / `isActioner` / `recordedActions` / `pendingReveal` / `rejectionForViewer` / `wolfVote` / `witchContext` / `wolfRobotReveal` / `chooseCard` / `seats[].disabledReason` / host 视角 `visibleRole`）+ `actionRejected.targetSeat` + `gameEnded` 参与者判别联合 + Worker 结算指纹只算 human + golden | —       |
| 2   | engine                   | §6.3 `getWerewolfNightReview` + 经真实转移构造的测试                                                                                                                                                                                                                                                                                                                      | 1       |
| 3   | engine + worker + client | §6.2 `phase.expire` / `phase.settleExpired` + `settle.due` 效果派生 + Worker 注册 + 变体契约；`progress.request` 删除，现有 `useStepDeadlineCountdown` 同 commit 改发带 pin 的 `phase.expire`                                                                                                                                                                             | —       |
| 4   | features/room            | §5.1 四个新 hook + §5.2 修改（含 `inGameAction`、`defineClientGameModule.extras`）；无消费者接入                                                                                                                                                                                                                                                                          | —       |
| 5   | werewolf                 | §6.4–6.8 整体重建：新树写完、搬运清单搬入、删除清单整体删除、`module.ts` 改 `defineClientGameModule`、34 个 `LocalGameState` 测试删除或改 `GameState` fixture；16 个 e2e 全绿为合入门槛                                                                                                                                                                                   | 1,2,3,4 |
| 6   | six games                | §7 全部                                                                                                                                                                                                                                                                                                                                                                   | 4       |
| 7   | contracts                | §8 契约测试；删除共享层头注释里的全部"werewolf divergence"登记；`docs/roomscreen-state-machine.md` 按 `NightInteractionModel` 重写                                                                                                                                                                                                                                        | 5,6     |

## 10. 测试与验收

- **引擎**：`getWerewolfViewModel` golden 新字段与 host 视角；`isActioner` 承接 `determineActionerState` 现有测试（输入改 `GameState`）；`getWerewolfNightReview` 承接 `NightReview.helpers` 现有测试（经真实引擎转移构造）；`phaseDeadlineVariants.contract.test.ts` werewolf 变体；Worker `settleDue` 投递、pin 不符丢弃、与客户端 `phase.expire` 同时到达只落一次。
- **共享层**：`useBotTakeover`（守卫释放、capability 翻转、长按拒绝原因）、`useReadyRoomSession`（非 ready throw、submit 透传 controlledSeat）、`useShareImageAction`（shared / cancelled / failed）、`useStageDeadline` 返回 `nowMs`、`createRoomSeatPressHandler.inGameAction` 消费 / 回落。
- **狼人杀 `night/`**：表驱动——13 个 model kind × 行动者 / 非行动者 × 草稿状态 × 锁状态 → `NightInteractionModel`；`buildNightCommand` 对每个 kind 产出正确 `WerewolfActionInput` / ack 命令；刷新重入（草稿恢复、`pendingReveal` 只弹一次）；拒绝按 `rejectionId` 去重；自动提示去重与抑制条件；§6.9 每行至少一个断言。
- **狼人杀 UI**：5 个 `*.ui.test.tsx` 与 `verticalSlice.integration.ui.test.tsx` 断言不变、构造改 `GameState`；`shellModelAssembly.characterization` 重新基线（新 adapter）。音频 hook：Room 卸载、push 子屏返回、重连、link 释放、重进同房。
- **E2E**：16 个 werewolf spec + `room-narration` + `resilience-*` 全绿（testID 契约不变）；新增 `werewolf-night-kill.spec.ts` 用例"host 页面置后台后狼投票 5 秒由服务端结算，下一段播报等 host 回前台"。
- **人工**：小程序端身份卡查看、接管机器人查看、分享取消三条路径。

## 11. 决策记录

| #   | 事项                             | 决定                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | `getActorIdentity` 的 drift 分支 | 删除。两个输入来自同一个 `useRoomBotControl` 状态，按构造不可达；软失败 `{null,null}` 违反 fail-fast                                                                                                                                                                                                                                                                                            |
| D2  | 阶段到期结算归属（§6.2）         | A：时钟归服务端（`settle.due`），播报归 host（`audio.ack`），与阿瓦隆同款。曾一度改为 B（host 客户端 `shouldExpire: () => isHost`），复核后否决：B 把本该在服务端的时钟留在 host 手机上；host 对每段播报的控制在 A 里一分不少                                                                                                                                                                   |
| D3  | 复盘事实迁引擎（§6.3）           | 做。读侧调引擎既有 `computeCanShootForSeat`，不重算；`deathSources` 持久化撤回（实现时发现无需求）                                                                                                                                                                                                                                                                                              |
| D4  | 身份查看协议                     | **以狼人杀为基准**：先确认后弹卡，六家跟上（§5.3 `useRoleViewing`）。v2/v3 曾写"狼人杀改为六家的先弹卡"，因把六家当基准而否决                                                                                                                                                                                                                                                                   |
| D5  | `WerewolfGameClient` 门面        | 删除。命令内联经 `submit`；AI 聊天 / 记事本 / 图鉴 / AppOverlay 改吃 `session`                                                                                                                                                                                                                                                                                                                  |
| D6  | 房间交互层                       | **重建而非改造**（v3）。`executors/` + `useActionOrchestrator` + `useInteractionDispatcher` + `useRoomActions` + policy 两层 + 底栏三件（~4,400 行命令式链）→ `night/` 声明式 `NightInteractionModel`（~1,200 行纯函数）。v2 曾决定保留 `executors/`，因它是旧架构的形状而否决                                                                                                                  |
| D7  | 实施顺序 engine 先行             | §9 第 1–3 步只新增纯函数 / 效果与 golden 测试，不改客户端行为，可先合入                                                                                                                                                                                                                                                                                                                         |
| D8  | 行动身份两个事实                 | `actorRole`（raw）与 `actorEffectiveRole`（底牌派生）并存；新模型只读 `isActioner` + `actionSchema`，现有"raw 当派生用"的分支消失                                                                                                                                                                                                                                                               |
| D9  | 机器人身份                       | **机器人不需要 userId**。平台 roster 已是 `{ seat, kind: 'bot' }`；假 id 只为满足 `userId: string`，是类型不诚实。共享类型改判别联合；狼人杀 `actionRejected.targetUserId → targetSeat`、`gameEnded` 参与者判别联合、结算指纹只算 human（随 v14 硬切）。部署瞬间已投递未 ack 的 `gameEnded` 重放会 FAIL-FAST，走 outbox-recovery runbook。v2 曾决定"格式各自保留只迁定义"，因回答错了问题而否决 |
| D10 | 交互预先禁用                     | 预先禁用是平台数据（`audioPlaybackLock` / `RoomCapability`），不是"预判"；狼人杀 `NightInteractionModel.blocked` 与六家同口径。v3 曾写"删预判，等服务端拒绝再 toast"，因平台本就有该机制且狼人杀体验更好而否决。pending ack 排他、host-only 对话框保留为 `werewolfInteractionPolicy.ts`                                                                                                         |
| D11 | 复盘事实投影方式                 | 同 D3。否决的是"读侧重跑结算函数"；复用步进共用的 `computeCanShootForSeat` 不是重跑结算，不违背单一事实                                                                                                                                                                                                                                                                                         |
| D12 | 音频编排宿主                     | 与阿瓦隆同：room-state hook 按 `session.epoch` 重建。Room 卸载 ⇒ `useRoomEntryController` cleanup `link.close()`，hook 与 ready link 同生命周期是结构保证，不是前提                                                                                                                                                                                                                             |
| D13 | 引擎承接行动者判定               | `determineActionerState` 的规则部分进引擎 `visibility.ts` 为 `night.isActioner`；客户端不再算"我是不是行动者"                                                                                                                                                                                                                                                                                   |
| D15 | §9 第 3 步过渡编辑               | 第 3 步改旧 `useStepDeadlineCountdown` 发带 pin 的 `phase.expire`，第 5 步整文件删除。接受这 ~10 行一次性改动，换每个 commit 端到端完整（引擎命令有消费者、无死代码）；不接受在引擎里暂留 `progress.request` 两路并存                                                                                                                                                                           |
| D16 | 行为基准                         | 架构向平台看齐，行为向狼人杀看齐。§5.3 四项从狼人杀提升为平台行为；后续发现的六家行为缺口按同一规则处理                                                                                                                                                                                                                                                                                         |
| D14 | 底栏走共享契约                   | `bottomLayoutConfig` / `resolveBottomLayout` / `bottomActionBuilder` 的规则表搬成 `createWerewolfBottomActions(viewModel, model)` 产出 `RoomBottomActions`，与六家同契约                                                                                                                                                                                                                        |

## 12. 修订记录

### v1 → v2（对抗评审，13 条全部核实成立）

| #   | 级别    | v1 错误                                                                 | v2 修正                                                                                                 |
| --- | ------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1   | BLOCKER | "`settle.due` 走已有 `progress.request` 路径"——该命令 host-only、无 pin | §6.2：新建 `phase.expire` / `phase.settleExpired` 带完整 pin；`progress.request` 删除                   |
| 2   | BLOCKER | "reducer 写 deadline 时同步发效果"——reducer 纯函数，引擎无效果管线      | §6.2：handler 结果加必填 `effects`，装弹现场显式返回（v2 曾写"从事件流派生"，v3 自审否决）              |
| 3   | MAJOR   | "每次推进都有音频门挡重复"——警长结算无音频                              | §6.2：pin 为唯一防线                                                                                    |
| 4   | MAJOR   | `effectiveRole` 收成一个 `actorRole`——raw 与底牌派生是两个事实          | §6.8 / D8                                                                                               |
| 5   | MAJOR   | `LocalPlayer` 只读 5 个字段——实读 11 个；host 看机器人底牌需投影        | §6.1：资料走 roster；`visibleRole` 加 host 视角                                                         |
| 6   | MAJOR   | 验收提"死亡标记"——当前实现不渲染                                        | 范围 = 复现当前输出                                                                                     |
| 7   | MAJOR   | "读 `deathReasons` 即可"——只持久化主因                                  | §6.3 / D11：复盘迁引擎，开枪资格复用引擎 `computeCanShootForSeat`（`deathSources` 持久化在实现时撤回）  |
| 8   | MAJOR   | 音频 hook 生命周期未论证                                                | §6.6 / D12：Room 卸载 ⇒ link 关闭是结构保证（v2 曾写"前提 + 必测"，v3 自审改为结构论证）                |
| 9   | MAJOR   | 整删 `RoomInteractionPolicy`——它还管 pending ack / 资料 / 对话框路由    | D10                                                                                                     |
| 10  | MAJOR   | 契约"禁止 `policy/` 目录"——阿瓦隆就有                                   | §8 契约 4                                                                                               |
| 11  | MAJOR   | 狼人杀 bot id 改格式——引擎与 D1 指纹已用 `bot-${seat}`                  | v2：格式不变只迁定义；v3 再改：删除 bot userId 概念本身（D9），`targetSeat` + 判别联合 + 指纹只算 human |
| 12  | MINOR   | "六家统一先弹卡"——fibking 不是                                          | §6.8                                                                                                    |
| 13  | MINOR   | `status` 枚举转换是风险                                                 | 恒等函数，直接读                                                                                        |

### v2 → v3（重建而非改造 + 对 v2 修正的自审）

v2 是对现有文件的 diff 清单：狼人杀 32.5k 行里删 ~3.5k，其余 29k "保留，输入改为 …"。被保留的房间交互链（intent → orchestrator → executors → dialogs → actions，12 个 hook、12 个执行器、3 层 policy）本身就是旧架构的形状，六家没有对应物。v3 §6 改为：目标文件树从零定义、`NightInteractionModel` 声明式契约、搬运清单（纯数据 / 纯函数）、删除清单（整目录）。删 ≈ 12.5k，新写 ≈ 3.5k。

v2 的 13 条修正自审：#2（事件流派生效果）、#7（读时重算死亡）为走捷径，#8（挂载前提 + 测试）为用假设代替结构，#4（逐个审计执行器）为逐点打补丁；v3 分别改为显式效果、持久化裁决 + 版本硬切、结构论证、模型消除分支。其余 9 条复核无误。

### v3 行为基准修订

v3 初稿默认"六家是基准、狼人杀向六家看齐"，把两处狼人杀更好的行为改坏（查看身份乐观弹卡、交互门控改等服务端拒绝）。修订为"架构向平台看齐，行为向狼人杀看齐"（§2.1 目标 6、§3 原则 6、§5.3、D4 / D10 / D16）。

### v3 行为清查修订

四份逐文件清查（§6.9 来源）补齐 v3 初稿遗漏：草稿跨刷新、查验结果 ack 刷新重入、自动弹一次提示、提交单飞、拒绝定向去重、音频锁豁免、ack 未落排他、底牌可选性规则（客户端重算 → 引擎投影）、被动 toast、BGM 生命周期、host 任务流持久化。`NightInteractionModel` 从 9 kind 扩为 13 kind；§6.1 投影补 6 个字段；§5.1 补 `useScopedDraft` / `useLastActionToast`；§5.3 补 4 项。

### v3 实施修订（步骤 1–5）

- 步骤 1：状态版本落为 **v15**（v14 已被占用），`migratePersistedWerewolfState` 迁 v12–14；`recordedActions` 投影字段无消费者，删除。
- 步骤 2：`deathSources` 持久化撤回（§6.3 / D3 / D11）；`speakingInstruction` → `speakingOrder` 结构化；`sheriffElectionRecord` 与复盘测试随事实层迁入引擎。
- 步骤 4：`useNowMs(intervalMs, isActive)` 带激活门——无倒计时的房间（大厅）不每秒重渲染，`useStageDeadline` 以 `deadlineAt !== null` 激活并返回 `{ remainingSeconds, nowMs }`；drawguess 自建 ticker 删除。`shareImagesBase64` 返回 `'shared' | 'cancelled'`，取消判定只有 Web Share `AbortError`——`expo-sharing@56` 的 `shareAsync` 对关闭与完成一律 resolve void，原稿「expo-sharing dismiss 结果」不存在，撤回。`useRoleViewing` 冻结的 `remainingCards` 取**确认前**记录（自己的牌仍在桌上），不是原稿的「确认后排除本座位」——`CardPick` 的桌面牌数语义要求本人的牌在场。`useLastActionToast` 按**命令类型**匹配（`lastCommand.type` 是命令类型，狼人杀原 hook 匹配 `KICK_PLAYER` 等 action 名从未命中，是死代码）；「天亮了」类状态迁移提示不走此 hook。`RoomOccupant` 落地：`RoomSeatPlayer.occupant` / `RoomProfileTarget.occupant`，bot 头像种子 `bot:<seat>`，`createRoomProfileTargetResolver` 删除（各家直接 `getRoomProfileTarget(state.roster, seat)`），`useUserProfileQuery` 接受 `null`。`useScopedDraft` 的存储访问放 `services/scopedDraftStore.ts`（架构契约：直接存储访问只在 services / platform）。`RoomAudioResumeDialog` 只在 `onClose` 绑一次 continue（狼人杀原实现按钮与 onClose 双绑，continue 跑两次）。new-game 生成器模板同步。
- 步骤 3：到期命令无 payload（同阿瓦隆，pin 只在效果上）；新增 `GameState.gameSequence`，状态 v16；`handleProgressionRequest` 删除，hand-built "exhausted" 测试状态改经音频 ack 触发收夜（线上 exhausted 态只会停在音频/确认门后）。
- 步骤 5（狼人杀房间重做）：
  - 投影补字段：`pendingReveal` 带 `targetSeat / result / resultFormat / titlePrefix`（查验结果对话框文案不再由客户端读 `seerReveal` 等原始字段拼出）；`wolfVote` 带 `voterSeats`（参与投票的狼座位，底牌排除已算入）与 `immuneSeats`（袭击免疫座位，确认对话框附注用）。
  - `NightInteractionModel` 的 `ackGroupReveal` 多一个 `prompt`（进入步骤的自动提示用 schema prompt，个性化文案只在确认对话框里）；底栏文案统一为 schema `ui.prompt`（狼投票追加状态行与警告），与旧 `useRoomDerived.actionMessage` 口径一致。
  - 命令全部经平台 `useReadyRoomSession.submit`；新增 `RoomCommandSubmitOptions.domainRejection: 'alert' | 'state'`——狼人杀夜间行动的业务拒绝由引擎 `commitDomainRejection` 落进状态（`night.rejection`），客户端按 `rejectionId` 去重后弹「操作失败」，提交路径不再重复弹；pre-commit 拒绝与网络失败仍由 submit 弹。`ReadyRoomSession` 暴露 `lastCommand` 给 `useLastActionToast`。
  - `useSheriffElection` 改收 `{ gameState, effectiveSeat, isHost, submit }` 自建命令；`useRoomModals` 保留复盘入口 / 昨夜信息两条流（身份卡与技能预览已移出）；`createWerewolfHostManagement` 保留。
  - 复盘子系统（`NightReview*` / `ShareProgressModal` / `useNightReviewShare` / `shareNightReview.ts` / `nightReviewLayout.ts`）**保留**，不按 §6.7 删除：`docs/game-review-share-design.md` 尚未实施，`review/toWerewolfReviewDocument.ts` 随该设计再做。
  - `defineClientGameModule.GuideScreen` 改为 session 绑定组件（狼人杀百科读房间状态高亮板子）；狼人杀 `config` 返回自有的嵌套配置流（板子选择 → 角色 → 规则），不走 schema 配置屏。`WerewolfRoomAccountCapability` 删除，由 `createLinkRoomAccountCapability` 统一生成。
  - 噩梦封锁：引擎在进入被封锁者步骤时已下发 `blocked_by_nightmare` 提示（`bottomAction: 'skipOnly'` + 提示覆盖），客户端据此只渲染跳过按钮，座位点击不再开确认；旧测试「被封锁者点座位弹确认」依赖的是没有提示的拼装状态，线上不存在。§6.9 第 379 行的「不预判」指客户端不自算封锁，保持。
  - 板子 UI 测试 harness 重写为「真 `GameState` + `createFakeRoomLink`」：`createWerewolfRoomMock(options)` 写出权威状态（含引擎 `maybeCreateUiHintAction` 的步骤提示、confirm 步骤默认 `confirmStatus`），视图模型与对话框全部走真投影；`buildMockWerewolfViewModel` 与 `mockShapeContract` / `mockViewModelCrossCheck` 两份"看守手写镜像"的契约随之删除。32 个板子文件只改 `jest.mock` 目标与断言对象（`mock.dispatch` / `mock.submitAction`）。
  - 底牌选择弹窗改吃引擎 `BottomCardChoice`（每张牌自带 `isSelectable / reason`）；`BoardNominationModal` 不再持有 client，采纳由房间状态 hook 的 `boardNominations.adopt` 执行（人数变化先清座再 `config.update`）。
  - `botDispatchDiscipline` 契约新增 `shared-ready-session-submit` 形态（漏斗在平台 `useReadyRoomSession`，`controlledSeat` 默认 null）；狼人杀是第一家登记者。
