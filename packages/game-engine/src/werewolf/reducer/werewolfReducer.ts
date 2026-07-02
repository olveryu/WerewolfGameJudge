/**
 * Werewolf Reducer - state reducer (compose shell)
 *
 * Pure function: (state, action) => newState
 *
 * Sub-reducers are split by action category into:
 * - lifecycleReducers  — initialization, restart, seating, role assignment, etc.
 * - nightActionReducers — night flow progression, resolver results, state setters
 *
 * This file retains only switch routing and minimal inline cases.
 */

import type { WerewolfState } from '../store/types';
import {
  handleAssignRoles,
  handleFillWithBots,
  handleInitializeGame,
  handleMarkAllBotsViewed,
  handlePlayerJoin,
  handlePlayerLeave,
  handlePlayerViewedRole,
  handleRestartGame,
  handleSetBoardNomination,
  handleUpdatePlayerProfile,
  handleUpdateTemplate,
  handleUpvoteBoardNomination,
  handleWithdrawBoardNomination,
} from './lifecycleReducers';
import {
  handleActionRejected,
  handleAddRevealAck,
  handleAdvanceToNextAction,
  handleApplyResolverResult,
  handleEndNight,
  handleRecordAction,
  handleSetAudioPlaying,
  handleSetConfirmStatus,
  handleSetWitchContext,
  handleSetWolfKillOverride,
  handleSetWolfRobotHunterStatusViewed,
  handleStartNight,
} from './nightActionReducers';
import type { StateAction } from './types';

/**
 * Game state reducer
 */
export function werewolfReducer(state: WerewolfState, action: StateAction): WerewolfState {
  switch (action.type) {
    // ── Lifecycle ────────────────────────────────────────
    case 'INITIALIZE_GAME':
      return handleInitializeGame(state, action);
    case 'RESTART_GAME':
      return handleRestartGame(state, action);
    case 'UPDATE_TEMPLATE':
      return handleUpdateTemplate(state, action);
    case 'PLAYER_JOIN':
      return handlePlayerJoin(state, action);
    case 'PLAYER_LEAVE':
      return handlePlayerLeave(state, action);
    case 'UPDATE_PLAYER_PROFILE':
      return handleUpdatePlayerProfile(state, action);
    case 'ASSIGN_ROLES':
      return handleAssignRoles(state, action);
    case 'PLAYER_VIEWED_ROLE':
      return handlePlayerViewedRole(state, action);
    case 'FILL_WITH_BOTS':
      return handleFillWithBots(state, action);
    case 'MARK_ALL_BOTS_VIEWED':
      return handleMarkAllBotsViewed(state);

    // ── Night action flow ────────────────────────────────
    case 'START_NIGHT':
      return handleStartNight(state, action);
    case 'ADVANCE_TO_NEXT_ACTION':
      return handleAdvanceToNextAction(state, action);
    case 'END_NIGHT':
      return handleEndNight(state, action);
    case 'RECORD_ACTION':
      return handleRecordAction(state, action);
    case 'APPLY_RESOLVER_RESULT':
      return handleApplyResolverResult(state, action);
    case 'SET_WITCH_CONTEXT':
      return handleSetWitchContext(state, action);
    case 'SET_CONFIRM_STATUS':
      return handleSetConfirmStatus(state, action);
    case 'SET_WOLF_KILL_OVERRIDE':
      return handleSetWolfKillOverride(state, action);
    case 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED':
      return handleSetWolfRobotHunterStatusViewed(state, action);
    case 'SET_AUDIO_PLAYING':
      return handleSetAudioPlaying(state, action);
    case 'ACTION_REJECTED':
      return handleActionRejected(state, action);
    case 'ADD_REVEAL_ACK':
      return handleAddRevealAck(state, action);

    // ── Inline trivial cases ─────────────────────────────
    case 'CLEAR_REVEAL_STATE':
      return {
        ...state,
        seerReveal: undefined,
        mirrorSeerReveal: undefined,
        drunkSeerReveal: undefined,
        psychicReveal: undefined,
        gargoyleReveal: undefined,
        pureWhiteReveal: undefined,
        wolfWitchReveal: undefined,
        wolfRobotReveal: undefined,
        wolfRobotHunterStatusViewed: undefined,
        confirmStatus: undefined,
        witchContext: undefined,
      };

    case 'SET_UI_HINT':
      return {
        ...state,
        ui: { ...state.ui, currentActorHint: action.payload.currentActorHint },
      };

    case 'CLEAR_ACTION_REJECTED':
      return { ...state, actionRejected: undefined };

    case 'CLEAR_REVEAL_ACKS':
      return { ...state, pendingRevealAcks: [] };

    case 'SET_STEP_DEADLINE':
      return { ...state, stepDeadline: action.payload.deadline };

    case 'CLEAR_STEP_DEADLINE':
      return { ...state, stepDeadline: undefined };

    case 'SET_PENDING_AUDIO_EFFECTS':
      return { ...state, pendingAudioEffects: action.payload.effects };

    case 'CLEAR_PENDING_AUDIO_EFFECTS':
      return { ...state, pendingAudioEffects: undefined };

    case 'SET_NIGHT_REVIEW_ALLOWED_SEATS':
      return { ...state, nightReviewAllowedSeats: action.allowedSeats };

    case 'ADD_PIPER_REVEAL_ACK': {
      const acks = state.piperRevealAcks ?? [];
      const seat = action.payload.seat;
      // Idempotent: ignore duplicate ack
      if (acks.includes(seat)) return state;
      return { ...state, piperRevealAcks: [...acks, seat] };
    }

    case 'ADD_CONVERSION_REVEAL_ACK': {
      const acks = state.conversionRevealAcks ?? [];
      const seat = action.payload.seat;
      // Idempotent: ignore duplicate ack
      if (acks.includes(seat)) return state;
      return { ...state, conversionRevealAcks: [...acks, seat] };
    }

    case 'ADD_CUPID_LOVERS_REVEAL_ACK': {
      const acks = state.cupidLoversRevealAcks ?? [];
      const seat = action.payload.seat;
      // Idempotent: ignore duplicate ack
      if (acks.includes(seat)) return state;
      return { ...state, cupidLoversRevealAcks: [...acks, seat] };
    }

    // ── Board Nomination ─────────────────────────────────
    case 'SET_BOARD_NOMINATION':
      return handleSetBoardNomination(state, action);
    case 'UPVOTE_BOARD_NOMINATION':
      return handleUpvoteBoardNomination(state, action);
    case 'WITHDRAW_BOARD_NOMINATION':
      return handleWithdrawBoardNomination(state, action);

    // ── Growth ───────────────────────────────────────────
    case 'UPDATE_ROSTER_LEVELS': {
      const { levels } = action.payload;
      const newRoster = { ...state.roster };
      let changed = false;
      for (const [userId, level] of Object.entries(levels)) {
        if (newRoster[userId] && newRoster[userId].level !== level) {
          newRoster[userId] = { ...newRoster[userId], level };
          changed = true;
        }
      }
      return changed ? { ...state, roster: newRoster } : state;
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
