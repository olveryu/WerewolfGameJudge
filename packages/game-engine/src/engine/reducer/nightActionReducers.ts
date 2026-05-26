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
 *   - handleSetAudioPlaying: @pre status === 'Ongoing' || status === 'Ended'
 *   - handleSetWitchContext: @pre status === 'Ongoing'
 *   - handleSetWolfKillOverride: @pre status === 'Ongoing'
 */

import { GameStatus } from '../../models';
import type { GameState } from '../store/types';
import type {
  ActionRejectedAction,
  AddRevealAckAction,
  AdvanceToNextActionAction,
  ApplyResolverResultAction,
  EndNightAction,
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
    currentStepId,
    // Do not set isAudioPlaying in reducer; Host UI controls it via SET_AUDIO_PLAYING
    actions: [],
    currentNightResults: {},
    pendingRevealAcks: [],
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
    // PR6 contract: sync currentStepId on advance (single source of truth)
    currentStepId: nextStepId ?? undefined,
    // Clear previous step's stepDeadline when advancing to a new step
    stepDeadline: undefined,
    // Do not set isAudioPlaying in reducer; Host UI controls it via SET_AUDIO_PLAYING
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
  return {
    ...state,
    // Terminal state for this app's scope (Night-1-only): results are ready.
    // This is NOT a winner decision; players decide outcomes offline.
    status: GameStatus.Ended,
    lastNightDeaths: deaths,
    deathReasons,
    currentStepIndex: -1,
    // PR6 contract: clear stepId and isAudioPlaying when night ends
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
  } = action.payload;

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

  // Sync treasureMaster fields from resolver updates to top-level state
  const treasureMasterChosenCard =
    updates && 'treasureMasterChosenCard' in updates
      ? updates.treasureMasterChosenCard
      : state.treasureMasterChosenCard;
  const effectiveTeam =
    updates && 'effectiveTeam' in updates ? updates.effectiveTeam : state.effectiveTeam;
  const bottomCardStepRoles =
    updates && 'bottomCardStepRoles' in updates
      ? updates.bottomCardStepRoles
      : state.bottomCardStepRoles;

  // Sync thief fields from resolver updates to top-level state
  const thiefChosenCard =
    updates && 'thiefChosenCard' in updates ? updates.thiefChosenCard : state.thiefChosenCard;

  // Sync cupid fields from resolver updates to top-level state
  const loverSeats = updates && 'loverSeats' in updates ? updates.loverSeats : state.loverSeats;

  return {
    ...state,
    currentNightResults,
    nightmareBlockedSeat,
    wolfKillOverride,
    hypnotizedSeats,
    convertedSeat,
    treasureMasterChosenCard,
    effectiveTeam,
    bottomCardStepRoles,
    thiefChosenCard,
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
