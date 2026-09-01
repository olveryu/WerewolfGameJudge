/**
 * Night action sub-reducers — night flow progression, resolver results, state setters.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
 *
 * @pre Each reducer assumes the caller has validated via the handler layer; preconditions are not re-checked.
 *   - handleStartNight: @pre status === 'Setup' || status === 'Unseated'
 *   - handleAdvanceToNextAction: @pre status === 'Ongoing'
 *   - handleEndNight: @pre status === 'Ongoing' && currentStepId === undefined
 *   - handleApplyResolverResult: @pre status === 'Ongoing'
 *   - handleSetAudioPlaying: accepts authoritative audio-queue state events
 *   - handleSetWitchContext: @pre status === 'Ongoing'
 *   - handleSetWolfKillOverride: @pre status === 'Ongoing'
 */

import { GameStatus } from '../models';
import type { GameState } from '../protocol/types';
import type {
  ActionRejectedAction,
  AddRevealAckAction,
  AdvanceToNextActionAction,
  ApplyResolverResultAction,
  EndNightAction,
  FinalizeSeedWolfInfectionAction,
  RecordActionAction,
  SetAudioPlayingAction,
  SetConfirmStatusAction,
  SetWitchContextAction,
  SetWolfKillOverrideAction,
  SetWolfRobotHunterStatusViewedAction,
  StartNightAction,
} from './types';

/** Start night (set initial stepIndex, clear actions/results). */
export function handleStartNight(state: GameState, action: StartNightAction): GameState {
  const { currentStepIndex, currentStepId } = action.payload;
  return {
    ...state,
    status: GameStatus.Ongoing,
    currentStepIndex,
    currentStepId: currentStepId ?? undefined,
    // Audio queue events own isAudioPlaying; step transitions never infer it.
    actions: [],
    currentNightResults: {},
    resolvedNightEffects: [],
    pendingRevealAcks: [],
    seedWolfInfectionResult: undefined,
    seedWolfDeferredReveal: undefined,
    seedWolfInfectionRevealAcks: [],
  };
}

/** Advance to the next night step. */
export function handleAdvanceToNextAction(
  state: GameState,
  action: AdvanceToNextActionAction,
): GameState {
  const { nextStepIndex, nextStepId } = action.payload;
  return {
    ...state,
    currentStepIndex: nextStepIndex,
    // Keep currentStepId synchronized on advance.
    currentStepId: nextStepId ?? undefined,
    // Clear previous step's stepDeadline when advancing to a new step
    stepDeadline: undefined,
    // Audio queue events own isAudioPlaying; step transitions never infer it.
    // Note: wolf vote single source of truth is currentNightResults.wolfVotesBySeat (protocol removed wolfVotes/wolfVoteStatus).
    // P0-FIX: no longer clear reveal fields. Reveal should persist through the entire night
    // so UI has enough time to display the popup. Only clear confirmStatus and witchContext
    // since these are step-specific context, not reveal results.
    confirmStatus: undefined,
    witchContext: undefined,
  };
}

/** End night (write death results, transition status to Ended). */
export function handleEndNight(state: GameState, action: EndNightAction): GameState {
  const { deaths, deathReasons } = action.payload;
  const isSheriffElectionEnabled = state.rules?.isSheriffElectionEnabled === true;
  return {
    ...state,
    status: isSheriffElectionEnabled ? GameStatus.Day : GameStatus.Ended,
    lastNightDeaths: deaths,
    deathReasons,
    sheriffElection: isSheriffElectionEnabled
      ? {
          phase: 'registration',
          registeredSeats: [],
          withdrawnSeats: [],
          completedRounds: [],
        }
      : undefined,
    sheriffElectionResult: undefined,
    currentStepIndex: -1,
    // Clear step state and audio state when night ends.
    currentStepId: undefined,
    isAudioPlaying: false,
  };
}

