/**
 * Word Preparation Protocol — shared pure rules (E2).
 *
 * FibKing and Undercover prepare every round the same way: a host
 * start freezes a pending round, entering `preparing` emits exactly
 * one word-selection effect carrying the roundId and a snapshot of
 * the already-used set, the worker selects a word off-band, and a
 * system internal command (complete / fail) correlated by roundId
 * fills the result back in. A failed preparation lands in
 * `preparationFailed`; when effect delivery itself is exhausted the
 * runtime synthesizes a `selectionFailed` fail command for the round
 * that is still preparing.
 *
 * Only the protocol predicates and the decide skeleton live here —
 * the two games keep their own state unions (their pending and
 * failed shapes differ), their own reason strings, and their own
 * word validation. What a game injects instead of re-implementing:
 *
 * - its declared failure-code subset of the protocol superset (D-2);
 * - its optional preparation stage vocabulary (D-5): FibKing
 *   injects its three stages and may complete only from the final
 *   one; Undercover injects the empty vocabulary and has no stage
 *   gate;
 * - its retry identity strategy (D-1, deliberately not unified):
 *   Undercover reuses the failed pending round, FibKing starts a
 *   fresh round from its ordinary start command.
 */

import {
  type CommandContext,
  type Decision,
  type GameEffect,
  type GameEvent,
  reject,
  resolveSystemActorEffectId,
} from '../engine';

/**
 * The protocol failure-code superset (D-2). Each game declares the
 * subset it can emit: FibKing never emits `inventoryEmpty` (in its
 * sequential inventory an empty library is an exhaustion case),
 * Undercover emits all three.
 */
export const PREPARATION_FAILURE_CODES = [
  'selectionFailed',
  'inventoryEmpty',
  'inventoryExhausted',
] as const;

export type PreparationFailureCode = (typeof PREPARATION_FAILURE_CODES)[number];

export function isPreparationFailureCode(value: unknown): value is PreparationFailureCode {
  return PREPARATION_FAILURE_CODES.some((failureCode) => failureCode === value);
}

/** The pending-round core every preparation state carries. */
export interface PreparationPendingRound {
  readonly roundId: string;
  readonly requestedAt: number;
}

/** The state slice the protocol predicates read; each game's own union satisfies it. */
export interface PreparationStateSlice<TPending extends PreparationPendingRound> {
  readonly phase: string;
  readonly pendingRound: TPending | null;
}

/** True while a round is waiting for its word selection to come back. */
export function isPreparing<TPending extends PreparationPendingRound>(
  state: PreparationStateSlice<TPending>,
): boolean {
  return state.phase === 'preparing' && state.pendingRound !== null;
}

/** True once a preparation has failed and waits for a retry or a cancel. */
export function isPreparationFailed<TPending extends PreparationPendingRound>(
  state: PreparationStateSlice<TPending>,
): boolean {
  return state.phase === 'preparationFailed';
}

/** The frozen pending round, or null outside the preparing phase. */
export function getPendingRound<TPending extends PreparationPendingRound>(
  state: PreparationStateSlice<TPending>,
): TPending | null {
  return isPreparing(state) ? state.pendingRound : null;
}

/** True when the state is preparing exactly the round `roundId` names. */
export function isPreparingRound<TPending extends PreparationPendingRound>(
  state: PreparationStateSlice<TPending>,
  roundId: string,
): boolean {
  const pendingRound = getPendingRound(state);
  return pendingRound !== null && pendingRound.roundId === roundId;
}

/** The rejection points the decide skeleton can raise, in the game's own strings. */
export interface PreparationReasons {
  readonly notPreparing: string;
  readonly roundMismatch: string;
  /** Reason for a stage update that is not the single next stage. */
  readonly stageInvalid?: string;
  /** Reason for a failure code outside the game's declared subset. */
  readonly failureInvalid?: string;
}

/** Commit shape a game hands the skeleton; its own decision plumbing satisfies it. */
export type PreparationCommit<TEvent extends GameEvent, TEffect extends GameEffect> = (
  events: readonly TEvent[],
  effects?: readonly TEffect[],
) => Decision<TEvent, TEffect>;

export type PreparationGate<TPending extends PreparationPendingRound> =
  | { readonly kind: 'ready'; readonly pendingRound: TPending }
  | { readonly kind: 'reject'; readonly decision: Decision<never, never> };

