/**
 * Game Control Handler - game control processor (Host-only)
 *
 * Responsibilities:
 * - Handle ASSIGN_ROLES / START_NIGHT / RESTART_GAME / UPDATE_TEMPLATE intents
 * - Role assignment logic (shuffle + write to state)
 * - NightPlan construction (generate step plan from template)
 *
 * Exports role assignment, NightPlan construction, and StateAction list building logic; no IO (network / audio / Alert),
 * does not directly modify state (returns StateAction list for reducer to execute).
 */

import { GameStatus, type RoleId } from '../../models';
import { buildNightPlan, getStepSpec } from '../../models/roles/spec';
import type { RoleSpec } from '../../models/roles/spec/roleSpec.types';
import { WOLF_KILL_OVERRIDE_TEXTS } from '../../models/roles/spec/schema.types';
import { ROLE_SPECS } from '../../models/roles/spec/specs';
import { Faction } from '../../models/roles/spec/types';
import { getBottomCardCount, getBottomCardRoleId, getPlayerCount } from '../../models/Template';
import type { Player, RosterEntry } from '../../protocol/types';
import { resolveSeerAudioKey } from '../../utils/audioKeyOverride';
import { formatSeat } from '../../utils/formatSeat';
import { randomHex } from '../../utils/id';
import { shuffleArray } from '../../utils/shuffle';
import type {
  AssignRolesIntent,
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
  FillWithBotsIntent,
  MarkAllBotsViewedIntent,
  RestartGameIntent,
  ShareNightReviewIntent,
  StartNightIntent,
  UpdateTemplateIntent,
} from '../intents/types';
import type {
  AssignRolesAction,
  EndNightAction,
  FillWithBotsAction,
  MarkAllBotsViewedAction,
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
import type { GameState } from '../store/types';
import { maybeCreateConfirmStatusAction } from './confirmContext';
import type { HandlerContext, HandlerResult, SideEffect } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';
import { maybeCreateWitchContextAction } from './witchContext';

// ---------------------------------------------------------------------------
// Shared guard: state must exist
// ---------------------------------------------------------------------------
type StateGuardOk = { ok: true; state: GameState };
type StateGuardFail = { ok: false; result: HandlerResult };

function requireState(context: HandlerContext): StateGuardOk | StateGuardFail {
  if (!context.state) {
    return { ok: false, result: handlerError('no_state') };
  }
  return { ok: true, state: context.state };
}

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
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: game status must be GameStatus.Seated
  if (state.status !== GameStatus.Seated) {
    return handlerError('invalid_status');
  }

  const seatCount = Object.keys(state.players).length;
  const bottomCardRoleId = getBottomCardRoleId(state.templateRoles);
  const bottomCardCount = getBottomCardCount(state.templateRoles);
  const expectedRoleCount = seatCount + bottomCardCount;

  // Validate: template role count matches seat count (including deck cards)
  if (state.templateRoles.length !== expectedRoleCount) {
    return handlerError('role_count_mismatch');
  }

  // Plague mode: replace all wolf-faction roles with villager before shuffling
  const effectiveRoles: RoleId[] = state.isPlagueMode
    ? state.templateRoles.map((roleId) => {
        const spec = ROLE_SPECS[roleId];
        return spec?.faction === Faction.Wolf ? ('villager' as RoleId) : roleId;
      })
    : [...state.templateRoles];

  let seatedRoles: RoleId[];
  let bottomCards: RoleId[] | undefined;
  let treasureMasterSeat: number | undefined;
  let thiefSeat: number | undefined;
  let cupidSeat: number | undefined;

  if (bottomCardRoleId && !state.isPlagueMode) {
    // Deck role present: shuffle -> first seatCount assigned to seats + remaining N as deck
    const result = shuffleWithBottomCardConstraints(
      state.templateRoles,
      seatCount,
      bottomCardRoleId,
    );
    seatedRoles = result.seatedRoles;
    bottomCards = result.bottomCards;
  } else {
    seatedRoles = shuffleArray(effectiveRoles);
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
        const spec = ROLE_SPECS[r as keyof typeof ROLE_SPECS] as RoleSpec | undefined;
        return spec?.groups?.includes('seerFamily') === true;
      }),
    ),
  ];
  let seerLabelMap: Readonly<Record<string, number>> | undefined;
  if (seerLikeRoles.length >= 2) {
    const labels = shuffleArray(Array.from({ length: seerLikeRoles.length }, (_, i) => i + 1));
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

  return handlerSuccess([assignRolesAction], STANDARD_SIDE_EFFECTS);
}

