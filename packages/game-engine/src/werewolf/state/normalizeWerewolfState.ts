/**
 * State Normalization (parse boundary)
 *
 * normalizeWerewolfState is the WerewolfState → WerewolfState normalization transform point.
 * Called before broadcast / before store write, ensuring:
 * - seat-map keys are canonicalized to string
 * - Optional fields are correctly passed through
 * - Required fields fail-fast (requireField)
 */

import type { WerewolfState } from '../protocol/types';

/**
 * Compile-time exhaustiveness guard for normalizeWerewolfState.
 *
 * Requires all keys of T to be explicitly present in the object literal.
 * Value correctness is guaranteed by the function's return type annotation.
 *
 * Effect: adding a new field to WerewolfState without listing it in
 * normalizeWerewolfState's return → TS error (missing property).
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
    throw new Error(`normalizeWerewolfState: missing required field: ${fieldName}`);
  }
  return value;
}

/**
 * Pre-broadcast state normalization (normalizeWerewolfState) — parse boundary.
 *
 * - Core required fields: fail-fast (requireField)
 * - seat-map keys: canonicalize to string
 *
 * Compile-time guard:
 * The returned object uses `satisfies Complete<WerewolfState>` to ensure every field is explicitly listed.
 * Adding a new WerewolfState field without passing it through here → compile error (no silent drop).
 */
export function normalizeWerewolfState(raw: WerewolfState): WerewolfState {
  // single source of truth: currentNightResults.wolfVotesBySeat
  // Protocol no longer includes top-level wolfVotes/wolfVoteStatus.
  const wolfVotesBySeat = canonicalizeSeatKeyRecord(raw.currentNightResults?.wolfVotesBySeat);

  const currentNightResults = raw.currentNightResults
    ? {
        ...raw.currentNightResults,
        wolfVotesBySeat,
      }
    : raw.currentNightResults;

  return {
    // Required fields (fail-fast to avoid masking state corruption)
    roomCode: requireField(raw.roomCode, 'roomCode'),
    hostUserId: requireField(raw.hostUserId, 'hostUserId'),
    status: requireField(raw.status, 'status'),
    templateRoles: requireField(raw.templateRoles, 'templateRoles'),
    rules: raw.rules,
    // Phase 1: players kept as-is, no key canonicalization
    players: requireField(raw.players, 'players'),
    // Player display info (roster), keyed by userId
    roster: raw.roster ?? {},
    currentStepIndex: requireField(raw.currentStepIndex, 'currentStepIndex'),
    isAudioPlaying: requireField(raw.isAudioPlaying, 'isAudioPlaying'),

    // Execution state (boundary normalize: undefined → [], so internal code doesn't need ?? [])
    actions: raw.actions ?? [],
    currentNightResults,
    pendingRevealAcks: raw.pendingRevealAcks ?? [],
    lastNightDeaths: raw.lastNightDeaths,
    deathReasons: raw.deathReasons,

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

    // Treasure Master (pass-through)
    bottomCards: raw.bottomCards,
    treasureMasterSeat: raw.treasureMasterSeat,
    treasureMasterChosenCard: raw.treasureMasterChosenCard,
    effectiveTeam: raw.effectiveTeam,
    bottomCardStepRoles: raw.bottomCardStepRoles,

    // Thief (pass-through)
    thiefSeat: raw.thiefSeat,
    thiefChosenCard: raw.thiefChosenCard,

    // Cupid (pass-through)
    loverSeats: raw.loverSeats,
    cupidSeat: raw.cupidSeat,
    cupidLoversRevealAcks: raw.cupidLoversRevealAcks,

    // Board nominations (pass-through)
    boardNominations: raw.boardNominations,
  } satisfies Complete<WerewolfState>;
}