/**
 * The shared gate for system internal commands: only the system
 * actor may fill a preparation result back in, the state must be
 * preparing, and the command must name the pending round — a stale
 * roundId is always rejected, never applied to a newer round.
 */
function gatePreparationInternal<TPending extends PreparationPendingRound>(
  state: PreparationStateSlice<TPending>,
  roundId: string,
  reasons: PreparationReasons,
  context: CommandContext,
): PreparationGate<TPending> {
  const actor = resolveSystemActorEffectId(context);
  if (actor.kind === 'rejected') {
    return { kind: 'reject', decision: reject(actor.reason) };
  }
  const pendingRound = getPendingRound(state);
  if (pendingRound === null) {
    return { kind: 'reject', decision: reject(reasons.notPreparing) };
  }
  if (pendingRound.roundId !== roundId) {
    return { kind: 'reject', decision: reject(reasons.roundMismatch) };
  }
  return { kind: 'ready', pendingRound };
}

/**
 * Enter preparing: commit the preparing event together with exactly
 * one selection effect built from the frozen pending round (its
 * payload carries the roundId and the used-set snapshot). This is
 * the single place the pair is assembled, so a round can never
 * enter preparing without its selection effect or with two.
 */
export function commitPreparationEntry<
  TPending extends PreparationPendingRound,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(input: {
  readonly pendingRound: TPending;
  readonly buildPreparingEvent: (pendingRound: TPending) => TEvent;
  readonly buildSelectionEffect: (pendingRound: TPending) => TEffect;
  readonly commit: PreparationCommit<TEvent, TEffect>;
}): Decision<TEvent, TEffect> {
  return input.commit(
    [input.buildPreparingEvent(input.pendingRound)],
    [input.buildSelectionEffect(input.pendingRound)],
  );
}

/**
 * Optional stage vocabulary (D-5): the stages a game shows while a
 * selection is in flight, in order. A game without progress stages
 * injects the empty vocabulary.
 */
export type PreparationStageVocabulary<TStage extends string> = readonly TStage[];

/** The single stage a pending round may advance to, or null at the final stage. */
export function nextPreparationStage<TStage extends string>(
  stages: PreparationStageVocabulary<TStage>,
  current: TStage,
): TStage | null {
  const index = stages.indexOf(current);
  if (index < 0 || index + 1 >= stages.length) return null;
  return stages[index + 1] ?? null;
}

/** True when `stage` is the vocabulary's final stage — the only one a completion may land in. */
export function isFinalPreparationStage<TStage extends string>(
  stages: PreparationStageVocabulary<TStage>,
  stage: TStage,
): boolean {
  return stages.length > 0 && stages[stages.length - 1] === stage;
}

/**
 * Advance the pending round's stage: system actor only, preparing
 * only, roundId must match, and the target must be exactly the next
 * stage of the injected vocabulary (no skipping, no going back).
 */
export function decidePreparationStageUpdate<
  TPending extends PreparationPendingRound & { readonly stage: TStage },
  TStage extends string,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(input: {
  readonly state: PreparationStateSlice<TPending>;
  readonly roundId: string;
  readonly stage: TStage;
  readonly stages: PreparationStageVocabulary<TStage>;
  readonly reasons: PreparationReasons;
  readonly context: CommandContext;
  readonly buildStageEvent: (stage: TStage) => TEvent;
  readonly commit: PreparationCommit<TEvent, TEffect>;
}): Decision<TEvent, TEffect> {
  if (input.reasons.stageInvalid === undefined) {
    throw new Error('Stage updates require a stageInvalid reason');
  }
  const gate = gatePreparationInternal(input.state, input.roundId, input.reasons, input.context);
  if (gate.kind === 'reject') return gate.decision;
  if (input.stage !== nextPreparationStage(input.stages, gate.pendingRound.stage)) {
    return reject(input.reasons.stageInvalid);
  }
  return input.commit([input.buildStageEvent(input.stage)]);
}

/**
 * Fail a preparation: gated like every internal command, then the
 * failure code must belong to the game's declared subset (D-2)
 * when the game validates codes in its decide. A game whose failed
 * state keeps the failed roundId injects `alreadyFailedRoundId` so
 * a replayed fail for that same round is an idempotent no-op while
 * any other round is a mismatch.
 */
