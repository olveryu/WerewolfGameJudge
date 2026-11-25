/**
 * Reducer Types - state action type definitions
 *
 * StateAction is reducer input, describing state mutations
 */

import type { AudioEffect } from '../../../../platform/audio';
import type { RosterChange } from '../../../../platform/room/seating';
import type { DeathReason } from '../../roles/deathEffects';
import type { GameRuleOverrides, RoleId } from '../models';
import type {
  Player,
  SheriffElectionResult,
  SheriffElectionRoundResult,
  SheriffElectionState,
  WerewolfHumanSeat,
} from '../protocol/types';
import type { BoardNomination } from '../protocol/types';

// =============================================================================
// Game lifecycle actions
// =============================================================================

export interface InitializeGameAction {
  type: 'INITIALIZE_GAME';
  payload: {
    roomCode: string;
    hostUserId: string;
    templateRoles: RoleId[];
    totalSeats: number;
  };
}
export interface RestartGameAction {
  type: 'RESTART_GAME';
  /** Pre-computed nonce for random animation resolution (injected by handler) */
  nonce: string;
}

export interface UpdateTemplateAction {
  type: 'UPDATE_TEMPLATE';
  payload: {
    templateRoles: RoleId[];
    rules?: GameRuleOverrides;
  };
}

// =============================================================================
// Seat management actions
// =============================================================================

export interface PlayerJoinAction {
  type: 'PLAYER_JOIN';
  payload: {
    seat: number;
    /** Roster occupant (identity axis). */
    occupant: WerewolfHumanSeat;
    /** Per-seat game data (role axis). */
    player: Player;
  };
}

export interface PlayerLeaveAction {
  type: 'PLAYER_LEAVE';
  payload: {
    seat: number;
  };
}

/**
 * Seats changed — the room-command skeleton's single seats event in
 * werewolf's action vocabulary. The roster changes land in one
 * batch; the reducer folds each change through the per-seat
 * lifecycle transitions (join / leave / bot fill), so the players
 * axis and the status derivation move with the roster exactly as
 * they did when handlers emitted the per-seat actions one by one.
 */
export interface SeatsChangedAction {
  type: 'SEATS_CHANGED';
  changes: readonly RosterChange<WerewolfHumanSeat>[];
}

/**
 * Update seated player's display profile (roster fields: displayName / avatarUrl / avatarFrame)
 */
export interface UpdatePlayerProfileAction {
  type: 'UPDATE_PLAYER_PROFILE';
  payload: {
    userId: string;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    revealEffect?: string;
    seatAnimation?: string;
  };
}

// =============================================================================
// Game phase actions
// =============================================================================

export interface AssignRolesAction {
  type: 'ASSIGN_ROLES';
  payload: {
    assignments: Record<number, RoleId>;
    /** Seer label map - set when both seer + mirrorSeer are in template */
    seerLabelMap?: Readonly<Record<string, number>>;
    /** The cards set aside for the board's bottom-card actor; absent when the board has none. */
    bottomCards?: readonly RoleId[];
  };
}

export interface StartNightAction {
  type: 'START_NIGHT';
}

export interface EndNightAction {
  type: 'END_NIGHT';
  payload: {
    deaths: number[];
    deathReasons?: Record<number, DeathReason>;
  };
}

// =============================================================================
// First-day sheriff election actions
// =============================================================================

export interface RegisterSheriffCandidateAction {
  type: 'REGISTER_SHERIFF_CANDIDATE';
  payload: { seat: number };
}

export interface CancelSheriffRegistrationAction {
  type: 'CANCEL_SHERIFF_REGISTRATION';
  payload: { seat: number };
}

export interface WithdrawSheriffCandidateAction {
  type: 'WITHDRAW_SHERIFF_CANDIDATE';
  payload: { seat: number };
}

export interface CastSheriffVoteAction {
  type: 'CAST_SHERIFF_VOTE';
  payload: { voterSeat: number; targetSeat: number | null };
}

export interface AdvanceSheriffElectionAction {
  type: 'ADVANCE_SHERIFF_ELECTION';
  payload: { election: SheriffElectionState };
}

/**
 * Arm the active sheriff voting round's settle-countdown deadline
 * (epoch ms). Mirrors SET_STEP_DEADLINE for the night step: the
 * deadline lives inside the voting phase that armed it.
 */
export interface SetSheriffElectionDeadlineAction {
  type: 'SET_SHERIFF_ELECTION_DEADLINE';
  payload: { deadline: number };
}

/** Clear the active sheriff voting round's settle-countdown deadline. */
export interface ClearSheriffElectionDeadlineAction {
  type: 'CLEAR_SHERIFF_ELECTION_DEADLINE';
}

export interface CompleteSheriffElectionAction {
  type: 'COMPLETE_SHERIFF_ELECTION';
  payload: {
    result: SheriffElectionResult;
    completedRound?: SheriffElectionRoundResult;
  };
}

