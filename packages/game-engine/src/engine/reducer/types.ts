/**
 * Reducer Types - state action type definitions
 *
 * StateAction is reducer input, describing state mutations
 */

import type { RoleId, SchemaId } from '../../models';
import type { WolfKillOverride } from '../../models/roles/spec/schema.types';
import type { ConfirmStatus, Player, ProtocolAction, RosterEntry } from '../../protocol/types';
import type { AudioEffect, BoardNomination } from '../../protocol/types';
import type { CurrentNightResults } from '../../resolvers/types';
import type { DeathReason } from '../DeathCalculator';

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
  };
}

// =============================================================================
// Seat management actions
// =============================================================================

export interface PlayerJoinAction {
  type: 'PLAYER_JOIN';
  payload: {
    seat: number;
    player: Player;
    rosterEntry: RosterEntry;
  };
}

export interface PlayerLeaveAction {
  type: 'PLAYER_LEAVE';
  payload: {
    seat: number;
  };
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
    roleRevealEffect?: string;
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
    /** Deck card role list (TreasureMaster 3 / Thief 2), only exists when deck role is present */
    bottomCards?: readonly RoleId[];
    /** TreasureMaster seat number */
    treasureMasterSeat?: number;
    /** Thief seat number */
    thiefSeat?: number;
    /** Cupid seat number */
    cupidSeat?: number;
  };
}

export interface StartNightAction {
  type: 'START_NIGHT';
  payload: {
    currentStepIndex: number;
    /** First step stepId, from NIGHT_STEPS[0].id table-driven single source */
    currentStepId: SchemaId;
  };
}

export interface AdvanceToNextActionAction {
  type: 'ADVANCE_TO_NEXT_ACTION';
  payload: {
    nextStepIndex: number;
    /** Next step stepId (from NIGHT_STEPS table-driven single source), null means night ended */
    nextStepId: SchemaId | null;
  };
}

export interface EndNightAction {
  type: 'END_NIGHT';
  payload: {
    deaths: number[];
    deathReasons?: Record<number, DeathReason>;
  };
}

// =============================================================================
// Night action actions
// =============================================================================

export interface RecordActionAction {
  type: 'RECORD_ACTION';
  payload: {
    action: ProtocolAction;
  };
}

export interface ApplyResolverResultAction {
  type: 'APPLY_RESOLVER_RESULT';
  payload: {
    updates?: Partial<CurrentNightResults>;
    seerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    mirrorSeerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    drunkSeerReveal?: { targetSeat: number; result: '好人' | '狼人' };
    psychicReveal?: { targetSeat: number; result: string };
    gargoyleReveal?: { targetSeat: number; result: string };
    pureWhiteReveal?: { targetSeat: number; result: string };
    wolfWitchReveal?: { targetSeat: number; result: string };
    wolfRobotReveal?: {
      targetSeat: number;
      result: string;
      /**
       * The learned role ID (strict RoleId) - REQUIRED for hunter gate check and disguise.
       * This is never optional when wolfRobotReveal exists.
       */
      learnedRoleId: RoleId;
      /** When learned hunter, whether wolfRobot can shoot as hunter */
      canShootAsHunter?: boolean;
    };
    /** Wolf Robot disguise context - written when wolfRobot learns a target */
    wolfRobotContext?: { learnedSeat: number; disguisedRole: RoleId };
    /**
     * Gate: wolfRobot learned hunter and must view status before proceeding.
     * Set to false when wolfRobotLearn reveal shows hunter.
     */
    wolfRobotHunterStatusViewed?: boolean;
  };
}

export interface SetWitchContextAction {
  type: 'SET_WITCH_CONTEXT';
  payload: {
    killedSeat: number;
    canSave: boolean;
    canPoison: boolean;
  };
}

export interface SetConfirmStatusAction {
  type: 'SET_CONFIRM_STATUS';
  payload: ConfirmStatus;
}

export interface ClearRevealStateAction {
  type: 'CLEAR_REVEAL_STATE';
}

export interface SetWolfKillOverrideAction {
  type: 'SET_WOLF_KILL_OVERRIDE';
  payload: {
    override?: WolfKillOverride;
    blockedSeat?: number;
  };
}

// =============================================================================
// UI Hint actions (Host broadcast driven, UI read-only)
// =============================================================================

/**
 * Set current step UI Hint
 *
 * Purpose: Host writes after resolver/handler determination, cleared on next step entry.
 * UI read-only display, no derivation. Filters "who can see" by targetRoleIds.
 */
export interface SetUiHintAction {
  type: 'SET_UI_HINT';
  payload: {
    currentActorHint: {
      kind:
        | 'blocked_by_nightmare'
        | 'wolf_kill_disabled'
        | 'wolf_unanimity_required'
        | 'wolf_tie_random';
      targetRoleIds: RoleId[];
      message: string;
      bottomAction?: 'skipOnly' | 'wolfEmptyOnly';
      promptOverride?: { title?: string; text?: string };
    } | null;
  };
}

// =============================================================================
// Audio state actions
// =============================================================================

