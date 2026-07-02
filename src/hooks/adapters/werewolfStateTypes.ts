/**
 * WerewolfStateTypes - UI-facing werewolf state type definitions.
 *
 * This file contains only:
 * - Enums
 * - Interfaces
 * - Type aliases
 * - Pure mapping functions (no side effects)
 *
 * No runtime logic or service dependencies.
 */

import type { RoleAction } from '@werewolf/game-engine/werewolf/models/actions/RoleAction';
import { type GameStatus } from '@werewolf/game-engine/werewolf/models/GameStatus';
import { type RoleId } from '@werewolf/game-engine/werewolf/models/roles';
import { type GameTemplate } from '@werewolf/game-engine/werewolf/models/Template';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';

// =============================================================================
// Player Types
// =============================================================================

export interface LocalWerewolfPlayer {
  userId: string;
  seat: number;
  displayName?: string;
  avatarUrl?: string;
  avatarFrame?: string;
  seatFlair?: string;
  seatAnimation?: string;
  nameStyle?: string;
  roleRevealEffect?: string;
  level?: number;
  role: RoleId | null;
  hasViewedRole: boolean;
  /** Debug mode: true if this is a bot placeholder (not a real player) */
  isBot?: boolean;
}

// =============================================================================
// Game State Types
// =============================================================================

/**
 * Fields from WerewolfState that LocalWerewolfState transforms
 * (different shape or required-ness) or replaces entirely.
 *
 * Everything NOT listed here is auto-inherited from WerewolfState,
 * so adding a new optional field to WerewolfState automatically
 * makes it available on LocalWerewolfState — no manual sync needed.
 */
type TransformedKeys =
  | 'status' // string literal union → GameStatus enum
  | 'templateRoles' // RoleId[] → GameTemplate
  | 'players' // Record<number, Player> → Map<number, LocalWerewolfPlayer>
  | 'roster' // merged into LocalWerewolfPlayer (display fields)
  | 'actions' // ProtocolAction[] → Map<RoleId, RoleAction>
  | 'currentNightResults' // optional → required (default {})
  | 'lastNightDeaths'; // optional → required (default [])

/**
 * LocalWerewolfState — UI-facing game state
 *
 * Passthrough fields are auto-inherited from WerewolfState (via Omit).
 * Only the transformed / local-only fields are declared here.
 *
 * Adding a new WerewolfState field makes it automatically available here.
 * Adding a new required field forces the adapter to set it (TS error).
 * If a new field needs transformation, add it to TransformedKeys and declare below.
 */
export interface LocalWerewolfState extends Omit<WerewolfState, TransformedKeys> {
  // --- Transformed fields (different shape from WerewolfState) ---
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalWerewolfPlayer | null>; // Record → Map
  lastNightDeaths: number[]; // optional → required (default [])
  currentNightResults: NonNullable<WerewolfState['currentNightResults']>; // optional → required (default {})

  // --- Local-only fields (adapter-created, not in WerewolfState) ---
  actions: Map<RoleId, RoleAction>; // derived from ProtocolAction[]
  wolfVotes: Map<number, number>; // derived from currentNightResults.wolfVotesBySeat
}
