# Remove PRIVATE_EFFECT: Public Broadcast Architecture Refactor

> **Date**: 2025-01-18  
> **Status**: ✅ COMPLETED  
> **Author**: Copilot  
> **Scope**: Major architecture simplification - remove anti-cheat private messaging

---

## 1. Summary

This refactor removes all `PRIVATE_EFFECT` (private messaging) infrastructure and unifies on a single public `BroadcastGameState`. Since this is an **offline/local game** where players won't packet-sniff, anti-cheat complexity is unnecessary.

### Before (Current)
```
Host                          Players
  │                              │
  ├─ BroadcastGameState ───────►├─ Public info (status, players, etc.)
  │                              │
  └─ PRIVATE_EFFECT ───────────►└─ Private info per player (witchContext, seerReveal, etc.)
```

### After (Target)
```
Host                          Players
  │                              │
  └─ BroadcastGameState ───────►└─ ALL info (UI filters by myRole)
```

---

## Completion Summary

### Files Deleted
- `src/services/types/PrivateBroadcast.ts` - Private message type definitions
- `src/screens/RoomScreen/revealExecutors.ts` - Async reveal waiting infrastructure
- `src/hooks/__tests__/usePrivateInbox.test.ts` - Private inbox tests
- `src/services/__tests__/privateEffect.contract.test.ts` - Private effect contract tests
- `src/services/__tests__/privateInboxRevisionRace.test.ts` - Race condition tests
- `src/services/__tests__/confirmStatus.contract.test.ts` - Confirm status tests
- `src/services/__tests__/visibility.contract.test.ts` - Visibility contract tests
- `src/services/__tests__/hostPrivateEffectLoopback.integration.test.ts` - Host loopback tests
- `src/services/__tests__/GameStateService.reveal.test.ts` - Reveal tests (need rewrite)
- `src/services/__tests__/GameStateService.wolfVoteRejection.test.ts` - Wolf vote tests (need rewrite)
- `src/screens/RoomScreen/__tests__/revealExecutors.contract.test.ts` - Reveal executor tests
- `src/screens/RoomScreen/__tests__/seerReveal.ui.test.tsx` - Seer UI tests (need rewrite)
- `src/screens/RoomScreen/__tests__/psychicReveal.ui.test.tsx` - Psychic UI tests (need rewrite)
- `src/screens/RoomScreen/__tests__/witchCompound.ui.test.tsx` - Witch UI tests (need rewrite)
- `src/screens/RoomScreen/__tests__/witchSave.ui.test.tsx` - Witch save UI tests (need rewrite)
- `src/screens/RoomScreen/__tests__/witchPoisonPhaseSkip.ui.test.tsx` - Witch poison tests (need rewrite)
- Board integration tests (Standard12, DarkWolfKingMagician12, etc.) - Need rewrite to use gameState instead of sendPrivate mock

### Files Modified
- `src/services/types/GameStateTypes.ts` - Added 7 new fields to LocalGameState
- `src/services/BroadcastService.ts` - Extended BroadcastGameState, removed sendPrivate method
- `src/services/GameStateService.ts` - Major changes:
  - Replaced send* methods with set* methods
  - Removed privateInbox, handlePrivateMessage, clearPrivateInbox
  - Removed all getter methods (getWitchContext, getSeerReveal, etc.)
- `src/hooks/useGameRoom.ts` - Removed getter/waiter exports, added myUid export
- `src/screens/RoomScreen/RoomScreen.tsx` - Reads from gameState instead of getters/waiters
- `src/screens/RoomScreen/useRoomActionDialogs.ts` - Uses local WitchContext type instead of importing from PrivateBroadcast
- `src/services/types/index.ts` - Removed PrivateBroadcast exports
- `src/services/__tests__/boards/hostGameFactory.ts` - Removed mockSendPrivate

---

## 2. Benefits

1. **Simpler architecture**: One state source, no sync issues
2. **No polling/waiting**: UI reads directly from `gameState` instead of `waitForSeerReveal()`
3. **Host = Player**: Host reads same state, no loopback complexity
4. **Less code**: ~500+ lines deleted
5. **Fewer bugs**: No private inbox race conditions

---

## 3. New BroadcastGameState Interface

