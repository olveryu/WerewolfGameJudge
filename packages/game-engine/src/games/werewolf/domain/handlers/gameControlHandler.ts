/**
 * Game Control Handler - game control processor (Host-only)
 *
 * Responsibilities:
 * - Handle ASSIGN_ROLES / START_NIGHT / ABORT_GAME / RETURN_TO_LOBBY intents
 *   (the config update is decided by the room-command skeleton in domain/seating)
 * - Role assignment logic (shuffle + write to state)
 * - NightPlan construction (generate step plan from template)
 *
 * Exports role assignment, NightPlan construction, and StateAction list building logic; no IO (network / audio / Alert),
 * does not directly modify state (returns StateAction list for reducer to execute).
 */

import { guardAudioPlayback } from '../../../../platform/audio';
import { createSeededRng, randomPick, type Rng, shuffleArray } from '../../../../platform/random';
import type {
  AbortGameIntent,
  AssignRolesIntent,
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
  ReturnToLobbyIntent,
  ShareNightReviewIntent,
} from '../intents/types';
import {
  type BottomCardRoleId,
  GameStatus,
  getBottomCardCount,
  getBottomCardRoleId,
  getRoleDealPool,
  getValidBottomCardDeals,
  type RoleId,
} from '../models';
import { getRoleSpec } from '../models/roles/spec';
import type { GameState } from '../protocol/types';
import type {
  AssignRolesAction,
  RestartGameAction,
  SetBoardNominationAction,
  SetNightReviewAllowedSeatsAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from '../reducer/types';
import type { HandlerContext, HandlerExecutionContext, HandlerResult } from './types';
import { handlerError, handlerSuccess } from './types';

/**
 * Handle assign roles (only seated -> assigned)
 *
 * - Precondition: status === GameStatus.Seated
 * - Shuffle and assign roles
 * - Clear the viewed-role record (roleViewedSeats)
 * - status -> GameStatus.Assigned
 * - Broadcast STATE_UPDATE
 */
export function handleAssignRoles(
  _intent: AssignRolesIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  // Gate: game status must be GameStatus.Seated
  if (context.state.status !== GameStatus.Seated) {
    return handlerError('invalid_status');
  }

  return decideRoleDeal(context.state, execution);
}

function decideRoleDeal(state: GameState, execution: HandlerExecutionContext): HandlerResult {
  const rng = createSeededRng(`${execution.randomSeed}:roles`);

  const seatCount = Object.keys(state.players).length;
  const bottomCardRoleId = getBottomCardRoleId(state.templateRoles);
  const bottomCardCount = getBottomCardCount(state.templateRoles);
  const expectedRoleCount = seatCount + bottomCardCount;

  // Validate: template role count matches seat count (including deck cards)
  if (state.templateRoles.length !== expectedRoleCount) {
    return handlerError('role_count_mismatch');
  }

  const isPlagueMode = state.rules?.isPlagueMode ?? false;
  const roleDealPool = getRoleDealPool(state.templateRoles, state.rules);

  let seatedRoles: RoleId[];
  let bottomCards: RoleId[] | undefined;
  let treasureMasterSeat: number | undefined;
  let thiefSeat: number | undefined;

  const shouldDealBottomCards =
    bottomCardRoleId !== null && (bottomCardRoleId === 'thief' || !isPlagueMode);
  if (shouldDealBottomCards) {
    const result = createBottomCardDeal(roleDealPool, bottomCardRoleId, rng);
    if (result.seatedRoles.length !== seatCount) {
      throw new Error(
        `[FAIL-FAST] Bottom-card deal produced ${result.seatedRoles.length} roles for ${seatCount} seats`,
      );
    }
    seatedRoles = result.seatedRoles;
    bottomCards = result.bottomCards;
  } else {
    seatedRoles = shuffleArray(roleDealPool, rng).slice(0, seatCount);
  }

  // Assign seated roles to seats
  const assignments: Record<number, RoleId> = {};
  const seats = Object.keys(state.players).map((s) => Number.parseInt(s, 10));

  for (let i = 0; i < seats.length; i++) {
    assignments[seats[i]!] = seatedRoles[i]!;
  }

  // Record deck roles / cupid seat
  if (bottomCardRoleId) {
    for (const [seatStr, roleId] of Object.entries(assignments)) {
      if (roleId === 'treasureMaster') {
        treasureMasterSeat = Number.parseInt(seatStr, 10);
      } else if (roleId === 'thief') {
        thiefSeat = Number.parseInt(seatStr, 10);
      }
    }
  }

  // When multiple seerFamily-tagged roles coexist, randomly assign numbered labels
  // Note: must use all roles (including deck) to determine seer family
  const allRoles = bottomCards ? [...seatedRoles, ...bottomCards] : seatedRoles;
  const seerLikeRoles = [
    ...new Set(
      allRoles.filter((r) => {
        if (r === 'seer') return true;
        return getRoleSpec(r).groups?.includes('seerFamily') === true;
      }),
    ),
  ];
  let seerLabelMap: Readonly<Record<string, number>> | undefined;
  if (seerLikeRoles.length >= 2) {
    const labels = shuffleArray(
      Array.from({ length: seerLikeRoles.length }, (_, i) => i + 1),
      rng,
    );
    seerLabelMap = Object.fromEntries(seerLikeRoles.map((r, i) => [r, labels[i]!]));
  }

  // Only produce ASSIGN_ROLES action (not START_NIGHT)
  const assignRolesAction: AssignRolesAction = {
    type: 'ASSIGN_ROLES',
    payload: {
      assignments,
      ...(seerLabelMap ? { seerLabelMap } : {}),
      ...(bottomCards ? { bottomCards, treasureMasterSeat, thiefSeat } : {}),
    },
  };

  return handlerSuccess([assignRolesAction]);
}

// ---------------------------------------------------------------------------
// Bottom-card physical partition selection
// ---------------------------------------------------------------------------

/**
 * Select one legal physical-card partition, then randomize both visible orders.
 */
function createBottomCardDeal(
  templateRoles: readonly RoleId[],
  bottomCardRoleId: BottomCardRoleId,
  rng: Rng,
): { seatedRoles: RoleId[]; bottomCards: RoleId[] } {
  const deals = getValidBottomCardDeals(templateRoles, bottomCardRoleId);
  if (deals.length === 0) {
    throw new Error(`[FAIL-FAST] Template cannot deal legal cards for ${bottomCardRoleId}`);
  }

  const deal = randomPick(deals, rng);
  return {
    seatedRoles: shuffleArray([...deal.seatedRoles], rng),
    bottomCards: shuffleArray([...deal.bottomCards], rng),
  };
}

/** The restart outcome both terminal-flow commands share (RESTART_GAME). */
function decideRestartGame(execution: HandlerExecutionContext): HandlerResult {
  const action: RestartGameAction = {
    type: 'RESTART_GAME',
    nonce: execution.randomSeed,
  };

  return handlerSuccess([action]);
}

/**
 * Handle abort game (a game is in progress): the host ends the current
 * game and returns the room to the lobby.
 */
export function handleAbortGame(
  _intent: AbortGameIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  // Gate: only a game in progress can be aborted; a finished game
  // leaves through returnToLobby instead.
  if (context.state.status === GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  // Gate: terminal flow waits until narration playback finishes
  // (platform audio gate, same reason as the night gates).
  const audioReason = guardAudioPlayback(context.state, 'forbidden_while_audio_playing');
  if (audioReason !== null) {
    return handlerError(audioReason);
  }

  return decideRestartGame(execution);
}

/**
 * Handle return to lobby (the game has ended): the host closes the
 * finished game and returns the room to the lobby.
 */
export function handleReturnToLobbyGame(
  _intent: ReturnToLobbyIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  // Gate: only a finished game returns to the lobby this way; a game
  // in progress is aborted instead.
  if (context.state.status !== GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  // Gate: terminal flow waits until narration playback finishes
  // (platform audio gate, same reason as the night gates).
  const audioReason = guardAudioPlayback(context.state, 'forbidden_while_audio_playing');
  if (audioReason !== null) {
    return handlerError(audioReason);
  }

  return decideRestartGame(execution);
}

/**
 * Handle night-review access sharing.
 *
 * Host selects seats allowed to view the review, writes to state and broadcasts.
 * @pre The room is in an active sheriff election or has ended.
 */
export function handleShareNightReview(
  intent: ShareNightReviewIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  if (state.status !== GameStatus.Day && state.status !== GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  const action: SetNightReviewAllowedSeatsAction = {
    type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
    allowedSeats: intent.allowedSeats,
  };

  return handlerSuccess([action]);
}

// =============================================================================
// Board Nomination Handlers (any connected player)
// =============================================================================

/**
 * Submit board nomination
 *
 * Any connected player can submit, max one per person (later overrides earlier).
 * Preconditions: status === Unseated | Seated
 */
export function handleBoardNominate(
  intent: BoardNominateIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  const canNominate = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canNominate) {
    return handlerError('invalid_status');
  }

  if (intent.payload.roles.length === 0) {
    return handlerError('empty_role_list');
  }

  // ── Dedup: compare roles of existing nominations after sorting ──
  const sortedRoles = intent.payload.roles.toSorted();
  const nominations = state.boardNominations;
  if (nominations) {
    for (const [existingUid, nom] of Object.entries(nominations)) {
      // Same user -> use override logic (existing behavior)
      if (existingUid === intent.payload.userId) continue;
      const existingSorted = nom.roles.toSorted();
      if (
        existingSorted.length === sortedRoles.length &&
        existingSorted.every((r, i) => r === sortedRoles[i])
      ) {
        // Roles identical -> auto-vote existing nomination
        const action: UpvoteBoardNominationAction = {
          type: 'UPVOTE_BOARD_NOMINATION',
          payload: { targetUserId: existingUid, voterUid: intent.payload.userId },
        };
        return handlerSuccess([action], { reason: 'DEDUPLICATED' });
      }
    }
  }

  const action: SetBoardNominationAction = {
    type: 'SET_BOARD_NOMINATION',
    payload: {
      nomination: {
        userId: intent.payload.userId,
        displayName: intent.payload.displayName,
        roles: intent.payload.roles,
        upvoters: [],
      },
    },
  };

  return handlerSuccess([action]);
}

/**
 * Upvote board nomination
 *
 * Preconditions:
 * - status === Unseated | Seated
 * - Cannot upvote own nomination
 * - Target nomination must exist
 */
export function handleBoardUpvote(
  intent: BoardUpvoteIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  const canVote = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canVote) {
    return handlerError('invalid_status');
  }

  const { targetUserId, voterUid } = intent.payload;

  if (!state.boardNominations?.[targetUserId]) {
    return handlerError('nomination_not_found');
  }

  const action: UpvoteBoardNominationAction = {
    type: 'UPVOTE_BOARD_NOMINATION',
    payload: { targetUserId, voterUid },
  };

  return handlerSuccess([action]);
}

/**
 * Withdraw board nomination
 *
 * Only the submitter can withdraw.
 * Preconditions: status === Unseated | Seated + nomination exists
 */
export function handleBoardWithdraw(
  intent: BoardWithdrawIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  const canWithdraw = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canWithdraw) {
    return handlerError('invalid_status');
  }

  if (!state.boardNominations?.[intent.payload.userId]) {
    return handlerError('nomination_not_found');
  }

  const action: WithdrawBoardNominationAction = {
    type: 'WITHDRAW_BOARD_NOMINATION',
    payload: { userId: intent.payload.userId },
  };

  return handlerSuccess([action]);
}
