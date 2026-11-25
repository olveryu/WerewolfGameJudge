/**
 * Intent Types - intent type definitions
 *
 * Intent is an action request from UI layer, processed by Handler
 * Intents are private domain inputs resolved from typed Werewolf commands.
 */

import type { RoleId } from '../models';

// (Seat / profile / fill intents have no intent form: the room
// commands are decided by the shared platform skeleton directly in
// the engine — see domain/seating.)

export interface AssignRolesIntent {
  type: 'ASSIGN_ROLES';
}

export interface StartNightIntent {
  type: 'START_NIGHT';
}

export interface AbortGameIntent {
  type: 'ABORT_GAME';
}

export interface ReturnToLobbyIntent {
  type: 'RETURN_TO_LOBBY';
}

export interface ShareNightReviewIntent {
  type: 'SHARE_NIGHT_REVIEW';
  allowedSeats: number[];
}

export interface AdvanceNightIntent {
  type: 'ADVANCE_NIGHT';
}

export interface EndNightIntent {
  type: 'END_NIGHT';
}

export interface RegisterSheriffCandidateIntent {
  type: 'REGISTER_SHERIFF_CANDIDATE';
  payload: { seat: number };
}

export interface CancelSheriffRegistrationIntent {
  type: 'CANCEL_SHERIFF_REGISTRATION';
  payload: { seat: number };
}

export interface WithdrawSheriffCandidateIntent {
  type: 'WITHDRAW_SHERIFF_CANDIDATE';
  payload: { seat: number };
}

export interface CastSheriffVoteIntent {
  type: 'CAST_SHERIFF_VOTE';
  payload: { voterSeat: number; targetSeat: number | null };
}

export interface AdvanceSheriffElectionIntent {
  type: 'ADVANCE_SHERIFF_ELECTION';
}

export interface EndSheriffElectionBySelfDestructIntent {
  type: 'END_SHERIFF_ELECTION_BY_SELF_DESTRUCT';
}

export interface BoardNominateIntent {
  type: 'BOARD_NOMINATE';
  payload: {
    userId: string;
    displayName: string;
    roles: RoleId[];
  };
}

export interface BoardUpvoteIntent {
  type: 'BOARD_UPVOTE';
  payload: {
    targetUserId: string;
    voterUid: string;
  };
}

export interface BoardWithdrawIntent {
  type: 'BOARD_WITHDRAW';
  payload: {
    userId: string;
  };
}