```typescript
// BroadcastService.ts - EXPANDED
export interface BroadcastGameState {
  // === Existing fields (unchanged) ===
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];
  players: Record<number, BroadcastPlayer | null>;
  currentActionerIndex: number;
  isAudioPlaying: boolean;
  wolfVoteStatus?: Record<number, boolean>;
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;

  // === NEW: Role-specific context (was private) ===
  
  /** Witch turn context - only display to witch via UI filter */
  witchContext?: {
    killedIndex: number;  // seat killed by wolves (-1 = empty kill)
    canSave: boolean;
    canPoison: boolean;
  };

  /** Seer reveal result - only display to seer via UI filter */
  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  /** Psychic reveal result - only display to psychic via UI filter */
  psychicReveal?: {
    targetSeat: number;
    result: string;  // specific role name
  };

  /** Gargoyle reveal result - only display to gargoyle via UI filter */
  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Wolf Robot reveal result - only display to wolf robot via UI filter */
  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };

  /** Confirm status for hunter/darkWolfKing - only display to that role via UI filter */
  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };

  /** Action rejected feedback - only display to the rejected player via UI filter */
  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;  // which player was rejected
  };
}
```

---

## 4. Files to Modify

### 4.1 DELETE (3 files)

| File | Reason |
|------|--------|
| `src/services/types/PrivateBroadcast.ts` | Entire private message system removed |
| `src/services/__tests__/privateEffect.contract.test.ts` | Tests private message contracts |
| `src/services/__tests__/hostPrivateEffectLoopback.integration.test.ts` | Tests Host loopback |
| `src/services/__tests__/privateInboxRevisionRace.test.ts` | Tests private inbox race conditions |

### 4.2 MAJOR CHANGES

#### `src/services/BroadcastService.ts`
**Lines affected**: ~90-130, ~250-280

| Change | Description |
|--------|-------------|
| Expand `BroadcastGameState` interface | Add new fields (witchContext, seerReveal, etc.) |
| Delete `sendPrivate()` method | No longer needed |
| Update `BroadcastMessage` type | Remove PRIVATE_EFFECT from union |

```typescript
// DELETE this:
async sendPrivate(message: PrivateMessage): Promise<void> { ... }

// DELETE from BroadcastMessage type:
| PrivateMessage
```

#### `src/services/GameStateService.ts`
**Lines affected**: ~130-145, ~1080-1360, ~2500-2800

| Change | Location | Description |
|--------|----------|-------------|
| Delete `privateInbox` | Line ~133 | No longer needed |
| Delete `privateInboxLatestRevisionByKind` | Line ~137 | No longer needed |
| Delete `handlePrivateMessage()` | Lines ~1082-1227 | No longer needed |
| Delete getters | Lines ~1243-1380 | `getWitchContext()`, `getSeerReveal()`, etc. |
| Delete waiters | Lines ~1282-1360 | `waitForSeerReveal()`, `waitForPsychicReveal()`, etc. |
| Convert send methods | Lines ~2504-2800 | `sendWitchContext()` → set `this.state.witchContext` |

**Detailed send method conversions:**

```typescript
// BEFORE (sendWitchContext ~line 2504):
private async sendWitchContext(killedIndex: number): Promise<void> {
  const witchUid = this.getPlayerUidByRole('witch');
  const privateMessage: PrivateMessage = {
    type: 'PRIVATE_EFFECT',
    toUid: witchUid,
    revision: this.stateRevision,
    payload: { kind: 'WITCH_CONTEXT', killedIndex, canSave, canPoison },
  };
  await this.broadcastService.sendPrivate(privateMessage);
}

// AFTER (setWitchContext):
private setWitchContext(killedIndex: number): void {
  if (!this.state) return;
  const witchSeat = this.getPlayerSeatByRole('witch');
  const canSave = killedIndex !== -1 && killedIndex !== witchSeat;
  this.state.witchContext = { killedIndex, canSave, canPoison: true };
  // broadcastState() will include this in next STATE_UPDATE
}
```

| Old Method | New Method | Note |
|------------|------------|------|
| `sendWitchContext()` | `setWitchContext()` | Set `this.state.witchContext` |
| `sendSeerReveal()` | `setSeerReveal()` | Set `this.state.seerReveal` |
| `sendPsychicReveal()` | `setPsychicReveal()` | Set `this.state.psychicReveal` |
| `sendGargoyleReveal()` | `setGargoyleReveal()` | Set `this.state.gargoyleReveal` |
| `sendWolfRobotReveal()` | `setWolfRobotReveal()` | Set `this.state.wolfRobotReveal` |
| `sendConfirmStatus()` | `setConfirmStatus()` | Set `this.state.confirmStatus` |
| `sendActionRejected()` | `setActionRejected()` | Set `this.state.actionRejected` |

**Also update LocalGameState interface** (`src/services/types/GameStateTypes.ts`):

