/**
 * processEngineAction — generic read-compute-write pipeline (Template Method via composition).
 *
 * Mirrors `processAction` (the werewolf core) but the reduce/normalize steps are injected
 * by the engine instead of being hardwired to gameReducer/normalizeState. This is what lets
 * a new game plug in without touching the DO or this pipeline.
 *
 * @remarks DO single-thread serialization guarantees no concurrency conflicts; SQLite sql.exec
 *   is synchronous and coalesces into an atomic transaction. Broadcast is performed by the caller.
 */

import type { EngineResult, GameEngine } from '@werewolf/game-engine/engine/registry/types';

/** Result of a generic engine action. `state` is the broadcast blob (engine-typed). */
export type EngineActionResult<S> =
  | { success: true; reason?: string; state?: S; revision?: number }
  | { success: false; reason: string };

/** DO-facing dispatch result (state is an opaque blob across all engines). */
export type DispatchResult = EngineActionResult<unknown>;

export function processEngineAction<S, A>(
  sql: DurableObjectState['storage']['sql'],
  engine: GameEngine<S, A, unknown>,
  dispatchFn: (state: S, revision: number) => EngineResult<A>,
): EngineActionResult<S> {
  // 1. Read SQLite (synchronous, zero network)
  const rows = sql.exec('SELECT game_state, revision FROM room_state WHERE id = 1').toArray();
  if (rows.length === 0) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const state = JSON.parse(rows[0].game_state as string) as S;
  const revision = rows[0].revision as number;

  // 2. Engine dispatch → EngineResult
  const result = dispatchFn(state, revision);

  // error: precondition / infra failure → do not persist
  if (result.kind === 'error') {
    return { success: false, reason: result.reason };
  }

  const isSuccess = result.kind === 'success';

  // 3. Apply actions via the engine's own reducer
  let newState = state;
  let applied = 0;
  for (const action of result.actions) {
    newState = engine.reduce(newState, action);
    applied++;
  }

  // No-op guard (e.g. UPDATE_CONFIG to the same value): nothing to persist
  if (applied === 0) {
    return isSuccess
      ? { success: true, reason: result.reason, state, revision }
      : { success: false, reason: result.reason ?? 'REJECTED' };
  }

  newState = engine.normalize(newState);
  const newRevision = revision + 1;

  // 4. Write SQLite (coalesces with the read above into an atomic transaction)
  sql.exec(
    'UPDATE room_state SET game_state = ?, revision = ? WHERE id = 1',
    JSON.stringify(newState),
    newRevision,
  );

  return isSuccess
    ? { success: true, reason: result.reason, state: newState, revision: newRevision }
    : { success: false, reason: result.reason ?? 'REJECTED' };
}
