/**
 * Game Control Handler - game control processor (Host-only)
 *
 * Responsibilities:
 * - Handle ASSIGN_ROLES / START_NIGHT / ABORT_GAME / RETURN_TO_LOBBY / REDEAL_GAME / UPDATE_TEMPLATE intents
 * - Role assignment logic (shuffle + write to state)
 * - NightPlan construction (generate step plan from template)
 *
 * Exports role assignment, NightPlan construction, and StateAction list building logic; no IO (network / audio / Alert),
 * does not directly modify state (returns StateAction list for reducer to execute).
 */

import type { AudioEffect } from '../../../../platform/audio';
import { createSeededRng, randomPick, type Rng, shuffleArray } from '../../../../platform/random';
import { decideRosterFillBots } from '../../../../platform/room/seating';
import { resolveSeerAudioKey } from '../audioKeyOverride';
import { createAudioQueueActions } from '../audioQueue';
import type {
  AbortGameIntent,
  AssignRolesIntent,
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
  FillWithBotsIntent,
  RedealGameIntent,
  ReturnToLobbyIntent,
  ShareNightReviewIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '../intents/types';
import {
  type BottomCardRoleId,
  GameStatus,
  getBottomCardCount,
  getBottomCardRoleId,
  getPlayerCount,
  getRoleDealPool,
  getValidBottomCardDeals,
  type RoleId,
} from '../models';
import { buildNightPlan, getRoleSpec, getStepSpec } from '../models/roles/spec';
import { WOLF_KILL_OVERRIDE_TEXTS } from '../models/roles/spec/schema.types';
import type { GameState, Player } from '../protocol/types';
import type {
  AssignRolesAction,
  EndNightAction,
  FillWithBotsAction,
  RestartGameAction,
  SetBoardNominationAction,
  SetNightReviewAllowedSeatsAction,
  SetWolfKillOverrideAction,
  StartNightAction,
  StateAction,
  UpdateTemplateAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from '../reducer/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import type { HandlerContext, HandlerExecutionContext, HandlerResult } from './types';
import { handlerError, handlerSuccess } from './types';
import { maybeCreateWitchContextAction } from './witchContext';

/**
 * Handle assign roles (only seated -> assigned)
 *
 * - Precondition: status === GameStatus.Seated
 * - Shuffle and assign roles
 * - Set hasViewedRole = false
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

/**
 * The one role-deal computation, shared by ASSIGN_ROLES and REDEAL_GAME.
 *
 * Every input (templateRoles, rules, the seat map) is preserved verbatim
 * by the RESTART_GAME transition, so dealing from the pre-restart state
 * yields exactly the deal the post-restart state would produce — that is
 * what lets REDEAL_GAME decide both steps against one state snapshot.
 */
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
  let cupidSeat: number | undefined;

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
  // Record cupid seat (regardless of deck role presence)
  for (const [seatStr, roleId] of Object.entries(assignments)) {
    if (roleId === 'cupid') {
      cupidSeat = Number.parseInt(seatStr, 10);
      break;
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
      ...(cupidSeat !== undefined ? { cupidSeat } : {}),
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

/**
 * Handle start night (ready -> ongoing)
 *
 * - Precondition: status === GameStatus.Ready
 * - Initialize Night-1 fields
 * - status -> GameStatus.Ongoing
 * - Broadcast STATE_UPDATE
 *
 * Initializes state only; audio and progression are handled separately.
 */
export function handleStartNight(
  _intent: StartNightIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  const { state } = context;

  // Gate: status must be GameStatus.Ready
  if (state.status !== GameStatus.Ready) {
    return handlerError('invalid_status');
  }

  // First step comes from buildNightPlan table-driven single source (filtered by current template roles)
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // Empty plans still initialize the night result aggregate before ending.
  if (nightPlan.steps.length === 0) {
    const startNightAction: StartNightAction = {
      type: 'START_NIGHT',
      payload: { nightStep: { kind: 'exhausted' } },
    };
    const endNightAction: EndNightAction = {
      type: 'END_NIGHT',
      payload: { deaths: [] },
    };
    return handlerSuccess([startNightAction, endNightAction]);
  }

  const firstStepId = nightPlan.steps[0]!.stepId;
  const firstStepSpec = getStepSpec(firstStepId);

  // Collect actions to return
  const actions: StateAction[] = [];

  // Night-1 only: the night opens on the first plan step.
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { nightStep: { kind: 'inStep', stepId: firstStepId } },
  };
  actions.push(startNightAction);

  // Use unified function to check if witchContext needs to be set (no-wolf board where first step is witchAction)
  const witchContextAction = maybeCreateWitchContextAction(
    firstStepId,
    state,
    createSeededRng(`${execution.randomSeed}:wolf-vote`),
  );
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // Use unified function to check if confirmStatus needs to be set (edge case: first step is hunterConfirm)
  const confirmStatusAction = maybeCreateConfirmStatusAction(firstStepId, state);
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

  // Witch present: wolves cannot attack on first night (board-level rule)
  if (state.templateRoles.includes('poisoner')) {
    const wolfKillOverrideAction: SetWolfKillOverrideAction = {
      type: 'SET_WOLF_KILL_OVERRIDE',
      payload: {
        override: {
          source: 'poisoner',
          ui: WOLF_KILL_OVERRIDE_TEXTS.poisoner,
        },
      },
    };
    actions.push(wolfKillOverrideAction);
  }

  const audioEffects: AudioEffect[] = [{ audioKey: 'night', isEndAudio: false }];

  // Add first step (usually wolf) start audio
  if (firstStepSpec) {
    audioEffects.push({
      audioKey: resolveSeerAudioKey(firstStepSpec.audioKey, state.seerLabelMap),
      isEndAudio: false,
    });
  }

  actions.push(...createAudioQueueActions(audioEffects));
  return handlerSuccess(actions);
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

  return decideRestartGame(execution);
}

/**
 * Handle redeal (Ended only): restart + a fresh role deal as one atomic
 * command — the host's "one more game" step. Emits RESTART_GAME followed
 * by the ASSIGN_ROLES action from the shared deal computation; evolve
 * applies both in order, so no half-restarted state is ever observable
 * (the client must not chain restart + assign commands to fake this).
 */
export function handleRedealGame(
  _intent: RedealGameIntent,
  context: HandlerContext,
  execution: HandlerExecutionContext,
): HandlerResult {
  const { state } = context;

  // Gate: only a finished game can be redealt.
  if (state.status !== GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  const deal = decideRoleDeal(state, execution);
  if (deal.kind !== 'success') {
    return deal;
  }

  const restartAction: RestartGameAction = {
    type: 'RESTART_GAME',
    nonce: execution.randomSeed,
  };

  return handlerSuccess([restartAction, ...deal.actions]);
}

/**
 * Handle update template (only "before role assignment": unseated | seated)
 *
 * Called when Host edits room config.
 */
export function handleUpdateTemplate(
  intent: UpdateTemplateIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  // Validate: only allow modification "before role assignment" (unseated/seated).
  // Once in assigned/ready/ongoing/ended, modifications cause state machine and player perception drift, so RESTART_GAME is required first.
  const canUpdateTemplateBeforeView =
    state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canUpdateTemplateBeforeView) {
    return handlerError('invalid_status');
  }

  const action: UpdateTemplateAction = {
    type: 'UPDATE_TEMPLATE',
    payload: {
      templateRoles: intent.payload.templateRoles,
      rules: intent.payload.rules,
    },
  };

  return handlerSuccess([action]);
}

/**
 * Handle fill with bots (Debug-only, Host-only)
 *
 * Preconditions:
 * - status === GameStatus.Unseated
 *
 * Result:
 * - Create bot players for all empty seats (bot occupants in the roster)
 *
 * @remarks
 * The seat decision is the platform's single fill implementation
 * (decideRosterFillBots, the same one every other game decides with):
 * it picks the empty seats and validates the roster invariants. What
 * stays werewolf-owned is the payload its state model needs per bot
 * seat — a players-record entry; the bot occupant in the roster
 * carries no profile (its display name is derived at projection).
 */
export function handleFillWithBots(
  _intent: FillWithBotsIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  // Gate: only allow bot fill in unseated phase
  if (state.status !== GameStatus.Unseated) {
    return handlerError('invalid_status');
  }

  const seatCount = getPlayerCount(state.templateRoles);
  const fill = decideRosterFillBots(state.roster, seatCount);
  if (fill.kind === 'rejected') {
    return handlerError(fill.reason);
  }

  const bots: Record<number, Player> = {};
  for (const change of fill.changes) {
    const seat = change.seat;
    bots[seat] = {
      seat: seat,
      hasViewedRole: false,
    };
  }

  const action: FillWithBotsAction = {
    type: 'FILL_WITH_BOTS',
    payload: { bots },
  };

  return handlerSuccess([action]);
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
  const sortedRoles = [...intent.payload.roles].sort();
  const nominations = state.boardNominations;
  if (nominations) {
    for (const [existingUid, nom] of Object.entries(nominations)) {
      // Same user -> use override logic (existing behavior)
      if (existingUid === intent.payload.userId) continue;
      const existingSorted = [...nom.roles].sort();
      if (
        existingSorted.length === sortedRoles.length &&
        existingSorted.every((r, i) => r === sortedRoles[i])
      ) {
        // Roles identical -> auto-vote existing nomination
        const action: UpvoteBoardNominationAction = {
          type: 'UPVOTE_BOARD_NOMINATION',
          payload: { targetUserId: existingUid, voterUid: intent.payload.userId },
        };
        return handlerSuccess([action], 'DEDUPLICATED');
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