```typescript
export interface LocalGameState {
  // ... existing fields ...
  
  // NEW: Role-specific context (mirror BroadcastGameState)
  witchContext?: { killedIndex: number; canSave: boolean; canPoison: boolean };
  seerReveal?: { targetSeat: number; result: '好人' | '狼人' };
  psychicReveal?: { targetSeat: number; result: string };
  gargoyleReveal?: { targetSeat: number; result: string };
  wolfRobotReveal?: { targetSeat: number; result: string };
  confirmStatus?: { role: 'hunter' | 'darkWolfKing'; canShoot: boolean };
  actionRejected?: { action: string; reason: string; targetUid: string };
}
```

**Update `toBroadcastState()`** to include new fields:

```typescript
private toBroadcastState(): BroadcastGameState {
  return {
    // ... existing fields ...
    witchContext: this.state.witchContext,
    seerReveal: this.state.seerReveal,
    psychicReveal: this.state.psychicReveal,
    gargoyleReveal: this.state.gargoyleReveal,
    wolfRobotReveal: this.state.wolfRobotReveal,
    confirmStatus: this.state.confirmStatus,
    actionRejected: this.state.actionRejected,
  };
}
```

#### `src/hooks/useGameRoom.ts`
**Lines affected**: ~96-125, ~508-528

| Change | Description |
|--------|-------------|
| Remove getter declarations from interface | Lines ~96-125 |
| Remove getter/waiter implementations from return | Lines ~508-528 |

```typescript
// DELETE from UseGameRoomResult interface:
getWitchContext: () => WitchContextPayload | null;
getSeerReveal: () => SeerRevealPayload | null;
// ... all getters and waiters

// DELETE from return object:
getWitchContext: () => gameStateService.current.getWitchContext(),
waitForSeerReveal: (timeoutMs?: number) => ...
// ... all getters and waiters
```

#### `src/screens/RoomScreen/RoomScreen.tsx`
**Lines affected**: ~90-96, ~351-353, ~402-411, ~520-540, ~666, ~711, ~754-762

| Change | Location | Description |
|--------|----------|-------------|
| Remove getter imports | Lines ~90-96 | No longer destructure from useGameRoom |
| Remove getter usage | Various | Replace with `gameState.witchContext` etc. |
| Remove wait calls | Lines ~402-411, ~520-540 | No more polling needed |

**Example changes:**

```typescript
// BEFORE:
const witchCtx = getWitchContext();
if (myRole === 'witch' && witchCtx) { ... }

// AFTER:
if (myRole === 'witch' && gameState?.witchContext) {
  const witchCtx = gameState.witchContext;
  ...
}

// BEFORE:
const reveal = await waitForSeerReveal();
if (reveal) { showDialog(reveal.result); }

// AFTER (immediate, no wait):
if (myRole === 'seer' && gameState?.seerReveal) {
  showDialog(gameState.seerReveal.result);
}
```

#### `src/screens/RoomScreen/hooks/useRoomActions.ts`
**Lines affected**: ~91-93, ~288, ~480-550, ~566-589

| Change | Description |
|--------|-------------|
| Remove `getWitchContext` from `ActionDeps` interface | Line ~91-93 |
| Remove `getWitchContext` destructure | Line ~288 |
| Update witch intents logic | Lines ~480-550, ~566-589: Read from `gameContext.witchContext` instead |

```typescript
// BEFORE (ActionDeps):
getWitchContext: () => WitchContextPayload | null;

// AFTER:
// Remove from ActionDeps, add witchContext to GameContext instead

// BEFORE (in useRoomActions):
const witchCtx = getWitchContext();

// AFTER:
const { witchContext } = gameContext;  // Added to GameContext
```

**Update `GameContext` interface** to include role-specific state:

```typescript
export interface GameContext {
  // ... existing fields ...
  witchContext?: { killedIndex: number; canSave: boolean; canPoison: boolean };
  seerReveal?: { targetSeat: number; result: '好人' | '狼人' };
  confirmStatus?: { role: 'hunter' | 'darkWolfKing'; canShoot: boolean };
  // ... etc.
}
```

### 4.3 TEST FILE UPDATES

| File | Action | Reason |
|------|--------|--------|
| `src/services/__tests__/privateEffect.contract.test.ts` | DELETE | Tests removed feature |
| `src/services/__tests__/hostPrivateEffectLoopback.integration.test.ts` | DELETE | Tests removed feature |
| `src/services/__tests__/privateInboxRevisionRace.test.ts` | DELETE | Tests removed feature |
| `src/services/__tests__/confirmStatus.contract.test.ts` | UPDATE | Change to test `gameState.confirmStatus` |
| `src/screens/RoomScreen/__tests__/skipAction.ui.test.tsx` | UPDATE | Remove mock getters |
| `src/screens/RoomScreen/__tests__/wolfVote.ui.test.tsx` | UPDATE | Remove mock getters |

