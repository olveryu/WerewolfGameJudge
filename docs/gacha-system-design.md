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

The original growth flow granted an item automatically on level-up. The current system separates
growth earnings from reward draws: settlement grants tickets, and the player spends tickets through
the server-authoritative gacha API.

- **No ceremony**: Level unlock only shows a toast, players likely miss it
- **No active engagement**: Rewards auto-deposit, players have no participation in "receiving"
- **Single source**: Automatic level-up grants did not support daily rewards, pity, or shard exchange

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
| Game engine purity   | `@game-judge/game-engine` holds probability pure functions (`rollRarity`/`selectReward`), no IO / DB operations                                       |
| Trust model          | Face-to-face party game, no extra anti-cheat architecture, but server validates ticket balance                                                        |
| Atomic deployment    | Worker + Pages deploy atomically, no old/new version coexistence, API changes are directly breaking                                                   |

---

## 2. Existing Architecture Analysis

### 2.1 Item Registry

**File**: `packages/game-engine/src/product/rewards/catalog.ts`

- 6 item types: avatar, frame, seat flair, name style, role-reveal effect, and seat animation
- `REWARD_POOL`: 1018 drawable items, `RewardItem { type, id, rarity }`
- 4 rarities: Common(500) / Rare(250) / Epic(219) / Legendary(49)

### 2.2 Random Selection

**File**: `packages/game-engine/src/product/rewards/gacha.ts`

- `rollRarity(drawType, pityCount, randomValue)` selects a rarity and applies the pity floor
- `selectReward(rarity, unlockedIds, rng)` selects only from that exact rarity pool
- Duplicate items remain valid results and are converted to rarity-based shards
- The injected `Rng` contract is shared with `platform/random` and fails fast outside `[0, 1)`

### 2.3 Settlement Chain

```
Game ends
  → generic effect outbox commits werewolf.game.ended
    → Werewolf effect handler
      → settleGameResults() [packages/api-worker/src/games/werewolf/settlement/settleGameResults.ts]
      → effect-idempotent D1 ledger + user_stats + camp history
      → internal roster-level command
      → durable user_event_inbox SETTLE_RESULT

Client
  → shared RoomSession decodes the acknowledged user event
    → useWerewolfSettleToast shows toast and invalidates product queries
```

**Settlement boundary**: `settleGameResults()` updates XP and ticket earnings only. Item selection is
owned by the authenticated gacha route, not by game settlement.

### 2.4 D1 Schema

**File**: `packages/api-worker/src/db/applicationSchema.ts`

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

Gacha-related migrations: `0013_gacha_system.sql` (base columns + draw_history), `0015_gacha_version.sql` (OCC version column), `0016_daily_login_reward.sql` (last_login_reward_at column), `0022_gacha_idempotency_keys.sql` (replay table), and `0039_gacha_mutation_ledger.sql` (atomic claim/application state).

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

`packages/api-worker/src/db/applicationSchema.ts` — `userStats` table gains 4 columns:

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
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  drawType: text('draw_type').notNull(),
  rarity: text('rarity').notNull(),
  rewardType: text('reward_type').notNull(),
  rewardId: text('reward_id').notNull(),
  pityCount: integer('pity_count').notNull(),
  isPityTriggered: integer('is_pity_triggered').notNull().default(0),
  isDuplicate: integer('is_duplicate').notNull().default(0),
  shardsAwarded: integer('shards_awarded').notNull().default(0),
  createdAt: text('created_at').notNull(),
});
```

`idempotency_keys` is the mutation ledger, not a best-effort response cache:

```sql
CREATE TABLE idempotency_keys (
  key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claim_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('draw', 'exchange')),
  is_applied INTEGER NOT NULL CHECK (is_applied IN (0, 1)),
  response TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`claim_id` identifies the one request allowed to apply a globally unique key. Only rows with
`is_applied = 1` are externally replayable; an unapplied claim is deleted inside the same D1 batch.

### 3.3 RewardItem Gains Rarity

`packages/game-engine/src/product/rewards/catalog.ts`:

```typescript
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface RewardItem {
  readonly type: RewardType;
  readonly id: string;
  readonly rarity: Rarity;
}
```

Each entry in `REWARD_POOL` gains a `rarity` field. Specific distribution in §5.

### 3.4 Werewolf Settlement Event

`src/games/werewolf/realtime/werewolfUserEventCodec.ts`:

