/**
 * State Normalization (parse boundary)
 *
 * normalizeState is the GameState → GameState normalization transform point.
 * Called before broadcast / before store write, ensuring:
 * - seat-map keys are canonicalized to string
 * - Optional fields are correctly passed through
 * - Required fields fail-fast (requireField)
 */

import { WEREWOLF_GAME_TYPE } from '../../../../platform/protocol/gameTypes';
import { WEREWOLF_STATE_VERSION } from '../../state/version';
import type { GameState } from '../protocol/types';
import type { SheriffElectionRoundResult, SheriffElectionState } from '../protocol/types';
import { assertWerewolfStateInvariants } from './assertStateInvariants';

/**
 * Compile-time exhaustiveness guard for normalizeState.
 *
 * Requires all keys of T to be explicitly present in the object literal.
 * Value correctness is guaranteed by the function's return type annotation.
 *
 * Effect: adding a new field to GameState without listing it in
 * normalizeState's return → TS error (missing property).
 */
export type Complete<T> = Record<keyof T, unknown>;

/**
 * Canonicalize a seat-key record, ensuring all keys are strings.
 * Used for any Record<string, T> that may receive number keys at runtime.
 */
function canonicalizeSeatKeyRecord<T>(
  record: Record<string | number, T> | undefined,
): Record<string, T> | undefined {
  if (record === undefined) return undefined;
  const result: Record<string, T> = {};
  for (const [k, v] of Object.entries(record)) {
    result[String(k)] = v;
  }
  return result;
}

function requireField<T>(value: T | undefined, fieldName: string): T {
  if (value === undefined) {
    throw new Error(`normalizeState: missing required field: ${fieldName}`);
  }
  return value;
}

function requireIdentity<T>(value: T | undefined, expected: T, fieldName: string): T {
  const actual = requireField(value, fieldName);
  if (actual !== expected) {
    throw new Error(`normalizeState: unsupported ${fieldName}: ${String(actual)}`);
  }
  return actual;
}

function canonicalizeRequiredSeatKeyRecord<T>(
  record: Readonly<Record<number, T>>,
): Readonly<Record<number, T>> {
  const result: Record<number, T> = {};
  for (const [seat, value] of Object.entries(record)) {
    result[Number(seat)] = value;
  }
  return result;
}

function normalizeSheriffRoundResult(
  result: SheriffElectionRoundResult,
): SheriffElectionRoundResult {
  return {
    ...result,
    ballots: canonicalizeRequiredSeatKeyRecord(result.ballots),
    voteCounts: canonicalizeRequiredSeatKeyRecord(result.voteCounts),
  };
}

function normalizeSheriffElection(
  election: SheriffElectionState | undefined,
): SheriffElectionState | undefined {
  if (election === undefined) return undefined;
  const common = {
    registeredSeats: [...election.registeredSeats],
    withdrawnSeats: [...election.withdrawnSeats],
    completedRounds: election.completedRounds.map(normalizeSheriffRoundResult),
  };
  switch (election.phase) {
    case 'registration':
    case 'withdrawal':
    case 'completed':
      return { ...common, phase: election.phase };
    case 'candidateSpeech':
      return {
        ...common,
        phase: election.phase,
        speakingOrder: [...election.speakingOrder],
      };
    case 'firstVote':
    case 'runoffVote':
      return {
        ...common,
        phase: election.phase,
        candidateSeats: [...election.candidateSeats],
        eligibleVoterSeats: [...election.eligibleVoterSeats],
        ballots: canonicalizeRequiredSeatKeyRecord(election.ballots),
      };
    case 'runoffSpeech':
      return {
        ...common,
        phase: election.phase,
        candidateSeats: [...election.candidateSeats],
        speakingOrder: [...election.speakingOrder],
      };
  }
  const exhaustive: never = election;
  return exhaustive;
}

/**
 * Pre-broadcast state normalization (normalizeState) — parse boundary.
 *
 * - Core required fields: fail-fast (requireField)
 * - seat-map keys: canonicalize to string
 *
 * Compile-time guard:
 * The returned object uses `satisfies Complete<GameState>` to ensure every field is explicitly listed.
 * Adding a new GameState field without passing it through here → compile error (no silent drop).
 */
