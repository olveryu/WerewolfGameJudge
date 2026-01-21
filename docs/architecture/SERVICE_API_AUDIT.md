# WerewolfGameJudge 服务层 API 全面审计报告

> 审计日期: 2026-01-20
> 分支: refactor/state-manager-extraction
> 总行数: 8266行 (34个服务文件，不含测试和index)

---

## 目录

1. [服务文件清单与行数统计](#1-服务文件清单与行数统计)
2. [所有服务的 API 列表](#2-所有服务的-api-列表)
3. [重复/相似 API 分析](#3-重复相似-api-分析)
4. [调用链分析](#4-调用链分析)
5. [问题汇总与建议](#5-问题汇总与建议)

---

## 1. 服务文件清单与行数统计

### 1.1 主服务文件 (8个核心服务)

| 文件                                | 行数     | 职责描述                 |
| ----------------------------------- | -------- | ------------------------ |
| `GameStateService.ts`               | 795      | 门面服务，协调所有子服务 |
| `host/HostCoordinator.ts`           | 892      | Host端游戏逻辑协调器     |
| `state/StateManager.ts`             | 794      | 状态管理单一真相源       |
| `seat/SeatManager.ts`               | 583      | 座位管理                 |
| `night/NightFlowService.ts`         | 564      | 夜晚流程高层服务         |
| `broadcast/BroadcastCoordinator.ts` | 559      | 广播消息协调器           |
| `action/ActionProcessor.ts`         | 533      | 行动处理与验证           |
| `player/PlayerCoordinator.ts`       | 458      | Player端逻辑协调器       |
| **小计**                            | **5178** |                          |

### 1.2 底层/基础设施服务 (8个)

| 文件                              | 行数     | 职责描述         |
| --------------------------------- | -------- | ---------------- |
| `BroadcastService.ts`             | 432      | 底层Supabase通信 |
| `DeathCalculator.ts`              | 348      | 死亡计算纯函数   |
| `NightFlowController.ts`          | 302      | 夜晚流程状态机   |
| `persistence/StatePersistence.ts` | 264      | 状态持久化       |
| `AuthService.ts`                  | 260      | 认证服务         |
| `AudioService.ts`                 | 234      | 音频播放         |
| `SimplifiedRoomService.ts`        | 197      | 房间管理         |
| `AvatarUploadService.ts`          | 112      | 头像上传         |
| **小计**                          | **2149** |                  |

### 1.3 独立工具服务 (2个)

| 文件                       | 行数    | 职责描述         |
| -------------------------- | ------- | ---------------- |
| `night/resolvers/types.ts` | 145     | Resolver类型定义 |
| `WolfVoteResolver.ts`      | 58      | 狼人投票结果计算 |
| **小计**                   | **203** |                  |

### 1.4 夜晚角色Resolvers (16个)

| 文件                                     | 行数    | 导出函数                      |
| ---------------------------------------- | ------- | ----------------------------- |
| `night/resolvers/witch.ts`               | 92      | `witchActionResolver`         |
| `night/resolvers/wolfVote.ts`            | 60      | `wolfVoteResolver`            |
| `night/resolvers/seer.ts`                | 58      | `seerCheckResolver`           |
| `night/resolvers/constraintValidator.ts` | 54      | `validateConstraints`         |
| `night/resolvers/wolfRobot.ts`           | 54      | `wolfRobotLearnResolver`      |
| `night/resolvers/gargoyle.ts`            | 51      | `gargoyleCheckResolver`       |
| `night/resolvers/psychic.ts`             | 51      | `psychicCheckResolver`        |
| `night/resolvers/nightmare.ts`           | 45      | `nightmareBlockResolver`      |
| `night/resolvers/magician.ts`            | 45      | `magicianSwapResolver`        |
| `night/resolvers/wolf.ts`                | 43      | `wolfKillResolver`            |
| `night/resolvers/slacker.ts`             | 41      | `slackerChooseIdolResolver`   |
| `night/resolvers/wolfQueen.ts`           | 41      | `wolfQueenCharmResolver`      |
| `night/resolvers/dreamcatcher.ts`        | 39      | `dreamcatcherDreamResolver`   |
| `night/resolvers/guard.ts`               | 30      | `guardProtectResolver`        |
| `night/resolvers/darkWolfKing.ts`        | 16      | `darkWolfKingConfirmResolver` |
| `night/resolvers/hunter.ts`              | 16      | `hunterConfirmResolver`       |
| **小计**                                 | **736** |                               |

---

## 2. 所有服务的 API 列表

### 2.1 GameStateService (795行)

**核心属性:**

```typescript
private state: LocalGameState | null
private isHost: boolean
private myUid: string | null
private mySeatNumber: number | null
private stateRevision: number
```

**公共方法 (22个):**

| 方法                                            | 行号 | 功能             | 委托目标                 |
| ----------------------------------------------- | ---- | ---------------- | ------------------------ |
| `getInstance()`                                 | 250  | 单例获取         | -                        |
| `clearSavedState(roomCode)`                     | 358  | 清除持久化状态   | StatePersistence         |
| `initializeAsHost(roomCode, hostUid, template)` | 369  | 作为Host初始化   | ⚠️ 与HostCoordinator重复 |
| `rejoinAsHost(roomCode, hostUid)`               | 433  | Host恢复连接     | ⚠️ 与HostCoordinator重复 |
| `joinAsPlayer(roomCode, playerUid, ...)`        | 504  | 作为Player加入   | BroadcastCoordinator     |
| `leaveRoom()`                                   | 531  | 离开房间         | BroadcastCoordinator     |
| `takeSeat(seat, displayName, avatarUrl)`        | 602  | 坐下             | SeatManager              |
| `leaveSeat()`                                   | 610  | 离开座位         | SeatManager              |
| `assignRoles()`                                 | 618  | 分配角色         | HostCoordinator          |
| `startGame()`                                   | 627  | 开始游戏         | HostCoordinator          |
| `restartGame()`                                 | 639  | 重新开始         | HostCoordinator          |
| `updateTemplate(newTemplate)`                   | 651  | 更新模板         | HostCoordinator          |
| `takeSeatWithAck(...)`                          | 672  | 坐下(带确认)     | SeatManager              |
| `leaveSeatWithAck(timeoutMs)`                   | 685  | 离开座位(带确认) | SeatManager              |
| `requestSnapshot(timeoutMs)`                    | 695  | 请求状态快照     | PlayerCoordinator        |
| `playerViewedRole()`                            | 710  | 标记已看角色     | PlayerCoordinator        |
| `submitAction(target, extra)`                   | 718  | 提交行动         | PlayerCoordinator        |
| `submitWolfVote(target)`                        | 726  | 提交狼人投票     | PlayerCoordinator        |
| `submitRevealAck(role)`                         | 734  | 确认揭示         | PlayerCoordinator        |

**私有方法 (4个):**

| 方法                       | 行号 | 功能                                |
| -------------------------- | ---- | ----------------------------------- |
| `notifyListeners()`        | 345  | 通知监听器                          |
| `handleHostBroadcast(msg)` | 584  | 处理Host广播                        |
| `broadcastState()`         | 759  | ⚠️ 广播状态 (与HostCoordinator重复) |

**测试钩子 (4个):**

| 方法                            | 行号 |
| ------------------------------- | ---- |
| `__testGetNightFlowService()`   | 306  |
| `__testGetHostCoordinator()`    | 310  |
| `__testInvokeCalculateDeaths()` | 329  |
| `__testSetMySeatNumber()`       | 338  |

---

### 2.2 HostCoordinator (892行)

**公共方法 (16个):**

| 方法                                               | 行号 | 功能           | 调用者                          |
| -------------------------------------------------- | ---- | -------------- | ------------------------------- |
| `initialize(roomCode, hostUid, template)`          | 114  | 初始化         | ⚠️ 从未被调用!                  |
| `rejoin(roomCode, hostUid)`                        | 178  | 恢复连接       | ⚠️ 从未被调用!                  |
| `handlePlayerMessage(msg, senderId)`               | 253  | 处理Player消息 | GameStateService                |
| `handlePlayerAction(seat, role, target, extra)`    | 314  | 处理玩家行动   | GameStateService (via callback) |
| `handleWolfVote(seat, target)`                     | 391  | 处理狼人投票   | GameStateService (via callback) |
| `handleRevealAck(seat, role, revision)`            | 442  | 处理揭示确认   | via handlePlayerMessage         |
| `handlePlayerViewedRole(seat)`                     | 476  | 处理查看角色   | GameStateService (via callback) |
| `startGame()`                                      | 517  | 开始游戏       | GameStateService                |
| `restartGame()`                                    | 533  | 重新开始       | GameStateService                |
| `assignRoles()`                                    | 557  | 分配角色       | GameStateService                |
| `updateTemplate(newTemplate)`                      | 571  | 更新模板       | GameStateService                |
| `handleRoleTurnStart(role, pendingSeats, options)` | 598  | 角色回合开始   | NightFlowService (callback)     |
| `endNight()`                                       | 645  | 结束夜晚       | NightFlowService (callback)     |
| `broadcastState()`                                 | 691  | ⚠️ 广播状态    | 内部多处调用                    |

**私有方法 (8个):**

| 方法                                      | 行号 | 功能             |
| ----------------------------------------- | ---- | ---------------- |
| `advanceToNextAction()`                   | 706  | 推进到下一个行动 |
| `finalizeWolfVote()`                      | 723  | 完成狼人投票     |
| `rejectAction(seat, action, reason)`      | 803  | 拒绝行动         |
| `applyActionResult(role, target, result)` | 816  | 应用行动结果     |
| `makeRevealAckKey(revision, role)`        | 841  | 生成ACK key      |
| `buildActionContext()`                    | 845  | 构建行动上下文   |
| `buildRoleSeatMap()`                      | 863  | 构建角色座位映射 |
| `calculateDeaths()`                       | 875  | ⚠️ 计算死亡      |
| `createAsyncHandler(fn)`                  | 888  | 创建异步处理器   |

---

### 2.3 StateManager (794行)

**公共方法 (31个):**

| 方法                                         | 行号 | 功能             | 调用者            |
| -------------------------------------------- | ---- | ---------------- | ----------------- |
| `getState()`                                 | 71   | 获取状态         | 多处              |
| `getRevision()`                              | 78   | 获取版本         | -                 |
| `hasState()`                                 | 85   | 检查是否有状态   | -                 |
| `updateState(updater)`                       | 104  | 更新状态         | 多处              |
| `batchUpdate(updates)`                       | 128  | 批量更新         | GameStateService  |
| `initialize(state)`                          | 136  | ⚠️ 初始化状态    | 6处调用!          |
| `reset()`                                    | 147  | 重置             | GameStateService  |
| `resetForGameRestart()`                      | 159  | 重启游戏时重置   | 3处调用           |
| `applyBroadcastState(broadcast, myUid, ...)` | 202  | 应用广播状态     | PlayerCoordinator |
| `subscribe(listener)`                        | 233  | 订阅状态变更     | GameStateService  |
| `toBroadcastState()`                         | 259  | 转换为广播状态   | 4处调用           |
| `findSeatByRole(role)`                       | 421  | 按角色查找座位   | HostCoordinator   |
| `getSeatsForRole(role)`                      | 434  | 获取角色所有座位 | NightFlowService  |
| `buildRoleMap()`                             | 455  | 构建角色映射     | HostCoordinator   |
| `assignRolesToPlayers(shuffledRoles)`        | 475  | 分配角色         | HostCoordinator   |
| `markPlayerViewedRole(seat)`                 | 497  | 标记已看角色     | HostCoordinator   |
| `setPlayerAtSeat(seat, player)`              | 521  | 设置座位玩家     | SeatManager       |
| `updateSeatingStatus()`                      | 530  | 更新座位状态     | SeatManager       |
| `updateTemplate(newTemplate)`                | 542  | 更新模板         | HostCoordinator   |
| `recordAction(role, action)`                 | 571  | 记录行动         | HostCoordinator   |
| `hasAction(role)`                            | 580  | 检查是否有行动   | HostCoordinator   |
| `recordWolfVote(seat, target)`               | 587  | 记录狼人投票     | HostCoordinator   |
| `clearWolfVotes()`                           | 596  | 清除狼人投票     | HostCoordinator   |
| `getVotingWolfSeats()`                       | 609  | 获取投票狼座位   | HostCoordinator   |
| `setWitchContext(context)`                   | 628  | 设置女巫上下文   | HostCoordinator   |
| `setConfirmStatus(status)`                   | 648  | 设置确认状态     | HostCoordinator   |
| `applyReveal(reveal)`                        | 665  | 应用揭示结果     | HostCoordinator   |
| `applyNightResultUpdates(updates)`           | 714  | 应用夜晚结果     | HostCoordinator   |
| `setSeatPlayer(seat, player)`                | 745  | 设置座位玩家     | SeatManager       |
| `clearSeat(seat)`                            | 757  | 清空座位         | SeatManager       |
| `clearSeatsByUid(uid, skipSeat)`             | 769  | 按UID清空座位    | SeatManager       |
| `updateSeatStatus()`                         | 782  | 更新座位状态     | SeatManager       |

---

### 2.4 PlayerCoordinator (458行)

**公共方法 (13个):**

| 方法                                     | 行号 | 功能                        | 调用者               |
| ---------------------------------------- | ---- | --------------------------- | -------------------- |
| `handleHostBroadcast(msg)`               | 96   | 处理Host广播                | BroadcastCoordinator |
| `takeSeat(seat, displayName, avatarUrl)` | 251  | ⚠️ 坐下 (wrapper)           | GameStateService     |
| `leaveSeat()`                            | 259  | ⚠️ 离开座位 (wrapper)       | GameStateService     |
| `takeSeatWithAck(...)`                   | 267  | ⚠️ 坐下带确认 (wrapper)     | GameStateService     |
| `leaveSeatWithAck(timeoutMs)`            | 280  | ⚠️ 离开座位带确认 (wrapper) | GameStateService     |
| `playerViewedRole()`                     | 288  | 标记已看角色                | GameStateService     |
| `submitAction(target, extra)`            | 307  | 提交行动                    | GameStateService     |
| `submitWolfVote(target)`                 | 330  | 提交狼人投票                | GameStateService     |
| `submitRevealAck(role)`                  | 350  | 确认揭示                    | GameStateService     |
| `requestSnapshot(timeoutMs)`             | 384  | 请求快照                    | GameStateService     |
| `reset()`                                | 451  | 重置                        | -                    |

**私有方法 (4个):**

| 方法                                         | 行号 | 功能                 |
| -------------------------------------------- | ---- | -------------------- |
| `handleSeatActionAck(msg)`                   | 164  | 处理座位ACK          |
| `handleSnapshotResponse(msg)`                | 180  | 处理快照响应         |
| `applyStateUpdate(broadcastState, revision)` | 215  | 应用状态更新         |
| `generateRequestId()`                        | 375  | ⚠️ 生成请求ID (重复) |

---

### 2.5 SeatManager (583行)

**公共方法 (12个):**

| 方法                                                  | 行号 | 功能                | 调用者                              |
| ----------------------------------------------------- | ---- | ------------------- | ----------------------------------- |
| `getLastSeatError()`                                  | 125  | 获取最后错误        | -                                   |
| `clearLastSeatError()`                                | 132  | 清除错误            | -                                   |
| `setLastSeatError(error)`                             | 139  | 设置错误            | -                                   |
| `takeSeat(seat, displayName, avatarUrl)`              | 151  | 坐下                | PlayerCoordinator, GameStateService |
| `takeSeatWithAck(...)`                                | 170  | 坐下带确认          | PlayerCoordinator, GameStateService |
| `leaveSeat()`                                         | 204  | 离开座位            | PlayerCoordinator, GameStateService |
| `leaveSeatWithAck(timeoutMs)`                         | 224  | 离开座位带确认      | PlayerCoordinator, GameStateService |
| `processSeatAction(seat, action, uid, ...)`           | 254  | 处理座位行动 (Host) | via handleSeatActionRequest         |
| `handleSeatActionRequest(msg)`                        | 348  | 处理座位请求        | HostCoordinator (via callback)      |
| `handleSeatActionAck(msg)`                            | 378  | 处理座位ACK         | PlayerCoordinator                   |
| `handlePlayerJoin(seat, uid, displayName, avatarUrl)` | 506  | 处理玩家加入        | processSeatAction                   |
| `handlePlayerLeave(seat, uid)`                        | 551  | 处理玩家离开        | processSeatAction                   |
| `cleanup()`                                           | 575  | 清理资源            | -                                   |

**私有方法 (2个):**

| 方法                         | 行号 | 功能                 |
| ---------------------------- | ---- | -------------------- |
| `generateRequestId()`        | 423  | ⚠️ 生成请求ID (重复) |
| `sendSeatActionWithAck(...)` | 430  | 发送座位行动         |

---

### 2.6 ActionProcessor (533行)

**公共方法 (9个):**

| 方法                                          | 行号 | 功能             | 调用者                           |
| --------------------------------------------- | ---- | ---------------- | -------------------------------- |
| `invokeResolver(schemaId, actorSeat, ...)`    | 140  | 调用Resolver     | processAction                    |
| `buildActionInput(schemaId, target, extra)`   | 177  | 构建行动输入     | processAction                    |
| `buildRoleAction(role, target, extra)`        | 279  | 构建角色行动     | processAction                    |
| `buildRevealFromResult(role, resolverResult)` | 300  | 从结果构建揭示   | processAction                    |
| `processAction(schemaId, actorSeat, ...)`     | 347  | 处理行动         | HostCoordinator                  |
| `validateWolfVote(target, context)`           | 399  | 验证狼人投票     | HostCoordinator                  |
| `resolveWolfVotes(wolfVotes)`                 | 421  | 解析狼人投票结果 | HostCoordinator                  |
| `buildNightActions(actions, ...)`             | 438  | 构建夜晚行动     | HostCoordinator, calculateDeaths |
| `calculateDeaths(context)`                    | 514  | ⚠️ 计算死亡      | 未被调用!                        |
| `isRevealRole(role)`                          | 530  | 检查是否揭示角色 | HostCoordinator                  |

**私有方法 (2个):**

| 方法                                 | 行号 | 功能           |
| ------------------------------------ | ---- | -------------- |
| `buildWitchAction(target, extra)`    | 222  | 构建女巫行动   |
| `buildMagicianAction(encodedTarget)` | 245  | 构建魔术师行动 |

---

### 2.7 BroadcastCoordinator (559行)

**公共方法 (19个):**

| 方法                                             | 行号 | 功能                 |
| ------------------------------------------------ | ---- | -------------------- |
| `setHostHandlers(handlers)`                      | 124  | 设置Host处理器       |
| `setPlayerHandlers(handlers)`                    | 131  | 设置Player处理器     |
| `getHostBroadcastHandler()`                      | 139  | 获取Host广播处理器   |
| `getPlayerMessageHandler()`                      | 147  | 获取Player消息处理器 |
| `broadcastState(state, revision)`                | 161  | 广播状态             |
| `broadcastRoleTurn(role, pendingSeats, options)` | 173  | 广播角色回合         |
| `broadcastNightEnd(deaths)`                      | 191  | 广播夜晚结束         |
| `broadcastSeatRejected(seat, uid, reason)`       | 202  | 广播座位拒绝         |
| `broadcastSeatActionAck(msg)`                    | 218  | 广播座位ACK          |
| `broadcastSnapshotResponse(msg)`                 | 234  | 广播快照响应         |
| `broadcastGameRestarted()`                       | 249  | 广播游戏重启         |
| `requestState(uid)`                              | 262  | 请求状态             |
| `requestSnapshot(requestId, uid, lastRevision)`  | 272  | 请求快照             |
| `sendSeatActionRequest(msg)`                     | 285  | 发送座位请求         |
| `sendAction(seat, role, target, extra)`          | 302  | 发送行动             |
| `sendWolfVote(seat, target)`                     | 320  | 发送狼人投票         |
| `sendRevealAck(seat, role, revision)`            | 331  | 发送揭示确认         |
| `sendViewedRole(seat)`                           | 343  | 发送已看角色         |
| `joinRoom(roomCode, uid, options)`               | 487  | 加入房间             |
| `leaveRoom()`                                    | 502  | 离开房间             |
| `markAsLive()`                                   | 513  | 标记为Live           |
| `markAsSyncing()`                                | 520  | 标记为同步中         |
| `setConnectionStatus(status)`                    | 527  | 设置连接状态         |
| `sendToHost(msg)`                                | 539  | 发送给Host           |
| `broadcastAsHost(msg)`                           | 547  | 作为Host广播         |
| `getBroadcastService()`                          | 556  | 获取底层服务         |

---

### 2.8 NightFlowService (564行)

**公共方法 (13个):**

| 方法                         | 行号 | 功能                    | 调用者          |
| ---------------------------- | ---- | ----------------------- | --------------- |
| `getNightFlow()`             | 140  | 获取NightFlowController | HostCoordinator |
| `isActive()`                 | 147  | 检查是否活跃            | -               |
| `getCurrentPhase()`          | 154  | 获取当前阶段            | -               |
| `getCurrentActionRole()`     | 161  | 获取当前行动角色        | HostCoordinator |
| `getCurrentStepInfo()`       | 175  | 获取当前步骤信息        | HostCoordinator |
| `startNight(roles)`          | 223  | 开始夜晚                | HostCoordinator |
| `advanceToNextAction()`      | 314  | 推进下一个行动          | HostCoordinator |
| `endNight()`                 | 382  | 结束夜晚                | - (由回调触发)  |
| `reset()`                    | 425  | 重置                    | HostCoordinator |
| `dispatchEvent(event)`       | 450  | 分发事件                | -               |
| `recordAction(role, target)` | 469  | 记录行动                | HostCoordinator |
| `canAcceptAction(role)`      | 483  | 检查能否接受行动        | HostCoordinator |
| `playCurrentRoleAudio()`     | 505  | 播放当前角色音频        | internal        |

---

### 2.9 NightFlowController (302行)

**公共方法 (7个):**

| 方法                         | 行号 | 功能           | 调用者           |
| ---------------------------- | ---- | -------------- | ---------------- |
| `getState()`                 | 149  | 获取状态       | NightFlowService |
| `hasMoreRoles()`             | 161  | 是否有更多角色 | -                |
| `isTerminal()`               | 168  | 是否终态       | NightFlowService |
| `dispatch(event)`            | 180  | 分发事件       | NightFlowService |
| `recordAction(role, target)` | 212  | 记录行动       | NightFlowService |

**私有方法 (7个):**

| 方法                          | 行号 | 功能                 |
| ----------------------------- | ---- | -------------------- |
| `handleStartNight()`          | 227  | 处理开始夜晚         |
| `handleNightBeginAudioDone()` | 238  | 处理夜晚开始音频完成 |
| `handleRoleBeginAudioDone()`  | 245  | 处理角色开始音频完成 |
| `handleActionSubmitted()`     | 256  | 处理行动提交         |
| `handleRoleEndAudioDone()`    | 263  | 处理角色结束音频完成 |
| `handleNightEndAudioDone()`   | 272  | 处理夜晚结束音频完成 |
| `handleReset()`               | 280  | 处理重置             |
| `transitionToNextRole()`      | 291  | 转换到下一个角色     |

---

### 2.10 BroadcastService (432行)

**公共方法 (12个):**

| 方法                               | 行号 | 功能           |
| ---------------------------------- | ---- | -------------- |
| `getInstance()`                    | 191  | 单例获取       |
| `getConnectionStatus()`            | 205  | 获取连接状态   |
| `addStatusListener(listener)`      | 212  | 添加状态监听器 |
| `setConnectionStatus(status)`      | 222  | 设置连接状态   |
| `joinRoom(roomCode, uid, options)` | 233  | 加入房间       |
| `markAsLive()`                     | 329  | 标记为Live     |
| `markAsSyncing()`                  | 338  | 标记为同步中   |
| `leaveRoom()`                      | 347  | 离开房间       |
| `broadcastAsHost(message)`         | 363  | 作为Host广播   |
| `broadcastPublic(payload)`         | 385  | 公共广播       |
| `sendToHost(message)`              | 403  | 发送给Host     |
| `getRoomCode()`                    | 420  | 获取房间码     |
| `isConnected()`                    | 427  | 检查是否连接   |

---

### 2.11 DeathCalculator (348行)

**导出函数 (1个公共 + 6个私有):**

| 函数                                         | 行号 | 功能           |
| -------------------------------------------- | ---- | -------------- |
| `calculateDeaths(nightActions, roleSeatMap)` | 119  | 计算死亡       |
| `processWolfKill(...)`                       | 164  | 处理狼人击杀   |
| `processWitchPoison(...)`                    | 208  | 处理女巫毒药   |
| `processWolfQueenLink(...)`                  | 239  | 处理狼王连带   |
| `processDreamcatcherEffect(...)`             | 263  | 处理摄梦人效果 |
| `processSpiritKnightReflection(...)`         | 290  | 处理灵骑反弹   |
| `processMagicianSwap(...)`                   | 330  | 处理魔术师交换 |

---

### 2.12 其他服务 (简略)

#### AudioService (234行)

- `getInstance()`, `playNightAudio()`, `playNightBeginAudio()`, `playNightEndAudio()`, `playRoleBeginningAudio(role)`, `playRoleEndingAudio(role)`

#### AuthService (260行)

- `getInstance()`, `waitForInit()`, `signInAnonymously()`, `signUpWithEmail()`, `signInWithEmail()`, `updateProfile()`, `signOut()`, `initAuth()`, `getCurrentDisplayName()`, `getCurrentAvatarUrl()`

#### SimplifiedRoomService (197行)

- `getInstance()`, `generateRoomNumber()`, `createRoom()`, `getRoom()`, `roomExists()`, `deleteRoom()`

#### StatePersistence (264行)

- `saveState()`, `loadState()`, `clearState()`, `hasState()`, `getStateAge()`

#### AvatarUploadService (112行)

- `getInstance()`, `uploadAvatar()`

#### WolfVoteResolver (58行)

- `resolveWolfVotes(votes)` - 计算投票结果

---

## 3. 重复/相似 API 分析

### 🔴 3.1 【严重】`stateManager.initialize()` 被调用6次

**调用位置:**

| 位置                                       | 行号 | 场景         |
| ------------------------------------------ | ---- | ------------ |
| `GameStateService.initializeAsHost()`      | 389  | 新建Host     |
| `GameStateService.rejoinAsHost()` (有存储) | 443  | 恢复Host     |
| `GameStateService.rejoinAsHost()` (无存储) | 456  | 恢复Host占位 |
| `HostCoordinator.initialize()`             | 137  | 新建Host     |
| `HostCoordinator.rejoin()` (有存储)        | 187  | 恢复Host     |
| `HostCoordinator.rejoin()` (无存储)        | 200  | 恢复Host占位 |

**问题:**

- `GameStateService.initializeAsHost`/`rejoinAsHost` 和 `HostCoordinator.initialize`/`rejoin` 是**完全重复**的实现
- `HostCoordinator.initialize()` 和 `HostCoordinator.rejoin()` **从未被调用**!
- 应该只保留一处初始化逻辑

**建议:** 删除 `GameStateService.initializeAsHost()`/`rejoinAsHost()` 中的逻辑，委托给 `HostCoordinator.initialize()`/`rejoin()`

---

### 🔴 3.2 【严重】`broadcastState()` 重复实现

**两处实现:**

| 位置                                | 行号    | 内容     |
| ----------------------------------- | ------- | -------- |
| `GameStateService.broadcastState()` | 759-793 | 完整实现 |
| `HostCoordinator.broadcastState()`  | 691-703 | 完整实现 |

**GameStateService 版本 (35行):**

```typescript
private async broadcastState(): Promise<void> {
  if (!this.isHost || !this.state) return;
  this.stateRevision++;
  const broadcastState = this.stateManager.toBroadcastState();
  // Sync computed fields to Host's local state
  if (this.state.nightmareBlockedSeat !== broadcastState.nightmareBlockedSeat ||
      this.state.wolfKillDisabled !== broadcastState.wolfKillDisabled) {
    this.stateManager.batchUpdate({...});
  }
  this.notifyListeners();
  await this.broadcastCoordinator.broadcastState(broadcastState, this.stateRevision);
  // Persist state
  if (this.isHost && this.state) {
    this.statePersistence.saveState(...).catch(...);
  }
}
```

**HostCoordinator 版本 (13行):**

```typescript
async broadcastState(): Promise<void> {
  if (!this.state) return;
  const broadcastState = this.stateManager.toBroadcastState();
  const revision = this.config.incrementStateRevision();
  await this.broadcastCoordinator.broadcastState(broadcastState, revision);
  this.statePersistence.saveState(...).catch(...);
}
```

**差异分析:**

- GameStateService 额外做了 `nightmareBlockedSeat`/`wolfKillDisabled` 同步
- GameStateService 额外调用了 `notifyListeners()`
- 两者都调用 `statePersistence.saveState()`

**建议:** 合并为一个版本，删除 `GameStateService.broadcastState()`，让 GameStateService 调用 `hostCoordinator.broadcastState()`

---

### 🔴 3.3 【严重】`calculateDeaths` 三处实现

**三处位置:**

| 位置                                | 行号 | 状态               |
| ----------------------------------- | ---- | ------------------ |
| `DeathCalculator.calculateDeaths()` | 119  | ✅ 核心纯函数      |
| `HostCoordinator.calculateDeaths()` | 875  | ✅ 调用核心函数    |
| `ActionProcessor.calculateDeaths()` | 514  | ⚠️ **从未被调用!** |

**ActionProcessor 版本:**

```typescript
calculateDeaths(context: DeathCalculationContext): number[] {
  const nightActions = this.buildNightActions(context.actions);
  return calculateDeaths(nightActions, context.roleSeatMap);
}
```

**HostCoordinator 版本:**

```typescript
private calculateDeaths(): number[] {
  if (!this.state) return [];
  const nightActions = this.actionProcessor.buildNightActions(this.state.actions, this.state.players);
  const roleSeatMap = this.buildRoleSeatMap();
  return calculateDeaths(nightActions, roleSeatMap);
}
```

**问题:**

- `ActionProcessor.calculateDeaths()` 从未被任何地方调用
- 两个版本功能相同，只是参数传递方式不同

**建议:** 删除 `ActionProcessor.calculateDeaths()`，只保留 `HostCoordinator` 版本

---

### 🟠 3.4 【中等】`takeSeat`/`leaveSeat` 三层wrapper

**调用链:**

```
GameStateService.takeSeat() → SeatManager.takeSeat()
       ↑ 重复
PlayerCoordinator.takeSeat() → SeatManager.takeSeat()
```

**完全相同的代码:**

| 方法                 | GameStateService | PlayerCoordinator |
| -------------------- | ---------------- | ----------------- |
| `takeSeat()`         | 602-603          | 251-253           |
| `leaveSeat()`        | 610-611          | 259-261           |
| `takeSeatWithAck()`  | 672-678          | 267-274           |
| `leaveSeatWithAck()` | 685-686          | 280-282           |

**问题:**

- `PlayerCoordinator` 的4个方法只是委托给 `SeatManager`
- `GameStateService` 也是直接委托给 `SeatManager`
- 两层完全重复

**建议:** 删除 `PlayerCoordinator` 的 seat wrapper 方法，让 GameStateService 直接用 SeatManager

---

### 🟠 3.5 【中等】`generateRequestId()` 重复

**两处完全相同的实现:**

| 位置                                    | 行号    |
| --------------------------------------- | ------- |
| `PlayerCoordinator.generateRequestId()` | 375-377 |
| `SeatManager.generateRequestId()`       | 423-425 |

**代码 (完全一致):**

```typescript
private generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
```

**建议:** 提取到共享 utility 函数，如 `src/utils/requestId.ts`

---

### 🟠 3.6 【中等】`WolfVoteResolver.ts` vs `night/resolvers/wolfVote.ts`

**两个文件:**

| 文件                                 | 导出函数                           | 功能                  |
| ------------------------------------ | ---------------------------------- | --------------------- |
| `WolfVoteResolver.ts` (58行)         | `resolveWolfVotes(votes)`          | 计算投票结果 (谁被杀) |
| `night/resolvers/wolfVote.ts` (60行) | `wolfVoteResolver(context, input)` | 验证单次投票输入      |

**调用情况:**

- `ActionProcessor` 同时 import 两个文件
- `resolveWolfVotes` 被 `ActionProcessor.resolveWolfVotes()` 调用
- `wolfVoteResolver` 被 `ActionProcessor.validateWolfVote()` 调用

**问题:**

- 命名混淆: `WolfVoteResolver` vs `wolfVoteResolver`
- 两个文件职责应该合并

**建议:** 将 `WolfVoteResolver.ts` 中的 `resolveWolfVotes` 移动到 `night/resolvers/wolfVote.ts`

---

### 🟡 3.7 【低】`startGame`/`restartGame`/`assignRoles`/`updateTemplate` wrapper

**GameStateService 纯 wrapper:**

```typescript
async assignRoles(): Promise<void> {
  return this.hostCoordinator.assignRoles();
}
async startGame(): Promise<void> {
  return this.hostCoordinator.startGame();
}
async restartGame(): Promise<boolean> {
  if (!this.isHost) return false;
  return this.hostCoordinator.restartGame();
}
async updateTemplate(newTemplate: GameTemplate): Promise<void> {
  return this.hostCoordinator.updateTemplate(newTemplate);
}
```

**问题:** 这些都是1-2行的纯委托，增加了一层不必要的间接层

**建议:** 保留（作为门面API），或考虑让调用方直接用 HostCoordinator

---

### 🟡 3.8 【低】`NightFlowController` vs `NightFlowService` 命名

**两个文件:**

| 文件                        | 行数 | 职责          |
| --------------------------- | ---- | ------------- |
| `NightFlowController.ts`    | 302  | 状态机 (底层) |
| `night/NightFlowService.ts` | 564  | 高层服务      |

**关系:**

```typescript
// NightFlowService.ts
export class NightFlowService {
  private nightFlow: NightFlowController | null = null;
  ...
  this.nightFlow = new NightFlowController(nightPlan);
}
```

**问题:**

- 命名容易混淆: 哪个是Service? 哪个是Controller?
- 实际上 `NightFlowController` 应该叫 `NightFlowStateMachine`

**建议:** 重命名 `NightFlowController` → `NightFlowStateMachine`

---

### 🟡 3.9 【低】`BroadcastService` vs `BroadcastCoordinator` 同样的问题

**两个文件:**

| 文件                                | 行数 | 职责             |
| ----------------------------------- | ---- | ---------------- |
| `BroadcastService.ts`               | 432  | 底层Supabase通信 |
| `broadcast/BroadcastCoordinator.ts` | 559  | 高层消息协调     |

**问题:** 命名混淆，但架构上是正确的分层

**建议:** 可考虑重命名 `BroadcastService` → `SupabaseChannel` 或 `RealtimeTransport`

---

### 🟡 3.10 【低】`recordAction` 三处调用

**调用链:**

```
HostCoordinator.applyActionResult()
  → stateManager.recordAction(role, result.actionToRecord)
  → nightFlowService.recordAction(role, target)
       → nightFlow.recordAction(role, target)
```

**问题:**

- 两个 `recordAction` 有不同含义:
  - `StateManager.recordAction()`: 记录 RoleAction 对象
  - `NightFlowController.recordAction()`: 记录 target 数字
- 容易混淆

**建议:** 重命名其中一个，如 `NightFlowController.recordActionTarget()`

---

## 4. 调用链分析

### 4.1 Host 初始化流程

```
UI: 创建房间
  → GameStateService.initializeAsHost()          ← 应该删除
      → stateManager.initialize()                ← 重复
      → broadcastCoordinator.joinRoom()          ← 重复
      → broadcastState()                         ← 重复

应该改为:
  → GameStateService.initializeAsHost()
      → hostCoordinator.initialize()             ← 唯一调用
          → stateManager.initialize()
          → broadcastCoordinator.joinRoom()
          → broadcastState()
```

### 4.2 玩家行动流程

```
UI: 提交行动
  → GameStateService.submitAction()
      → playerCoordinator.submitAction()
          → broadcastCoordinator.sendAction()

Host接收:
  → handlePlayerMessage()
      → hostCoordinator.handlePlayerAction()
          → actionProcessor.processAction()
              → invokeResolver()
          → applyActionResult()
              → stateManager.recordAction()
              → stateManager.applyReveal()
          → advanceToNextAction()
              → nightFlowService.advanceToNextAction()
          → broadcastState()
```

### 4.3 夜晚结束流程

```
NightFlowService 检测到所有角色完成:
  → hostCoordinator.endNight()
      → calculateDeaths()                        ← 应该只有这一处
          → actionProcessor.buildNightActions()
          → buildRoleSeatMap()
          → DeathCalculator.calculateDeaths()
      → broadcastCoordinator.broadcastNightEnd()
      → broadcastState()
```

---

## 5. 问题汇总与建议

### 5.1 优先级分类

| 优先级 | 问题                                                             | 预期减少行数 | 风险 |
| ------ | ---------------------------------------------------------------- | ------------ | ---- |
| 🔴 P0  | 删除 `GameStateService.initializeAsHost()`/`rejoinAsHost()` 重复 | ~100行       | 中   |
| 🔴 P0  | 合并 `broadcastState()` 到 HostCoordinator                       | ~30行        | 中   |
| 🔴 P0  | 删除未使用的 `ActionProcessor.calculateDeaths()`                 | ~8行         | 低   |
| 🟠 P1  | 删除 `PlayerCoordinator` 的 seat wrapper 方法                    | ~40行        | 低   |
| 🟠 P1  | 合并 `WolfVoteResolver.ts` 到 `wolfVote.ts`                      | ~58行        | 低   |
| 🟠 P1  | 提取 `generateRequestId()` 到共享 utility                        | ~10行        | 低   |
| 🟡 P2  | 重命名 `NightFlowController` → `NightFlowStateMachine`           | 0行          | 低   |
| 🟡 P2  | 重命名 `recordAction` 以区分两个含义                             | 0行          | 低   |

### 5.2 建议执行顺序

1. **Phase 1: 删除未使用代码**
   - 删除 `ActionProcessor.calculateDeaths()`
   - 删除 `HostCoordinator.initialize()`/`rejoin()` (因为从未被调用)

2. **Phase 2: 统一初始化路径**
   - 让 `GameStateService.initializeAsHost()` 调用 `hostCoordinator.initialize()`
   - 让 `GameStateService.rejoinAsHost()` 调用 `hostCoordinator.rejoin()`

3. **Phase 3: 统一 broadcastState**
   - 删除 `GameStateService.broadcastState()`
   - 让需要广播的地方调用 `hostCoordinator.broadcastState()`

4. **Phase 4: 清理 wrapper 层**
   - 删除 `PlayerCoordinator` 的 seat wrapper
   - 提取 `generateRequestId()` 到 utility

5. **Phase 5: 合并小文件**
   - 合并 `WolfVoteResolver.ts` 到 `wolfVote.ts`

6. **Phase 6: 重命名 (可选)**
   - `NightFlowController` → `NightFlowStateMachine`
   - `BroadcastService` → `RealtimeTransport`

---

## 附录: 服务依赖图

```
                              ┌─────────────────────┐
                              │  GameStateService   │ (门面)
                              │       795行         │
                              └─────────┬───────────┘
                                        │
          ┌─────────────────────────────┼─────────────────────────────┐
          │                             │                             │
          ▼                             ▼                             ▼
┌─────────────────────┐   ┌─────────────────────┐   ┌─────────────────────┐
│   HostCoordinator   │   │  PlayerCoordinator  │   │    StateManager     │
│       892行         │   │       458行         │   │       794行         │
└─────────┬───────────┘   └─────────┬───────────┘   └─────────────────────┘
          │                         │
          │                         │
          ▼                         ▼
┌─────────────────────┐   ┌─────────────────────┐
│  NightFlowService   │   │    SeatManager      │
│       564行         │   │       583行         │
└─────────┬───────────┘   └─────────────────────┘
          │
          ▼
┌─────────────────────┐
│ NightFlowController │
│       302行         │
└─────────────────────┘

          共享基础设施
          ─────────────
┌─────────────────────┐   ┌─────────────────────┐
│ BroadcastCoordinator│──▶│  BroadcastService   │
│       559行         │   │       432行         │
└─────────────────────┘   └─────────────────────┘

┌─────────────────────┐   ┌─────────────────────┐
│  ActionProcessor    │──▶│  DeathCalculator    │
│       533行         │   │       348行         │
└─────────────────────┘   └─────────────────────┘

          独立服务
          ─────────
┌─────────────────────┐   ┌─────────────────────┐
│    AudioService     │   │    AuthService      │
│       234行         │   │       260行         │
└─────────────────────┘   └─────────────────────┘

┌─────────────────────┐   ┌─────────────────────┐
│SimplifiedRoomService│   │  StatePersistence   │
│       197行         │   │       264行         │
└─────────────────────┘   └─────────────────────┘
```

---

_文档结束_
