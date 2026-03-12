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

import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { RoleId } from '@werewolf/game-engine/models/roles';
import { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { CurrentNightResults } from '@werewolf/game-engine/resolvers/types';

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
 * Fields from GameState that LocalGameState transforms
 * (different shape or required-ness) or replaces entirely.
 *
 * Everything NOT listed here is auto-inherited from GameState,
 * so adding a new optional field to GameState automatically
 * makes it available on LocalGameState — no manual sync needed.
 */
type TransformedKeys =
  | 'status' // string literal union → GameStatus enum
  | 'templateRoles' // RoleId[] → GameTemplate
  | 'players' // Record<number, Player> → Map<number, LocalPlayer>
  | 'actions' // ProtocolAction[] → Map<RoleId, RoleAction>
  | 'currentNightResults' // optional → required (default {})
  | 'lastNightDeaths'; // optional → required (default [])

/**
 * LocalGameState — UI-facing game state
 *
 * Passthrough fields are auto-inherited from GameState (via Omit).
 * Only the transformed / local-only fields are declared here.
 *
 * Adding a new GameState field makes it automatically available here.
 * Adding a new required field forces the adapter to set it (TS error).
 * If a new field needs transformation, add it to TransformedKeys and declare below.
 */
export interface LocalGameState extends Omit<GameState, TransformedKeys> {
  // --- Transformed fields (different shape from GameState) ---
  status: GameStatus;
  template: GameTemplate;
  players: Map<number, LocalPlayer | null>; // Record → Map
  lastNightDeaths: number[]; // optional → required (default [])
  currentNightResults: CurrentNightResults; // optional → required (default {})

  // --- Local-only fields (adapter-created, not in GameState) ---
  actions: Map<RoleId, RoleAction>; // derived from ProtocolAction[]
  wolfVotes: Map<number, number>; // derived from currentNightResults.wolfVotesBySeat
}