export function normalizeState(raw: GameState): GameState {
  // single source of truth: currentNightResults.wolfVotesBySeat
  // Protocol no longer includes top-level wolfVotes/wolfVoteStatus.
  const wolfVotesBySeat = canonicalizeSeatKeyRecord(raw.currentNightResults?.wolfVotesBySeat);

  const currentNightResults = raw.currentNightResults
    ? {
        ...raw.currentNightResults,
        wolfVotesBySeat,
      }
    : raw.currentNightResults;

  const normalized = {
    // Required fields (fail-fast to avoid masking state corruption)
    gameType: requireIdentity(raw.gameType, WEREWOLF_GAME_TYPE, 'gameType'),
    stateVersion: requireIdentity(raw.stateVersion, WEREWOLF_STATE_VERSION, 'stateVersion'),
    roomCode: requireField(raw.roomCode, 'roomCode'),
    hostUserId: requireField(raw.hostUserId, 'hostUserId'),
    status: requireField(raw.status, 'status'),
    templateRoles: requireField(raw.templateRoles, 'templateRoles'),
    rules: raw.rules,
    // Player keys retain the authoritative state representation.
    players: requireField(raw.players, 'players'),
    // Player display info (roster), keyed by userId
    roster: raw.roster ?? {},
    currentStepIndex: requireField(raw.currentStepIndex, 'currentStepIndex'),
    isAudioPlaying: requireField(raw.isAudioPlaying, 'isAudioPlaying'),

    // Execution state (boundary normalize: undefined → [], so internal code doesn't need ?? [])
    actions: raw.actions ?? [],
    currentNightResults,
    resolvedNightEffects: raw.resolvedNightEffects ?? [],
    pendingRevealAcks: raw.pendingRevealAcks ?? [],
    lastNightDeaths: raw.lastNightDeaths,
    deathReasons: raw.deathReasons,
    sheriffElection: normalizeSheriffElection(raw.sheriffElection),
    sheriffElectionResult: raw.sheriffElectionResult,

    // Night flow state (critical: currentStepId must be passed through)
    currentStepId: raw.currentStepId,

    // Role reveal animation seed (must be passed through, otherwise speaking-order RNG can't read it)
    roleRevealRandomNonce: raw.roleRevealRandomNonce,

    // Other optional fields (pass-through)
    nightmareBlockedSeat: raw.nightmareBlockedSeat,
    wolfKillOverride: raw.wolfKillOverride,
    witchContext: raw.witchContext,
    seerReveal: raw.seerReveal,
    mirrorSeerReveal: raw.mirrorSeerReveal,
    drunkSeerReveal: raw.drunkSeerReveal,
    psychicReveal: raw.psychicReveal,
    gargoyleReveal: raw.gargoyleReveal,
    pureWhiteReveal: raw.pureWhiteReveal,
    wolfWitchReveal: raw.wolfWitchReveal,
    wolfRobotReveal: raw.wolfRobotReveal,
    wolfRobotHunterStatusViewed: raw.wolfRobotHunterStatusViewed,
    wolfRobotContext: raw.wolfRobotContext,
    confirmStatus: raw.confirmStatus,
    actionRejected: raw.actionRejected,

    // Step progression deadline (unified deadline-gate, pass-through)
    stepDeadline: raw.stepDeadline,

    // Pending audio effect queue (pass-through)
    pendingAudioEffects: raw.pendingAudioEffects,

    // UI Hints (Host broadcast-driven, UI read-only display, must be passed through)
    ui: raw.ui,

    // Debug mode (pass-through)
    debugMode: raw.debugMode,

    // Dual Seer label mapping (pass-through)
    seerLabelMap: raw.seerLabelMap,

    // Night review share permissions (pass-through)
    nightReviewAllowedSeats: raw.nightReviewAllowedSeats,

    // Piper (pass-through, required fields)
    hypnotizedSeats: raw.hypnotizedSeats,
    piperRevealAcks: raw.piperRevealAcks,

    // Awakened Gargoyle (pass-through)
    convertedSeat: raw.convertedSeat,
    conversionRevealAcks: raw.conversionRevealAcks,

    // Seed Wolf (pass-through)
    seedWolfInfectionResult: raw.seedWolfInfectionResult,
    seedWolfDeferredReveal: raw.seedWolfDeferredReveal,
    seedWolfInfectionRevealAcks: raw.seedWolfInfectionRevealAcks,

    // Treasure Master (pass-through)
    bottomCards: raw.bottomCards,
    treasureMasterSeat: raw.treasureMasterSeat,

    // Thief (pass-through)
    thiefSeat: raw.thiefSeat,

    // Cupid (pass-through)
    loverSeats: raw.loverSeats,
    cupidSeat: raw.cupidSeat,
    cupidLoversRevealAcks: raw.cupidLoversRevealAcks,

    // Board nominations (pass-through)
    boardNominations: raw.boardNominations,
  } satisfies Complete<GameState>;

  assertWerewolfStateInvariants(normalized);
  return normalized;
}
