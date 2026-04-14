# 用户成长体系设计

## 0. 核心前提

### 有效局定义

> `status === Ended` 且房间内 **≥ 9 个不同真人玩家**（`uid` 去重，含匿名）。
> XP 仅写入 `is_anonymous = 0` 的注册用户；匿名玩家仅计入有效局人数门槛。

### 成长体系

| 维度     | 驱动力                        | 展示                    |
| -------- | ----------------------------- | ----------------------- |
| XP/等级  | 每有效局 50 + random(0~20) XP | 设置页进度条            |
| 等级解锁 | 52 级，每级 1 个头像或头像框  | 头像选择页 + 设置页预告 |

### 不做清单

| 不做          | 原因                                          |
| ------------- | --------------------------------------------- |
| 胜负/结局     | App 不知道谁赢，手动上报不可信                |
| 月相系统      | 已删除，XP 简化为固定 base + random           |
| 角色图鉴/收集 | 已删除，记录玩过什么角色 = 作弊信息           |
| 游戏历史      | 已删除，Night-1 后游戏仍在继续，查记录 = 作弊 |
| 称号系统      | 不需要                                        |
| 排行榜        | party game 不需要竞争压力                     |
| 每日任务/签到 | 重度系统，违背轻量原则                        |
| 结算弹窗      | 打断面对面游戏；使用非阻塞 toast 替代         |

---

## 1. 等级系统

### 阈值表（52 级 Lv.0–Lv.51）

| 区间     | 每级增量 | 累计起点   |
| -------- | -------- | ---------- |
| Lv.1–20  | +60      | 60         |
| Lv.21–40 | +90      | 1200 + 90  |
| Lv.41–51 | +120     | 3000 + 120 |

`LEVEL_THRESHOLDS` 由 IIFE 计算生成（`packages/game-engine/src/growth/level.ts`）。

### XP 计算

```
rollXp() = 50 + crypto.getRandomValues(Uint32Array)[0] % 21
```

范围 [50, 70]，期望 ~60。前期 1 局/级，后期 2 局/级。

---

## 2. 等级解锁奖励

`packages/game-engine/src/growth/frameUnlock.ts`

- Lv.0 免费：villager 头像 + ironForge 头像框
- Lv.1–51 每级 1 个奖励（42 头像 + 9 头像框），框约每 5–6 级穿插
- 所有头像 key 与 `AVATAR_KEYS`（`src/utils/avatar.ts`）对应
- 所有头像框 id 与 `AVATAR_FRAMES`（`src/components/avatarFrames/index.ts`）对应

### 查询 API

| 函数                              | 返回                           |
| --------------------------------- | ------------------------------ |
| `getLevelReward(level)`           | 该等级的奖励（undefined = 无） |
| `getUnlockedAvatars(level)`       | 已解锁头像 key 集合            |
| `getUnlockedFrames(level)`        | 已解锁头像框 id 集合           |
| `isFrameUnlocked(frameId, level)` | 头像框是否已解锁               |

---

## 3. 服务端结算

`packages/api-worker/src/growth/settleGameResults.ts`

### 流程

1. `endNight()` handler 广播 `END_NIGHT` 后，`ctx.waitUntil(settleGameResults(state, env))`
2. 收集非空非 bot 玩家 uid，检查 `≥ MIN_PLAYERS`
3. 查 D1（via Drizzle ORM）过滤匿名用户
4. 逐注册玩家：`rollXp()` → Drizzle upsert（`onConflictDoUpdate` + `last_room_code` 幂等 guard）
5. 读回 xp → `getLevel()` → 更新 level → 返回 `PlayerSettleResult[]`

### 幂等保证

`user_stats.last_room_code` 列：`ON CONFLICT DO UPDATE` 的 `WHERE` 子句排除重复 room_code，`meta.changes === 0` 时跳过该玩家。

### WebSocket 单播

`GameRoom.#sendSettleResults(results)` 遍历已连接 WebSocket，`deserializeAttachment()` 读 userId，匹配后发送 `{ type: 'SETTLE_RESULT', xpEarned, newXp, newLevel, previousLevel }`。

---

## 4. 客户端接收链路

```
GameRoom DO → WebSocket → CFRealtimeService.#parseMessage (SETTLE_RESULT)
  → ConnectionManager.onSettleResult → GameFacade.handleSettleResult
  → #settleResultListeners → useSettleToast → sonner-native toast
```

### Toast 展示逻辑（`src/hooks/useSettleToast.ts`）

| 场景      | Toast                                      |
| --------- | ------------------------------------------ |
| 获取 XP   | `toast.info("+{xp} XP")`                   |
| 升级+解锁 | `toast.success("升级！Lv.{n} 解锁{奖励}")` |

---

## 5. UI 触点

### 设置页 GrowthSection（`src/screens/SettingsScreen/components/GrowthSection.tsx`）

- 等级标签 `Lv.{n}`
- 已完成局数
- XP 进度条（当前/下一级阈值）
- 下一级奖励预告

### 头像选择页（`src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx`）

- 已解锁头像可选，未解锁头像灰色 + 提示"提升等级后可解锁更多头像"
- 已解锁头像框可选，未解锁头像框提示"达到 Lv.{n} 解锁"
- 解锁判断基于 `fetchUserStats().level` → `getUnlockedAvatars` / `isFrameUnlocked`

### API

| Method | Path              | Response                     |
| ------ | ----------------- | ---------------------------- |
| GET    | `/api/user/stats` | `{ xp, level, gamesPlayed }` |

---

## 6. D1 Schema（Drizzle ORM）

### user_stats（0008 + 0009 migration）

| Column         | Type    | 说明                    |
| -------------- | ------- | ----------------------- |
| user_id        | TEXT PK | references users(id)    |
| xp             | INTEGER | 累计 XP                 |
| level          | INTEGER | 当前等级                |
| games_played   | INTEGER | 有效局数                |
| last_room_code | TEXT    | 幂等 guard（0009 新增） |
| updated_at     | TEXT    | 最后更新时间            |

### 已删除表（0009 migration DROP）

- `game_results` — 游戏历史记录
- `user_role_collection` — 角色收集记录

---

## 7. 文件清单

| 路径                                                      | 职责                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| `packages/game-engine/src/growth/level.ts`                | 等级阈值 + `getLevel` + `getLevelProgress` + `rollXp` |
| `packages/game-engine/src/growth/frameUnlock.ts`          | 等级奖励表 + 解锁查询                                 |
| `packages/game-engine/src/growth/index.ts`                | Barrel export                                         |
| `packages/api-worker/src/growth/settleGameResults.ts`     | 服务端结算                                            |
| `packages/api-worker/src/handlers/statsHandlers.ts`       | GET /api/user/stats                                   |
| `packages/api-worker/migrations/0009_simplify_growth.sql` | D1 migration                                          |
| `src/services/feature/StatsService.ts`                    | 客户端 stats 查询                                     |
| `src/hooks/useSettleToast.ts`                             | 结算 toast                                            |
| `src/screens/SettingsScreen/components/GrowthSection.tsx` | 设置页成长区块                                        |
| `src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx`   | 头像选择（等级解锁）                                  |
| 个人主页月相 banner（上局结果，看过消失）                 | `src/screens/SettingsScreen/`                         |
