# SeatAdapter 字段填充规范

`RoomSeatViewModel`（`src/features/room/model/RoomSeatDataSource.ts`）是各游戏向共享 `RoomSeatBoard` 提供座位数据的契约。

## 字段语义

| 字段                 | 类型                          | 语义                          | 填充规则                                                              |
| -------------------- | ----------------------------- | ----------------------------- | --------------------------------------------------------------------- |
| `seat`               | `number`                      | 座位索引（0-based）           | 游戏直接透传座位索引                                                  |
| `player`             | `RoomSeatPlayer \| null`      | 座位上的玩家，null 表示空座   | 有玩家坐则填玩家对象，否则 null                                       |
| `isSelf`             | `boolean`                     | 是否是当前用户自己的座位      | `player.userId === currentUser.id`                                    |
| `highlight`          | `RoomSeatHighlight`           | 座位高亮状态                  | 游戏按阶段设置（如投票中被指、夜间行动目标等）；无特殊状态填 `'none'` |
| `secondaryLabel`     | `string \| null`              | 座位副标签（如 bot 身份显示） | 有副信息则填（如 avalon 的 bot 身份），否则 null                      |
| `disabledReason`     | `string?`                     | 座位禁用原因（可选）          | 座位不可点时填原因，否则省略                                          |
| `showReadyBadge`     | `boolean`                     | 是否显示准备徽章              | 大厅阶段已准备的玩家填 true                                           |
| `statusBadge`        | `RoomSeatStatusBadge \| null` | 状态徽章                      | 有状态（如掉线、托管）则填，否则 null                                 |
| `isStatusEmphasized` | `boolean`                     | 状态是否强调显示              | 需要引起注意的状态填 true                                             |
| `showLevel`          | `boolean`                     | 是否显示玩家等级              | 游戏决定；一般填 true                                                 |
| `decorationsEnabled` | `boolean`                     | 是否启用装饰                  | 玩家装备了装饰则 true                                                 |

## 各游戏 checklist

### Werewolf（基准）

- [x] `secondaryLabel`：bot 座位显示身份
- [x] `highlight`：夜间/投票阶段高亮
- [x] `statusBadge`：托管/掉线状态

### Avalon

- [x] `secondaryLabel`：bot 身份显示（2026-10-08 补）
- [ ] `highlight`：投票/任务阶段高亮（待补）

### Fibking

- [ ] 全字段待对齐

### Undercover

- [ ] 全字段待对齐

### Pictionary / Drawguess / Storyrelay

- 无座位盘，不适用