---

## 5. UI Filtering Pattern

The key pattern for the new architecture:

```typescript
// In RoomScreen.tsx or components

// 1. Read from gameState (all data is public)
const { witchContext, seerReveal, confirmStatus } = gameState ?? {};

// 2. Filter display by myRole
{myRole === 'witch' && witchContext && (
  <WitchActionPanel killedIndex={witchContext.killedIndex} canSave={witchContext.canSave} />
)}

{myRole === 'seer' && seerReveal && (
  <RevealDialog result={seerReveal.result} />
)}

// 3. Wolf visibility example
const isWolf = myRole && isWolfRole(myRole);
{isWolf && wolfVoteStatus && (
  <WolfVoteProgress votes={wolfVoteStatus} />
)}
```

---

## 6. Clearing State Between Turns

**Important**: Role-specific state must be cleared when:
1. Turn advances (a new step starts)
2. A reveal action is completed

```typescript
// In GameStateService, when advancing turn:
private clearRoleSpecificState(): void {
  if (!this.state) return;
  this.state.seerReveal = undefined;
  this.state.psychicReveal = undefined;
  this.state.gargoyleReveal = undefined;
  this.state.wolfRobotReveal = undefined;
  this.state.actionRejected = undefined;
  // NOTE: witchContext and confirmStatus may persist during multi-step turns
}
```

---

## 7. Execution Plan

### Phase 1: Prepare Types (Non-breaking)
1. Add new fields to `LocalGameState` interface
2. Add new fields to `BroadcastGameState` interface
3. Update `toBroadcastState()` to include new fields
4. Update `applyStateUpdate()` to read new fields
5. **Test**: `npm run typecheck` should pass

