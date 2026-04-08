# RoomScreen UI 状态机速查

## GameStatus → 底部按钮映射

| GameStatus | Host 底部按钮                                     | 非 Host 底部按钮                        |
| ---------- | ------------------------------------------------- | --------------------------------------- |
| `Unseated` | 房间配置                                          | （无）                                  |
| `Seated`   | 房间配置, 分配角色                                | （无）                                  |
| `Assigned` | 重新开始, 查看身份                                | 查看身份                                |
| `Ready`    | 重新开始, 开始游戏, 查看身份                      | 查看身份                                |
| `Ongoing`  | 重新开始, 查看身份, (schema 行动按钮 if actioner) | 查看身份, (schema 行动按钮 if actioner) |
| `Ended`    | 重新开始, 昨夜信息, 详细信息, 查看身份            | 查看身份, (详细信息 if allowed)         |

所有 Host 按钮在 `isAudioPlaying` 或 `isHostActionSubmitting` 时禁用。

## ⋯ 菜单项可见性

| 菜单项           | 可见条件                                             |
| ---------------- | ---------------------------------------------------- |
| 角色图鉴         | 所有用户，始终可见                                   |
| 翻牌动画         | `isHost && !isAudioPlaying && (Unseated \| Seated)`  |
| 音乐设置         | `isHost && !isAudioPlaying && (Unseated \| Seated)`  |
| 用户设置         | 所有用户，始终可见                                   |
| 全员起立         | `isHost && (Unseated \| Seated) && anyPlayersSeated` |
| 填充机器人       | `isHost && Unseated`                                 |
| 标记机器人已查看 | `isHost && isDebugMode && Assigned`                  |

## 夜晚 Schema Kind → 交互模式

| Kind              | Host/行动者 UI                                                 | 其他玩家 UI            |
| ----------------- | -------------------------------------------------------------- | ---------------------- |
| `chooseSeat`      | 座位可点击 → 确认/reveal 弹窗。有 `canSkip` 时底栏显示跳过按钮 | 座位不可交互           |
| `wolfVote`        | 狼人座位高亮，点击投票/改票。底栏：放弃袭击 / 取消投票         | 看不到狼人身份，无按钮 |
| `compound`        | 自动弹窗（女巫解药/毒药两步）。底栏：用解药 / 跳过全部         | 无                     |
| `swap`            | 自动弹窗。依次点两个座位完成交换                               | 无                     |
| `confirm`         | 底栏按钮查看发动状态 → 弹窗显示可/不可发动                     | 无                     |
| `multiChooseSeat` | 点击座位切换多选。底栏：确认催眠({count}人) / 跳过             | 无                     |
| `groupConfirm`    | **所有坐下玩家**看到自己的状态弹窗 → 点「我知道了」确认        | 同左（全员参与）       |

## Overlay / Modal 触发条件

| 组件                   | 触发条件                               | 可见者            |
| ---------------------- | -------------------------------------- | ----------------- |
| `AuthGateOverlay`      | 无 session 通过直链进入房间            | 未登录用户        |
| AlertModal（继续游戏） | Host 断线重连后 `needsContinueOverlay` | Host              |
| `SeatConfirmModal`     | 点击座位（Unseated/Seated 阶段）       | 点击者            |
| `RoleCardModal`        | 点击「查看身份」                       | 有座位的玩家      |
| `NightReviewModal`     | 点击「详细信息」（Ended 阶段）         | Host + 被授权玩家 |
| `ShareReviewModal`     | Host 点击「昨夜信息」                  | Host              |
| `QRCodeModal`          | 点击「分享房间」                       | 所有用户          |
| `NotepadModal`         | 点击 BoardInfoCard 笔记图标            | 所有用户          |
| `SettingsSheet`        | ConfigScreen 内游戏设置                | Host              |

## SeatTile 视觉状态

| 状态          | 条件                      | 视觉                               |
| ------------- | ------------------------- | ---------------------------------- |
| 空位          | `playerUid === null`      | 显示「空」                         |
| 我的座位      | `isMySpot`                | 座位号角标变绿（`colors.success`） |
| 狼人高亮      | `isWolf`（wolfVote 步骤） | 红色底色 + 红色半透遮罩            |
| 选中          | `isSelected`              | 深色 primary 底色 + 选中遮罩       |
| 被控制（bot） | `isControlled`            | warning 边框加粗                   |
| 匿名用户      | `isPlayerAnonymous`       | 昵称样式变暗                       |
