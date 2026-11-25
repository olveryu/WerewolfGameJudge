/**
 * Game Reducer - state reducer (compose shell)
 *
 * Pure function: (state, action) => newState
 *
 * Sub-reducers are split by action category into:
 * - lifecycleReducers  — initialization, restart, seating, role assignment, etc.
 * - nightActionReducers — night flow progression, resolver results, state setters
 *
 * This file retains only switch routing and minimal inline cases.
 */

import { queueAudioBatch } from '../../../../platform/audio';
import { buildRoomSeatProfile } from '../../../../platform/room/roster';
import { findRosterSeatByUserId, isBotOccupant } from '../../../../platform/room/seating';
import { evolveWerewolfNight } from '../../roles/nightEvolution';
import type { GameState } from '../protocol/types';
import {
  handleAssignRoles,
  handleFillWithBots,
  handleInitializeGame,
  handlePlayerJoin,
  handlePlayerLeave,
  handlePlayerViewedRole,
  handleRestartGame,
  handleSeatsChanged,
  handleSetBoardNomination,
  handleUpdatePlayerProfile,
  handleUpdateTemplate,
  handleUpvoteBoardNomination,
  handleWithdrawBoardNomination,
} from './lifecycleReducers';
import { handleEndNight, handleStartNight } from './nightActionReducers';
import {
  handleAdvanceSheriffElection,
  handleCancelSheriffRegistration,
  handleCastSheriffVote,
  handleClearSheriffElectionDeadline,
  handleCompleteSheriffElection,
  handleRegisterSheriffCandidate,
  handleSetSheriffElectionDeadline,
  handleWithdrawSheriffCandidate,
} from './sheriffElectionReducers';
import type { StateAction } from './types';

/**
 * Game state reducer
 */
export function gameReducer(state: GameState, action: StateAction): GameState {
  switch (action.type) {
    // ── Lifecycle ────────────────────────────────────────
    case 'INITIALIZE_GAME':
      return handleInitializeGame(state, action);
    case 'RESTART_GAME':
      return handleRestartGame(state, action);
    case 'SELECT_MVP':
      return { ...state, mvpUserId: action.mvpUserId };
    case 'WEREWOLF_NIGHT_EVENT': {
      const nightState = evolveWerewolfNight(state, action.event);
      const outcome = action.event.type === 'infectionSettled' ? action.event.outcome : undefined;
      const infectedPlayer =
        outcome?.outcome === 'converted' ? state.players[outcome.targetSeat] : undefined;
      if (outcome?.outcome === 'converted' && infectedPlayer == null) {
        throw new Error('[FAIL-FAST] Seed Wolf infection target has no player');
      }
      const players =
        outcome?.outcome === 'converted' && infectedPlayer != null
          ? {
              ...state.players,
              [outcome.targetSeat]: { ...infectedPlayer, role: 'wolf' as const },
            }
          : state.players;
      return { ...state, nightState, players };
    }
    case 'UPDATE_TEMPLATE':
      return handleUpdateTemplate(state, action);
    case 'PLAYER_JOIN':
      return handlePlayerJoin(state, action);
    case 'PLAYER_LEAVE':
      return handlePlayerLeave(state, action);
    case 'SEATS_CHANGED':
      return handleSeatsChanged(state, action);
    case 'UPDATE_PLAYER_PROFILE':
      return handleUpdatePlayerProfile(state, action);
    case 'ASSIGN_ROLES':
      return handleAssignRoles(state, action);
    case 'PLAYER_VIEWED_ROLE':
      return handlePlayerViewedRole(state, action);
    case 'FILL_WITH_BOTS':
      return handleFillWithBots(state, action);

    // ── Night action flow ────────────────────────────────
    case 'START_NIGHT':
      return handleStartNight(state, action);
    case 'END_NIGHT':
      return handleEndNight(state, action);
    case 'CONFIRM_LAST_NIGHT_INFO':
      return { ...state, lastNightInfoConfirmed: true };
    case 'COMPLETE_REVIEW':
      return {
        ...state,
        reviewCompletedUserIds: [...(state.reviewCompletedUserIds ?? []), action.userId],
      };

    // ── First-day sheriff election ──────────────────────
    case 'REGISTER_SHERIFF_CANDIDATE':
      return handleRegisterSheriffCandidate(state, action);
    case 'CANCEL_SHERIFF_REGISTRATION':
      return handleCancelSheriffRegistration(state, action);
    case 'WITHDRAW_SHERIFF_CANDIDATE':
      return handleWithdrawSheriffCandidate(state, action);
    case 'CAST_SHERIFF_VOTE':
      return handleCastSheriffVote(state, action);
    case 'ADVANCE_SHERIFF_ELECTION':
      return handleAdvanceSheriffElection(state, action);
    case 'SET_SHERIFF_ELECTION_DEADLINE':
      return handleSetSheriffElectionDeadline(state, action);
    case 'CLEAR_SHERIFF_ELECTION_DEADLINE':
      return handleClearSheriffElectionDeadline(state, action);
    case 'COMPLETE_SHERIFF_ELECTION':
      return handleCompleteSheriffElection(state, action);
    // ── Inline trivial cases ─────────────────────────────
    case 'SET_PENDING_AUDIO_EFFECTS': {
      const queued = queueAudioBatch(state, action.payload.effects);
      return {
        ...state,
        pendingAudioEffects: [...queued.pendingAudioEffects],
        isAudioPlaying: queued.isAudioPlaying,
        audioBatchId: queued.audioBatchId,
      };
    }

    case 'CLEAR_PENDING_AUDIO_EFFECTS':
      return { ...state, pendingAudioEffects: [], isAudioPlaying: false };

    case 'SET_NIGHT_REVIEW_ALLOWED_SEATS':
      return { ...state, nightReviewAllowedSeats: action.allowedSeats };

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
      const seatCount = Object.keys(state.players).length;
      let newRoster: GameState['roster'] | null = null;
      for (const [userId, level] of Object.entries(levels)) {
        const roster: GameState['roster'] = newRoster ?? state.roster;
        const seat: number | null = findRosterSeatByUserId(roster, seatCount, userId);
        if (seat === null) continue; // no seat held: nothing to update
        const occupant = roster[seat];
        if (occupant == null || isBotOccupant(occupant)) continue;
        if (occupant.profile.level === level) continue;
        newRoster = {
          ...roster,
          [seat]: { ...occupant, profile: buildRoomSeatProfile({ ...occupant.profile, level }) },
        };
      }
      return newRoster ? { ...state, roster: newRoster } : state;
    }

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
