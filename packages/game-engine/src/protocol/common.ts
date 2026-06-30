/**
 * Protocol Common — game-agnostic protocol primitives (zero werewolf dependency).
 *
 * Single source of truth for types shared by EVERY game engine (werewolf, fibking, …).
 * This module must stay free of any game-specific imports (no RoleId / Team / GameStatus).
 * `protocol/types.ts` and `engine/handlers/types.ts` re-export from here for backward compatibility.
 *
 * ⚠️ Type-only definitions + frozen constants. No game logic, no game-specific imports.
 */

// =============================================================================
// RosterEntry — per-room player display info (nickname / avatar / level)
// =============================================================================

/**
 * Player display info within a room, keyed by userId in a game state's `roster`.
 * Display fields are deliberately separated from per-game player/seat records so the
 * same shape can back werewolf `players` and fibking `seats`.
 */
export interface RosterEntry {
  displayName: string;
  avatarUrl?: string;
  avatarFrame?: string;
  /** Equipped seat flair gacha item ID */
  seatFlair?: string;
  /** Equipped seat animation gacha item ID */
  seatAnimation?: string;
  /** Equipped name style gacha item ID */
  nameStyle?: string;
  /** Equipped role reveal effect gacha item ID */
  roleRevealEffect?: string;
  level?: number;
}

// =============================================================================
// SideEffect — handler-produced side-effect descriptors (executed by outer layer)
// =============================================================================

/**
 * Side effect types.
 *
 * Handlers do not execute side effects directly; they return descriptions the
 * Durable Object / processor layer executes (broadcast, audio, persist).
 */
export type SideEffect =
  /** Broadcast updated state to all connected WebSocket clients */
  | { type: 'BROADCAST_STATE' }
  /** Queue audio for Host device playback; isEndAudio=true loads from audio_end/ directory */
  | { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean }
  /** Reserved (unused) */
  | { type: 'SEND_MESSAGE'; message: unknown }
  /** Persist updated state to SQLite */
  | { type: 'SAVE_STATE' };

/**
 * Standard side effects: broadcast state + save state.
 *
 * Most handler sideEffects are this pair combined.
 * Handlers including PLAY_AUDIO should construct the full list themselves.
 */
export const STANDARD_SIDE_EFFECTS: readonly SideEffect[] = Object.freeze([
  { type: 'BROADCAST_STATE' },
  { type: 'SAVE_STATE' },
] as const);
