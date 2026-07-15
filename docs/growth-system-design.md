# 用户成长系统设计

> 状态：已实现
> 最后核对：2026-07-15

## 1. 边界与所有权

成长与奖励是产品能力，不属于狼人杀或瞎掰王规则：

- `packages/game-engine/src/product/growth/` 拥有 XP、等级阈值与等级展示算法。
- `packages/game-engine/src/product/rewards/` 拥有奖励目录、收藏查询、抽卡概率、票券产出与翻牌动画选择。
- `packages/game-engine/src/platform/random/` 提供可注入 `Rng`、安全随机数和确定性随机数。
- 具体游戏自行决定何时采用产品能力。当前只有狼人杀的 `werewolf.game.ended` effect 触发成长结算；
  瞎掰王没有成长 effect，也不会因为共用房间平台而自动获得狼人杀结算。

产品模块是纯 TypeScript，不访问 D1、网络、React 或 Cloudflare binding。Worker game module 负责把 game event
翻译为产品奖励，客户端只展示服务端已提交的结果。

## 2. 有效狼人杀对局

狼人杀成长结算要求：

1. Engine 已提交 ended state，并产生唯一 `werewolf.game.ended` effect。
2. Effect 中至少有 6 个按 `userId` 去重的真人参与者；匿名玩家计入人数，bot 不计入。
3. 只有 `users.is_anonymous = 0` 的注册用户获得 XP 和票券。
4. Participant fingerprint 必须和同一 effect 已提交的 ledger 一致，否则重试直接失败。

房主只是 UI 标记，不得到额外奖励。胜负、角色和阵营不影响 XP；阵营只写入狼人杀公开统计表。

## 3. XP 与等级

### 3.1 等级阈值

`packages/game-engine/src/product/growth/level.ts` 定义 52 个等级（Lv.0 到 Lv.51）：

| 等级范围 | 每级累计 XP 增量 |
| -------- | ---------------- |
| Lv.1–20  | 60               |
| Lv.21–40 | 90               |
| Lv.41–51 | 120              |

`getLevel(xp)`、`getLevelProgress(xp)` 和 `getLevelTitle(level)` 由客户端与 Worker 共用，避免各端重复阈值。
累计 XP 必须是非负 safe integer，level 必须是 `0..51` 的整数；D1 或调用方破坏该不变量时直接
`[FAIL-FAST]`，不能把非法 XP 投影成 0 级，也不能把非法 level 显示成“传奇”。超过满级阈值但仍可由
JavaScript 精确表示的累计 XP 合法，等级保持 51。

### 3.2 单局 XP

```text
rollXp(level) = 50 + randomIntInclusive(0, 20 + level)
```

随机数由调用方注入。狼人杀 settlement 使用 `effectId + userId + "xp"` 生成确定性 seed，因此 effect 重放不会
重新抽取结果。默认 `secureRng` 只供没有幂等重放要求的产品调用。

## 4. 票券产出

`packages/game-engine/src/product/rewards/earnings.ts` 定义两种独立分布：

| 普通券 | 概率 | 金券 | 概率 |
| ------ | ---- | ---- | ---- |
| 1      | 30%  | 1    | 35%  |
| 2      | 35%  | 2    | 35%  |
| 3      | 20%  | 3    | 18%  |
| 4      | 10%  | 4    | 8%   |
| 5      | 5%   | 5    | 4%   |

- 每个有效狼人杀对局产生一次普通券抽取。
- 只有 `newLevel > previousLevel` 时才采用一次金券候选抽取。
- 每日登录奖励复用普通券分布，但由 auth/gacha handler 的产品流程触发，不属于游戏结算。
- 权重或注入 RNG 不覆盖合法区间时直接 `[FAIL-FAST]`，不会返回默认票数。

## 5. 奖励与收藏

`packages/game-engine/src/product/rewards/catalog.ts` 是奖励 ID、类型和稀有度的唯一来源。当前类型包括头像、
头像框、座位特效、名字样式、翻牌特效和入座动画。

`packages/game-engine/src/product/rewards/gacha.ts` 先按普通/金券概率和保底计数决定稀有度，再从该稀有度的
静态 pool 选择奖励。每个稀有度在模块初始化时必须有可选项；selector 返回越界索引会直接失败，不能静默降级到
另一个稀有度或少执行一次抽卡。重复物品按 `SHARD_VALUES` 转为碎片。

`packages/game-engine/src/product/rewards/unlocks.ts` 只负责从服务端已持久化的 `unlockedItems` 投影各类收藏。
旧的“升级时直接按等级类型赠送物品”API 已删除，不保留兼容 export。

## 6. Worker 结算

入口：`packages/api-worker/src/games/werewolf/settlement/settleGameResults.ts`。

1. `werewolf.game.ended` 由 generic outbox 在 room state 提交后执行。
2. Settlement 计算 canonical participant fingerprint，并为每个注册用户构造确定性 XP/票券。
3. `game_settlement_results` 以 `(effect_id, user_id)` 保存不可变结果和 `stats_applied`。
4. 一个 D1 batch 写入 result ledger、`user_stats` 与 `camp_settlements`。
5. 重试先校验 ledger，再返回相同结果；不会重新随机或重复增加 stats。
6. Worker 发送幂等 internal roster-level command，然后写入 `user_event_inbox`。
7. Shared `RoomSession` 只有在 listener 成功处理事件后才 ACK；断线会重放未确认事件。

`user_stats.last_room_code` 是历史产品字段，不是幂等边界。幂等性由 effect result ledger 保证。

## 7. 客户端

```text
Werewolf effect
  -> user_event_inbox
  -> shared RoomSession
  -> Werewolf user-event codec
  -> useWerewolfSettleToast
  -> stats/gacha query invalidation
```

- `src/screens/SettingsScreen/components/GrowthSection.tsx` 展示等级进度、对局数和收藏进度。
- `src/screens/AppearanceScreen/` 展示并装备服务端确认已解锁的外观。
- `src/screens/GachaScreen/` 消费票券并展示服务端抽卡结果。
- `src/screens/UnlocksScreen/` 展示完整奖励目录和解锁状态。

客户端不计算票券余额、不决定稀有度，也不在 settlement toast 中自行增加本地统计。

## 8. D1 数据

`packages/api-worker/src/db/applicationSchema.ts` 中：

- `user_stats`：`xp`、`level`、`games_played`、`unlocked_items`、普通/金券余额、两种 pity、碎片、OCC
  `version`、每日奖励时间和最近结算时间。
- `draw_history`：每次抽取的类型、稀有度、奖励、pity、重复标记和碎片补偿。

狼人杀拥有的 `camp_settlements` 与 `game_settlement_results` 位于
`packages/api-worker/src/games/werewolf/dbSchema.ts`。历史 SQL migration 继续按编号保留在 Worker
`migrations/`，运行时不通过 aggregate schema 重新混合 table ownership。

## 9. 验证门禁

- Product 模块只能 import `product/` 或 `platform/`，不能 import 具体游戏。
- 具体游戏可以采用 product API，但 `platform/` 不能反向 import product 或 game。
- 根 `src/growth`、`src/utils` 与旧 package export 必须不存在。
- RNG 输入、奖池完整性和 selector index 使用 fail-fast tests。
- 任何结算修改都必须覆盖 effect replay、participant mismatch、并发 effect 和 D1 ledger corruption。
- 提交前运行 `pnpm run quality`；最终多游戏验收还要运行完整 E2E。