```typescript
export interface WerewolfSettlementEvent {
  type: 'SETTLE_RESULT';
  eventId: string;
  gameType: 'werewolf';
  settlementId: string;
  endedRevision: number;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
}
```

`reward` field was removed outright. The Worker and client use one strict game-owned event shape; no old/new version coexistence.

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

### 4.3 Duplicate and Shard Mechanism

- `selectReward(rarity, unlockedIds, rng)` samples the complete pool for the exact rolled rarity
- Owned items can be selected again; they produce `SHARD_VALUES[rarity]` instead of another unlock
- New items are appended to `unlockedItems`; duplicates leave the collection unchanged
- Shards can be exchanged for a specific catalog item through `POST /api/gacha/exchange`
- Every rarity pool is validated at module initialization; an empty pool is a catalog error and fails fast

### 4.4 Pure Function Implementation Location

**File**: `packages/game-engine/src/product/rewards/gacha.ts` (new)

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
 * Select an item from the exact target-rarity pool.
 * Owned items remain selectable and are converted to shards.
 *
 * @param targetRarity - rarity returned by rollRarity
 * @param unlockedIds - set of owned item IDs
 * @param rng - random number generator returning a float in [0, 1)
 */
export function selectReward(
  targetRarity: Rarity,
  unlockedIds: ReadonlySet<string>,
  rng: Rng,
): SelectRewardResult;
```

**Why pure functions**:

- Random numbers injected by caller (`randomValue` / `randomFn`), function itself has no side effects
- Client can reuse for probability preview/simulation (doesn't affect server authority)
- Easy to unit test, 100% deterministically verifiable

### 4.5 Probability Verification Tests

`packages/game-engine/src/product/rewards/__tests__/gacha.test.ts` (new)

Scenarios to cover:

| Test                                         | Description                                      |
| -------------------------------------------- | ------------------------------------------------ |
| `rollRarity` normal probability distribution | 100K simulations, each rarity deviation < 1%     |
| `rollRarity` golden probability distribution | Same as above                                    |
| Normal pity triggers on 10th draw            | When pityCount=9, must not return Common         |
| Golden pity triggers on 10th draw            | When pityCount=9, must not return Common or Rare |
| Pity resets on natural high-rarity draw      | pityCount=5 draws Rare → pityReset=true          |
| `selectReward` exact-rarity selection        | Returned item has the requested rarity           |
| `selectReward` duplicate conversion          | Owned item returns the configured shard amount   |
| `selectReward` complete collection           | Owned items remain drawable as duplicates        |
| `selectReward` invalid RNG                   | Values outside `[0, 1)` fail fast                |

---

## 5. Rarity Distribution

### 5.1 Overview

| Type                | Total    | Legendary | Epic    | Rare    | Common  |
| ------------------- | -------- | --------- | ------- | ------- | ------- |
| Avatars             | 196      | 11        | 35      | 50      | 100     |
| Frames              | 200      | 11        | 39      | 50      | 100     |
| Seat flairs         | 210      | 7         | 53      | 50      | 100     |
| Name styles         | 200      | 4         | 46      | 50      | 100     |
| Role-reveal effects | 12       | 6         | 6       | 0       | 0       |
| Seat animations     | 200      | 10        | 40      | 50      | 100     |
| **Total**           | **1018** | **49**    | **219** | **250** | **500** |

> `REWARD_POOL` in `packages/game-engine/src/product/rewards/catalog.ts` is authoritative. Contract
> tests verify both the total and per-rarity distribution.

### 5.2 Specific Distribution

The catalog owns the complete ordered ID arrays and rarity maps. Client registries consume those IDs
and contract tests reject missing assets or duplicate IDs. The design document intentionally does not
copy the full ID list because that would create a second source of truth.

### 5.3 Collection Expectation Analysis

Draws are with replacement. Collection completion therefore has no fixed draw count: duplicate rates
rise over time and duplicates become shards for deterministic exchange. Probability disclosure reads
`NORMAL_RATES` / `GOLDEN_RATES`; collection progress reads `TOTAL_UNLOCKABLE_COUNT`. No UI or API
hardcodes the catalog total.

---

## 6. Server Implementation

### 6.1 Settlement Refactor: `settleGameResults.ts`

**Changes**:

- Only the Werewolf `game.ended` effect triggers growth settlement today
- At least six human participants are required; bots never receive account rewards
- Reward RNG is seeded by `effectId + userId + reward kind`, so retries reproduce the same result
- `game_settlement_results` is the idempotency ledger and records XP plus normal/golden ticket earnings
- D1 applies the ledger and `user_stats` update once, then publishes a durable per-user result event

**`PlayerSettleResult` interface changes**:

```typescript
export interface PlayerSettleResult {
  userId: string;
  xpEarned: number;
  newXp: number;
  newLevel: number;
  previousLevel: number;
  normalDrawsEarned: number;
  goldenDrawsEarned: number;
}
```

**Settlement user event changes**: the Werewolf effect publishes `normalDrawsEarned` / `goldenDrawsEarned` through the durable user inbox.

### 6.2 Gacha API routes

**File**: `packages/api-worker/src/features/gacha/routes.ts`

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
  shards: number;
  unlockedCount: number;
  lastLoginRewardAt: string | null;
}
```