/** Record a single night action. */
export function handleRecordAction(state: GameState, action: RecordActionAction): GameState {
  const { action: newAction } = action.payload;
  const existingActions = state.actions;
  return {
    ...state,
    actions: [...existingActions, newAction],
  };
}

/** Apply resolver computed result to state (reveal, status sync). */
export function handleApplyResolverResult(
  state: GameState,
  action: ApplyResolverResultAction,
): GameState {
  const appliedState = applyResolvedNightEffect(state, action.payload);
  return {
    ...appliedState,
    resolvedNightEffects: [...(state.resolvedNightEffects ?? []), action.payload],
  };
}

function applyResolvedNightEffect(
  state: GameState,
  effect: ApplyResolverResultAction['payload'],
): GameState {
  const {
    updates,
    seerReveal,
    mirrorSeerReveal,
    drunkSeerReveal,
    psychicReveal,
    gargoyleReveal,
    pureWhiteReveal,
    wolfWitchReveal,
    wolfRobotReveal,
    wolfRobotContext,
    wolfRobotHunterStatusViewed,
    seedWolfDeferredReveal,
  } = effect;

  const currentNightResults = updates
    ? {
        ...state.currentNightResults,
        ...updates,
      }
    : state.currentNightResults;

  // Sync nightmare block fields from updates to top-level state
  // (These are the single source of truth for UI, not currentNightResults)
  // Note: Use 'in' check to allow blockedSeat=0 (seat 0 is valid)
  const nightmareBlockedSeat =
    updates && 'blockedSeat' in updates ? updates.blockedSeat : state.nightmareBlockedSeat;
  const wolfKillOverride =
    updates && 'wolfKillOverride' in updates ? updates.wolfKillOverride : state.wolfKillOverride;

  // Sync cumulative hypnotizedSeats from resolver updates to top-level state
  // (Top-level hypnotizedSeats is the cross-night source of truth; resolver context reads it)
  const hypnotizedSeats =
    updates && 'hypnotizedSeats' in updates
      ? (updates.hypnotizedSeats ?? state.hypnotizedSeats)
      : state.hypnotizedSeats;

  // Sync convertedSeat from resolver updates to top-level state
  const convertedSeat =
    updates && 'convertedSeat' in updates ? updates.convertedSeat : state.convertedSeat;

  // Sync cupid fields from resolver updates to top-level state
  const loverSeats = updates && 'loverSeats' in updates ? updates.loverSeats : state.loverSeats;

  return {
    ...state,
    currentNightResults,
    nightmareBlockedSeat,
    wolfKillOverride,
    hypnotizedSeats,
    convertedSeat,
    loverSeats,
    seerReveal: seerReveal ?? state.seerReveal,
    mirrorSeerReveal: mirrorSeerReveal ?? state.mirrorSeerReveal,
    drunkSeerReveal: drunkSeerReveal ?? state.drunkSeerReveal,
    psychicReveal: psychicReveal ?? state.psychicReveal,
    gargoyleReveal: gargoyleReveal ?? state.gargoyleReveal,
    pureWhiteReveal: pureWhiteReveal ?? state.pureWhiteReveal,
    wolfWitchReveal: wolfWitchReveal ?? state.wolfWitchReveal,
    wolfRobotReveal: wolfRobotReveal ?? state.wolfRobotReveal,
    wolfRobotContext: wolfRobotContext ?? state.wolfRobotContext,
    // Gate: wolfRobot learned hunter - must view status before proceeding
    wolfRobotHunterStatusViewed: wolfRobotHunterStatusViewed ?? state.wolfRobotHunterStatusViewed,
    seedWolfDeferredReveal: seedWolfDeferredReveal ?? state.seedWolfDeferredReveal,
  };
}

