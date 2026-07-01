/**
 * gameProcessor — core read-compute-write pipeline inside a DO
 *
 * Replaces processGameAction from the old gameStateManager.ts.
 * DO single-thread serialization guarantees no concurrency conflicts; no optimistic lock retry needed.
 * SQLite sql.exec is synchronous; multiple SQL statements automatically coalesce into an atomic transaction.
 * Broadcast is performed within the same instance with zero network overhead.
 *
 * @remarks Pipeline order:
 *   1. Read SQLite (synchronous)
 *   2. processFn(state, revision) → HandlerResult
 *   3. If success: reduce actions → newState → inlineProgression(optional) → extractAudio
 *   4. Write SQLite (synchronous, single exec atomic)
 *   5. Caller performs broadcast
 */

import type { HandlerResult, SideEffect } from '@werewolf/game-engine/engine/handlers/types';
import type { HandlerContext } from '@werewolf/game-engine/engine/handlers/types';
import { runInlineProgression } from '@werewolf/game-engine/engine/inlineProgression';
import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import { normalizeState } from '@werewolf/game-engine/engine/state/normalize';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { AudioEffect } from '@werewolf/game-engine/protocol/types';

/** Final return value of processAction (equivalent to the old GameActionResult) */
export type GameActionResult =
  | {
      success: true;
      reason?: string;
      state?: GameState;
      revision?: number;
      sideEffects?: readonly SideEffect[];
    }
  | {
      success: false;
      reason: string;
      state?: GameState;
      revision?: number;
      sideEffects?: readonly SideEffect[];
    };

interface InlineProgressionOptions {
  enabled: boolean;
  /** Unix timestamp (ms). Used for stepDeadline checks. Defaults to Date.now(). */
  nowMs?: number;
}

/** Find seat number by UID */
function findSeatByUserId(state: GameState, userId: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.userId === userId) return Number(seatKey);
  }
  return null;
}

/** Build HandlerContext for game-engine pure handler functions */
export function buildHandlerContext(state: GameState, userId: string): HandlerContext {
  return {
    state,
    myUserId: userId,
    mySeat: findSeatByUserId(state, userId),
  };
}

/** Extract PLAY_AUDIO side effects into AudioEffect state actions. */
export function extractAudioActions(sideEffects: readonly SideEffect[] | undefined): StateAction[] {
  const audioEffects: AudioEffect[] = (sideEffects ?? [])
    .filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    )
    .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

  if (audioEffects.length === 0) return [];

  return [
    { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
    { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
  ];
}

/**
 * Core read-compute-write pipeline (DO internal method)
 *
 * Semantically equivalent to the old processGameAction, but:
 * - No retry loop (DO single-thread guarantees no concurrency conflicts)
 * - SQLite sql.exec is synchronous; multiple SQL statements automatically coalesce into an atomic transaction
 * - Broadcast is performed by the caller after this function returns
 */
export function processAction(
  sql: DurableObjectState['storage']['sql'],
  processFn: (state: GameState, revision: number) => HandlerResult,
  inlineProgression?: InlineProgressionOptions,
): GameActionResult {
  // 1. Read SQLite (synchronous, zero network)
  const rows = sql.exec('SELECT game_state, revision FROM room_state WHERE id = 1').toArray();

  if (rows.length === 0) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const state = JSON.parse(rows[0].game_state as string) as GameState;
  const revision = rows[0].revision as number;

  // 2. Call game-engine pure function
  const result = processFn(state, revision);

  // error: precondition / infrastructure failure → do not persist
  if (result.kind === 'error') {
    return { success: false, reason: result.reason };
  }

  // success | rejection: both have actions to apply + persist + broadcast
  const isSuccess = result.kind === 'success';

  // 3. Apply actions → new state
  let newState = state;
  let totalActionsApplied = 0;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
    totalActionsApplied++;
  }

  // 3.5. Inline progression (optional, success only)
  if (isSuccess && inlineProgression?.enabled) {
    const prog = runInlineProgression(newState, newState.hostUserId, inlineProgression.nowMs);
    for (const action of prog.actions) {
      newState = gameReducer(newState, action);
      totalActionsApplied++;
    }
  }

  // No-op guard
  if (totalActionsApplied === 0) {
    return isSuccess
      ? { success: true as const, reason: result.reason, state, revision }
      : { success: false as const, reason: result.reason ?? 'REJECTED' };
  }

  newState = normalizeState(newState);
  const newRevision = revision + 1;

  // 4. Write SQLite (automatically coalesces with the read above into an atomic transaction)
  sql.exec(
    'UPDATE room_state SET game_state = ?, revision = ? WHERE id = 1',
    JSON.stringify(newState),
    newRevision,
  );

  return isSuccess
    ? {
        success: true as const,
        reason: result.reason,
        state: newState,
        revision: newRevision,
        sideEffects: result.sideEffects,
      }
    : {
        success: false as const,
        reason: result.reason ?? 'REJECTED',
        state: newState,
        revision: newRevision,
        sideEffects: result.sideEffects,
      };
}