export interface SetAudioPlayingAction {
  type: 'SET_AUDIO_PLAYING';
  payload: {
    isPlaying: boolean;
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
// Error/rejection actions
// =============================================================================

export interface ActionRejectedAction {
  type: 'ACTION_REJECTED';
  payload: {
    action: string;
    reason: string;
    targetUserId: string;
    /**
     * Unique id for this rejection event.
     * Used by UI to avoid accidentally deduping distinct rejections that share the same reason.
     */
    rejectionId: string;
  };
}

export interface ClearActionRejectedAction {
  type: 'CLEAR_ACTION_REJECTED';
}

// =============================================================================
// Reveal ACK actions
// =============================================================================

export interface AddRevealAckAction {
  type: 'ADD_REVEAL_ACK';
  payload: {
    ackKey: string;
  };
}

export interface ClearRevealAcksAction {
  type: 'CLEAR_REVEAL_ACKS';
}

// =============================================================================
// Wolf Robot Hunter Gate actions
// =============================================================================

export interface SetWolfRobotHunterStatusViewedAction {
  type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED';
  payload: {
    viewed: boolean;
  };
}

// =============================================================================
// Debug Bots actions
// =============================================================================

/**
 * Fill with bots action
 * Create bot players for all empty seats, set debugMode.botsEnabled = true
 */
export interface FillWithBotsAction {
  type: 'FILL_WITH_BOTS';
  payload: {
    /** bot players to add (keyed by seat number) */
    bots: Record<number, Player>;
    /** bot roster entries to add (keyed by userId) */
    botRoster: Record<string, RosterEntry>;
  };
}

/**
 * Mark all bots as having viewed roles action
 * Set hasViewedRole = true only for isBot === true players
 */
export interface MarkAllBotsViewedAction {
  type: 'MARK_ALL_BOTS_VIEWED';
}

// =============================================================================
// Step progression deadline (unified deadline-gate)
// =============================================================================

/**
 * Set current step progression deadline (epoch ms).
 * - wolfKill step: set (now + WOLF_VOTE_COUNTDOWN_MS) after all votes
 * - Empty deck step: set (now + random(5000, 10000)) on entry
 */
export interface SetStepDeadlineAction {
  type: 'SET_STEP_DEADLINE';
  payload: {
    deadline: number;
  };
}

/**
 * Clear current step progression deadline.
 * Cleared when wolf retract vote results in not all voted.
 */
export interface ClearStepDeadlineAction {
  type: 'CLEAR_STEP_DEADLINE';
}

// =============================================================================
// Pending audio queue actions
// =============================================================================

/**
 * Set pending audio queue (produced by server-side inline progression)
 * Written to pendingAudioEffects after server progression.
 */
export interface SetPendingAudioEffectsAction {
  type: 'SET_PENDING_AUDIO_EFFECTS';
  payload: {
    effects: AudioEffect[];
  };
}

/**
 * Clear pending audio queue
 * Cleared via POST audio-ack after Host playback.
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

// =============================================================================
// Piper groupConfirm ACK
// =============================================================================

/**
 * Record seat confirmed hypnotize status (idempotent: duplicate ack ignored).
 * Server progresses to next step after all seated players ack.
 */
export interface AddPiperRevealAckAction {
  type: 'ADD_PIPER_REVEAL_ACK';
  payload: {
    seat: number;
  };
}

// =============================================================================
// Awakened Gargoyle groupConfirm ACK
// =============================================================================

/**
 * Record seat confirmed conversion status (idempotent: duplicate ack ignored).
 * Server progresses to next step after all seated players ack.
 */
export interface AddConversionRevealAckAction {
  type: 'ADD_CONVERSION_REVEAL_ACK';
  payload: {
    seat: number;
  };
}

// =============================================================================
// Cupid groupConfirm ACK
// =============================================================================

/**
 * Record seat confirmed lover status (idempotent: duplicate ack ignored).
 * Server progresses to next step after all seated players ack.
 */
export interface AddCupidLoversRevealAckAction {
  type: 'ADD_CUPID_LOVERS_REVEAL_ACK';
  payload: {
    seat: number;
  };
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
  // Lifecycle
  | InitializeGameAction
  | RestartGameAction
  | UpdateTemplateAction
  // Seating
  | PlayerJoinAction
  | PlayerLeaveAction
  | UpdatePlayerProfileAction
  // Game phase
  | AssignRolesAction
  | StartNightAction
  | AdvanceToNextActionAction
  | EndNightAction
  // Night actions
  | RecordActionAction
  | ApplyResolverResultAction
  | SetWitchContextAction
  | SetConfirmStatusAction
  | ClearRevealStateAction
  // Wolf related
  | SetWolfKillOverrideAction
  // Wolf Robot Hunter Gate
  | SetWolfRobotHunterStatusViewedAction
  // UI Hint (Host broadcast driven)
  | SetUiHintAction
  // Audio
  | SetAudioPlayingAction
  // Player state
  | PlayerViewedRoleAction
  // Error
  | ActionRejectedAction
  | ClearActionRejectedAction
  // Reveal ACK
  | AddRevealAckAction
  | ClearRevealAcksAction
  // Debug Bots
  | FillWithBotsAction
  | MarkAllBotsViewedAction
  // Step progression deadline
  | SetStepDeadlineAction
  | ClearStepDeadlineAction
  // Pending audio queue
  | SetPendingAudioEffectsAction
  | ClearPendingAudioEffectsAction
  // Detail sharing
  | SetNightReviewAllowedSeatsAction
  // Piper groupConfirm ACK
  | AddPiperRevealAckAction
  // Awakened Gargoyle groupConfirm ACK
  | AddConversionRevealAckAction
  // Cupid groupConfirm ACK
  | AddCupidLoversRevealAckAction
  // Board Nomination
  | SetBoardNominationAction
  | UpvoteBoardNominationAction
  | WithdrawBoardNominationAction
  // Growth settlement
  | UpdateRosterLevelsAction;