/** Finalize Seed Wolf infection and replay all resolver effects except the converted actor's. */
export function handleFinalizeSeedWolfInfection(
  state: GameState,
  action: FinalizeSeedWolfInfectionAction,
): GameState {
  const { result } = action.payload;
  if (result.outcome !== 'converted') {
    return {
      ...state,
      seedWolfInfectionResult: result,
      seedWolfDeferredReveal: undefined,
      seedWolfInfectionRevealAcks: [],
    };
  }

  const targetPlayer = state.players[result.targetSeat];
  if (!targetPlayer?.role) {
    throw new Error(
      `[FAIL-FAST] Seed Wolf infection target seat ${result.targetSeat} has no assigned role`,
    );
  }

  const retainedEffects = (state.resolvedNightEffects ?? []).filter(
    (effect) => effect.sourceSeat !== result.targetSeat,
  );
  let replayedState: GameState = {
    ...state,
    currentNightResults: {},
    nightmareBlockedSeat: undefined,
    wolfKillOverride: undefined,
    hypnotizedSeats: [],
    convertedSeat: undefined,
    loverSeats: undefined,
    seerReveal: undefined,
    mirrorSeerReveal: undefined,
    drunkSeerReveal: undefined,
    psychicReveal: undefined,
    gargoyleReveal: undefined,
    pureWhiteReveal: undefined,
    wolfWitchReveal: undefined,
    wolfRobotReveal: undefined,
    wolfRobotContext: undefined,
    wolfRobotHunterStatusViewed: undefined,
    seedWolfDeferredReveal: undefined,
  };
  for (const effect of retainedEffects) {
    replayedState = applyResolvedNightEffect(replayedState, effect);
  }

  return {
    ...replayedState,
    players: {
      ...replayedState.players,
      [result.targetSeat]: { ...targetPlayer, role: 'wolf' },
    },
    actions: replayedState.actions.filter((record) => record.actorSeat !== result.targetSeat),
    resolvedNightEffects: retainedEffects,
    seedWolfInfectionResult: result,
    seedWolfInfectionRevealAcks: [],
  };
}

/** Set Witch context (poison potion status). */
export function handleSetWitchContext(state: GameState, action: SetWitchContextAction): GameState {
  return {
    ...state,
    witchContext: action.payload,
  };
}

/** Set confirm status (check result pending confirmation). */
export function handleSetConfirmStatus(
  state: GameState,
  action: SetConfirmStatusAction,
): GameState {
  return {
    ...state,
    confirmStatus: action.payload,
  };
}

/** Override wolf kill target (after Nightmare blocks). */
export function handleSetWolfKillOverride(
  state: GameState,
  action: SetWolfKillOverrideAction,
): GameState {
  const { override, blockedSeat } = action.payload;
  return {
    ...state,
    wolfKillOverride: override,
    nightmareBlockedSeat: blockedSeat,
    currentNightResults: {
      ...state.currentNightResults,
      wolfKillOverride: override,
      blockedSeat,
    },
  };
}

/** Mark Wolf Robot as having viewed Hunter status. */
export function handleSetWolfRobotHunterStatusViewed(
  state: GameState,
  action: SetWolfRobotHunterStatusViewedAction,
): GameState {
  return {
    ...state,
    wolfRobotHunterStatusViewed: action.payload.viewed,
  };
}

/** Set audio playing status. */
export function handleSetAudioPlaying(state: GameState, action: SetAudioPlayingAction): GameState {
  return {
    ...state,
    isAudioPlaying: action.payload.isPlaying,
  };
}

/** Record that an action was rejected (for UI popup feedback). */
export function handleActionRejected(state: GameState, action: ActionRejectedAction): GameState {
  return {
    ...state,
    actionRejected: action.payload,
  };
}

/** Add reveal ack (idempotent). */
export function handleAddRevealAck(state: GameState, action: AddRevealAckAction): GameState {
  const { ackKey } = action.payload;
  const existing = state.pendingRevealAcks;
  // Idempotent: ignore duplicate ack
  if (existing.includes(ackKey)) return state;
  return {
    ...state,
    pendingRevealAcks: [...existing, ackKey],
  };
}