#### `POST /api/gacha/draw`

Execute draw.

```typescript
// Request body (Zod schema)
{
  drawType: 'normal' | 'golden';
  count: number; // integer in [1, 10]
  idempotencyKey: string; // UUID
}

// Response (success)
{
  results: Array<{
    rarity: Rarity;
    rewardType: RewardType;
    rewardId: string;
    isNew: boolean;
    isPityTriggered: boolean;
    isDuplicate: boolean;
    shardsAwarded: number;
  }>;
  totalShardsAwarded: number;
  remaining: {
    normalDraws: number;
    goldenDraws: number;
  }
}

// Response (failure)
{
  success: false;
  reason: 'INSUFFICIENT_DRAWS' | // not enough tickets
    'NO_STATS' |
    'CONFLICT';
}
```

**Server logic pseudocode**:

```
POST /api/gacha/draw:
1. requireAuth → userId
2. Validate body; return the committed response for the same owner/operation, or 409 on identity conflict
3. Read user_stats with its OCC version
4. Check ticket balance >= count, otherwise → INSUFFICIENT_DRAWS
5. FOR each draw:
   a. use secureRng() to produce the rarity roll
   b. selectReward(rarity, unlockedSet, secureRng) from the exact rarity pool
   c. add a new item, or add shards for a duplicate
   d. update pity and prepare one draw_history row
6. Execute one D1 batch transaction:
   a. INSERT the key/claim/operation/response with is_applied = 0; key conflict is a no-op
   b. INSERT history only when this claim owns the key and user_stats.version = readVersion
   c. mark this claim applied under the same version predicate
   d. UPDATE user_stats under the applied-claim and version predicates
   e. DELETE this claim when it was not applied
7. Read the committed ledger row: replay the winner, or retry from a fresh stats snapshot after OCC loss
```

### 6.3 New Zod Schema

**File**: `packages/api-worker/src/features/gacha/schemas.ts`

```typescript
import { z } from 'zod';

export const gachaDrawSchema = z.object({
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(10).default(1),
  idempotencyKey: z.string().uuid(),
});
```

### 6.4 Route Mounting

`packages/api-worker/src/index.ts`:

```diff
 import { statsRoutes } from './features/account/routes';
+import { gachaRoutes } from './features/gacha/routes';

 // ... existing routes ...
 app.route('/api', statsRoutes);
+app.route('/api', gachaRoutes);
```

### 6.5 Idempotency & Concurrency Safety

- **Settlement idempotency**: `game_settlement_results.effect_id` is the durable settlement ledger
- **Draw/exchange idempotency**: `idempotency_keys.key` is globally unique; owner and operation must match. `claim_id` prevents a losing concurrent request from using the winner's row. Stored responses are parsed by operation-specific Zod schemas before replay.
- **Atomic mutation**: claim, draw history, applied state, and `user_stats` update execute in one `D1Database.batch()` transaction. Any statement error rolls back the whole sequence; no response is committed without the matching balance/version mutation.
- **Draw concurrency — OCC (Optimistic Concurrency Control)**: `user_stats.version` (Migration `0015`) is read before calculation and rechecked inside the ledger transaction. A different-key loser leaves no claim/history and retries from a fresh snapshot (maximum `MAX_GACHA_OCC_ATTEMPTS=3`). Same-key concurrency returns the one committed response and applies one mutation.
- **Random number source**: Worker injects `secureRng` from `platform/random`; selection uses the same validated `[0, 1)` contract as engine tests

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

