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
    case 'completed':
      return { ...common, phase: election.phase };
    case 'candidateSpeech':
      return {
        ...common,
        phase: election.phase,
        speakingStartSeat: election.speakingStartSeat,
        speakingDirection: election.speakingDirection,
      };
    case 'firstVote':
    case 'runoffVote':
      return {
        ...common,
        phase: election.phase,
        candidateSeats: [...election.candidateSeats],
        eligibleVoterSeats: [...election.eligibleVoterSeats],
        ballots: canonicalizeRequiredSeatKeyRecord(election.ballots),
        deadline: election.deadline,
      };
    case 'runoffSpeech':
      return {
        ...common,
        phase: election.phase,
        candidateSeats: [...election.candidateSeats],
        speakingStartSeat: election.speakingStartSeat,
        speakingDirection: election.speakingDirection,
      };
    case 'result':
      return {
        ...common,
        phase: election.phase,
        deadline: election.deadline,
        next:
          election.next.kind === 'final'
            ? election.next
            : { ...election.next, candidateSeats: [...election.next.candidateSeats] },
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
  const normalized = {
    // Required fields (fail-fast to avoid masking state corruption)
    gameType: requireIdentity(raw.gameType, WEREWOLF_GAME_TYPE, 'gameType'),
    roomCode: requireField(raw.roomCode, 'roomCode'),
    hostUserId: requireField(raw.hostUserId, 'hostUserId'),
    status: requireField(raw.status, 'status'),
    templateRoles: requireField(raw.templateRoles, 'templateRoles'),
    rules: raw.rules,
    // Player keys retain the authoritative state representation.
    players: requireField(raw.players, 'players'),
    roleViewedSeats: requireField(raw.roleViewedSeats, 'roleViewedSeats'),
    startingParticipants: raw.startingParticipants,
    mvpUserId: raw.mvpUserId,
    // Seat occupancy roster (seat -> human occupant or bot marker)
    roster: requireField(raw.roster, 'roster'),
    nightState: requireField(raw.nightState, 'nightState'),
    isAudioPlaying: requireField(raw.isAudioPlaying, 'isAudioPlaying'),
    audioBatchId: requireField(raw.audioBatchId, 'audioBatchId'),
    gameSequence: requireField(raw.gameSequence, 'gameSequence'),

    lastNightDeaths: raw.lastNightDeaths,
    lastNightInfoConfirmed: raw.lastNightInfoConfirmed,
    reviewCompletedUserIds: raw.reviewCompletedUserIds,
    deathReasons: raw.deathReasons,
    sheriffElection: normalizeSheriffElection(raw.sheriffElection),
    sheriffElectionResult: raw.sheriffElectionResult,

    // Role reveal animation seed (must be passed through, otherwise speaking-order RNG can't read it)
    roleRevealRandomNonce: raw.roleRevealRandomNonce,

    pendingAudioEffects: requireField(raw.pendingAudioEffects, 'pendingAudioEffects'),

    // Dual Seer label mapping (pass-through)
    seerLabelMap: raw.seerLabelMap,

    // Night review share permissions (pass-through)
    nightReviewAllowedSeats: raw.nightReviewAllowedSeats,

    // Bottom cards (pass-through)
    bottomCards: raw.bottomCards,

    // Board nominations (pass-through)
    boardNominations: raw.boardNominations,
  } satisfies Complete<GameState>;

  assertWerewolfStateInvariants(normalized);
  return normalized;
}