// ---------------------------------------------------------------------------
// Bottom card shuffle with constraints (rejection sampling)
// ---------------------------------------------------------------------------

/** Maximum retry count (deck constraint satisfaction probability is very high, rarely needs retry) */
const MAX_SHUFFLE_RETRIES = 100;

/**
 * Shuffle roles and split into seated + bottom cards with constraints.
 *
 * Bottom card constraints vary by role:
 * - treasureMaster: at most 1 regular wolf; not all gods; not all villagers; no skill wolves
 * - thief: <=1 wolf-team card (including skill wolves); cannot have 2 wolf-team cards
 */
function shuffleWithBottomCardConstraints(
  templateRoles: readonly RoleId[],
  seatCount: number,
  bottomCardRoleId: RoleId,
): { seatedRoles: RoleId[]; bottomCards: RoleId[] } {
  for (let attempt = 0; attempt < MAX_SHUFFLE_RETRIES; attempt++) {
    const shuffled = shuffleArray([...templateRoles]);
    const seated = shuffled.slice(0, seatCount);
    const bottom = shuffled.slice(seatCount);

    if (validateBottomCards(bottom, bottomCardRoleId)) {
      return { seatedRoles: seated, bottomCards: bottom };
    }
  }

  // Should never happen given the loose constraints
  throw new Error(
    `[FAIL-FAST] Failed to satisfy bottom card constraints after ${MAX_SHUFFLE_RETRIES} retries`,
  );
}

/**
 * Validate bottom card constraints (parameterized by bottom card role).
 */
function validateBottomCards(cards: RoleId[], bottomCardRoleId: RoleId): boolean {
  // Common: bottom card role itself must not be in bottom cards
  if (cards.includes(bottomCardRoleId)) return false;

  // Common: cupid must not be in bottom cards
  if (cards.includes('cupid' as RoleId)) return false;

  if (bottomCardRoleId === 'treasureMaster') {
    return validateTreasureMasterBottomCards(cards);
  }
  if (bottomCardRoleId === 'thief') {
    return validateThiefBottomCards(cards);
  }
  return true;
}

/** TreasureMaster deck constraint: S21 strict 1Wolf(regular wolf) + 1God + 1Villager */
function validateTreasureMasterBottomCards(cards: RoleId[]): boolean {
  const factions = cards.map((r) => {
    const spec = ROLE_SPECS[r] as RoleSpec | undefined;
    return spec?.faction;
  });
  const wolfCount = factions.filter((f) => f === Faction.Wolf).length;
  const godCount = factions.filter((f) => f === Faction.God).length;
  const villagerCount = factions.filter((f) => f === Faction.Villager).length;
  if (wolfCount !== 1 || godCount !== 1 || villagerCount !== 1) return false;
  // Wolf faction deck card can only be regular wolf, no skill wolves
  const wolfCard = cards.find(
    (r) => (ROLE_SPECS[r] as RoleSpec | undefined)?.faction === Faction.Wolf,
  );
  return wolfCard === 'wolf';
}

/** Thief deck constraint */
function validateThiefBottomCards(cards: RoleId[]): boolean {
  // <=1 wolf-team card (including skill wolves)
  const wolfFactionCount = cards.filter((r) => {
    const spec = ROLE_SPECS[r] as RoleSpec | undefined;
    return spec?.faction === Faction.Wolf;
  }).length;
  if (wolfFactionCount > 1) return false;

  return true;
}

