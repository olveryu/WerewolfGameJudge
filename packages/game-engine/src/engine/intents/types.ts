/**
 * Intent Types - intent type definitions
 *
 * Intent is an action request from UI layer, processed by Handler
 * Intent corresponds to PlayerMessage, but more type-safe
 */

import type { RoleId } from '../../models';

// =============================================================================
// Seat-related Intents
// =============================================================================

export interface JoinSeatIntent {
  type: 'JOIN_SEAT';
  payload: {
    seat: number;
    userId: string;
    displayName: string;
    avatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    roleRevealEffect?: string;
    seatAnimation?: string;
    level?: number;
  };
}

/**
 * Leave my seat (no need to specify seat)
 * seat obtained by handler from context.mySeat
 */
export interface LeaveMySeatIntent {
  type: 'LEAVE_MY_SEAT';
  payload: {
    userId: string;
  };
}

/**
 * Unseat all Intent (Host-only)
 * Precondition: status === Unseated | Seated
 * Result: all seats cleared, status -> Unseated
 */
export interface ClearAllSeatsIntent {
  type: 'CLEAR_ALL_SEATS';
}

/**
 * Kick from seat Intent (Host-only)
 * Precondition: status === Unseated | Seated, target seat not empty
 */
export interface KickPlayerIntent {
  type: 'KICK_PLAYER';
  payload: {
    targetSeat: number;
  };
}

// =============================================================================
// Game lifecycle Intents
// =============================================================================

/**
 * Assign roles Intent (Host-only)
 * Precondition: status === Seated
 * Result: status -> Assigned
 */
export interface AssignRolesIntent {
  type: 'ASSIGN_ROLES';
}

/**
 * Start night Intent (Host-only)
 * Precondition: status === Ready
 * Result: status -> Ongoing, initialize Night-1 fields
 */
export interface StartNightIntent {
  type: 'START_NIGHT';
}

export interface RestartGameIntent {
  type: 'RESTART_GAME';
}

/**
 * Update template Intent (Host-only)
 * Precondition: status === Unseated | Seated (before role assignment)
 * Used for Host editing room config
 */
export interface UpdateTemplateIntent {
  type: 'UPDATE_TEMPLATE';
  payload: {
    templateRoles: RoleId[];
  };
}

/**
 * Share details Intent (Host-only)
 * Host selects seats allowed to view "detailed info" in ended phase
 */
export interface ShareNightReviewIntent {
  type: 'SHARE_NIGHT_REVIEW';
  allowedSeats: number[];
}

// =============================================================================
// Player profile Intents
// =============================================================================

/**
 * Update seated player display profile (roster fields)
 * Any seated player can call (updates own profile)
 */
export interface UpdatePlayerProfileIntent {
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
// Night action Intents
// =============================================================================

export interface SubmitActionIntent {
  type: 'SUBMIT_ACTION';
  payload: {
    seat: number;
    role: RoleId;
    target: number | null;
    extra?: unknown;
  };
}

// =============================================================================
// Player state Intents
// =============================================================================

export interface ViewedRoleIntent {
  type: 'VIEWED_ROLE';
  payload: {
    seat: number;
  };
}

// =============================================================================
// Audio control Intents (Host-only)
// =============================================================================

/**
 * Set audio playing state Intent (Host-only)
 *
 * PR7: audio timing control
 * - When audio starts playing, call setAudioPlaying(true)
 * - When audio ends (or is skipped), call setAudioPlaying(false)
 *
 * Gate:
 * - host_only
 * - no_state
 * - invalid_status (must be ongoing)
 */
export interface SetAudioPlayingIntent {
  type: 'SET_AUDIO_PLAYING';
  payload: {
    isPlaying: boolean;
  };
}

// =============================================================================
// Night flow Intents (Host-only)
// =============================================================================

/**
 * Advance night to next step
 * Host-only: called after audio ends, advances currentStepIndex + currentStepId
 */
export interface AdvanceNightIntent {
  type: 'ADVANCE_NIGHT';
}

/**
 * End night
 * Host-only: after night end audio finishes, perform death settlement and set ended
 */
export interface EndNightIntent {
  type: 'END_NIGHT';
}

// =============================================================================
// Debug Bots Intents (Host-only)
// =============================================================================

/**
 * Fill with bots Intent (Host-only, Debug-only)
 *
 * Precondition: status === Unseated
 * Result:
 * - Create bot players for all empty seats (isBot: true)
 * - Set debugMode.botsEnabled = true
 */
export interface FillWithBotsIntent {
  type: 'FILL_WITH_BOTS';
}

/**
 * Mark all bots as having viewed roles Intent (Host-only, Debug-only)
 *
 * Precondition: debugMode.botsEnabled === true && status === Assigned
 * Result: set hasViewedRole = true only for isBot === true players
 */
export interface MarkAllBotsViewedIntent {
  type: 'MARK_ALL_BOTS_VIEWED';
}

// =============================================================================
// Board Nomination Intents (any connected player)
// =============================================================================

/**
 * Submit board nomination Intent
 * Any connected player can submit, max one per person (later overrides).
 * Precondition: status === Unseated | Seated (before role assignment)
 */
export interface BoardNominateIntent {
  type: 'BOARD_NOMINATE';
  payload: {
    userId: string;
    displayName: string;
    roles: RoleId[];
  };
}

/**
 * Upvote board nomination Intent
 * Precondition: target nomination exists, cannot upvote own
 */
export interface BoardUpvoteIntent {
  type: 'BOARD_UPVOTE';
  payload: {
    /** Upvoted nomination submitter userId */
    targetUserId: string;
    /** Upvoter userId */
    voterUid: string;
  };
}

/**
 * Withdraw board nomination Intent
 * Only the submitter can withdraw
 */
export interface BoardWithdrawIntent {
  type: 'BOARD_WITHDRAW';
  payload: {
    userId: string;
  };
}
