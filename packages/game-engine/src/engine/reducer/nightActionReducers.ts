/**
 * Night action sub-reducers — night flow progression, resolver results, state setters.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
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

export function handleStartNight(state: GameState, action: StartNightAction): GameState {
  const { currentStepIndex, currentStepId } = action.payload;
  return {
    ...state,
    status: GameStatus.Ongoing,
    currentStepIndex,
    currentStepId,
    // 不在 reducer 里设置 isAudioPlaying，由 Host UI 调用 SET_AUDIO_PLAYING 控制
    actions: [],
    currentNightResults: {},
    pendingRevealAcks: [],
  };
}

export function handleAdvanceToNextAction(
  state: GameState,
  action: AdvanceToNextActionAction,
): GameState {
  const { nextStepIndex, nextStepId } = action.payload;
  return {
    ...state,
    currentStepIndex: nextStepIndex,
    // PR6 contract: 推进时同步更新 currentStepId（单一真相）
    currentStepId: nextStepId ?? undefined,
    // 推进到新步骤时清除上一步的 stepDeadline
    stepDeadline: undefined,
    // 不在 reducer 里设置 isAudioPlaying，由 Host UI 调用 SET_AUDIO_PLAYING 控制
    // 注意：wolf 投票单一真相在 currentNightResults.wolfVotesBySeat（协议已移除 wolfVotes/wolfVoteStatus）。
    // P0-FIX: 不再清空 reveal 字段。reveal 应该保留到整个夜晚结束，
    // 让 UI 有足够时间显示弹窗。只清空 confirmStatus 和 witchContext
    // 因为这些是步骤特定的 context，不是 reveal 结果。
    confirmStatus: undefined,
    witchContext: undefined,
  };
}

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
    // PR6 contract: 夜晚结束清空 stepId 和 isAudioPlaying
    currentStepId: undefined,
    isAudioPlaying: false,
  };
}

export function handleRecordAction(state: GameState, action: RecordActionAction): GameState {
  const { action: newAction } = action.payload;
  const existingActions = state.actions;
  return {
    ...state,
    actions: [...existingActions, newAction],
  };
}

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
    updates && 'hypnotizedSeats' in updates ? updates.hypnotizedSeats : state.hypnotizedSeats;

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

export function handleSetWitchContext(state: GameState, action: SetWitchContextAction): GameState {
  return {
    ...state,
    witchContext: action.payload,
  };
}

export function handleSetConfirmStatus(
  state: GameState,
  action: SetConfirmStatusAction,
): GameState {
  return {
    ...state,
    confirmStatus: action.payload,
  };
}

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
    },
  };
}

export function handleSetWolfRobotHunterStatusViewed(
  state: GameState,
  action: SetWolfRobotHunterStatusViewedAction,
): GameState {
  return {
    ...state,
    wolfRobotHunterStatusViewed: action.payload.viewed,
  };
}

export function handleSetAudioPlaying(state: GameState, action: SetAudioPlayingAction): GameState {
  return {
    ...state,
    isAudioPlaying: action.payload.isPlaying,
  };
}

export function handleActionRejected(state: GameState, action: ActionRejectedAction): GameState {
  return {
    ...state,
    actionRejected: action.payload,
  };
}

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
