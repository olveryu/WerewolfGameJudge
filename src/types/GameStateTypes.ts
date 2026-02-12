/**
 * GameStateTypes - Pure type definitions for game state
 *
 * This file contains only:
 * - Enums
 * - Interfaces
 * - Type aliases
 * - Pure mapping functions (no side effects)
 *
 * No runtime logic or service dependencies.
 */

import type { RoleAction } from '@/models/actions/RoleAction';
import { GameStatus } from '@/models/GameStatus';
import { RoleId } from '@/models/roles';
import { GameTemplate } from '@/models/Template';
import type { CurrentNightResults } from '@/services/night/resolvers/types';
import type { BroadcastGameState } from '@/services/protocol/types';

// =============================================================================
// Game Status Enum (canonical definition in src/models/GameStatus.ts)
// =============================================================================

export { GameStatus } from '@/models/GameStatus';

// =============================================================================
// Player Types
// =============================================================================

export interface LocalPlayer {
  uid: string;
  seatNumber: number;
  displayName?: string;
  avatarUrl?: string;
  role: RoleId | null;
  hasViewedRole: boolean;
  /** Debug mode: true if this is a bot placeholder (not a real player) */
  isBot?: boolean;
}

// =============================================================================
// Game State Types
// =============================================================================

/**
 * Fields from BroadcastGameState that LocalGameState transforms
 * (different shape or required-ness) or replaces entirely.
 *
 * Everything NOT listed here is auto-inherited from BroadcastGameState,
 * so adding a new optional field to BroadcastGameState automatically
 * makes it available on LocalGameState — no manual sync needed.
 */
type BroadcastTransformedKeys =
  | 'status' // string literal union → GameStatus enum
  | 'templateRoles' // RoleId[] → GameTemplate
  | 'players' // Record<number, BroadcastPlayer> → Map<number, LocalPlayer>
  | 'actions' // ProtocolAction[] → Map<RoleId, RoleAction>
  | 'currentNightResults' // optional → required (default {})
  | 'lastNightDeaths'; // optional → required (default [])

/**
 * LocalGameState — UI-facing game state
 *
 * Passthrough fields are auto-inherited from BroadcastGameState (via Omit).
 * Only the transformed / local-only fields are declared here.
 *
 * ✅ Adding a new BroadcastGameState field: automatically available here.
 * ✅ Adding a new required BroadcastGameState field: adapter MUST set it (TS error).
 * ❌ If a new field needs transformation: add it to BroadcastTransformedKeys and declare below.
 */
export interface LocalGameState extends Omit<BroadcastGameState, BroadcastTransformedKeys> {
  // --- Transformed fields (different shape from BroadcastGameState) ---
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalPlayer | null>; // Record → Map
  lastNightDeaths: number[]; // optional → required (default [])
  currentNightResults: CurrentNightResults; // optional → required (default {})

  // --- Local-only fields (adapter-created, not in BroadcastGameState) ---
  actions: Map<RoleId, RoleAction>; // derived from ProtocolAction[]
  wolfVotes: Map<number, number>; // derived from currentNightResults.wolfVotesBySeat
}