**Schema**: `packages/api-worker/src/features/gacha/schemas.ts`

```typescript
export const dailyRewardSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
```

**Endpoint**: `POST /api/gacha/daily-reward` (requireAuth)

**Mechanism**:

- Client passes `localDate` (player's local date YYYY-MM-DD, `new Date().toLocaleDateString('en-CA')`)
- Server checks:
  1. No user_stats row → `INSERT ... ON CONFLICT DO NOTHING`; exactly one concurrent request creates and claims it
  2. An insert loser restarts the OCC loop and observes the committed cooldown
  3. Less than 20h since last claim → `{ claimed: false, reason: 'cooldown' }`
  4. Passes → add 1–5 normal draws and one golden draw, update `lastLoginRewardAt`, and bump `version`
- 20h cooldown guard prevents timezone abuse (face-to-face party game trust model, lightweight protection suffices)
- OCC retry (`MAX_GACHA_OCC_ATTEMPTS=3`) reuses the stats-version concurrency pattern

**Client auto-claim**: `useAutoClaimDailyReward()` hook:

- Mounted on HomeScreen, checks `status.lastLoginRewardAt !== today` on app startup
- Auto-calls `claimDailyReward(getLocalDate())`, on success toasts "每日登录奖励 / 获得 1 次普通抽！"
- `attemptedRef` ensures only one attempt per session

---

## 7. Client Implementation

### 7.1 Settlement Toast Refactor

**File**: `src/games/werewolf/hooks/useWerewolfSettleToast.ts`

Before:

```
Level up + reward → "升级！Lv.3 解锁 头像「猎人」"
Level up → "升级！Lv.3"
Normal → "+55 XP"
```

Current toast content reads the committed settlement event. It always shows XP; it adds the exact
`normalDrawsEarned` count when positive and adds the level/golden-ticket message only when those
fields say they were earned.

**SettleResultMessage interface changes**: Directly replaced with §3.4 definition (remove `reward` field, `normalDrawsEarned`/`goldenDrawsEarned` are required).

**RoomSession parsing changes**: the Werewolf user-event codec parses the required ticket fields and rejects malformed payloads.

### 7.2 New Gacha Service

**File**: `src/features/gacha/services/gachaApi.ts`

```typescript
interface GachaStatus {
  normalDraws: number;
  goldenDraws: number;
  normalPity: number;
  goldenPity: number;
  shards: number;
  unlockedCount: number;
  lastLoginRewardAt: string | null;
}

export interface DrawResultItem {
  rarity: Rarity;
  rewardType: RewardType;
  rewardId: string;
  isNew: boolean;
  isPityTriggered: boolean;
  isDuplicate: boolean;
  shardsAwarded: number;
}

export interface DrawResponse {
  results: DrawResultItem[];
  totalShardsAwarded: number;
  remaining: {
    normalDraws: number;
    goldenDraws: number;
  };
}

export async function fetchGachaStatus(): Promise<GachaStatus> {
  return cfGet<GachaStatus>('/api/gacha/status');
}

export async function performDraw(
  drawType: 'normal' | 'golden',
  count: number = 1,
): Promise<DrawResponse> {
  const idempotencyKey = crypto.randomUUID();
  return cfPost<DrawResponse>('/api/gacha/draw', { drawType, count, idempotencyKey });
}
```

### 7.3 TanStack Query Hooks

**File**: `src/features/gacha/queries/useGachaQuery.ts`

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
│   └── Pity countdown "Pity in {10-pity} draws"
├── Action button area
│   ├── Normal ×1 / ×10
│   └── Golden ×1 / ×10 (disabled when tickets are insufficient)
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

### Phase 1a — Reward Catalog Rarity

**Changed files**:

- `packages/game-engine/src/product/rewards/catalog.ts` — Add `Rarity` type, `RewardItem` gains `rarity` field, each `REWARD_POOL` entry gains `rarity`
- `packages/game-engine/src/index.ts` — export `Rarity`

**Impact analysis**:

- `catalog.ts` is the only item-ID and rarity registry
- Client asset registries and Worker reward handlers import the exact `product/rewards` package export
- `RewardItem.rarity` is required and every `REWARD_POOL` entry is built by the catalog

**Tests**: Catalog contracts verify unique IDs, client asset coverage, and rarity totals.

### Phase 1b — Gacha Probability Engine + Tests

**New files**:

- `packages/game-engine/src/product/rewards/gacha.ts`
- `packages/game-engine/src/product/rewards/__tests__/gacha.test.ts`
- `packages/game-engine/src/product/rewards/index.ts` — add re-export
- `packages/game-engine/src/index.ts` — add export

**Test coverage**: All scenarios listed in §4.5.

### Phase 1c — D1 Migration + Drizzle Schema

**New files**:

- `packages/api-worker/migrations/0013_gacha_system.sql`

**Changed files**:

- `packages/api-worker/src/db/applicationSchema.ts` — add 4 columns + drawHistory table

**Impact analysis**:

- New columns have DEFAULT values, don't affect existing data
- Drizzle schema new columns: all `select({...})` explicitly list column names, not affected (don't use `select()` select-all)
- `settleGameResults.ts` upsert values don't include new columns (use DEFAULT) → safe

### Phase 1d — settleGameResults.ts Refactor

**Changed files**:

- `packages/api-worker/src/games/werewolf/settlement/settleGameResults.ts` — persist effect-idempotent XP and ticket earnings
- `packages/api-worker/src/games/werewolf/effects.ts` — publish durable settlement events with ticket fields
- `src/games/werewolf/realtime/werewolfUserEventCodec.ts` — parse the game-owned settlement event
- `src/features/room/session/RoomSession.ts` — deliver and acknowledge durable user events
- `src/games/werewolf/hooks/useWerewolfSettleToast.ts` — Display changed to ticket notification

**Impact analysis**:

- `PlayerSettleResult` interface change: `reward` → `normalDrawsEarned` / `goldenDrawsEarned`
- Consumers: Werewolf internal roster-level command and durable user-event publisher
- `getRewardDisplayName` function no longer needed (delete)
- `useSettleToast`'s `showSettleToast` logic rewritten

### Phase 1e — Gacha API Handler

**New files**:

- `packages/api-worker/src/features/gacha/routes.ts`
- `packages/api-worker/src/features/gacha/schemas.ts`

**Changed files**:

- `packages/api-worker/src/index.ts` — mount routes

### Phase 1f — Client Data Layer

**New files**:

- `src/features/gacha/services/gachaApi.ts`
- `src/features/gacha/queries/useGachaQuery.ts`

### Phase 1g — seed-local.mjs Update

**Changed files**:

- `scripts/seed-local.mjs` — add gacha column initial values

### Phase 2 — GachaScreen + Animation

**New files**:

- `src/screens/GachaScreen/GachaScreen.tsx`
- `src/screens/GachaScreen/components/CapsuleMachine.tsx` — Skia animation component
- `src/screens/GachaScreen/components/TenResultOverlay.tsx` — 10-pull result panel
- `src/screens/GachaScreen/hooks/useGachaPhysics.ts` — Physics simulation hook

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

| Scenario                       | Handling                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 10-pull but only 3 tickets     | API returns `INSUFFICIENT_DRAWS`; client controls are disabled when balance is insufficient          |
| Complete collection            | Draws continue with duplicate-to-shard conversion; deterministic exchange remains available          |
| Missing account stats          | API returns `NO_STATS`; no ticket deduction occurs                                                   |
| Offline / disconnected         | `cfPost` reports the request failure and the client presents the draw error                          |
| Multi-device simultaneous draw | Same key replays one atomic ledger result; different keys serialize through `user_stats.version` OCC |
| Settlement retry               | The effect ledger returns the already-committed per-user result without rolling rewards again        |

### 10.2 Risks

| Risk                                                     | Level  | Mitigation                                                                                                          |
| -------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------- |
| D1 concurrency race (two draws reading same balance)     | Low    | One D1 batch owns the claim, verifies OCC version, writes history, updates stats, and commits the replay atomically |
| Invalid RNG or empty rarity catalog                      | Low    | Shared random contracts and module-initialization checks fail fast before an invalid result can be persisted        |
| Partial failure mid-10-pull                              | Low    | D1 rolls back the claim, all history rows, applied marker, and stats mutation as one batch transaction              |
| Skia animation performance (28 ball physics + particles) | Medium | HTML prototype verified smooth. Skia's GPU acceleration should be better. If needed, reduce ball count to 20        |
| Probability engine bug                                   | Medium | §4.5 test coverage + 100K Monte Carlo verification                                                                  |
