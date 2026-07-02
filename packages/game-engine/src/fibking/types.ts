/**
 * Fib King (瞎掰王) state & action types — the fibking engine's own state machine.
 *
 * Fully independent of werewolf WerewolfState: separate phases, separate roles, separate
 * action union. Imports only the game-agnostic `RosterEntry` from protocol/common.
 */

import type { RosterEntry } from '../protocol/common';
import { type FIB_GAME_TYPE } from '../protocol/gameTypes';

/** Player count bounds (inclusive). N≥4 guarantees 1 guesser + 1 honest + ≥2 fibber. */
export const FIB_MIN_PLAYERS = 4;

/** Default room size for new fibking rooms. Users may raise it without a product cap. */
export const FIB_DEFAULT_PLAYERS = 8;

/** Ring-buffer cap for per-room used-word dedup. */
export const FIB_USED_WORDS_CAP = 50;

export type FibPhase = 'Lobby' | 'Starting' | 'Playing' | 'Revealed';

/** guesser = 大聪明 (public) / honest = 老实人 (hidden) / fibber = 瞎掰王 (hidden) */
export type FibRole = 'guesser' | 'honest' | 'fibber';

export type FibWordSource = 'gemini' | 'workersai' | 'fallback';

export interface FibSeat {
  userId: string;
  seat: number;
}

/**
 * Authoritative, broadcast fibking state.
 *
 * `word`/`definition`/`roleBySeat`/`wordSource` are present iff phase ∈ {Playing, Revealed}
 * (enforced by normalizeFibState). Clients filter visibility by phase + own role.
 */
export interface FibState {
  gameType: typeof FIB_GAME_TYPE;
  roomCode: string;
  hostUserId: string;
  phase: FibPhase;
  /** Fixed seat count 0..N-1; N >= FIB_MIN_PLAYERS, no product upper bound. */
  numberOfPlayers: number;
  /** Sparse occupied-seat map. Empty seats are omitted to keep large rooms light. */
  seats: Record<number, FibSeat>;
  roster: Record<string, RosterEntry>;
  word?: string;
  definition?: string;
  /** guesser seat is public; honest/fibber hidden until reveal (UI filters). */
  roleBySeat?: Record<number, FibRole>;
  wordSource?: FibWordSource;
  /** Cross-round dedup within the room (ring buffer, cap FIB_USED_WORDS_CAP). */
  usedWords: string[];
}

/** Validated create config (zod-validated at the api-worker boundary). */
export interface FibConfig {
  numberOfPlayers: number;
}

/**
 * fibking reducer action union — the only way FibState mutates.
 * Each is a minimal, total, immutable state transition.
 */
export type FibAction =
  | { type: 'SET_PHASE'; phase: FibPhase }
  | { type: 'SET_SEAT'; seat: number; value: FibSeat | null }
  | { type: 'SET_ROSTER'; userId: string; entry: RosterEntry }
  | { type: 'REMOVE_ROSTER'; userId: string }
  | { type: 'RESIZE_SEATS'; numberOfPlayers: number }
  | { type: 'CLEAR_ALL_SEATS' }
  | {
      type: 'SET_ROUND';
      word: string;
      definition: string;
      roleBySeat: Record<number, FibRole>;
      wordSource: FibWordSource;
    }
  | { type: 'CLEAR_ROUND' }
  | { type: 'ADD_USED_WORD'; word: string }
  | { type: 'CLEAR_USED_WORDS' };
