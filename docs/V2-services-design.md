# V2 Services Design (Night-1-only + Guardrails Compliant)

> **Version**: v5 (收口版)
> **Status**: Approved for Phase 1 implementation
> **Scope**: Night-1 only; no cross-night state
> **Last Updated**: 2026-01-21

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Decision Log](#3-decision-log)
4. [Protocol Layer Contract](#4-protocol-layer-contract)
5. [Normalization Contract](#5-normalization-contract)
6. [Boundary Rules (Enforceable)](#6-boundary-rules-enforceable)
7. [Directory Structure](#7-directory-structure)
8. [Implementation Patchlist](#8-implementation-patchlist)
9. [Test Checklist](#9-test-checklist)
10. [Migration Plan](#10-migration-plan)
11. [Risk Registry](#11-risk-registry)
12. [Acceptance Checklist](#12-acceptance-checklist)

---

## 1. Executive Summary

### Problem Statement

- **God Class**: `GameStateService.ts` is 2724 lines with 12+ responsibilities
- **Host/Player State Split**: 40+ `isHost` branches causing "经常漏 host state / UI render"
- **No snapshot recovery**: Execution state (actions, wolfVotes) not in wire protocol

### Solution

- **Single State Shape**: `GameState ≡ BroadcastGameState` (Host and Player hold identical type)
- **SRP Modules**: Split God Class into store, handlers, intents, reducer
- **Protocol-first**: All execution state in `BroadcastGameState` for snapshot recovery
- **Factory DI**: `ServiceFactory` pattern for v1/v2 switching

### Hard Constraints (Non-negotiable)

- ❌ No host-only state fields
- ❌ No new wire protocol (reuse `PlayerMessage`/`HostBroadcast`)
- ❌ v2 must NOT import from legacy at runtime
- ❌ Player must NOT execute resolvers/reducers
- ✅ All existing tests must pass

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         HOST DEVICE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Intent (UI action)                                             │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────────┐                                            │
│  │ IntentDispatcher │ ─── validates intent shape                │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │    Handler      │ ─── invokes resolver (pure function)       │
│  │  (host-only)    │     computes state delta                   │
│  └────────┬────────┘                                            │
│           │ returns StateAction                                 │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │    Reducer      │ ─── pure: (state, action) => newState      │
│  │  (host-only)    │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐      ┌────────────────────┐                │
│  │   GameStore     │─────▶│  normalize(state)  │                │
│  │ (state holder)  │      │  (core/state/)     │                │
│  └────────┬────────┘      └────────────────────┘                │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   Transport     │ ─── wraps BroadcastService                 │
│  │   Adapter       │     sends STATE_UPDATE                     │
│  └────────┬────────┘                                            │
│           │                                                     │
└───────────┼─────────────────────────────────────────────────────┘
            │
            │  Supabase Realtime Broadcast
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       PLAYER DEVICE                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐                                            │
│  │   Transport     │ ─── receives STATE_UPDATE                  │
│  │   Adapter       │                                            │
│  └────────┬────────┘                                            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │   GameStore     │ ─── revision check:                        │
│  │ (state holder)  │     if (incoming.rev > local.rev)          │
│  └────────┬────────┘         applySnapshot(incoming)            │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                            │
│  │       UI        │ ─── reads state, filters by myRole         │
│  └─────────────────┘                                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Decision Log

### Decision A: Single Source of Truth for Protocol Types

| Option | Description | Verdict |
|--------|-------------|---------|
| A1 | Keep types in `BroadcastService.ts` | ❌ Rejected: Couples transport to protocol |
| **A2** | Extract to `protocol/types.ts` | ✅ **Chosen**: Clean separation |

**Migration Rule**:
1. `protocol/types.ts` becomes the **sole authority** for `BroadcastGameState`, `HostBroadcast`, `PlayerMessage`
2. `BroadcastService.ts` **deletes** local type definitions, imports from protocol
3. **All other files** import from `services/protocol`, never from `BroadcastService`

### Decision B: ProtocolAction Key Strategy

| Option | Description | Verdict |
|--------|-------------|---------|
| B1 | `Record<SchemaId, ProtocolAction>` | ❌ Rejected: Same schemaId may have multiple actors |
| B2 | `Record<string, ProtocolAction>` with key = `${schemaId}:${actorSeat}` | ⚠️ Possible but complex key parsing |
| **B3** | `ProtocolAction[]` | ✅ **Chosen**: Simplest, no key collision |

**Rationale**: Array is most stable—no key collision, no parsing needed, trivial to iterate.

### Decision C: Seat-map Wire Key Convention

| Option | Description | Verdict |
|--------|-------------|---------|
| C1 | Use `Record<number, T>` | ❌ Rejected: JSON serializes number keys as strings anyway |
| **C2** | Use `Record<string, T>` everywhere | ✅ **Chosen**: Explicit, no TS illusion |

**Rule**: All seat-map fields on wire protocol use `Record<string, T>`. UI/internal logic may convert to number keys via helpers.

---

## 4. Protocol Layer Contract

### 4.1 Type Authority (Single Definition)

```typescript
// src/services/protocol/types.ts — THE SOLE AUTHORITY

import type { RoleId } from '../../models/roles/spec/specs';
import type { SchemaId } from '../../models/roles/spec/schemas';
import type { CurrentNightResults } from '../night/resolvers/types';

// =============================================================================
// Protocol Action (wire-safe, stable)
// =============================================================================

/** Action record for wire transmission */
export interface ProtocolAction {
  readonly schemaId: SchemaId;       // type-only import, stable contract
  readonly actorSeat: number;
  readonly targetSeat?: number;
  readonly timestamp: number;
}

// =============================================================================
// Broadcast Player
// =============================================================================

export interface BroadcastPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role?: RoleId | null;
  hasViewedRole: boolean;
}

// =============================================================================
// Broadcast Game State (THE wire protocol)
// =============================================================================

export interface BroadcastGameState {
  // --- Core fields (existing) ---
  roomCode: string;
  hostUid: string;
  status: 'unseated' | 'seated' | 'assigned' | 'ready' | 'ongoing' | 'ended';
  templateRoles: RoleId[];
  players: Record<string, BroadcastPlayer | null>;  // key = seat.toString()
  currentActionerIndex: number;
  isAudioPlaying: boolean;

  // --- Seat-map fields (all keys are string on wire) ---
  /** Wolf vote status (legacy compatibility) */
  wolfVoteStatus?: Record<string, boolean>;  // key = seat.toString()
  
  /** Wolf votes (v2) - voterSeat -> targetSeat */
  wolfVotes?: Record<string, number>;  // key = voterSeat.toString()

  // --- Execution state (v2, optional for backward compat) ---
  /** Night-1 action records */
  actions?: ProtocolAction[];
  
  /** Current night accumulated results (type-only from resolver types) */
  currentNightResults?: CurrentNightResults;
  
  /** Pending reveal acknowledgements */
  pendingRevealAcks?: string[];
  
  /** Last night deaths */
  lastNightDeaths?: number[];

  // --- Nightmare block ---
  nightmareBlockedSeat?: number;
  wolfKillDisabled?: boolean;

  // --- Role-specific context (all public, UI filters by myRole) ---
  witchContext?: {
    killedIndex: number;
    canSave: boolean;
    canPoison: boolean;
  };

  seerReveal?: {
    targetSeat: number;
    result: '好人' | '狼人';
  };

  psychicReveal?: {
    targetSeat: number;
    result: string;
  };

  gargoyleReveal?: {
    targetSeat: number;
    result: string;
  };

  wolfRobotReveal?: {
    targetSeat: number;
    result: string;
  };

  confirmStatus?: {
    role: 'hunter' | 'darkWolfKing';
    canShoot: boolean;
  };

  actionRejected?: {
    action: string;
    reason: string;
    targetUid: string;
  };
}

// =============================================================================
// Host Broadcast Messages
// =============================================================================

export type HostBroadcast =
  | { type: 'STATE_UPDATE'; state: BroadcastGameState; revision: number }
  | { type: 'ROLE_TURN'; role: RoleId; pendingSeats: number[]; killedIndex?: number; stepId?: SchemaId }
  | { type: 'NIGHT_END'; deaths: number[] }
  | { type: 'PLAYER_JOINED'; seat: number; player: BroadcastPlayer }
  | { type: 'PLAYER_LEFT'; seat: number }
  | { type: 'GAME_RESTARTED' }
  | { type: 'SEAT_REJECTED'; seat: number; requestUid: string; reason: 'seat_taken' }
  | { type: 'SEAT_ACTION_ACK'; requestId: string; toUid: string; success: boolean; seat: number; reason?: string }
  | { type: 'SNAPSHOT_RESPONSE'; requestId: string; toUid: string; state: BroadcastGameState; revision: number };

// =============================================================================
// Player Messages
// =============================================================================

export type PlayerMessage =
  | { type: 'REQUEST_STATE'; uid: string }
  | { type: 'JOIN'; seat: number; uid: string; displayName: string; avatarUrl?: string }
  | { type: 'LEAVE'; seat: number; uid: string }
  | { type: 'ACTION'; seat: number; role: RoleId; target: number | null; extra?: any }
  | { type: 'WOLF_VOTE'; seat: number; target: number }
  | { type: 'VIEWED_ROLE'; seat: number }
  | { type: 'REVEAL_ACK'; seat: number; role: RoleId; revision: number }
  | { type: 'SEAT_ACTION_REQUEST'; requestId: string; action: 'sit' | 'standup'; seat: number; uid: string; displayName?: string; avatarUrl?: string }
  | { type: 'SNAPSHOT_REQUEST'; requestId: string; uid: string; lastRevision?: number };
```

### 4.2 ProtocolAction Stability Guarantee

**Why this won't drift**:
1. `SchemaId` is a type-only import from `models/roles/spec/schemas.ts` (single source)
2. `ProtocolAction[]` array has no key collision issues
3. All fields are primitives + stable type references
4. Contract test verifies `ProtocolAction` only uses wire-safe types

---

## 5. Normalization Contract

### 5.1 Location

```
src/services/core/state/normalize.ts  ← Runtime code (NOT in protocol/)
```

### 5.2 Implementation

```typescript
// src/services/core/state/normalize.ts

import type { BroadcastGameState } from '../../protocol/types';

/**
 * Canonicalize a seat-keyed record to ensure all keys are strings.
 * Use this for any Record<string, T> that may receive number keys at runtime.
 */
export function canonicalizeSeatKeyRecord<T>(
  record: Record<string | number, T> | undefined
): Record<string, T> | undefined {
  if (record === undefined) return undefined;
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    result[String(k)] = v;
  }
  return result;
}

/**
 * Derive wolfVoteStatus from wolfVotes.
 * Only call this when wolfVotes is defined.
 */
function deriveWolfVoteStatus(
  wolfVotes: Record<string, number>
): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const seatStr of Object.keys(wolfVotes)) {
    result[seatStr] = true;
  }
  return result;
}

/**
 * Normalize state before broadcast.
 * - Fills optional fields with defaults
 * - Canonicalizes seat-map keys to string
 * - Derives wolfVoteStatus from wolfVotes (if wolfVotes present)
 */
export function normalizeState(
  raw: Partial<BroadcastGameState>
): BroadcastGameState {
  // Canonicalize seat-map fields
  const players = canonicalizeSeatKeyRecord(raw.players) ?? {};
  const wolfVotes = canonicalizeSeatKeyRecord(raw.wolfVotes);
  
  // Derive wolfVoteStatus: only if wolfVotes present, else preserve legacy
  let wolfVoteStatus: Record<string, boolean> | undefined;
  if (wolfVotes !== undefined) {
    // v2 mode: derive from wolfVotes
    wolfVoteStatus = deriveWolfVoteStatus(wolfVotes);
  } else if (raw.wolfVoteStatus !== undefined) {
    // legacy mode: preserve existing, but canonicalize keys
    wolfVoteStatus = canonicalizeSeatKeyRecord(raw.wolfVoteStatus);
  }

  return {
    // Required fields with defaults
    roomCode: raw.roomCode ?? '',
    hostUid: raw.hostUid ?? '',
    status: raw.status ?? 'unseated',
    templateRoles: raw.templateRoles ?? [],
    players,
    currentActionerIndex: raw.currentActionerIndex ?? -1,
    isAudioPlaying: raw.isAudioPlaying ?? false,

    // Seat-map fields (canonicalized)
    wolfVoteStatus,
    wolfVotes,

    // Execution state (optional, no defaults needed)
    actions: raw.actions,
    currentNightResults: raw.currentNightResults,
    pendingRevealAcks: raw.pendingRevealAcks,
    lastNightDeaths: raw.lastNightDeaths,

    // Other optional fields (pass through)
    nightmareBlockedSeat: raw.nightmareBlockedSeat,
    wolfKillDisabled: raw.wolfKillDisabled,
    witchContext: raw.witchContext,
    seerReveal: raw.seerReveal,
    psychicReveal: raw.psychicReveal,
    gargoyleReveal: raw.gargoyleReveal,
    wolfRobotReveal: raw.wolfRobotReveal,
    confirmStatus: raw.confirmStatus,
    actionRejected: raw.actionRejected,
  };
}
```

### 5.3 Invariants

| Rule | Description |
|------|-------------|
| **Keys are string** | All seat-map `Record<string, T>` keys are string on wire |
| **wolfVotes → wolfVoteStatus** | If `wolfVotes` present, derive `wolfVoteStatus` from it |
| **Legacy preservation** | If `wolfVotes` absent but `wolfVoteStatus` present, preserve it |
| **normalize before broadcast** | Host calls `normalizeState(state)` before every `STATE_UPDATE` |

---

## 6. Boundary Rules (Enforceable)

### 6.1 Module Boundary Matrix

| Module | Allowed Imports | Forbidden Imports |
|--------|-----------------|-------------------|
| `protocol/` | `import type` from `models/**`, `services/night/resolvers/types` | Any runtime import; any transport import |
| `core/` | `import type` from protocol; import from `models/**` | Runtime import from transport |
| `transport/` | Import from protocol (types); import supabase | Import from v2, legacy |
| `legacy/` | Anything (legacy is exempt during migration) | — |
| `v2/` | Import from protocol, core | Runtime import from legacy |

### 6.2 Enforcement Strategy

```typescript
// src/services/__tests__/boundary.contract.test.ts

import * as fs from 'fs';
import * as path from 'path';

const SERVICES_DIR = path.join(__dirname, '..');

// Regex patterns
const RUNTIME_IMPORT = /^import\s+(?!type\s)/;  // "import X" but not "import type X"
const TYPE_ONLY_IMPORT = /^import\s+type\s/;

function getImports(filePath: string): { runtime: string[]; typeOnly: string[] } {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const runtime: string[] = [];
  const typeOnly: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (TYPE_ONLY_IMPORT.test(trimmed)) {
      typeOnly.push(trimmed);
    } else if (RUNTIME_IMPORT.test(trimmed)) {
      runtime.push(trimmed);
    }
  }
  return { runtime, typeOnly };
}

describe('Module Boundary Contract', () => {
  describe('protocol/ layer', () => {
    const protocolDir = path.join(SERVICES_DIR, 'protocol');
    
    it('types.ts has no runtime imports', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return; // Skip if not yet created
      
      const { runtime } = getImports(typesPath);
      expect(runtime).toEqual([]);
    });

    it('types.ts does not export functions', () => {
      const typesPath = path.join(protocolDir, 'types.ts');
      if (!fs.existsSync(typesPath)) return;
      
      const content = fs.readFileSync(typesPath, 'utf-8');
      // Should not have "export function" or "export const ... = (...) =>"
      expect(content).not.toMatch(/export\s+(async\s+)?function\s/);
      expect(content).not.toMatch(/export\s+const\s+\w+\s*=\s*\([^)]*\)\s*=>/);
    });
  });

  describe('core/ layer', () => {
    it('core/ does not runtime-import from transport/', () => {
      const coreDir = path.join(SERVICES_DIR, 'core');
      if (!fs.existsSync(coreDir)) return;
      
      const files = fs.readdirSync(coreDir, { recursive: true }) as string[];
      for (const file of files) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const filePath = path.join(coreDir, file);
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*transport/);
        }
      }
    });
  });

  describe('v2/ layer', () => {
    it('v2/ does not runtime-import from legacy/', () => {
      const v2Dir = path.join(SERVICES_DIR, 'v2');
      if (!fs.existsSync(v2Dir)) return;
      
      const files = fs.readdirSync(v2Dir, { recursive: true }) as string[];
      for (const file of files) {
        if (!file.endsWith('.ts') || file.endsWith('.test.ts')) continue;
        const filePath = path.join(v2Dir, file);
        const { runtime } = getImports(filePath);
        for (const imp of runtime) {
          expect(imp).not.toMatch(/from\s+['"].*legacy/);
        }
      }
    });
  });

  describe('BroadcastService type migration', () => {
    it('BroadcastService.ts does not export BroadcastGameState interface', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      // After migration, these should be removed
      // During migration, this test will fail until we complete the migration
      expect(content).not.toMatch(/export\s+interface\s+BroadcastGameState\b/);
    });

    it('BroadcastService.ts does not export HostBroadcast type', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      expect(content).not.toMatch(/export\s+type\s+HostBroadcast\b/);
    });

    it('BroadcastService.ts does not export PlayerMessage type', () => {
      const bsPath = path.join(SERVICES_DIR, 'BroadcastService.ts');
      const content = fs.readFileSync(bsPath, 'utf-8');
      expect(content).not.toMatch(/export\s+type\s+PlayerMessage\b/);
    });

    it('protocol/types.ts exports BroadcastGameState', () => {
      const typesPath = path.join(SERVICES_DIR, 'protocol', 'types.ts');
      if (!fs.existsSync(typesPath)) {
        // Skip during Phase 0
        return;
      }
      const content = fs.readFileSync(typesPath, 'utf-8');
      expect(content).toMatch(/export\s+interface\s+BroadcastGameState\b/);
    });
  });
});
```

### 6.3 Key Distinctions

| Pattern | Meaning | Allowed in protocol/ |
|---------|---------|---------------------|
| `import type { X } from '...'` | Type-only, erased at runtime | ✅ Yes |
| `import { X } from '...'` | Runtime import | ❌ No |
| `export function X() {}` | Runtime export | ❌ No |
| `export interface X {}` | Type export | ✅ Yes |

---

## 7. Directory Structure

```
src/services/
├── protocol/                          # 纯类型，无 runtime 代码
│   └── types.ts                       # BroadcastGameState, HostBroadcast, PlayerMessage, ProtocolAction
│
├── transport/                         # Supabase Realtime (有副作用)
│   └── index.ts                       # re-export BroadcastService
│
├── core/                              # 纯逻辑，可被任何层使用
│   ├── state/
│   │   ├── normalize.ts               # normalizeState(), canonicalizeSeatKeyRecord()
│   │   └── __tests__/
│   │       └── normalize.contract.test.ts
│   ├── NightFlowController.ts         # 从现有位置移入
│   ├── DeathCalculator.ts             # 从现有位置移入
│   └── index.ts                       # re-exports
│
├── night/
│   └── resolvers/                     # 保持现有位置（pure functions）
│       ├── types.ts                   # CurrentNightResults 等（单一真相）
│       └── *.ts
│
├── legacy/                            # 仅旧 God Service（迁移期）
│   └── GameStateService.ts            # 从现有位置移入
│
├── v2/                                # 新实现
│   ├── store/
│   │   └── GameStore.ts
│   ├── handlers/
│   │   └── *.ts
│   ├── intents/
│   │   └── types.ts
│   ├── reducer/
│   │   └── gameReducer.ts
│   └── index.ts
│
├── factory.ts                         # ServiceFactory for DI
├── BroadcastService.ts                # 保留，但删除类型定义
└── __tests__/
    ├── boundary.contract.test.ts      # 边界规则测试
    └── ...existing tests...
```

---

## 8. Implementation Patchlist

### Phase 1: Protocol Extraction + Boundary Tests

| File | Action | Changes |
|------|--------|---------|
| `src/services/protocol/types.ts` | **CREATE** | Define `BroadcastGameState`, `HostBroadcast`, `PlayerMessage`, `ProtocolAction`, `BroadcastPlayer` |
| `src/services/BroadcastService.ts` | **MODIFY** | 1. Delete `interface BroadcastPlayer` (lines 96-103)<br>2. Delete `interface BroadcastGameState` (lines 106-167)<br>3. Delete `type HostBroadcast` (lines 37-63)<br>4. Delete `type PlayerMessage` (lines 66-85)<br>5. Add `import type { BroadcastGameState, HostBroadcast, PlayerMessage, BroadcastPlayer } from './protocol/types'` |
| `src/services/__tests__/GameStateService.recovery.test.ts` | **MODIFY** | Change `import type { BroadcastGameState } from '../BroadcastService'` → `import type { BroadcastGameState } from '../protocol/types'` |
| `src/services/__tests__/boards/hostGameFactory.ts` | **MODIFY** | Change `import type { PlayerMessage } from '../../BroadcastService'` → `import type { PlayerMessage } from '../../protocol/types'` |
| `src/services/__tests__/boundary.contract.test.ts` | **CREATE** | Boundary enforcement tests (as shown in Section 6.2) |

### Phase 2: Normalize Layer

| File | Action | Changes |
|------|--------|---------|
| `src/services/core/state/normalize.ts` | **CREATE** | `normalizeState()`, `canonicalizeSeatKeyRecord()`, `deriveWolfVoteStatus()` |
| `src/services/core/state/__tests__/normalize.contract.test.ts` | **CREATE** | Tests for normalization (see Section 9) |
| `src/services/core/index.ts` | **CREATE** | Re-export normalize functions |

### Phase 3: Core Module Consolidation

| File | Action | Changes |
|------|--------|---------|
| `src/services/core/NightFlowController.ts` | **MOVE** | From `src/services/NightFlowController.ts` |
| `src/services/core/DeathCalculator.ts` | **MOVE** | From `src/services/DeathCalculator.ts` |
| `src/services/NightFlowController.ts` | **MODIFY** | Change to re-export: `export * from './core/NightFlowController'` |
| `src/services/DeathCalculator.ts` | **MODIFY** | Change to re-export: `export * from './core/DeathCalculator'` |

### Phase 4: Legacy Isolation

| File | Action | Changes |
|------|--------|---------|
| `src/services/legacy/GameStateService.ts` | **MOVE** | From `src/services/GameStateService.ts` |
| `src/services/GameStateService.ts` | **MODIFY** | Change to re-export: `export * from './legacy/GameStateService'` |

### Phase 5: V2 Implementation (Future)

| File | Action | Changes |
|------|--------|---------|
| `src/services/v2/store/GameStore.ts` | **CREATE** | State holder with revision tracking |
| `src/services/v2/handlers/*.ts` | **CREATE** | Host-only action handlers |
| `src/services/v2/reducer/gameReducer.ts` | **CREATE** | Pure state reducer |
| `src/services/v2/intents/types.ts` | **CREATE** | Intent type definitions |
| `src/services/factory.ts` | **CREATE** | ServiceFactory for v1/v2 switching |

---

## 9. Test Checklist

### 9.1 New Tests to Create

| File | Test | Assertion |
|------|------|-----------|
| `boundary.contract.test.ts` | `protocol/types.ts has no runtime imports` | Regex scan finds no `import X from` (only `import type`) |
| `boundary.contract.test.ts` | `protocol/types.ts does not export functions` | No `export function` or `export const = () =>` |
| `boundary.contract.test.ts` | `BroadcastService.ts does not export BroadcastGameState interface` | After Phase 1, this should pass |
| `boundary.contract.test.ts` | `BroadcastService.ts does not export HostBroadcast type` | After Phase 1, this should pass |
| `boundary.contract.test.ts` | `BroadcastService.ts does not export PlayerMessage type` | After Phase 1, this should pass |
| `boundary.contract.test.ts` | `protocol/types.ts exports BroadcastGameState` | Regex finds `export interface BroadcastGameState` |
| `boundary.contract.test.ts` | `v2/ does not runtime-import from legacy/` | Scan all v2/ files |
| `boundary.contract.test.ts` | `core/ does not runtime-import from transport/` | Scan all core/ files |
| `normalize.contract.test.ts` | `canonicalizes wolfVotes keys to string` | `{ 1: 3 }` → `{ '1': 3 }` |
| `normalize.contract.test.ts` | `canonicalizes wolfVoteStatus keys to string` | `{ 1: true }` → `{ '1': true }` |
| `normalize.contract.test.ts` | `preserves legacy wolfVoteStatus when wolfVotes is undefined` | Input only has `wolfVoteStatus`, output preserves it |
| `normalize.contract.test.ts` | `derives wolfVoteStatus from wolfVotes when present` | Input has `wolfVotes`, output has derived `wolfVoteStatus` |
| `normalize.contract.test.ts` | `fills default values for required fields` | Empty input → valid BroadcastGameState with defaults |
| `normalize.contract.test.ts` | `canonicalizes players keys to string` | `{ 0: player }` → `{ '0': player }` |

### 9.2 Existing Tests to Verify

All existing tests in `src/services/__tests__/` must continue to pass after migration:

```bash
npm test -- --testPathPattern="src/services/__tests__"
```

---

## 10. Migration Plan

### Phase 1: Protocol Extraction (Week 1)

1. Create `src/services/protocol/types.ts`
2. Migrate types from `BroadcastService.ts`
3. Update all imports
4. Add boundary contract tests
5. **Gate**: All existing tests pass + boundary tests pass

### Phase 2: Normalize Layer (Week 1-2)

1. Create `src/services/core/state/normalize.ts`
2. Add normalize contract tests
3. Integrate normalize into Host broadcast path
4. **Gate**: Normalize tests pass + existing tests pass

### Phase 3: Core Consolidation (Week 2)

1. Move `NightFlowController.ts` → `core/`
2. Move `DeathCalculator.ts` → `core/`
3. Add re-export shims for backward compatibility
4. **Gate**: All existing tests pass

### Phase 4: Legacy Isolation (Week 2-3)

1. Move `GameStateService.ts` → `legacy/`
2. Add re-export shim
3. **Gate**: All existing tests pass

### Phase 5: V2 Implementation (Week 3-4)

1. Implement `GameStore`, `Reducer`, `Handlers`
2. Implement `ServiceFactory`
3. Add v2-specific tests
4. **Gate**: All tests pass, feature-flag works

---

## 11. Risk Registry

| # | Risk | Likelihood | Impact | Mitigation | Verification |
|---|------|------------|--------|------------|--------------|
| 1 | Import path breaks after type extraction | Medium | High | Re-export shims + grep verify all imports | `grep -r "from.*BroadcastService" --include="*.ts"` |
| 2 | Number-key `Record<number, T>` survives in fixtures | Medium | Medium | Normalize all inputs; canonicalize in normalize | `npm test -- normalize.contract` |
| 3 | Legacy `wolfVoteStatus` overwritten | High | High | Conditional derive only when `wolfVotes` present | `npm test -- normalize.contract` |
| 4 | `CurrentNightResults` imported as runtime | Low | High | Boundary test scans for runtime imports | `npm test -- boundary.contract` |
| 5 | v2 accidentally imports legacy | Low | Critical | ESLint rule + boundary test | `npm test -- boundary.contract` |

---

## 12. Acceptance Checklist

| # | Criterion | Verification Command |
|---|-----------|---------------------|
| 1 | `protocol/types.ts` has no runtime code | `npm test -- boundary.contract` |
| 2 | `BroadcastService.ts` no longer exports protocol types | `npm test -- boundary.contract` |
| 3 | All seat-map keys are string on wire | `npm test -- normalize.contract` |
| 4 | Legacy `wolfVoteStatus` preserved when no `wolfVotes` | `npm test -- normalize.contract` |
| 5 | `CurrentNightResults` type-only import | Grep + boundary test |
| 6 | v2 does not import legacy at runtime | `npm test -- boundary.contract` |
| 7 | core does not import transport at runtime | `npm test -- boundary.contract` |
| 8 | Host increments revision on every broadcast | Integration test |
| 9 | Player discards stale revision | Integration test |
| 10 | All existing tests pass | `npm test` |

---

## Appendix: Quick Reference

### Import Patterns

```typescript
// ✅ Correct: Import from protocol
import type { BroadcastGameState, HostBroadcast, PlayerMessage } from '@/services/protocol/types';

// ❌ Wrong: Import from BroadcastService (after migration)
import type { BroadcastGameState } from '@/services/BroadcastService';

// ✅ Correct: Type-only import in protocol
import type { SchemaId } from '@/models/roles/spec/schemas';

// ❌ Wrong: Runtime import in protocol
import { SCHEMAS } from '@/models/roles/spec/schemas';
```

### Seat-map Key Convention

```typescript
// Wire protocol (JSON-serialized)
{
  "players": { "0": {...}, "1": {...} },      // string keys
  "wolfVotes": { "0": 2, "1": 2 },            // string keys
  "wolfVoteStatus": { "0": true, "1": true }  // string keys
}

// Internal/UI (after conversion)
const seatNumber: number = parseInt(key, 10);
```
