# User Growth System Design

## 0. Core Premises

### Valid Game Definition

> `status === Ended` and the room has **≥ 9 distinct real players** (`uid` deduplicated, including anonymous).
> XP is only written for registered users with `is_anonymous = 0`; anonymous players only count toward the valid game player threshold.

### Growth System

| Dimension    | Driver                                 | Display                                    |
| ------------ | -------------------------------------- | ------------------------------------------ |
| XP/Level     | 50 + random(0~20) XP per valid game    | Progress bar on settings page              |
| Level Unlock | 52 levels, 1 avatar or frame per level | Avatar picker page + settings page preview |

### Not-Doing List

| Not Doing               | Reason                                                            |
| ----------------------- | ----------------------------------------------------------------- |
| Win/loss/outcome        | App doesn't know who won; manual reporting is unreliable          |
| Moon phase system       | Removed; XP simplified to fixed base + random                     |
| Role collection/journal | Removed; recording which roles played = cheating info             |
| Game history            | Removed; game continues after Night-1, viewing records = cheating |
| Title system            | Not needed                                                        |
| Leaderboard             | Party game doesn't need competitive pressure                      |
| Daily quests/check-in   | Heavy system, violates lightweight principle                      |
| Settlement popup        | Interrupts face-to-face gameplay; use non-blocking toast instead  |

---

## 1. Level System

### Threshold Table (52 levels Lv.0–Lv.51)

| Range    | Per-Level Increment | Cumulative Start |
| -------- | ------------------- | ---------------- |
| Lv.1–20  | +60                 | 60               |
| Lv.21–40 | +90                 | 1200 + 90        |
| Lv.41–51 | +120                | 3000 + 120       |

`LEVEL_THRESHOLDS` is computed via IIFE (`packages/game-engine/src/growth/level.ts`).

### XP Calculation

```
rollXp() = 50 + crypto.getRandomValues(Uint32Array)[0] % 21
```

Range [50, 70], expected ~60. Early: 1 game/level, later: 2 games/level.

---

## 2. Level Unlock Rewards

`packages/game-engine/src/growth/frameUnlock.ts`

- Lv.0 free: villager avatar + ironForge avatar frame
- Lv.1–51 one reward per level (42 avatars + 9 avatar frames), frames interspersed roughly every 5–6 levels
- All avatar keys correspond to `AVATAR_KEYS` (`src/utils/avatar.ts`)
- All avatar frame IDs correspond to `AVATAR_FRAMES` (`src/components/avatarFrames/index.ts`)

### Query API

| Function                          | Returns                                  |
| --------------------------------- | ---------------------------------------- |
| `getLevelReward(level)`           | Reward for that level (undefined = none) |
| `getUnlockedAvatars(level)`       | Set of unlocked avatar keys              |
| `getUnlockedFrames(level)`        | Set of unlocked frame IDs                |
| `isFrameUnlocked(frameId, level)` | Whether a frame is unlocked              |

---

## 3. Server-Side Settlement

`packages/api-worker/src/growth/settleGameResults.ts`

### Flow

1. `AUDIO_ACK` reaches ended state, then `werewolfSettlementEffects` runs `settleGameResults(state, env)`
2. Collects non-empty non-bot player UIDs, checks `≥ MIN_PLAYERS`
3. Queries D1 (via Drizzle ORM) to filter anonymous users
4. Per registered player: `rollXp()` → Drizzle upsert (`onConflictDoUpdate` + `last_room_code` idempotency guard)
5. Reads back xp → `getLevel()` → updates level → returns `PlayerSettleResult[]`

### Idempotency Guarantee

`user_stats.last_room_code` column: `ON CONFLICT DO UPDATE`'s `WHERE` clause excludes duplicate room_code; when `meta.changes === 0`, that player is skipped.

### WebSocket Unicast

`werewolfSettlementEffects.sendSettleResults(results)` iterates connected WebSockets, `deserializeAttachment()` reads userId, matches then sends `{ type: 'SETTLE_RESULT', xpEarned, newXp, newLevel, previousLevel }`.

---

## 4. Client Receive Chain

```
GameRoom DO settlement effect → WebSocket → CFRealtimeService.#parseMessage (SETTLE_RESULT)
  → ConnectionManager.onSettleResult → WerewolfFacade.handleSettleResult
  → #settleResultListeners → useSettleToast → sonner-native toast
```

### Toast Display Logic (`src/hooks/useSettleToast.ts`)

| Scenario        | Toast                                      |
| --------------- | ------------------------------------------ |
| XP gained       | `toast.info("+{xp} XP")`                   |
| Level up+unlock | `toast.success("升级！Lv.{n} 解锁{奖励}")` |

---

## 5. UI Touch Points

### Settings Page GrowthSection (`src/screens/SettingsScreen/components/GrowthSection.tsx`)

- Level badge `Lv.{n}`
- Games played count
- XP progress bar (current / next level threshold)
- Next level reward preview

### Avatar Picker Page (`src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx`)

- Unlocked avatars are selectable; locked avatars grayed out + hint "提升等级后可解锁更多头像"
- Unlocked frames are selectable; locked frames show hint "达到 Lv.{n} 解锁"
- Unlock checks based on `fetchUserStats().level` → `getUnlockedAvatars` / `isFrameUnlocked`

### API

| Method | Path              | Response                     |
| ------ | ----------------- | ---------------------------- |
| GET    | `/api/user/stats` | `{ xp, level, gamesPlayed }` |

---

## 6. D1 Schema (Drizzle ORM)

### user_stats (0008 + 0009 migration)

| Column         | Type    | Notes                             |
| -------------- | ------- | --------------------------------- |
| user_id        | TEXT PK | references users(id)              |
| xp             | INTEGER | Cumulative XP                     |
| level          | INTEGER | Current level                     |
| games_played   | INTEGER | Valid games count                 |
| last_room_code | TEXT    | Idempotency guard (added in 0009) |
| updated_at     | TEXT    | Last update time                  |

### Dropped Tables (0009 migration DROP)

- `game_results` — Game history records
- `user_role_collection` — Role collection records

---

## 7. File List

| Path                                                                       | Responsibility                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `packages/game-engine/src/growth/level.ts`                                 | Level thresholds + `getLevel` + `getLevelProgress` + `rollXp` |
| `packages/game-engine/src/growth/frameUnlock.ts`                           | Level reward table + unlock queries                           |
| `packages/game-engine/src/growth/index.ts`                                 | Barrel export                                                 |
| `packages/api-worker/src/growth/settleGameResults.ts`                      | Server-side settlement                                        |
| `packages/api-worker/src/handlers/statsHandlers.ts`                        | GET /api/user/stats                                           |
| `packages/api-worker/migrations/0009_simplify_growth.sql`                  | D1 migration                                                  |
| `src/services/feature/StatsService.ts`                                     | Client stats query                                            |
| `src/hooks/useSettleToast.ts`                                              | Settlement toast                                              |
| `src/screens/SettingsScreen/components/GrowthSection.tsx`                  | Settings page growth section                                  |
| `src/screens/AvatarPickerScreen/AvatarPickerScreen.tsx`                    | Avatar picker (level unlock)                                  |
| Profile page moon phase banner (last game result, disappears after viewed) | `src/screens/SettingsScreen/`                                 |
