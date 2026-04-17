# 扭蛋系统详细设计文档

> 状态：**待实施**  
> 作者：Copilot + eyan  
> 日期：2026-04-17

---

## 目录

1. [系统概述](#1-系统概述)
2. [现有架构分析](#2-现有架构分析)
3. [数据模型变更](#3-数据模型变更)
4. [概率引擎](#4-概率引擎)
5. [稀有度分配](#5-稀有度分配)
6. [服务端实现](#6-服务端实现)
7. [客户端实现](#7-客户端实现)
8. [动画方案](#8-动画方案)
9. [实施步骤](#9-实施步骤)
10. [边界条件与风险](#10-边界条件与风险)

---

## 1. 系统概述

### 1.1 动机

现有成长系统：每局获得 50–70 XP → 升级 → `pickRandomReward()` 直接随机发放 1 个未解锁物品。这种方式的问题：

- **无仪式感**：升级解锁只有 1 条 toast，玩家很可能没注意
- **无主动行为**：奖励自动到账，玩家对"获得"没有参与感
- **单一来源**：只有升级才有奖励，打完一局如果没升级，仅显示 "+55 XP"

### 1.2 目标

引入扭蛋（Gacha）机制：

- 每局有效游戏获得 1 张**普通券**，每次升级获得 1 张**黄金券**
- 玩家在扭蛋页面主动消耗券抽取，支持单抽和 10 连
- 通过概率表 + 保底 + 去重构建可控的收集体验
- 扭蛋机动画提供仪式感

### 1.3 架构约束

| 约束         | 说明                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| 服务端权威   | 概率计算、券扣减、物品发放全部在 Worker 执行。客户端只提交 "抽" 的请求，展示服务端返回的结果 |
| 游戏引擎纯净 | `@werewolf/game-engine` 放概率纯函数（`rollRarity`/`selectReward`），不放 IO / DB 操作       |
| 信任模型     | 面对面 party game，不加额外防作弊架构，但服务端校验券余额                                    |
| 原子部署     | Worker + Pages 原子部署，不存在新旧版本共存，接口变更直接 breaking                           |

---

## 2. 现有架构分析

### 2.1 物品注册表

**文件**：`packages/game-engine/src/growth/rewardCatalog.ts`

- 4 类物品：`avatar`(42) / `frame`(20) / `seatFlair`(30) / `nameStyle`(20)
- `REWARD_POOL`：112 个可抽物品（减去 1 个免费 `villager`），`RewardItem { type, id }`
- 目前 **没有稀有度字段**

### 2.2 随机抽取

**文件**：`packages/game-engine/src/growth/frameUnlock.ts`

- `pickRandomReward(unlockedIds, randomFn, level)` — 按等级模 5/7/3 决定优先类型，过滤已解锁，随机选一个
- 扭蛋系统将**替代此函数**（不再按等级决定类型，而是先 roll 稀有度，再从该稀有度池中随机选物品）

### 2.3 结算链路

```
游戏结束
  → GameRoom DO #settleIfEnded()
    → settleGameResults() [packages/api-worker/src/growth/settleGameResults.ts]
      → per player: rollXp() → Drizzle upsert → check level up → pickRandomReward()
    → #sendSettleResults() — WebSocket 单播 SETTLE_RESULT
    → #updateRosterLevels() — 广播 UPDATE_ROSTER_LEVELS action

客户端
  → CFRealtimeService 解析 SETTLE_RESULT
    → facade.handleSettleResult()
      → useSettleToast hook 显示 toast
```

**关键改动点**：`settleGameResults()` 中不再调用 `pickRandomReward()`，改为增加券数。

### 2.4 D1 Schema

**文件**：`packages/api-worker/src/db/schema.ts`

```
user_stats:
  userId (PK, FK→users)
  xp (INTEGER)
  level (INTEGER)
  gamesPlayed (INTEGER)
  lastRoomCode (TEXT, 幂等 key)
  unlockedItems (TEXT, JSON array of string IDs)
  updatedAt (TEXT)
```

需要新增：`normal_draws`、`golden_draws`、`normal_pity`、`golden_pity` 列 + `draw_history` 表。

### 2.5 API 路由结构

**文件**：`packages/api-worker/src/index.ts`

现有 growth 相关路由挂载在 `/api`（`statsRoutes`）：

- `GET /api/user/stats`
- `GET /api/user/:userId/profile`
- `GET /api/user/:userId/unlocks`

新增扭蛋路由方案：在 `/api` 路由组内新增 `/api/gacha/*`。

### 2.6 Migration 编号

现有最大编号：`0012_add_equipped_name_style.sql`。下一个：**`0013`**。

---

## 3. 数据模型变更

### 3.1 D1 Migration: `0013_gacha_system.sql`

```sql
-- 给 user_stats 表添加扭蛋相关列
ALTER TABLE user_stats ADD COLUMN normal_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN normal_pity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_pity INTEGER NOT NULL DEFAULT 0;

-- 抽奖历史记录
CREATE TABLE draw_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  draw_type TEXT NOT NULL,        -- 'normal' | 'golden'
  rarity TEXT NOT NULL,           -- 'common' | 'rare' | 'epic' | 'legendary'
  item_type TEXT NOT NULL,        -- 'avatar' | 'frame' | 'seatFlair' | 'nameStyle'
  item_id TEXT NOT NULL,
  pity_count INTEGER NOT NULL,    -- 本次抽奖时的 pity 计数（0 = 首次，9 = 保底触发）
  was_pity INTEGER NOT NULL DEFAULT 0,  -- 1 = 本次是保底触发
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_draw_history_user ON draw_history(user_id);
CREATE INDEX idx_draw_history_created ON draw_history(created_at);
```

**字段说明**：

| 列             | 类型    | 说明                                              |
| -------------- | ------- | ------------------------------------------------- |
| `normal_draws` | INTEGER | 未使用的普通抽奖券数                              |
| `golden_draws` | INTEGER | 未使用的黄金抽奖券数                              |
| `normal_pity`  | INTEGER | 普通抽连续未触发保底的次数（0–9），触发后重置为 0 |
| `golden_pity`  | INTEGER | 黄金抽连续未触发保底的次数（0–9），触发后重置为 0 |

`draw_history` 用于：调试追溯、未来可能的"抽奖记录"UI、概率审计。不参与实时逻辑（pity 由 `user_stats` 列维护，不需要查 history 表计算）。

### 3.2 Drizzle Schema 更新

`packages/api-worker/src/db/schema.ts` — `userStats` 表增加 4 列：

```typescript
export const userStats = sqliteTable('user_stats', {
  // ...existing fields...
  normalDraws: integer('normal_draws').notNull().default(0),
  goldenDraws: integer('golden_draws').notNull().default(0),
  normalPity: integer('normal_pity').notNull().default(0),
  goldenPity: integer('golden_pity').notNull().default(0),
  // ...
});
```

新增 `drawHistory` 表定义：

```typescript
export const drawHistory = sqliteTable('draw_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  drawType: text('draw_type').notNull(),
  rarity: text('rarity').notNull(),
  itemType: text('item_type').notNull(),
  itemId: text('item_id').notNull(),
  pityCount: integer('pity_count').notNull(),
  wasPity: integer('was_pity').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
```

### 3.3 RewardItem 增加 rarity

`packages/game-engine/src/growth/rewardCatalog.ts`：

```typescript
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
  readonly rarity: Rarity;
}
```

`REWARD_POOL` 中每个条目新增 `rarity` 字段。具体分配见 §5。

### 3.4 SettleResultMessage 变更

`src/services/types/IRealtimeTransport.ts`：

```typescript
export interface SettleResultMessage {
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number; // 通常 = 1（有效局）
  goldenDrawsEarned: number; // 升级时 = 1（未升级 = 0）
}
```

`reward` 字段直接删除（Web 客户端 + Worker 原子部署，不存在新旧版本共存）。

---

## 4. 概率引擎

### 4.1 概率表

**普通抽**（来源：每局有效游戏 1 张）：

| Rarity    | 概率  | 说明     |
| --------- | ----- | -------- |
| Common    | 84.5% | 基础物品 |
| Rare      | 10%   | 中等品质 |
| Epic      | 4%    | 高品质   |
| Legendary | 1.5%  | 最高品质 |

**黄金抽**（来源：每次升级 1 张）：

| Rarity    | 概率 | 说明     |
| --------- | ---- | -------- |
| Common    | 69%  | 基础物品 |
| Rare      | 20%  | 中等品质 |
| Epic      | 8%   | 高品质   |
| Legendary | 3%   | 最高品质 |

### 4.2 保底机制（Pity）

| 抽奖类型 | 保底阈值                     | 保底内容                                              |
| -------- | ---------------------------- | ----------------------------------------------------- |
| 普通抽   | 连续 10 次未抽到 Rare 或更高 | 第 10 次保底 Rare+（重新 roll，仅排除 Common）        |
| 黄金抽   | 连续 10 次未抽到 Epic 或更高 | 第 10 次保底 Epic+（重新 roll，仅排除 Common + Rare） |

**Pity 计数规则**：

- 每次抽奖后 +1（不论结果）
- 抽到保底阈值以上稀有度时重置为 0
- 普通抽：抽到 Rare/Epic/Legendary → 重置
- 黄金抽：抽到 Epic/Legendary → 重置
- 达到 10 时强制触发保底（本次不消耗计数，直接重置为 0）
- **10 连抽中每次独立计算 pity**（连抽不是一次性 roll 10 个结果再一起结算）

### 4.3 去重机制

**池子移除制**：

- `selectReward(rarity, unlockedIds)` 从 `REWARD_POOL` 过滤 `rarity === target && !unlockedIds.has(id)`
- 如果目标稀有度池已清空（该稀有度全部集齐），向上升级：Common 空 → Rare → Epic → Legendary
- 如果全部 112 件都已收集 → 不允许抽奖，API 返回 `{ success: false, reason: 'ALL_COLLECTED' }`
- 客户端券数 badge 显示 "已集齐"，抽奖按钮 disabled，**券保留不浪费**

### 4.4 纯函数实现位置

**文件**：`packages/game-engine/src/growth/gachaProbability.ts`（新建）

```typescript
// ── 常量 ──
export const PITY_THRESHOLD = 10;

export const NORMAL_RATES: Record<Rarity, number> = {
  legendary: 1.5,
  epic: 4,
  rare: 10,
  common: 84.5,
};

export const GOLDEN_RATES: Record<Rarity, number> = {
  legendary: 3,
  epic: 8,
  rare: 20,
  common: 69,
};

// ── 核心函数 ──

/**
 * 根据抽奖类型和 pity 计数 roll 稀有度。
 *
 * @param drawType - 'normal' | 'golden'
 * @param pityCount - 当前 pity 计数（0–9）
 * @param randomValue - [0, 100) 的随机数（调用方提供，服务端用 crypto）
 * @returns { rarity, pityReset } — pityReset: true 表示 pity 被重置
 */
export function rollRarity(
  drawType: DrawType,
  pityCount: number,
  randomValue: number,
): { rarity: Rarity; pityReset: boolean };

/**
 * 从指定稀有度的未解锁池中选取物品。
 * 如果目标稀有度已清空，向上升级（Common→Rare→Epic→Legendary）。
 * 全部集齐返回 undefined。
 *
 * @param targetRarity - rollRarity 返回的稀有度
 * @param unlockedIds - 已拥有的物品 ID 集合
 * @param randomFn - [0, max) 随机整数
 */
export function selectReward(
  targetRarity: Rarity,
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
): RewardItem | undefined;
```

**为什么是纯函数**：

- 随机数由调用方注入（`randomValue` / `randomFn`），函数本身无副作用
- 客户端可复用做概率预览/模拟（不影响服务端权威）
- 方便单元测试，100% 可确定性验证

### 4.5 概率验证测试

`packages/game-engine/src/__tests__/gachaProbability.test.ts`（新建）

需要覆盖的场景：

| 测试                          | 说明                                    |
| ----------------------------- | --------------------------------------- |
| `rollRarity` normal 概率分布  | 10 万次模拟，各稀有度偏差 < 1%          |
| `rollRarity` golden 概率分布  | 同上                                    |
| normal pity 第 10 次保底      | pityCount=9 时一定不返回 Common         |
| golden pity 第 10 次保底      | pityCount=9 时一定不返回 Common 或 Rare |
| pity 正常抽到高稀有度时 reset | pityCount=5 抽到 Rare → pityReset=true  |
| `selectReward` 正常选取       | 给定稀有度返回对应稀有度物品            |
| `selectReward` 稀有度升级     | Common 池空 → 返回 Rare 物品            |
| `selectReward` 全部集齐       | 返回 undefined                          |
| `selectReward` 不返回已拥有   | 过滤验证                                |

---

## 5. 稀有度分配

### 5.1 总览

| 类型                | 总数    | Legendary | Epic   | Rare   | Common |
| ------------------- | ------- | --------- | ------ | ------ | ------ |
| Avatars 头像        | 42      | 3         | 7      | 14     | 18     |
| Frames 头像框       | 20      | 3         | 5      | 6      | 6      |
| SeatFlairs 座位特效 | 30      | 3         | 7      | 12     | 8      |
| NameStyles 名字样式 | 20      | 2         | 4      | 7      | 7      |
| **合计**            | **112** | **11**    | **23** | **39** | **39** |

### 5.2 具体分配

#### Avatars (42)

**Legendary (3)**：`darkWolfKing` / `nightmare` / `masquerade`

**Epic (7)**：`wolfKing` / `wolfQueen` / `bloodMoon` / `spiritKnight` / `awakenedGargoyle` / `witch` / `seer`

**Rare (14)**：`hunter` / `guard` / `knight` / `magician` / `piper` / `poisoner` / `gargoyle` / `dreamcatcher` / `avenger` / `mirrorSeer` / `psychic` / `cursedFox` / `witcher` / `wolfWitch`

**Common (18)**：`wolf` / `wolfRobot` / `villager`\* / `crow` / `cupid` / `dancer` / `drunkSeer` / `graveyardKeeper` / `idiot` / `maskedMan` / `pureWhite` / `shadow` / `silenceElder` / `slacker` / `thief` / `treasureMaster` / `votebanElder` / `warden` / `wildChild`

> \*注：`villager` 是免费头像，不在 REWARD_POOL 中，但列在此处供完整性参考。实际 Common 头像 = 18（不含 villager）。

#### Frames (20)

**Legendary (3)**：`starNebula` / `celestialRing` / `dragonScale`

**Epic (5)**：`voidRift` / `stormBolt` / `jadeSeal` / `shadowWeave` / `hellFire`

**Rare (6)**：`ironForge` / `moonSilver` / `bloodThorn` / `runicSeal` / `pharaohGold` / `sakuraDrift`

**Common (6)**：`boneGate` / `darkVine` / `frostCrystal` / `coralReef` / `emberAsh` / `obsidianEdge`

#### SeatFlairs (30)

**Legendary (3)**：`runeCircle` / `lightPillar` / `prismShard`

**Epic (7)**：`phoenixFeather` / `thunderBolt` / `cometTail` / `lunarHalo` / `magmaFloat` / `sonicWave` / `purpleMist`

**Rare (12)**：`emberGlow` / `frostAura` / `shadowMist` / `goldenShine` / `bloodMark` / `starlight` / `sakura` / `fireRing` / `iceCrystal` / `ghostWisp` / `poisonBubble` / `windGust`

**Common (8)**：`snowfall` / `goldSpark` / `butterfly` / `shadowClaw` / `rainDrop` / `flowerBloom` / `firefly` / `forestLeaf`

#### NameStyles (20)

**Legendary (2)**：`celestialDawn` / `voidStar`

**Epic (4)**：`phoenixRebirth` / `dragonBreath` / `stormElectric` / `moltenGoldPulse`

**Rare (7)**：`silverGleam` / `copperEmber` / `bloodMoonGlow` / `jadeShimmer` / `amethystGlow` / `indigoRadiance` / `twilightGradient`

**Common (7)**：`roseGold` / `frostVeil` / `amberFlare` / `frostBreath` / `venomShift` / `shadowPulse` / `crimsonTide`

### 5.3 收集期望分析

假设只用普通抽（每局 1 张）：

| 稀有度         | 池大小 | 单次概率    | 期望抽完所需次数（含保底）     |
| -------------- | ------ | ----------- | ------------------------------ |
| Common (39)    | 39     | 84.5%       | ~39 / 0.845 ≈ 46 次            |
| Rare (39)      | 39     | 10% (+保底) | 有效率 ~15%（含保底）→ ~260 次 |
| Epic (23)      | 23     | 4%          | ~575 次                        |
| Legendary (11) | 11     | 1.5%        | ~733 次                        |

完整收集 112 件：~800+ 局（纯普通抽，不含黄金抽加速）。黄金抽有 3× legendary 概率 + 升级 ~52 张，可显著缩短中后期收集。

---

## 6. 服务端实现

### 6.1 结算改造：`settleGameResults.ts`

**改动**：

```diff
 // 3. 遍历注册玩家，结算 XP
 for (const uid of registeredUids) {
   const xpEarned = rollXp();
   // ... upsert XP + gamesPlayed ...

   const statsRow = await db.select(...).from(userStats).where(eq(userStats.userId, uid)).get();

   if (statsRow) {
     const previousLevel = statsRow.level;
     const newLevel = getLevel(statsRow.xp);

-    let reward: RewardItem | undefined;
-    if (newLevel > previousLevel) {
-      const unlockedIds = JSON.parse(statsRow.unlockedItems);
-      const unlockedSet = new Set(unlockedIds);
-      for (let lv = previousLevel + 1; lv <= newLevel; lv++) {
-        const picked = pickRandomReward(unlockedSet, cryptoRandomInt, lv);
-        if (picked) { unlockedSet.add(picked.id); reward = picked; }
-      }
-      const updatedItems = JSON.stringify([...unlockedSet]);
-      await db.update(userStats).set({ level: newLevel, unlockedItems: updatedItems }).where(...);
-    }
+    // 每局有效游戏 → +1 普通券
+    let normalDrawsEarned = 1;
+    let goldenDrawsEarned = 0;
+
+    if (newLevel > previousLevel) {
+      // 每升一级 → +1 黄金券
+      goldenDrawsEarned = newLevel - previousLevel;
+      await db.update(userStats).set({ level: newLevel }).where(eq(userStats.userId, uid));
+    }
+
+    // 累加券数
+    await db.update(userStats).set({
+      normalDraws: sql`${userStats.normalDraws} + ${normalDrawsEarned}`,
+      goldenDraws: sql`${userStats.goldenDraws} + ${goldenDrawsEarned}`,
+    }).where(eq(userStats.userId, uid));

     results.push({
       uid, xpEarned,
       newXp: statsRow.xp, newLevel, previousLevel,
-      reward,
+      normalDrawsEarned,
+      goldenDrawsEarned,
     });
   }
 }
```

**`PlayerSettleResult` 接口变更**：

```typescript
export interface PlayerSettleResult {
  uid: string;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
  // reward 字段移除
}
```

**`#sendSettleResults` 变更**：WebSocket 消息增加 `normalDrawsEarned` / `goldenDrawsEarned` 字段。

### 6.2 新建扭蛋 API：`gachaHandlers.ts`

**文件**：`packages/api-worker/src/handlers/gachaHandlers.ts`

**路由**：

#### `GET /api/gacha/status`

返回当前用户的扭蛋状态。

```typescript
// Response
{
  normalDraws: number; // 可用普通券
  goldenDraws: number; // 可用黄金券
  normalPity: number; // 普通 pity 计数
  goldenPity: number; // 黄金 pity 计数
  totalCollected: number; // 已收集物品总数
  totalItems: 112; // 可收集物品总数
  allCollected: boolean; // 是否全部集齐
}
```

#### `POST /api/gacha/draw`

执行抽奖。

```typescript
// Request body (Zod schema)
{
  drawType: 'normal' | 'golden';
  count: 1 | 10;
}

// Response (success)
{
  success: true;
  results: Array<{
    rarity: Rarity;
    itemType: RewardType;
    itemId: string;
    isNew: true; // 扭蛋系统下永远是 true（去重）
    wasPity: boolean;
  }>;
  remaining: {
    normalDraws: number;
    goldenDraws: number;
    normalPity: number;
    goldenPity: number;
  }
}

// Response (failure)
{
  success: false;
  reason: 'INSUFFICIENT_DRAWS' | // 券不够
    'ALL_COLLECTED' | // 已集齐
    'VALIDATION_ERROR'; // 参数错误
}
```

**服务端逻辑伪代码**：

```
POST /api/gacha/draw:
1. requireAuth → userId
2. Validate body: { drawType ∈ ['normal','golden'], count ∈ [1, 10] }
3. BEGIN transaction (D1 不支持真事务，用 batch 或逐步校验)
4. 读 user_stats: normalDraws/goldenDraws/normalPity/goldenPity/unlockedItems
5. 检查券余额 >= count，否则 → INSUFFICIENT_DRAWS
6. 解析 unlockedItems → Set<string>
7. 检查 REWARD_POOL.length - unlockedSet.size > 0，否则 → ALL_COLLECTED
8. results = []
9. FOR i = 0 to count-1:
   a. cryptoRandomValue = crypto random [0, 100)
   b. { rarity, pityReset } = rollRarity(drawType, currentPity, cryptoRandomValue)
   c. item = selectReward(rarity, unlockedSet, cryptoRandomInt)
   d. IF item is undefined → break（池清空了，但前面已检查过，理论上不会发生）
   e. unlockedSet.add(item.id)
   f. IF pityReset → currentPity = 0, ELSE → currentPity += 1
   g. INSERT draw_history
   h. results.push({ rarity, itemType: item.type, itemId: item.id, wasPity })
10. UPDATE user_stats SET
      normalDraws/goldenDraws -= count,
      normalPity/goldenPity = currentPity,
      unlockedItems = JSON.stringify([...unlockedSet])
11. RETURN { success: true, results, remaining: { ... } }
```

### 6.3 新建 Zod Schema

**文件**：`packages/api-worker/src/schemas/gacha.ts`

```typescript
import { z } from 'zod';

export const drawSchema = z.object({
  drawType: z.enum(['normal', 'golden']),
  count: z.union([z.literal(1), z.literal(10)]),
});
```

### 6.4 路由挂载

`packages/api-worker/src/index.ts`：

```diff
 import { statsRoutes } from './handlers/statsHandlers';
+import { gachaRoutes } from './handlers/gachaHandlers';

 // ... existing routes ...
 app.route('/api', statsRoutes);
+app.route('/api', gachaRoutes);
```

### 6.5 幂等性与并发安全

- **结算幂等**：已有 `lastRoomCode` 机制保证同一局不重复结算
- **抽奖并发**：单个用户的抽奖请求通过 D1 的 `WHERE normalDraws >= count` 条件保证不超支。如果两个请求同时到达，第二个会因余额不足被拒绝
- **D1 事务**：D1 不支持跨语句事务。抽奖的 "读→计算→写" 链通过 batch write（先更新券数 WHERE 余额足够，再写入 unlockedItems）保证一致性。如果 UPDATE 影响 0 行（余额不足），回退不写入

### 6.6 seed-local.mjs 更新

`scripts/seed-local.mjs` 更新：给 dev 用户设置初始券数。

```sql
UPDATE user_stats SET
  normal_draws = 50,
  golden_draws = 10,
  normal_pity = 0,
  golden_pity = 0
WHERE user_id = '00000000-0000-4000-a000-000000000001';
```

---

## 7. 客户端实现

### 7.1 结算 Toast 改造

**文件**：`src/hooks/useSettleToast.ts`

改动前：

```
升级 + reward → "升级！Lv.3 解锁 头像「猎人」"
升级 → "升级！Lv.3"
普通 → "+55 XP"
```

改动后：

```
升级 + 黄金券 → "升级 Lv.3！获得黄金抽奖机会 🎰"，description: "+55 XP · 抽奖券 +1"
普通（每局都有普通券） → "+55 XP · 获得抽奖券"
```

**SettleResultMessage 接口变更**：直接替换为 §3.4 定义（删除 `reward` 字段，`normalDrawsEarned`/`goldenDrawsEarned` 为 required）。

**CFRealtimeService 解析变更**：解析新字段，删除旧 `reward` 解析逻辑。

### 7.2 新建扭蛋 Service

**文件**：`src/services/feature/GachaService.ts`

```typescript
export interface GachaStatus {
  normalDraws: number;
  goldenDraws: number;
  normalPity: number;
  goldenPity: number;
  totalCollected: number;
  totalItems: number;
  allCollected: boolean;
}

export interface DrawResult {
  rarity: Rarity;
  itemType: RewardType;
  itemId: string;
  isNew: boolean;
  wasPity: boolean;
}

export interface DrawResponse {
  success: true;
  results: DrawResult[];
  remaining: {
    normalDraws: number;
    goldenDraws: number;
    normalPity: number;
    goldenPity: number;
  };
}

export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet<GachaStatus>('/api/gacha/status');
}

export async function performDraw(
  drawType: 'normal' | 'golden',
  count: 1 | 10,
): Promise<DrawResponse> {
  return cfPost<DrawResponse>('/api/gacha/draw', { drawType, count });
}
```

### 7.3 TanStack Query Hooks

**文件**：`src/hooks/queries/useGachaQuery.ts`

```typescript
// useGachaStatusQuery — queryKey: ['gachaStatus']
// staleTime: 30s（进入页面时刷新，但不过于频繁）
// 匿名用户返回空状态（与 useUserStatsQuery 模式一致）

// 抽奖用 useMutation:
// useDraw mutation — onSuccess 时 invalidate ['gachaStatus'] + ['userStats'] + ['userUnlocks']
```

### 7.4 Navigation 注册

`src/navigation/types.ts`：

```typescript
export type RootStackParamList = {
  // ...existing...
  Gacha: undefined;
};
```

### 7.5 HomeScreen 入口

在 HomeScreen 的 action 区域（现有 "百科" / "设置" 行附近）新增扭蛋入口按钮：

- **图标**：🎰 或自定义 Skia icon
- **Badge**：显示可用券总数 `normalDraws + goldenDraws`（0 时不显示 badge）
- **文字**：`已集齐` 时替代券数 badge
- **匿名用户**：不显示入口（与 Settings 中 GrowthSection 模式一致）
- **位置**：encyclopedia 旁边（同一行 flex row）

### 7.6 GachaScreen 结构

**文件**：`src/screens/GachaScreen/GachaScreen.tsx`

```
GachaScreen
├── 顶部导航栏（返回）
├── 扭蛋机动画区域（Skia Canvas）
│   ├── 透明玻璃圆罩（含扭蛋球物理模拟）
│   ├── 机身 + 旋钮 + 管道
│   └── 落地区域（开蛋动画）
├── 状态栏
│   ├── 普通券数 + 黄金券数
│   ├── 收集进度 "42/112"
│   └── 保底倒计时 "距保底 {10-pity} 次"
├── 操作按钮区
│   ├── 普通 ×1 / ×10
│   └── 黄金 ×1 / ×10（各自 disabled 当券不足或全集齐）
└── 最近结果展示（最后一次抽的结果，emoji + 名字 + 稀有度色）
```

**10 连结果 Overlay**：全屏 modal，5×2 网格，卡片按稀有度排序逐张飞入（与原型 V6 一致）。

### 7.7 Query Invalidation 链路

抽奖成功后需要 invalidate 的 query：

| Query Key                 | 原因                 |
| ------------------------- | -------------------- |
| `['gachaStatus']`         | 券数、pity 变化      |
| `['userStats']`           | `unlockedItems` 变化 |
| `['userUnlocks', userId]` | 同上                 |

不需要 invalidate `['userStats']` 的 XP/level 数据（抽奖不影响这些）。但 `unlockedItems` 在同一个 response 里，所以整体 invalidate。

---

## 8. 动画方案

### 8.1 选型

**Skia Canvas**（`@shopify/react-native-skia`，项目已有依赖）实现全部动画。HTML Canvas 原型已在 V6 验证可行性。

### 8.2 场景描述

#### 扭蛋机静态结构

| 部件     | 描述                                                                              |
| -------- | --------------------------------------------------------------------------------- |
| 玻璃圆罩 | 圆形，透明感（左侧弧形高光 + 右上椭圆高光 + 底部弧光 + 极低 alpha 填充）          |
| 扭蛋球   | 28 颗，上半壳各色 + 下半白色 + "?" 标记，带碰撞物理。所有球外观一致，不泄露稀有度 |
| 机身     | 矩形暗色容器，标题文字（"GOLDEN GACHA" / "GACHA"），金属质感                      |
| 旋钮     | 圆形金属旋钮，中心十字线 + 把手圆点                                               |
| 管道     | 罩底部到地面的出球通道                                                            |
| 地面     | 水平线 + 轻微阴影                                                                 |

#### 单抽流程（~4 秒）

| 阶段     | 时间        | 描述                                                                  |
| -------- | ----------- | --------------------------------------------------------------------- |
| 搅拌     | 0–2.2s      | 旋转力（正弦切换方向）+ 向心力 + 随机扰动。旋钮同步旋转，画面轻震     |
| 沉降     | 2.2–2.6s    | 力衰减，球在重力下沉降                                                |
| 开闸     | 2.6s        | 底部闸门打开，底部球被推向洞口                                        |
| 掉落     | 2.6–3.5s    | 1 颗球穿过管道，重力加速，弹跳落地（bounce 3–4 次衰减）               |
| 关闸     | 球出闸后    | 立即关闭                                                              |
| 自动开蛋 | 落地后 0.5s | 壳碎裂（10 片三角碎片向四周飞散）+ 稀有度颜色全屏闪光 + 28 颗星火粒子 |
| 展示     | 开蛋后      | 物品 emoji（48px）+ 名字 + 稀有度标签 + 底部光晕                      |

#### 10 连流程（~8 秒）

| 阶段     | 时间        | 描述                                                                                |
| -------- | ----------- | ----------------------------------------------------------------------------------- |
| 搅拌     | 0–2.2s      | 同单抽                                                                              |
| 沉降     | 2.2–2.6s    | 同单抽                                                                              |
| 开闸     | 2.6s        | 闸门大开（管道加宽 28→40px），**持续开放**                                          |
| 批量掉落 | 2.6–5s      | 10 颗球一起从罩内涌出，各自带随机水平速度，在地面散开弹跳                           |
| 关闸     | 10 颗出完后 | 关闭                                                                                |
| 等待落地 | 5–6s        | 所有球弹跳完毕，稳定在地面                                                          |
| 依次开蛋 | 6–8.5s      | 每 0.25s 自动开一颗。壳碎 + 小闪光 + 位置显示 emoji。效果比单抽缩小（避免视觉过载） |
| 结果面板 | 8.5s+       | 全屏 overlay：5×2 网格，按稀有度排序，卡片逐张飞入（80ms 间隔）                     |

### 8.3 物理参数

| 参数        | 值                                               | 说明              |
| ----------- | ------------------------------------------------ | ----------------- |
| 重力        | 500 px/s²                                        |                   |
| 碰撞弹性    | 0.7                                              | 球-球、球-壁      |
| 摩擦系数    | 0.985/帧                                         | 速度衰减          |
| 球半径      | 14px（罩内）/ 18px（单抽掉落）/ 16px（10连掉落） |                   |
| 碰撞 solver | 3-pass per frame                                 | 处理密集堆叠      |
| 圆罩半径    | 125px                                            |                   |
| 搅拌力      | 3000 × strength                                  | strength 先升后降 |

### 8.4 稀有度视觉映射

| Rarity    | 色值      | Glow                   | 碎裂效果                                    |
| --------- | --------- | ---------------------- | ------------------------------------------- |
| Common    | `#9E9E9E` | `rgba(158,158,158,.3)` | 标准碎裂                                    |
| Rare      | `#4A90D9` | `rgba(74,144,217,.4)`  | 蓝色碎裂 + 更多粒子                         |
| Epic      | `#9B59B6` | `rgba(155,89,182,.5)`  | 紫色碎裂 + 全屏紫光闪烁                     |
| Legendary | `#F5A623` | `rgba(245,166,35,.5)`  | 金色碎裂 + 全屏金光 + 画面大震 + 额外粒子环 |

---

## 9. 实施步骤

### Phase 1a — rewardCatalog.ts 加 Rarity

**改动文件**：

- `packages/game-engine/src/growth/rewardCatalog.ts` — 新增 `Rarity` 类型，`RewardItem` 加 `rarity` 字段，`REWARD_POOL` 每个条目加 `rarity`
- `packages/game-engine/src/index.ts` — export `Rarity`

**影响分析**：

- `pickRandomReward()` 参数不变，不受影响（它不读 rarity 字段）
- `REWARD_POOL` 的消费者：`pickRandomReward`、`getUnlockedAvatars/Frames/Flairs/NameStyles`、seed-local.mjs — 都不读 rarity，安全
- 类型变更：`RewardItem` 加了 required 字段。所有构造 `RewardItem` 的地方需要更新 → 只有 `REWARD_POOL` 自身（map 函数内加 rarity）

**测试**：现有测试应全部通过（rarity 是新增字段不破坏现有功能）。

### Phase 1b — 新建 gachaProbability.ts + 测试

**新增文件**：

- `packages/game-engine/src/growth/gachaProbability.ts`
- `packages/game-engine/src/__tests__/gachaProbability.test.ts`
- `packages/game-engine/src/growth/index.ts` — 新增 re-export
- `packages/game-engine/src/index.ts` — 新增 export

**测试范围**：§4.5 列出的全部场景。

### Phase 1c — D1 Migration + Drizzle Schema

**新增文件**：

- `packages/api-worker/migrations/0013_gacha_system.sql`

**改动文件**：

- `packages/api-worker/src/db/schema.ts` — 新增 4 列 + drawHistory 表

**影响分析**：

- 新增列有 DEFAULT 值，不影响现有数据
- Drizzle schema 新增列：所有 `select({...})` 显式列出列名，不受影响（不用 `select()` 全选）
- `settleGameResults.ts` 的 upsert values 不含新列（用 DEFAULT）→ 安全

### Phase 1d — settleGameResults.ts 改造

**改动文件**：

- `packages/api-worker/src/growth/settleGameResults.ts` — 移除 `pickRandomReward` 调用，改为累加券数
- `packages/api-worker/src/durableObjects/GameRoom.ts` — `#sendSettleResults` 新增字段
- `src/services/types/IRealtimeTransport.ts` — `SettleResultMessage` 替换为券数字段（删除 `reward`）
- `src/services/cloudflare/CFRealtimeService.ts` — 解析新字段
- `src/hooks/useSettleToast.ts` — 展示改为券数通知

**影响分析**：

- `PlayerSettleResult` 接口变更：`reward` → `normalDrawsEarned` / `goldenDrawsEarned`
- 消费者：`#sendSettleResults`、`#updateRosterLevels` — 前者需改，后者不受影响
- `getRewardDisplayName` 函数不再需要（删除）
- `useSettleToast` 的 `showSettleToast` 逻辑重写

### Phase 1e — 扭蛋 API Handler

**新增文件**：

- `packages/api-worker/src/handlers/gachaHandlers.ts`
- `packages/api-worker/src/schemas/gacha.ts`

**改动文件**：

- `packages/api-worker/src/index.ts` — 挂载路由

### Phase 1f — 客户端数据层

**新增文件**：

- `src/services/feature/GachaService.ts`
- `src/hooks/queries/useGachaQuery.ts`

### Phase 1g — seed-local.mjs 更新

**改动文件**：

- `scripts/seed-local.mjs` — 新增 gacha 列初始值

### Phase 2 — GachaScreen + 动画

**新增文件**：

- `src/screens/GachaScreen/GachaScreen.tsx`
- `src/screens/GachaScreen/components/CapsuleMachine.tsx` — Skia 动画组件
- `src/screens/GachaScreen/components/TenResultOverlay.tsx` — 10 连结果面板
- `src/screens/GachaScreen/hooks/usePhysicsEngine.ts` — 物理模拟 hook

**改动文件**：

- `src/navigation/types.ts` — 新增 Gacha route
- `src/navigation/` — Stack.Screen 注册
- `src/screens/HomeScreen/HomeScreen.tsx` — 新增入口按钮 + badge

### Phase 3 — 打磨

- Legendary 特殊全屏动画（单独视觉强化）
- 抽奖音效（抽奖开始 / 碎裂 / 揭示 / legendary 专属）
- 抽奖历史页面（optional，从 draw_history 表查）
- UnlocksScreen 增加稀有度标签显示

---

## 10. 边界条件与风险

### 10.1 边界条件

| 场景               | 处理                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------- |
| 10 连时券只有 3 张 | API 返回 `INSUFFICIENT_DRAWS`，客户端按钮 disabled（count > available 时）                    |
| 10 连途中池清空    | 循环中 `selectReward` 返回 undefined → 结束循环，只返回已抽到的结果。更新券扣减为实际抽取次数 |
| 全部 112 件集齐    | GET status → `allCollected: true`，客户端抽奖按钮 disabled，badge 显示 "已集齐"               |
| 匿名用户           | 不结算、无券、不显示入口                                                                      |
| 离线 / 断网        | 抽奖是 HTTP POST，标准 cfPost 超时+错误处理。失败时 `showAlert('抽奖失败', '请稍后重试')`     |
| 多设备同时抽       | D1 UPDATE WHERE 余额足够，第二个请求因余额不足被拒                                            |
| 结算重试（alarm）  | 现有 retry 机制不变，新字段 `normalDrawsEarned` 在重试时也正确（幂等 upsert）                 |

### 10.2 风险

| 风险                                           | 等级 | 缓解                                                                                                                                              |
| ---------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 并发竞态（两次 draw 同时读到相同余额）      | 低   | D1 单 writer 保证。UPDATE SET WHERE 条件兜底                                                                                                      |
| 概率偏差（crypto.getRandomValues modulo bias） | 极低 | Uint32 范围 4.29B，modulo 100 偏差 < 0.0000024%                                                                                                   |
| 10 连中间失败（DB 写入部分成功）               | 低   | 10 次 draw 在同一个 handler 中串行执行，D1 写入原子性足够。最坏情况：部分物品写入但券未扣 → 用户多得物品（可接受风险）。可通过 batch() 进一步降低 |
| Skia 动画性能（28 球物理 + 粒子）              | 中   | HTML 原型已验证流畅。Skia 的 GPU 加速应更优。必要时降低球数到 20                                                                                  |
| 概率引擎 bug                                   | 中   | §4.5 测试覆盖 + 10 万次蒙特卡洛验证                                                                                                               |
