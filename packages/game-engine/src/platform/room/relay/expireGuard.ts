/**
 * Relay phase expiry guard sequence, shared by the games on the relay
 * machine: platform actor resolution, an optional per-game actor gate,
 * the revision gate, and the deadline gate, ending in the game's own
 * expiry dispatch (expireRelayPhase through its kit and hooks, or a
 * wrapper around it).
 *
 * What a gate does on failure is observable per-game behavior and
 * stays injected: Pictionary adds a host-or-seated actor gate Story
 * Relay does not have, and its stale revision silently commits empty
 * (injected via `revision.onStale`). Story Relay's revision gate runs
 * in its decide entry — every revisioned command is rejected there
 * before dispatch — so it injects no revision gate here. Deadline
 * rejection reasons are likewise per-game.
 */

import {
  type CommandContext,
  type Decision,
  type GameEffect,
  type GameEvent,
  reject,
  resolveUncontrolledUserActorId,
} from '../../engine';

/** The revision gate: the command's phase revision against the state's. */
export interface RelayPhaseExpiryRevision<TEvent extends GameEvent, TEffect extends GameEffect> {
  readonly commandRevision: number;
  readonly currentRevision: number;
  /** Decision for a stale revision: reject, or silently commit empty. */
  readonly onStale: () => Decision<TEvent, TEffect>;
}

/** Per-game injections for the shared expiry guard sequence. */
export interface RelayPhaseExpiryGuards<TEvent extends GameEvent, TEffect extends GameEffect> {
  /** Extra actor gate after platform actor resolution; null rejects nobody. */
  readonly checkActor?: (actorUserId: string) => Decision<TEvent, TEffect> | null;
  /** Revision gate; omit when the game's decide entry already gates revisions. */
  readonly revision?: RelayPhaseExpiryRevision<TEvent, TEffect>;
  readonly deadlineAt: number | null;
  /** This game's reason for a missing or unreached deadline. */
  readonly notExpiredReason: string;
  /** The game's own expiry dispatch, invoked once every gate passes. */
  readonly dispatch: (nowMs: number) => Decision<TEvent, TEffect>;
}

/** Runs the shared expiry guard sequence for one phase.expire command. */
export function guardRelayPhaseExpiry<TEvent extends GameEvent, TEffect extends GameEffect>(
  context: CommandContext,
  guards: RelayPhaseExpiryGuards<TEvent, TEffect>,
): Decision<TEvent, TEffect> {
  const actor = resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const actorRejection = guards.checkActor?.(actor.value) ?? null;
  if (actorRejection !== null) return actorRejection;
  if (
    guards.revision !== undefined &&
    guards.revision.commandRevision !== guards.revision.currentRevision
  ) {
    return guards.revision.onStale();
  }
  if (guards.deadlineAt === null || context.nowMs < guards.deadlineAt) {
    return reject(guards.notExpiredReason);
  }
  return guards.dispatch(context.nowMs);
}