// =============================================================================
// Player state actions
// =============================================================================

export interface PlayerViewedRoleAction {
  type: 'PLAYER_VIEWED_ROLE';
  payload: {
    seat: number;
  };
}

// =============================================================================
// Debug Bots actions
// =============================================================================

/**
 * Fill with bots action
 * Create bot players for all empty seats
 */
export interface FillWithBotsAction {
  type: 'FILL_WITH_BOTS';
  payload: {
    /** bot seats to add: per-seat game data keyed by seat number */
    bots: Record<number, Player>;
  };
}

// (No MARK_ALL_BOTS_VIEWED action: the scaffold emits one
// PLAYER_VIEWED_ROLE action per unviewed bot seat via the shared
// platform skeleton.)

// =============================================================================
// Pending audio queue actions
// =============================================================================

/**
 * Queue one playback batch (produced by server-side inline progression).
 * The reducer applies the shared audio-queue transition: effects, gate and batch id together.
 */
export interface SetPendingAudioEffectsAction {
  type: 'SET_PENDING_AUDIO_EFFECTS';
  payload: {
    effects: AudioEffect[];
  };
}

/**
 * Clear the pending audio queue and reopen the gate.
 * Emitted by a committed `werewolf.audio.ack` for the current batch.
 */
export interface ClearPendingAudioEffectsAction {
  type: 'CLEAR_PENDING_AUDIO_EFFECTS';
}

/**
 * Set detail sharing permissions
 * Host selects seats allowed to view "detailed info" in ended phase.
 */
export interface SetNightReviewAllowedSeatsAction {
  type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS';
  allowedSeats: number[];
}

export interface ConfirmLastNightInfoAction {
  type: 'CONFIRM_LAST_NIGHT_INFO';
}

export interface CompleteReviewAction {
  type: 'COMPLETE_REVIEW';
  userId: string;
}

// =============================================================================
// Board Nomination actions
// =============================================================================

/** Submit/update board nomination (one per userId, later overrides earlier) */
export interface SetBoardNominationAction {
  type: 'SET_BOARD_NOMINATION';
  payload: {
    nomination: BoardNomination;
  };
}

/** Upvote board nomination */
export interface UpvoteBoardNominationAction {
  type: 'UPVOTE_BOARD_NOMINATION';
  payload: {
    /** Upvoted nomination submitter userId */
    targetUserId: string;
    /** Upvoter userId */
    voterUid: string;
  };
}

/** Withdraw board nomination */
export interface WithdrawBoardNominationAction {
  type: 'WITHDRAW_BOARD_NOMINATION';
  payload: {
    userId: string;
  };
}

/** Batch update roster levels after settlement */
export interface UpdateRosterLevelsAction {
  type: 'UPDATE_ROSTER_LEVELS';
  payload: {
    levels: Record<string, number>;
  };
}

// =============================================================================
// StateAction union type
// =============================================================================

export type StateAction =
  | { readonly type: 'SELECT_MVP'; readonly mvpUserId: string }
  | {
      readonly type: 'WEREWOLF_NIGHT_EVENT';
      readonly event: import('../../roles/nightEvolution').WerewolfNightEvent;
    }
  | CompleteReviewAction
  // Lifecycle
  | InitializeGameAction
  | RestartGameAction
  | UpdateTemplateAction
  // Seating
  | PlayerJoinAction
  | PlayerLeaveAction
  | SeatsChangedAction
  | UpdatePlayerProfileAction
  // Game phase
  | AssignRolesAction
  | StartNightAction
  | EndNightAction
  // First-day sheriff election
  | RegisterSheriffCandidateAction
  | CancelSheriffRegistrationAction
  | WithdrawSheriffCandidateAction
  | CastSheriffVoteAction
  | AdvanceSheriffElectionAction
  | SetSheriffElectionDeadlineAction
  | ClearSheriffElectionDeadlineAction
  | CompleteSheriffElectionAction
  // Night actions
  // Wolf related
  // Wolf Robot Hunter Gate
  // UI Hint (Host broadcast driven)
  // Player state
  | PlayerViewedRoleAction
  // Error
  // Reveal ACK
  // Debug Bots
  | FillWithBotsAction
  // Step progression deadline
  // Pending audio queue
  | SetPendingAudioEffectsAction
  | ClearPendingAudioEffectsAction
  // Detail sharing
  | SetNightReviewAllowedSeatsAction
  | ConfirmLastNightInfoAction
  // Piper groupConfirm ACK
  // Awakened Gargoyle groupConfirm ACK
  // Cupid groupConfirm ACK
  // Wolf Girl groupConfirm ACK
  // Board Nomination
  | SetBoardNominationAction
  | UpvoteBoardNominationAction
  | WithdrawBoardNominationAction
  // Growth settlement
  | UpdateRosterLevelsAction;
