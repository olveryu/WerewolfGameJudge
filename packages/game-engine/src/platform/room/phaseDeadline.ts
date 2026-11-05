/**
 * Phase deadline chassis: the one expiry guard sequence every
 * stage-deadline game runs, the settle.due effect constructor, and
 * the late-submission deadline gate.
 *
 * The guard sequence is welded in this order: the ready-made phase
 * rejection, platform actor resolution on the game's registered
 * channel, an optional per-game actor gate, the revision gate, and
 * the deadline gate, ending in the game's own expiry dispatch. What
 * a gate does on failure is observable per-game behavior and stays
 * injected; the per-game assembly is registered in
 * `platform/__tests__/phaseDeadlineVariants.contract.test.ts`:
 *
 * - Actor channel: every stage-deadline game settles on the system
 *   channel only. There is no public expire command: the scheduled
 *   settle.due effect is the sole channel (D3, 2026-11-05 — the
 *   client acceleration channel was deleted in all five games).
 *   Dual-channel and uncontrolled-user expiry are gone; do not
 *   reintroduce a client-sent expiry path.
 * - Revision policy: the internal settle command carries no revision
 *   in any game — there is no revision gate on the expiry path at
 *   all. Staleness is the worker's pinned-arming gate, which
 *   compares the settle.due effect payload field by field. (A game
 *   whose decide entry already rejects stale revisions on its other
 *   revisioned commands, e.g. Story Relay, keeps that entry gate for
 *   those commands; it has nothing to do with expiry.)
 * - Settle pinning: games whose correctness path is a scheduled
 *   settle.due effect pin the arming in its payload (see
 *   `buildSettleDueEffect`). Avalon, Werewolf, Demo, Pictionary,
 *   Story Relay, and DrawGuess all arm one; Fibking and Undercover
 *   have no stage-deadline domain and arm none.
 *
 * The late-submission gate (`rejectIfPastDeadline`) is the same
 * deadline fact read from the submission side: a stage submission
 * arriving at or after the deadline rejects. The relay task machine
 * reads it internally; games with their own submission gates call it
 * directly with their own reason.
 */

import {
  type CommandContext,
  type Decision,
  type GameEffect,
  type GameEvent,
  reject,
  resolveSystemActorEffectId,
  resolveUncontrolledUserActorId,
} from '../engine';

/** Which platform actor resolution the expiry command travels on. */
export type PhaseExpiryActorChannel = 'uncontrolledUser' | 'system';

/** One revision comparison of the revision gate. */
export interface PhaseExpiryRevisionCheck {
  /** The revision the command carries. */
  readonly commandRevision: number;
  /** The revision the authoritative state is at. */
  readonly currentRevision: number;
}

/** The revision gate: every check must match, or the revision is stale. */
export interface PhaseExpiryRevision<TEvent extends GameEvent, TEffect extends GameEffect> {
  readonly checks: readonly PhaseExpiryRevisionCheck[];
  /** Decision for a stale revision: reject, or silently commit empty. */
  readonly onStale: () => Decision<TEvent, TEffect>;
}

/** Per-game injections for the shared expiry guard sequence. */
export interface PhaseExpiryGuards<TEvent extends GameEvent, TEffect extends GameEffect> {
  /**
   * Ready-made phase rejection, returned before any other gate;
   * null (or omitted) means the current phase accepts expiry.
   */
  readonly phaseRejection?: Decision<TEvent, TEffect> | null;
  /** Actor channel; defaults to an uncontrolled user. */
  readonly actorChannel?: PhaseExpiryActorChannel;
  /**
   * Extra actor gate after platform actor resolution, receiving the
   * resolved actor id (the effect id on the system channel); null
   * rejects nobody.
   */
  readonly checkActor?: (actorId: string) => Decision<TEvent, TEffect> | null;
  /** Revision gate; omit when the game's decide entry already gates revisions. */
  readonly revision?: PhaseExpiryRevision<TEvent, TEffect>;
  readonly deadlineAt: number | null;
  /** This game's reason for a missing or unreached deadline. */
  readonly notExpiredReason: string;
  /** The game's own expiry dispatch, invoked once every gate passes. */
  readonly dispatch: (nowMs: number) => Decision<TEvent, TEffect>;
}

/** Runs the shared expiry guard sequence for one phase expiry command. */
export function guardPhaseExpiry<TEvent extends GameEvent, TEffect extends GameEffect>(
  context: CommandContext,
  guards: PhaseExpiryGuards<TEvent, TEffect>,
): Decision<TEvent, TEffect> {
  if (guards.phaseRejection !== undefined && guards.phaseRejection !== null) {
    return guards.phaseRejection;
  }
  const actor =
    guards.actorChannel === 'system'
      ? resolveSystemActorEffectId(context)
      : resolveUncontrolledUserActorId(context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  const actorRejection = guards.checkActor?.(actor.value) ?? null;
  if (actorRejection !== null) return actorRejection;
  if (
    guards.revision !== undefined &&
    guards.revision.checks.some((check) => check.commandRevision !== check.currentRevision)
  ) {
    return guards.revision.onStale();
  }
  if (guards.deadlineAt === null || context.nowMs < guards.deadlineAt) {
    return reject(guards.notExpiredReason);
  }
  return guards.dispatch(context.nowMs);
}

/**
 * The fields a settle.due payload pins: the exact arming (game,
 * deadline) a Worker delivery must still match to settle, extended
 * per game with the phase identity fields its staleness gate
 * compares (Avalon pins phase and round as well; multi-phase relay
 * games pin roundId, phaseRevision, stepIndex and turnIndex).
 * Only `deadlineAt` is required: `gameSequence` is absent for
 * games whose state carries no game sequence, and each extension
 * field is present only for games whose staleness gate compares it.
 * The internal settle command itself carries no pin at all — the
 * pin lives only on the effect payload. The Worker-side mirror of
 * this shape is `SettleDuePinShape` in the api-worker settleDue
 * module; the two must stay field-identical.
 */
export interface SettleDuePin {
  readonly gameSequence?: number;
  readonly deadlineAt: number;
  readonly phase?: string;
  readonly round?: number;
  readonly roundId?: string;
  readonly phaseRevision?: number;
  readonly stepIndex?: number;
  readonly turnIndex?: number;
}

/**
 * Builds the scheduled settle effect for one armed stage deadline.
 * The payload pins the exact arming so the Worker handler can no-op
 * a delivery that arrives after the phase already settled or a new
 * game began. Game-rule validation of a pin field (for example a
 * legal round) stays at the game's call site.
 */
export function buildSettleDueEffect<TGameType extends string, TPin extends SettleDuePin>(
  gameType: TGameType,
  pin: TPin,
): { readonly type: `${TGameType}.settle.due`; readonly payload: TPin } {
  return { type: `${gameType}.settle.due`, payload: pin };
}

/**
 * The late-submission deadline gate: a rejection carrying `reason`
 * once `nowMs` reaches a present deadline, or null while submission
 * is still on time (or no deadline is armed).
 */
export function rejectIfPastDeadline<TEvent extends GameEvent, TEffect extends GameEffect>(
  deadlineAt: number | null,
  nowMs: number,
  reason: string,
): Decision<TEvent, TEffect> | null {
  return deadlineAt !== null && nowMs >= deadlineAt ? reject(reason) : null;
}