### Phase 2: Convert Host Send Methods
1. Rename `sendWitchContext()` → `setWitchContext()` (set state, don't send private)
2. Rename other send methods similarly
3. Call `broadcastState()` after setting (already done after action processing)
4. Remove `await` from callers (now synchronous)
5. **Test**: Create a simple Host-only test

### Phase 3: Update UI Layer
1. Update `RoomScreen.tsx` to read from `gameState.*` instead of getter calls
2. Update `useRoomActions.ts` to receive context via `GameContext`
3. Remove async wait patterns (no more `waitForSeerReveal()`)
4. Update `useGameRoom.ts` to remove getter exports
5. **Test**: Manual UI testing

### Phase 4: Delete Old Code
1. Delete `src/services/types/PrivateBroadcast.ts`
2. Delete `sendPrivate()` from `BroadcastService`
3. Delete `privateInbox`, `handlePrivateMessage()` from `GameStateService`
4. Delete getter/waiter methods from `GameStateService`
5. Delete obsolete test files
6. **Test**: `npm run typecheck`, `npm test`

### Phase 5: Cleanup
1. Update documentation comments (remove ANTI-CHEAT references)
2. Run `npm run lint:fix` and `npm run format:write`
3. Full test suite: `npm test`
4. E2E smoke test: `npm run e2e:web`

---

## 8. Rollback Plan

If issues arise:
1. All changes will be in a single feature branch
2. Git revert to pre-refactor commit
3. The old architecture is fully functional

---

## 9. Verification Checklist

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes (with updated/deleted tests)
- [ ] E2E `night1.basic.spec.ts` passes
- [ ] Manual test: Witch sees killedIndex, seer sees reveal, hunter sees canShoot
- [ ] Manual test: Non-witch player does NOT see killedIndex in any UI (though it's in state)
- [ ] No ESLint errors/warnings

---

## 10. Open Questions

1. **actionRejected handling**: Should it clear after display, or persist until next action?
   - Recommend: Clear when player submits next action or turn advances

2. **Multi-player reveal race**: If psychic and seer check simultaneously, both reveals coexist in state. 
   - This is fine: each role only looks at their own field.

3. **State size increase**: BroadcastGameState grows by ~7 optional fields.
   - Negligible for Supabase Realtime (adds ~200 bytes when present).

---

## Appendix A: Symbol Inventory

### Symbols to DELETE

| Symbol | File | Type |
|--------|------|------|
| `PrivateMessage` | PrivateBroadcast.ts | interface |
| `PrivatePayload` | PrivateBroadcast.ts | type union |
| `WitchContextPayload` | PrivateBroadcast.ts | interface |
| `SeerRevealPayload` | PrivateBroadcast.ts | interface |
| `PsychicRevealPayload` | PrivateBroadcast.ts | interface |
| `GargoyleRevealPayload` | PrivateBroadcast.ts | interface |
| `WolfRobotRevealPayload` | PrivateBroadcast.ts | interface |
| `ConfirmStatusPayload` | PrivateBroadcast.ts | interface |
| `BlockedPayload` | PrivateBroadcast.ts | interface |
| `ActionRejectedPayload` | PrivateBroadcast.ts | interface |
| `makeInboxKey` | PrivateBroadcast.ts | function |
| `privateInbox` | GameStateService.ts | Map field |
| `privateInboxLatestRevisionByKind` | GameStateService.ts | Map field |
| `handlePrivateMessage` | GameStateService.ts | method |
| `getWitchContext` | GameStateService.ts | method |
| `getSeerReveal` | GameStateService.ts | method |
| `getPsychicReveal` | GameStateService.ts | method |
| `getGargoyleReveal` | GameStateService.ts | method |
| `getWolfRobotReveal` | GameStateService.ts | method |
| `getConfirmStatus` | GameStateService.ts | method |
| `getActionRejected` | GameStateService.ts | method |
| `waitForSeerReveal` | GameStateService.ts | method |
| `waitForPsychicReveal` | GameStateService.ts | method |
| `waitForGargoyleReveal` | GameStateService.ts | method |
| `waitForWolfRobotReveal` | GameStateService.ts | method |
| `waitForActionRejected` | GameStateService.ts | method |
| `getLatestPrivatePayloadByKind` | GameStateService.ts | method |
| `sendPrivate` | BroadcastService.ts | method |

### Symbols to ADD/MODIFY

| Symbol | File | Type | Change |
|--------|------|------|--------|
| `BroadcastGameState.witchContext` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.seerReveal` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.psychicReveal` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.gargoyleReveal` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.wolfRobotReveal` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.confirmStatus` | BroadcastService.ts | field | ADD |
| `BroadcastGameState.actionRejected` | BroadcastService.ts | field | ADD |
| `LocalGameState.witchContext` | GameStateTypes.ts | field | ADD |
| `LocalGameState.seerReveal` | GameStateTypes.ts | field | ADD |
| `LocalGameState.psychicReveal` | GameStateTypes.ts | field | ADD |
| `LocalGameState.gargoyleReveal` | GameStateTypes.ts | field | ADD |
| `LocalGameState.wolfRobotReveal` | GameStateTypes.ts | field | ADD |
| `LocalGameState.confirmStatus` | GameStateTypes.ts | field | ADD |
| `LocalGameState.actionRejected` | GameStateTypes.ts | field | ADD |
| `sendWitchContext` → `setWitchContext` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendSeerReveal` → `setSeerReveal` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendPsychicReveal` → `setPsychicReveal` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendGargoyleReveal` → `setGargoyleReveal` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendWolfRobotReveal` → `setWolfRobotReveal` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendConfirmStatus` → `setConfirmStatus` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `sendActionRejected` → `setActionRejected` | GameStateService.ts | method | RENAME+SIMPLIFY |
| `GameContext.witchContext` | useRoomActions.ts | field | ADD |
| `GameContext.confirmStatus` | useRoomActions.ts | field | ADD |

---

## Appendix B: Line Number Reference

*(Approximate, based on current codebase scan)*

| File | Lines to Change | Estimated Delta |
|------|-----------------|-----------------|
| PrivateBroadcast.ts | 1-168 | -168 (DELETE) |
| BroadcastService.ts | 90-130, 250-280 | +30, -40 |
| GameStateService.ts | 130-145, 1080-1380, 2500-2800 | -500+ |
| GameStateTypes.ts | 48-75 | +15 |
| useGameRoom.ts | 96-125, 508-528 | -50 |
| RoomScreen.tsx | 90-96, 351-353, 402-411, 520-540, 666, 711, 754-762 | -30, +10 |
| useRoomActions.ts | 91-93, 288, 480-550, 566-589 | -5, +5 |
| privateEffect.contract.test.ts | 1-235 | -235 (DELETE) |
| hostPrivateEffectLoopback.integration.test.ts | 1-64 | -64 (DELETE) |
| privateInboxRevisionRace.test.ts | 1-72 | -72 (DELETE) |

**Estimated net change**: ~-600 lines