/**
 * Handle start night (ready -> ongoing)
 *
 * - Precondition: status === GameStatus.Ready
 * - Initialize Night-1 fields
 * - status -> GameStatus.Ongoing
 * - Broadcast STATE_UPDATE
 *
 * PR3 scope: state initialization only, no audio/advance/action handling
 */
export function handleStartNight(
  _intent: StartNightIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: status must be GameStatus.Ready
  if (state.status !== GameStatus.Ready) {
    return handlerError('invalid_status');
  }

  // First step comes from buildNightPlan table-driven single source (filtered by current template roles)
  const nightPlan = buildNightPlan(state.templateRoles, state.seerLabelMap);

  // No roles with night actions (e.g. pure villager board): skip night, end directly, no deaths
  if (nightPlan.steps.length === 0) {
    const endNightAction: EndNightAction = {
      type: 'END_NIGHT',
      payload: { deaths: [] },
    };
    return handlerSuccess([endNightAction], STANDARD_SIDE_EFFECTS);
  }

  const firstStepId = nightPlan.steps[0]!.stepId;
  const firstStepSpec = getStepSpec(firstStepId);

  // Collect actions to return
  const actions: StateAction[] = [];

  // Night-1 only: currentStepIndex starts at 0 (first step)
  const startNightAction: StartNightAction = {
    type: 'START_NIGHT',
    payload: { currentStepIndex: 0, currentStepId: firstStepId },
  };
  actions.push(startNightAction);

  // Use unified function to check if witchContext needs to be set (no-wolf board where first step is witchAction)
  const witchContextAction = maybeCreateWitchContextAction(firstStepId, state);
  if (witchContextAction) {
    actions.push(witchContextAction);
  }

  // Use unified function to check if confirmStatus needs to be set (edge case: first step is hunterConfirm)
  const confirmStatusAction = maybeCreateConfirmStatusAction(firstStepId, state);
  if (confirmStatusAction) {
    actions.push(confirmStatusAction);
  }

  // Witch present: wolves cannot attack on first night (board-level rule)
  if (state.templateRoles.includes('poisoner' as RoleId)) {
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

  // Build sideEffects: broadcast + save first, then play night start audio + first step audio
  const sideEffects: SideEffect[] = [
    { type: 'BROADCAST_STATE' },
    { type: 'SAVE_STATE' },
    // Night start background sound
    { type: 'PLAY_AUDIO', audioKey: 'night', isEndAudio: false },
  ];

  // Add first step (usually wolf) start audio
  if (firstStepSpec) {
    sideEffects.push({
      type: 'PLAY_AUDIO',
      audioKey: resolveSeerAudioKey(firstStepSpec.audioKey, state.seerLabelMap),
      isEndAudio: false,
    });
  }

  return handlerSuccess(actions, sideEffects);
}

/**
 * Handle restart game
 */
export function handleRestartGame(
  _intent: RestartGameIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;

  const action: RestartGameAction = {
    type: 'RESTART_GAME',
    nonce: randomHex(8),
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
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
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Validate: only allow modification "before role assignment" (unseated/seated).
  // Once in assigned/ready/ongoing/ended, modifications cause state machine and player perception drift, so RESTART_GAME is required first.
  const canUpdateTemplateBeforeView =
    state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canUpdateTemplateBeforeView) {
    return handlerError(
      '只能在"分配角色"前修改设置（未入座/已入座阶段）。如果已经不是该阶段，请先点击"重新开始"回到准备阶段再修改。',
    );
  }

  const action: UpdateTemplateAction = {
    type: 'UPDATE_TEMPLATE',
    payload: { templateRoles: intent.payload.templateRoles },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * Handle fill with bots (Debug-only, Host-only)
 *
 * Preconditions:
 * - status === GameStatus.Unseated
 *
 * Result:
 * - Create bot players for all empty seats (isBot: true)
 * - Set debugMode.botsEnabled = true
 */
export function handleFillWithBots(
  _intent: FillWithBotsIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: only allow bot fill in unseated phase
  if (state.status !== GameStatus.Unseated) {
    return handlerError('invalid_status');
  }

  // Calculate empty seats and generate bot players
  const seatCount = getPlayerCount(state.templateRoles);
  // Only seats with player !== null count as occupied
  const occupiedSeats = new Set(
    Object.entries(state.players)
      .filter(([, player]) => player !== null)
      .map(([seat]) => Number.parseInt(seat, 10)),
  );
  const bots: Record<number, Player> = {};
  const botRoster: Record<string, RosterEntry> = {};

  for (let seat = 0; seat < seatCount; seat++) {
    if (!occupiedSeats.has(seat)) {
      const userId = `bot-${seat}`;
      bots[seat] = {
        userId,
        seat: seat,
        hasViewedRole: false,
        isBot: true,
      };
      botRoster[userId] = {
        displayName: `机器人${formatSeat(seat)}`,
      };
    }
  }

  const action: FillWithBotsAction = {
    type: 'FILL_WITH_BOTS',
    payload: { bots, botRoster },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * Handle mark all bots as having viewed roles (Debug-only, Host-only)
 *
 * Preconditions:
 * - debugMode.botsEnabled === true
 * - status === GameStatus.Assigned
 *
 * Result: set hasViewedRole = true only for isBot === true players
 */
export function handleMarkAllBotsViewed(
  _intent: MarkAllBotsViewedIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  // Gate: debugMode.botsEnabled must be true
  if (!state.debugMode?.botsEnabled) {
    return handlerError('debug_not_enabled');
  }

  // Gate: status must be assigned
  if (state.status !== GameStatus.Assigned) {
    return handlerError('invalid_status');
  }

  const action: MarkAllBotsViewedAction = {
    type: 'MARK_ALL_BOTS_VIEWED',
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * Handle share details (Host-only, ended phase)
 *
 * Host selects seats allowed to view "detailed info", writes to state and broadcasts.
 * Preconditions: Host only + status === GameStatus.Ended
 */
export function handleShareNightReview(
  intent: ShareNightReviewIntent,
  context: HandlerContext,
): HandlerResult {
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  if (state.status !== GameStatus.Ended) {
    return handlerError('invalid_status');
  }

  const action: SetNightReviewAllowedSeatsAction = {
    type: 'SET_NIGHT_REVIEW_ALLOWED_SEATS',
    allowedSeats: intent.allowedSeats,
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
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
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canNominate = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canNominate) {
    return handlerError('invalid_status');
  }

  if (intent.payload.roles.length === 0) {
    return handlerError('角色列表不能为空');
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
        return handlerSuccess([action], STANDARD_SIDE_EFFECTS, 'DEDUPLICATED');
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

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
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
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canVote = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canVote) {
    return handlerError('invalid_status');
  }

  const { targetUserId, voterUid } = intent.payload;

  if (!state.boardNominations?.[targetUserId]) {
    return handlerError('目标建议不存在');
  }

  const action: UpvoteBoardNominationAction = {
    type: 'UPVOTE_BOARD_NOMINATION',
    payload: { targetUserId, voterUid },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
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
  const guard = requireState(context);
  if (!guard.ok) return guard.result;
  const { state } = guard;

  const canWithdraw = state.status === GameStatus.Unseated || state.status === GameStatus.Seated;
  if (!canWithdraw) {
    return handlerError('invalid_status');
  }

  if (!state.boardNominations?.[intent.payload.userId]) {
    return handlerError('建议不存在或已被撤回');
  }

  const action: WithdrawBoardNominationAction = {
    type: 'WITHDRAW_BOARD_NOMINATION',
    payload: { userId: intent.payload.userId },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
