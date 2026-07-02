# Gacha System Detailed Design

> Status: **Implemented** (completed 2026-04-19)  
> Authors: Copilot + eyan  
> Date: 2026-04-17 (design) · 2026-04-19 (implementation complete)

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Existing Architecture Analysis](#2-existing-architecture-analysis)
3. [Data Model Changes](#3-data-model-changes)
4. [Probability Engine](#4-probability-engine)
5. [Rarity Distribution](#5-rarity-distribution)
6. [Server Implementation](#6-server-implementation) (incl. §6.7 Daily Login Reward)
7. [Client Implementation](#7-client-implementation)
8. [Animation Design](#8-animation-design)
9. [Implementation Steps](#9-implementation-steps)
10. [Edge Cases & Risks](#10-edge-cases--risks)

---

## 1. System Overview

### 1.1 Motivation

Existing growth system: gain 50–70 XP per game → level up → `pickRandomReward()` directly gives 1 random unlocked item. Problems with this approach:

- **No ceremony**: Level unlock only shows a toast, players likely miss it
- **No active engagement**: Rewards auto-deposit, players have no participation in "receiving"
- **Single source**: Only leveling gives rewards; if no level-up after a game, only "+55 XP" is shown

### 1.2 Goals

Introduce gacha mechanism:

- Each valid game earns 1 **Normal Ticket**, each level-up earns 1 **Golden Ticket**
- Players actively spend tickets on the gacha page, supporting single and 10-pull
- Build a controlled collection experience through probability table + pity + deduplication
- Gacha machine animation provides ceremony
- Daily login reward of 1 normal ticket increases daily active retention

### 1.3 Architecture Constraints

| Constraint           | Description                                                                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server authoritative | Probability calculation, ticket deduction, item grants all execute on Worker. Client only submits "draw" request and displays server-returned results |
| Game engine purity   | `@werewolf/game-engine` holds probability pure functions (`rollRarity`/`selectReward`), no IO / DB operations                                         |
| Trust model          | Face-to-face party game, no extra anti-cheat architecture, but server validates ticket balance                                                        |
| Atomic deployment    | Worker + Pages deploy atomically, no old/new version coexistence, API changes are directly breaking                                                   |

---

## 2. Existing Architecture Analysis

### 2.1 Item Registry

**File**: `packages/game-engine/src/growth/rewardCatalog.ts`

- 4 item types: `avatar`(43) / `frame`(170) / `seatFlair`(180) / `nameStyle`(170)
- `REWARD_POOL`: 563 drawable items, `RewardItem { type, id, rarity }`
- 4 rarities: Common(319) / Rare(164) / Epic(55) / Legendary(25)

### 2.2 Random Selection

**File**: `packages/game-engine/src/growth/frameUnlock.ts`

- `pickRandomReward(unlockedIds, randomFn, level)` — determines priority type by level modulo 5/7/3, filters already-unlocked, randomly picks one
- Gacha system will **replace this function** (no longer type-by-level; instead roll rarity first, then randomly pick from that rarity pool)

### 2.3 Settlement Chain

```
Game ends
  → GameRoom engineAction(AUDIO_ACK) post-commit effect
    → werewolfSettlementEffects.runWerewolfPostCommitEffects()
    → settleGameResults() [packages/api-worker/src/growth/settleGameResults.ts]
      → per player: rollXp() → Drizzle upsert → check level up → pickRandomReward()
    → sendSettleResults() — WebSocket unicast SETTLE_RESULT
    → updateRosterLevels() — broadcast UPDATE_ROSTER_LEVELS action

Client
  → CFRealtimeService parses SETTLE_RESULT
    → facade.handleSettleResult()
      → useSettleToast hook shows toast
```

**Key change point**: `settleGameResults()` no longer calls `pickRandomReward()`, instead increments ticket count.

### 2.4 D1 Schema

**File**: `packages/api-worker/src/db/schema.ts`

```
user_stats:
  userId (PK, FK→users)
  xp (INTEGER)
  level (INTEGER)
  gamesPlayed (INTEGER)
  lastRoomCode (TEXT, idempotency key)
  unlockedItems (TEXT, JSON array of string IDs)
  updatedAt (TEXT)
```

Added: `normal_draws`, `golden_draws`, `normal_pity`, `golden_pity`, `version` (OCC), `last_login_reward_at` columns + `draw_history` table.

### 2.5 API Route Structure

**File**: `packages/api-worker/src/index.ts`

Existing growth-related routes mounted at `/api` (`statsRoutes`):

- `GET /api/user/stats`
- `GET /api/user/:userId/profile`
- `GET /api/user/:userId/unlocks`

New gacha route approach: add `/api/gacha/*` within the `/api` route group.

### 2.6 Migration Numbers

Gacha-related migrations: `0013_gacha_system.sql` (base columns + draw_history), `0015_gacha_version.sql` (OCC version column), `0016_daily_login_reward.sql` (last_login_reward_at column).

---

## 3. Data Model Changes

### 3.1 D1 Migration: `0013_gacha_system.sql`

```sql
-- Add gacha-related columns to user_stats table
ALTER TABLE user_stats ADD COLUMN normal_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_draws INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN normal_pity INTEGER NOT NULL DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN golden_pity INTEGER NOT NULL DEFAULT 0;

-- Draw history records
CREATE TABLE draw_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  draw_type TEXT NOT NULL,        -- 'normal' | 'golden'
  rarity TEXT NOT NULL,           -- 'common' | 'rare' | 'epic' | 'legendary'
  item_type TEXT NOT NULL,        -- 'avatar' | 'frame' | 'seatFlair' | 'nameStyle'
  item_id TEXT NOT NULL,
  pity_count INTEGER NOT NULL,    -- pity count at time of draw (0 = first, 9 = pity triggered)
  was_pity INTEGER NOT NULL DEFAULT 0,  -- 1 = this draw was pity-triggered
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_draw_history_user ON draw_history(user_id);
CREATE INDEX idx_draw_history_created ON draw_history(created_at);
```

**Column descriptions**:

| Column         | Type    | Description                                                        |
| -------------- | ------- | ------------------------------------------------------------------ |
| `normal_draws` | INTEGER | Unused normal draw ticket count                                    |
| `golden_draws` | INTEGER | Unused golden draw ticket count                                    |
| `normal_pity`  | INTEGER | Normal draw consecutive non-pity count (0–9), resets after trigger |
| `golden_pity`  | INTEGER | Golden draw consecutive non-pity count (0–9), resets after trigger |

`draw_history` is used for: debug tracing, potential future "draw history" UI, probability auditing. Not involved in real-time logic (pity is maintained by `user_stats` columns, no need to query history table for calculation).

### 3.2 Drizzle Schema Update

`packages/api-worker/src/db/schema.ts` — `userStats` table gains 4 columns:

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

New `drawHistory` table definition:

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

### 3.3 RewardItem Gains Rarity

`packages/game-engine/src/growth/rewardCatalog.ts`:

```typescript
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
  readonly rarity: Rarity;
}
```

Each entry in `REWARD_POOL` gains a `rarity` field. Specific distribution in §5.

### 3.4 SettleResultMessage Changes

`src/services/types/IRealtimeTransport.ts`:

```typescript
export interface SettleResultMessage {
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number; // usually = 1 (valid game)
  goldenDrawsEarned: number; // = 1 on level-up (0 otherwise)
}
```

`reward` field removed outright (Web client + Worker deploy atomically, no old/new version coexistence).

---

## 4. Probability Engine

### 4.1 Probability Table

**Normal Draw** (source: 1 ticket per valid game):

| Rarity    | Probability | Description     |
| --------- | ----------- | --------------- |
| Common    | 84.5%       | Basic items     |
| Rare      | 10%         | Mid quality     |
| Epic      | 4%          | High quality    |
| Legendary | 1.5%        | Highest quality |

**Golden Draw** (source: 1 ticket per level-up):

| Rarity    | Probability | Description     |
| --------- | ----------- | --------------- |
| Common    | 69%         | Basic items     |
| Rare      | 20%         | Mid quality     |
| Epic      | 8%          | High quality    |
| Legendary | 3%          | Highest quality |

### 4.2 Pity Mechanism

| Draw Type   | Pity Threshold                              | Pity Content                                                 |
| ----------- | ------------------------------------------- | ------------------------------------------------------------ |
| Normal Draw | 10 consecutive draws without Rare or higher | 10th draw guarantees Rare+ (re-roll excluding Common only)   |
| Golden Draw | 10 consecutive draws without Epic or higher | 10th draw guarantees Epic+ (re-roll excluding Common + Rare) |

**Pity Count Rules**:

- +1 after each draw (regardless of result)
- Resets to 0 when drawing above the pity threshold rarity
- Normal draw: drawing Rare/Epic/Legendary → reset
- Golden draw: drawing Epic/Legendary → reset
- When reaching 10, pity forcibly triggers (this draw doesn't consume count, directly resets to 0)
- **10-pull calculates pity independently per draw** (multi-pull is not rolling 10 results at once then settling together)

### 4.3 Deduplication Mechanism

**Pool Removal System**:

- `selectReward(rarity, unlockedIds)` filters `REWARD_POOL` for `rarity === target && !unlockedIds.has(id)`
- If target rarity pool is empty (all of that rarity collected), upgrade upward: Common empty → Rare → Epic → Legendary
- If all 563 items collected → draws disallowed, API returns `{ success: false, reason: 'ALL_COLLECTED' }`
- Client ticket badge shows "已集齐", draw button disabled, **tickets preserved, not wasted**

### 4.4 Pure Function Implementation Location

**File**: `packages/game-engine/src/growth/gachaProbability.ts` (new)

```typescript
// ── Constants ──
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

// ── Core Functions ──

/**
 * Roll rarity based on draw type and pity count.
 *
 * @param drawType - 'normal' | 'golden'
 * @param pityCount - current pity count (0–9)
 * @param randomValue - random number in [0, 100) (caller provides, server uses crypto)
 * @returns { rarity, pityReset } — pityReset: true means pity was reset
 */
export function rollRarity(
  drawType: DrawType,
  pityCount: number,
  randomValue: number,
): { rarity: Rarity; pityReset: boolean };

/**
 * Select an item from the unlocked pool of the specified rarity.
 * If target rarity is empty, upgrade upward (Common→Rare→Epic→Legendary).
 * Returns undefined if all collected.
 *
 * @param targetRarity - rarity returned by rollRarity
 * @param unlockedIds - set of owned item IDs
 * @param randomFn - random integer in [0, max)
 */
export function selectReward(
  targetRarity: Rarity,
  unlockedIds: ReadonlySet<string>,
  randomFn: (max: number) => number,
): RewardItem | undefined;
```

**Why pure functions**:

- Random numbers injected by caller (`randomValue` / `randomFn`), function itself has no side effects
- Client can reuse for probability preview/simulation (doesn't affect server authority)
- Easy to unit test, 100% deterministically verifiable

### 4.5 Probability Verification Tests

`packages/game-engine/src/__tests__/gachaProbability.test.ts` (new)

Scenarios to cover:

| Test                                         | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `rollRarity` normal probability distribution | 100K simulations, each rarity deviation < 1%     |
| `rollRarity` golden probability distribution | Same as above                                    |
| Normal pity triggers on 10th draw            | When pityCount=9, must not return Common         |
| Golden pity triggers on 10th draw            | When pityCount=9, must not return Common or Rare |
| Pity resets on natural high-rarity draw      | pityCount=5 draws Rare → pityReset=true          |
| `selectReward` normal selection              | Given rarity returns item of that rarity         |
| `selectReward` rarity upgrade                | Common pool empty → returns Rare item            |
| `selectReward` all collected                 | Returns undefined                                |
| `selectReward` won't return owned items      | Filter verification                              |

---

## 5. Rarity Distribution

### 5.1 Overview

| Type       | Total   | Legendary | Epic   | Rare    | Common  |
| ---------- | ------- | --------- | ------ | ------- | ------- |
| Avatars    | 43      | 3         | 7      | 14      | 19      |
| Frames     | 170     | 11        | 9      | 50      | 100     |
| SeatFlairs | 180     | 7         | 23     | 50      | 100     |
| NameStyles | 170     | 4         | 16     | 50      | 100     |
| **Total**  | **563** | **25**    | **55** | **164** | **319** |

> Note: Exact numbers defer to `REWARD_POOL` in `packages/game-engine/src/growth/rewardCatalog.ts`.

### 5.2 Specific Distribution

#### Avatars (42)

**Legendary (3)**: `darkWolfKing` / `nightmare` / `masquerade`

**Epic (7)**: `wolfKing` / `wolfQueen` / `bloodMoon` / `spiritKnight` / `awakenedGargoyle` / `witch` / `seer`

**Rare (14)**: `hunter` / `guard` / `knight` / `magician` / `piper` / `poisoner` / `gargoyle` / `dreamcatcher` / `avenger` / `mirrorSeer` / `psychic` / `cursedFox` / `witcher` / `wolfWitch`

**Common (19)**: `wolf` / `wolfRobot` / `crow` / `cupid` / `dancer` / `drunkSeer` / `graveyardKeeper` / `idiot` / `maskedMan` / `pureWhite` / `shadow` / `silenceElder` / `slacker` / `thief` / `treasureMaster` / `votebanElder` / `warden` / `wildChild` / `halfblood`

> `villager` is a free default avatar, not in REWARD_POOL.

#### Frames (170)

Generated by `{shape}_{color}` naming convention. 10 shapes (circle / diamond / hexagon / octagon / pentagon / shield / square / star / triangle / rounded) × 10 colors (gold / silver / bronze / ruby / sapphire / emerald / amethyst / obsidian / pearl / rose), totaling 100 Common. Plus 50 Rare (hand-drawn themed frames), 9 Epic (glowing effect frames), 11 Legendary (full-screen animated frames).

See `packages/game-engine/src/growth/rewardCatalog.ts` — `FRAME_IDS` / frame rarity assignments.

#### SeatFlairs (180)

100 Common (basic SVG animations) + 50 Rare + 23 Epic + 7 Legendary.

See `packages/game-engine/src/growth/rewardCatalog.ts` — `SEAT_FLAIR_IDS` / flair rarity assignments.

#### NameStyles (170)

100 Common (basic gradient text) + 50 Rare + 16 Epic + 4 Legendary.

See `packages/game-engine/src/growth/rewardCatalog.ts` — `NAME_STYLE_IDS` / nameStyle rarity assignments.

### 5.3 Collection Expectation Analysis

Assuming only normal draws (1 ticket per game):

| Rarity         | Pool Size | Single Probability | Expected Draws to Complete (incl. pity)        |
| -------------- | --------- | ------------------ | ---------------------------------------------- |
| Common (319)   | 319       | 84.5%              | ~319 / 0.845 ≈ 378 draws                       |
| Rare (164)     | 164       | 10% (+pity)        | Effective rate ~15% (incl. pity) → ~1093 draws |
| Epic (55)      | 55        | 4%                 | ~1375 draws                                    |
| Legendary (25) | 25        | 1.5%               | ~1667 draws                                    |

Full collection of 563 items: ~2000+ games (normal draws only, excluding golden draw acceleration). Golden draws have 3× legendary probability + ~52 tickets from leveling, significantly shortening mid-to-late collection. Daily login rewards provide a steady non-gameplay ticket source (1/day).

---

## 6. Server Implementation

### 6.1 Settlement Refactor: `settleGameResults.ts`

**Changes**:

```diff
 // 3. Iterate registered players, settle XP
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
+    // Each valid game → +1 normal ticket
+    let normalDrawsEarned = 1;
+    let goldenDrawsEarned = 0;
+
+    if (newLevel > previousLevel) {
+      // Each level-up → +1 golden ticket
+      goldenDrawsEarned = newLevel - previousLevel;
+      await db.update(userStats).set({ level: newLevel }).where(eq(userStats.userId, uid));
+    }
+
+    // Accumulate tickets
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

**`PlayerSettleResult` interface changes**:

```typescript
export interface PlayerSettleResult {
  uid: string;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
  // reward field removed
}
```

**`sendSettleResults` changes**: WebSocket message adds `normalDrawsEarned` / `goldenDrawsEarned` fields.

### 6.2 New Gacha API: `gachaHandlers.ts`

**File**: `packages/api-worker/src/handlers/gachaHandlers.ts`

**Routes**:

#### `GET /api/gacha/status`

Returns current user's gacha status.

```typescript
// Response
{
  normalDraws: number; // available normal tickets
  goldenDraws: number; // available golden tickets
  normalPity: number; // normal pity count
  goldenPity: number; // golden pity count
  totalCollected: number; // total items collected
  totalItems: 112; // total collectible items
  allCollected: boolean; // whether all collected
}
```

#### `POST /api/gacha/draw`

Execute draw.

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
    isNew: true; // always true in gacha system (deduplication)
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
  reason: 'INSUFFICIENT_DRAWS' | // not enough tickets
    'ALL_COLLECTED' | // all collected
    'VALIDATION_ERROR'; // parameter error
}
```

**Server logic pseudocode**:

```
POST /api/gacha/draw:
1. requireAuth → userId
2. Validate body: { drawType ∈ ['normal','golden'], count ∈ [1, 10] }
3. BEGIN transaction (D1 doesn't support real transactions, use batch or sequential validation)
4. Read user_stats: normalDraws/goldenDraws/normalPity/goldenPity/unlockedItems
5. Check ticket balance >= count, otherwise → INSUFFICIENT_DRAWS
6. Parse unlockedItems → Set<string>
7. Check REWARD_POOL.length - unlockedSet.size > 0, otherwise → ALL_COLLECTED
8. results = []
9. FOR i = 0 to count-1:
   a. cryptoRandomValue = crypto random [0, 100)
   b. { rarity, pityReset } = rollRarity(drawType, currentPity, cryptoRandomValue)
   c. item = selectReward(rarity, unlockedSet, cryptoRandomInt)
   d. IF item is undefined → break (pool emptied, but already checked above, theoretically won't happen)
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

### 6.3 New Zod Schema

**File**: `packages/api-worker/src/schemas/gacha.ts`

```typescript
import { z } from 'zod';

export const drawSchema = z.object({
  drawType: z.enum(['normal', 'golden']),
  count: z.union([z.literal(1), z.literal(10)]),
});
```

### 6.4 Route Mounting

`packages/api-worker/src/index.ts`:

```diff
 import { statsRoutes } from './handlers/statsHandlers';
+import { gachaRoutes } from './handlers/gachaHandlers';

 // ... existing routes ...
 app.route('/api', statsRoutes);
+app.route('/api', gachaRoutes);
```

### 6.5 Idempotency & Concurrency Safety

- **Settlement idempotency**: Existing `lastRoomCode` mechanism ensures no duplicate settlement per game
- **Draw concurrency — OCC (Optimistic Concurrency Control)**: `user_stats.version` column (Migration `0015`). Each draw reads version → writes with `WHERE version = readVersion`; 0 affected rows triggers retry (MAX_DRAW_RETRIES=3). Stricter than D1 balance conditions, prevents two concurrent draws from reading the same snapshot and double-deducting
- **Random number security**: `crypto.getRandomValues()` generates `percent [0, 100)` and `int [0, max)`, no modulo bias (Uint32 range 4.29B)

### 6.6 seed-local.mjs Update

`scripts/seed-local.mjs` updated: sets initial ticket count for dev user.

```sql
UPDATE user_stats SET
  normal_draws = 50,
  golden_draws = 10,
  normal_pity = 0,
  golden_pity = 0
WHERE user_id = '00000000-0000-4000-a000-000000000001';
```

### 6.7 Daily Login Reward

**Migration**: `0016_daily_login_reward.sql` — `ALTER TABLE user_stats ADD COLUMN last_login_reward_at TEXT;`

**Schema**: `packages/api-worker/src/schemas/gacha.ts`

```typescript
export const dailyRewardSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Endpoint**: `POST /api/gacha/daily-reward` (requireAuth)

**Mechanism**:

- Client passes `localDate` (player's local date YYYY-MM-DD, `new Date().toLocaleDateString('en-CA')`)
- Server checks:
  1. No user_stats row → auto-create (`INSERT ... ON CONFLICT DO UPDATE`)
  2. `lastLoginRewardAt === localDate` → `{ claimed: false, reason: 'already_claimed' }`
  3. Less than 20h since last claim → `{ claimed: false, reason: 'cooldown' }`
  4. Passes → `normalDraws + 1`, update `lastLoginRewardAt`, return `{ claimed: true, normalDrawsAdded: 1 }`
- 20h cooldown guard prevents timezone abuse (face-to-face party game trust model, lightweight protection suffices)
- OCC retry (MAX_DRAW_RETRIES=3), reuses draw concurrency safety pattern

**Client auto-claim**: `useAutoClaimDailyReward()` hook:

- Mounted on HomeScreen, checks `status.lastLoginRewardAt !== today` on app startup
- Auto-calls `claimDailyReward(getLocalDate())`, on success toasts "每日登录奖励 / 获得 1 次普通抽！"
- `attemptedRef` ensures only one attempt per session

---

## 7. Client Implementation

### 7.1 Settlement Toast Refactor

**File**: `src/hooks/useSettleToast.ts`

Before:

```
Level up + reward → "升级！Lv.3 解锁 头像「猎人」"
Level up → "升级！Lv.3"
Normal → "+55 XP"
```

After:

```
Level up + golden ticket → "升级 Lv.3！获得黄金抽奖机会 🎰", description: "+55 XP · 抽奖券 +1"
Normal (every game has normal ticket) → "+55 XP · 获得抽奖券"
```

**SettleResultMessage interface changes**: Directly replaced with §3.4 definition (remove `reward` field, `normalDrawsEarned`/`goldenDrawsEarned` are required).

**CFRealtimeService parsing changes**: Parse new fields, remove old `reward` parsing logic.

### 7.2 New Gacha Service

**File**: `src/services/feature/GachaService.ts`

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

**File**: `src/hooks/queries/useGachaQuery.ts`

```typescript
// useGachaStatusQuery — queryKey: ['gachaStatus']
// staleTime: 30s (refresh on page entry, but not too frequently)
// Anonymous users return empty state (consistent with useUserStatsQuery pattern)

// Draw uses useMutation:
// useDraw mutation — onSuccess invalidates ['gachaStatus'] + ['userStats'] + ['userUnlocks']
```

### 7.4 Navigation Registration

`src/navigation/types.ts`:

```typescript
export type RootStackParamList = {
  // ...existing...
  Gacha: undefined;
};
```

### 7.5 HomeScreen Entry

Add gacha entry button in HomeScreen's action area (near existing "百科" / "设置" row):

- **Icon**: 🎰 or custom Skia icon
- **Badge**: Shows available ticket total `normalDraws + goldenDraws` (no badge when 0)
- **Text**: `已集齐` replaces ticket badge when all collected
- **Anonymous users**: Entry not shown (consistent with Settings GrowthSection pattern)
- **Position**: Next to encyclopedia (same flex row)

### 7.6 GachaScreen Structure

**File**: `src/screens/GachaScreen/GachaScreen.tsx`

```
GachaScreen
├── Top navigation bar (back)
├── Gacha machine animation area (Skia Canvas)
│   ├── Transparent glass dome (with capsule ball physics simulation)
│   ├── Machine body + dial + tube
│   └── Landing area (opening animation)
├── Status bar
│   ├── Normal ticket count + Golden ticket count
│   ├── Collection progress "42/112"
│   └── Pity countdown "Pity in {10-pity} draws"
├── Action button area
│   ├── Normal ×1 / ×10
│   └── Golden ×1 / ×10 (each disabled when tickets insufficient or all collected)
└── Recent results display (last draw results, emoji + name + rarity color)
```

**10-pull Result Overlay**: Full-screen modal, 5×2 grid, cards sorted by rarity fly in sequentially (consistent with prototype V6).

### 7.7 Query Invalidation Chain

Queries to invalidate after successful draw:

| Query Key                 | Reason                     |
| ------------------------- | -------------------------- |
| `['gachaStatus']`         | Ticket count, pity changed |
| `['userStats']`           | `unlockedItems` changed    |
| `['userUnlocks', userId]` | Same as above              |

No need to invalidate `['userStats']` XP/level data (draws don't affect those). But `unlockedItems` is in the same response, so invalidate entirely.

---

## 8. Animation Design

### 8.1 Tech Choice

**Skia Canvas** (`@shopify/react-native-skia`, already a project dependency) for all animations. HTML Canvas prototype validated feasibility in V6.

### 8.2 Scene Description

#### Gacha Machine Static Structure

| Part          | Description                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Glass dome    | Circular, transparent feel (left arc highlight + top-right ellipse highlight + bottom arc glow + very low alpha fill)                    |
| Capsule balls | 28 balls, upper half various colors + lower half white + "?" mark, with collision physics. All balls look identical, don't reveal rarity |
| Machine body  | Rectangular dark container, title text ("GOLDEN GACHA" / "GACHA"), metallic texture                                                      |
| Dial          | Circular metal dial, center crosshair + handle dot                                                                                       |
| Tube          | Exit channel from dome bottom to ground                                                                                                  |
| Ground        | Horizontal line + light shadow                                                                                                           |

#### Single Draw Flow (~4 seconds)

| Phase       | Time               | Description                                                                                                                       |
| ----------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Stirring    | 0–2.2s             | Rotation force (sine direction switching) + centripetal force + random perturbation. Dial rotates in sync, screen slightly shakes |
| Settling    | 2.2–2.6s           | Force decays, balls settle under gravity                                                                                          |
| Gate opens  | 2.6s               | Bottom gate opens, bottom ball pushed toward hole                                                                                 |
| Drop        | 2.6–3.5s           | 1 ball passes through tube, gravity accelerates, bounces on landing (3–4 dampening bounces)                                       |
| Gate closes | After exit         | Immediately closes                                                                                                                |
| Auto-open   | 0.5s after landing | Shell cracks (10 triangular shards fly outward) + rarity-color full-screen flash + 28 sparkle particles                           |
| Reveal      | After open         | Item emoji (48px) + name + rarity label + bottom glow                                                                             |

#### 10-Pull Flow (~8 seconds)

| Phase            | Time              | Description                                                                                                                      |
| ---------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Stirring         | 0–2.2s            | Same as single                                                                                                                   |
| Settling         | 2.2–2.6s          | Same as single                                                                                                                   |
| Gate opens       | 2.6s              | Gate opens wide (tube widens 28→40px), **stays open**                                                                            |
| Batch drop       | 2.6–5s            | 10 balls rush out from dome, each with random horizontal velocity, scatter and bounce on ground                                  |
| Gate closes      | After all 10 exit | Closes                                                                                                                           |
| Wait for landing | 5–6s              | All balls finish bouncing, stabilize on ground                                                                                   |
| Sequential open  | 6–8.5s            | Auto-open one every 0.25s. Shell crack + small flash + position shows emoji. Effects smaller than single (avoid visual overload) |
| Result panel     | 8.5s+             | Full-screen overlay: 5×2 grid, sorted by rarity, cards fly in sequentially (80ms interval)                                       |

### 8.3 Physics Parameters

| Parameter            | Value                                                     | Notes                     |
| -------------------- | --------------------------------------------------------- | ------------------------- |
| Gravity              | 500 px/s²                                                 |                           |
| Collision elasticity | 0.7                                                       | Ball-ball, ball-wall      |
| Friction coefficient | 0.985/frame                                               | Velocity decay            |
| Ball radius          | 14px (in dome) / 18px (single drop) / 16px (10-pull drop) |                           |
| Collision solver     | 3-pass per frame                                          | Handle dense stacking     |
| Dome radius          | 125px                                                     |                           |
| Stirring force       | 3000 × strength                                           | strength rises then falls |

### 8.4 Rarity Visual Mapping

| Rarity    | Color     | Glow                   | Crack Effect                                                          |
| --------- | --------- | ---------------------- | --------------------------------------------------------------------- |
| Common    | `#9E9E9E` | `rgba(158,158,158,.3)` | Standard crack                                                        |
| Rare      | `#4A90D9` | `rgba(74,144,217,.4)`  | Blue crack + more particles                                           |
| Epic      | `#9B59B6` | `rgba(155,89,182,.5)`  | Purple crack + full-screen purple flash                               |
| Legendary | `#F5A623` | `rgba(245,166,35,.5)`  | Gold crack + full-screen gold light + big shake + extra particle ring |

---

## 9. Implementation Steps

### Phase 1a — rewardCatalog.ts Add Rarity

**Changed files**:

- `packages/game-engine/src/growth/rewardCatalog.ts` — Add `Rarity` type, `RewardItem` gains `rarity` field, each `REWARD_POOL` entry gains `rarity`
- `packages/game-engine/src/index.ts` — export `Rarity`

**Impact analysis**:

- `pickRandomReward()` params unchanged, not affected (doesn't read rarity field)
- `REWARD_POOL` consumers: `pickRandomReward`, `getUnlockedAvatars/Frames/Flairs/NameStyles`, seed-local.mjs — none read rarity, safe
- Type change: `RewardItem` gains a required field. All places constructing `RewardItem` need updating → only `REWARD_POOL` itself (add rarity in map function)

**Tests**: All existing tests should pass (rarity is a new field that doesn't break existing functionality).

### Phase 1b — New gachaProbability.ts + Tests

**New files**:

- `packages/game-engine/src/growth/gachaProbability.ts`
- `packages/game-engine/src/__tests__/gachaProbability.test.ts`
- `packages/game-engine/src/growth/index.ts` — add re-export
- `packages/game-engine/src/index.ts` — add export

**Test coverage**: All scenarios listed in §4.5.

### Phase 1c — D1 Migration + Drizzle Schema

**New files**:

- `packages/api-worker/migrations/0013_gacha_system.sql`

**Changed files**:

- `packages/api-worker/src/db/schema.ts` — add 4 columns + drawHistory table

**Impact analysis**:

- New columns have DEFAULT values, don't affect existing data
- Drizzle schema new columns: all `select({...})` explicitly list column names, not affected (don't use `select()` select-all)
- `settleGameResults.ts` upsert values don't include new columns (use DEFAULT) → safe

### Phase 1d — settleGameResults.ts Refactor

**Changed files**:

- `packages/api-worker/src/growth/settleGameResults.ts` — Remove `pickRandomReward` call, replace with ticket accumulation
- `packages/api-worker/src/durableObjects/effects/werewolfSettlementEffects.ts` — `sendSettleResults` adds fields
- `src/services/types/IRealtimeTransport.ts` — `SettleResultMessage` replaced with ticket count fields (remove `reward`)
- `src/services/cloudflare/CFRealtimeService.ts` — Parse new fields
- `src/hooks/useSettleToast.ts` — Display changed to ticket notification

**Impact analysis**:

- `PlayerSettleResult` interface change: `reward` → `normalDrawsEarned` / `goldenDrawsEarned`
- Consumers: `sendSettleResults`, `updateRosterLevels` — former needs change, latter unaffected
- `getRewardDisplayName` function no longer needed (delete)
- `useSettleToast`'s `showSettleToast` logic rewritten

### Phase 1e — Gacha API Handler

**New files**:

- `packages/api-worker/src/handlers/gachaHandlers.ts`
- `packages/api-worker/src/schemas/gacha.ts`

**Changed files**:

- `packages/api-worker/src/index.ts` — mount routes

### Phase 1f — Client Data Layer

**New files**:

- `src/services/feature/GachaService.ts`
- `src/hooks/queries/useGachaQuery.ts`

### Phase 1g — seed-local.mjs Update

**Changed files**:

- `scripts/seed-local.mjs` — add gacha column initial values

### Phase 2 — GachaScreen + Animation

**New files**:

- `src/screens/GachaScreen/GachaScreen.tsx`
- `src/screens/GachaScreen/components/CapsuleMachine.tsx` — Skia animation component
- `src/screens/GachaScreen/components/TenResultOverlay.tsx` — 10-pull result panel
- `src/screens/GachaScreen/hooks/usePhysicsEngine.ts` — Physics simulation hook

**Changed files**:

- `src/navigation/types.ts` — add Gacha route
- `src/navigation/` — Stack.Screen registration
- `src/screens/HomeScreen/HomeScreen.tsx` — add entry button + badge

### Phase 3 — Polish

- Legendary special full-screen animation (dedicated visual enhancement)
- Draw sound effects (draw start / crack / reveal / legendary exclusive)
- Draw history page (optional, queries from draw_history table)
- UnlocksScreen add rarity label display

---

## 10. Edge Cases & Risks

### 10.1 Edge Cases

| Scenario                       | Handling                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 10-pull but only 3 tickets     | API returns `INSUFFICIENT_DRAWS`, client button disabled (when count > available)                                                   |
| Pool empties mid-10-pull       | Loop's `selectReward` returns undefined → end loop, only return already-drawn results. Update ticket deduction to actual draw count |
| All 563 items collected        | GET status → `allCollected: true`, client draw button disabled, badge shows "已集齐"                                                |
| Anonymous user                 | No settlement, no tickets, entry not shown                                                                                          |
| Offline / disconnected         | Draw is HTTP POST, standard cfPost timeout+error handling. On failure `showAlert('抽奖失败', '请稍后重试')`                         |
| Multi-device simultaneous draw | D1 UPDATE WHERE balance sufficient, second request rejected due to insufficient balance                                             |
| Settlement retry (alarm)       | Existing retry mechanism unchanged, new `normalDrawsEarned` field correct on retry (idempotent upsert)                              |

### 10.2 Risks

| Risk                                                     | Level    | Mitigation                                                                                                                                                                                                       |
| -------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1 concurrency race (two draws reading same balance)     | Low      | D1 single writer guarantee. UPDATE SET WHERE condition as safety net                                                                                                                                             |
| Probability bias (crypto.getRandomValues modulo bias)    | Very Low | Uint32 range 4.29B, modulo 100 bias < 0.0000024%                                                                                                                                                                 |
| Partial failure mid-10-pull (partial DB write success)   | Low      | 10 draws execute serially in same handler, D1 write atomicity is sufficient. Worst case: some items written but tickets not deducted → user gains extra items (acceptable risk). Can further reduce with batch() |
| Skia animation performance (28 ball physics + particles) | Medium   | HTML prototype verified smooth. Skia's GPU acceleration should be better. If needed, reduce ball count to 20                                                                                                     |
| Probability engine bug                                   | Medium   | §4.5 test coverage + 100K Monte Carlo verification                                                                                                                                                               |