export function decidePreparationFail<
  TPending extends PreparationPendingRound,
  TFailureCode extends PreparationFailureCode,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(input: {
  readonly state: PreparationStateSlice<TPending>;
  readonly roundId: string;
  readonly failureCode: TFailureCode;
  readonly failureCodes: readonly TFailureCode[];
  readonly reasons: PreparationReasons;
  readonly context: CommandContext;
  readonly alreadyFailedRoundId?: string | null;
  readonly buildFailedEvent: (failureCode: TFailureCode) => TEvent;
  readonly commit: PreparationCommit<TEvent, TEffect>;
}): Decision<TEvent, TEffect> {
  const actor = resolveSystemActorEffectId(input.context);
  if (actor.kind === 'rejected') return reject(actor.reason);
  if (input.alreadyFailedRoundId !== undefined && input.alreadyFailedRoundId !== null) {
    return input.alreadyFailedRoundId === input.roundId
      ? input.commit([])
      : reject(input.reasons.roundMismatch);
  }
  const gate = gatePreparationInternal(input.state, input.roundId, input.reasons, input.context);
  if (gate.kind === 'reject') return gate.decision;
  if (
    input.reasons.failureInvalid !== undefined &&
    !input.failureCodes.some((failureCode) => failureCode === input.failureCode)
  ) {
    return reject(input.reasons.failureInvalid);
  }
  return input.commit([input.buildFailedEvent(input.failureCode)]);
}

/**
 * Complete a preparation: gated like every internal command, then
 * the game's injected completion gate runs (FibKing: the pending
 * stage must be the vocabulary's final stage, D-5), then the game's
 * own word validation and started-event assembly take over.
 */
export function decidePreparationComplete<
  TPending extends PreparationPendingRound,
  TEvent extends GameEvent,
  TEffect extends GameEffect,
>(input: {
  readonly state: PreparationStateSlice<TPending>;
  readonly roundId: string;
  readonly reasons: PreparationReasons;
  readonly context: CommandContext;
  readonly completionGate?: (pendingRound: TPending) => string | null;
  readonly complete: (pendingRound: TPending) => Decision<TEvent, TEffect>;
}): Decision<TEvent, TEffect> {
  const gate = gatePreparationInternal(input.state, input.roundId, input.reasons, input.context);
  if (gate.kind === 'reject') return gate.decision;
  const gateReason = input.completionGate?.(gate.pendingRound) ?? null;
  if (gateReason !== null) return reject(gateReason);
  return input.complete(gate.pendingRound);
}

/**
 * Retry identity strategies (D-1, registered divergence — the two
 * games keep their current behavior until a ruling unifies them):
 * `reuse` replays the failed pending round unchanged (its roundId,
 * requestedAt and selection policy survive); `fresh` builds a brand
 * new pending round through the game's ordinary start path.
 */
export const PREPARATION_RETRY_STRATEGIES = { reuse: 'reuse', fresh: 'fresh' } as const;

export type PreparationRetryStrategy =
  (typeof PREPARATION_RETRY_STRATEGIES)[keyof typeof PREPARATION_RETRY_STRATEGIES];

/**
 * Resolve which pending round a (re)start enters preparing with,
 * per the injected strategy. `reuse` requires the failed pending
 * round; `fresh` ignores it and builds a new one — FibKing routes
 * every start through `fresh` (its retry is an ordinary start),
 * Undercover's dedicated retry command routes through `reuse`.
 */
export function resolvePreparationRetryPending<TPending extends PreparationPendingRound>(
  strategy: PreparationRetryStrategy,
  failedPendingRound: TPending | null,
  createFreshPendingRound: () => TPending,
): TPending {
  if (strategy === PREPARATION_RETRY_STRATEGIES.fresh) return createFreshPendingRound();
  if (failedPendingRound === null) {
    throw new Error('A reuse retry requires the failed pending round');
  }
  return failedPendingRound;
}

/**
 * The runtime fallback: when a selection effect's delivery is
 * exhausted, synthesize its fail command — but only while the state
 * is still preparing that exact round; a superseded round gets no
 * command. The synthesized failure code is always `selectionFailed`.
 */
export function buildPreparationFailureCommand<
  TPending extends PreparationPendingRound,
  TCommand,
>(input: {
  readonly isSelectionEffect: boolean;
  readonly effectRoundId: string;
  readonly state: PreparationStateSlice<TPending>;
  readonly buildFailCommand: (roundId: string, failureCode: 'selectionFailed') => TCommand;
}): TCommand | null {
  if (!input.isSelectionEffect) return null;
  if (!isPreparingRound(input.state, input.effectRoundId)) return null;
  return input.buildFailCommand(input.effectRoundId, 'selectionFailed');
}
