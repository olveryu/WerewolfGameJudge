/**
 * Lifecycle sub-reducers — game setup, player management, template & animation config.
 *
 * Pure functions: (state, action) => newState.
 * No IO, no random, no time dependencies.
 *
 * @pre Each reducer assumes caller has validated through the handler layer.
 *   - handleRestartGame: @pre action.nonce must be precomputed by handler
 *   - handleAssignRoles: @pre assignments keys are valid seat numbers
 *   - handleUpdateTemplate: @pre newTemplateRoles is a valid template
 *   - handlePlayerViewedRole: @throws '[FAIL-FAST] PLAYER_VIEWED_ROLE: no player at seat X'
 */

import { GameStatus, getPlayerCount } from '../../models';
import type { Complete } from '../state/normalize';
import type { GameState } from '../store/types';
import type {
  AssignRolesAction,
  FillWithBotsAction,
  InitializeGameAction,
  PlayerJoinAction,
  PlayerLeaveAction,
  PlayerViewedRoleAction,
  RestartGameAction,
  SetBoardNominationAction,
  UpdatePlayerProfileAction,
  UpdateTemplateAction,
  UpvoteBoardNominationAction,
  WithdrawBoardNominationAction,
} from './types';

/** Initialize game state (set room code, template, seat count). */
export function handleInitializeGame(state: GameState, action: InitializeGameAction): GameState {
  const { roomCode, hostUserId, templateRoles, totalSeats } = action.payload;
  const players: Record<number, null> = {};
  for (let i = 0; i < totalSeats; i++) {
    players[i] = null;
  }
  return {
    ...state,
    roomCode,
    hostUserId,
    templateRoles,
    players,
    status: GameStatus.Unseated,
    currentStepIndex: -1,
    isAudioPlaying: false,
  };
}

/** Restart game (keep players, clear role assignments, back to Seated). */
export function handleRestartGame(state: GameState, action: RestartGameAction): GameState {
  // PR9: align with v1 behavior - keep players but clear roles
  // v1: keep players unchanged, only clear role/hasViewedRole
  // v1: status resets to GameStatus.Seated (not GameStatus.Unseated)
  const players: Record<number, (typeof state.players)[number]> = {};
  const seatCount = Object.keys(state.players).length;

  for (let i = 0; i < seatCount; i++) {
    const existingPlayer = state.players[i];
    if (existingPlayer) {
      // Keep player but clear role
      players[i] = {
        ...existingPlayer,
        role: null,
        hasViewedRole: false,
      };
    } else {
      players[i] = null;
    }
  }

  // Use handler-precomputed nonce (ensures reducer purity)
  const newNonce = action.nonce;

  return {
    // ── Preserved fields (unchanged across games) ──────────────────────────────
    roomCode: state.roomCode,
    hostUserId: state.hostUserId,
    templateRoles: state.templateRoles,
    isPlagueMode: state.isPlagueMode,
    debugMode: state.debugMode,
    roster: state.roster,

    // ── Reset fields ─────────────────────────────────────────
    players,
    status: GameStatus.Seated, // v1: reset to seated, not unseated
    currentStepIndex: -1, // consistent with buildInitialGameState
    isAudioPlaying: false,
    currentStepId: undefined, // clear night step
    actions: [],
    currentNightResults: undefined,
    lastNightDeaths: undefined,
    deathReasons: undefined,
    witchContext: undefined,
    seerReveal: undefined,
    mirrorSeerReveal: undefined,
    drunkSeerReveal: undefined,
    psychicReveal: undefined,
    gargoyleReveal: undefined,
    pureWhiteReveal: undefined,
    wolfWitchReveal: undefined,
    wolfRobotReveal: undefined,
    wolfRobotContext: undefined,
    wolfRobotHunterStatusViewed: undefined,
    confirmStatus: undefined,
    actionRejected: undefined,
    nightmareBlockedSeat: undefined,
    wolfKillOverride: undefined,
    pendingRevealAcks: [],
    pendingAudioEffects: undefined,
    stepDeadline: undefined,
    ui: undefined,
    nightReviewAllowedSeats: undefined,
    seerLabelMap: undefined,
    hypnotizedSeats: [],
    piperRevealAcks: [],
    convertedSeat: undefined,
    conversionRevealAcks: [],

    // Treasure Master
    bottomCards: undefined,
    treasureMasterSeat: undefined,
    treasureMasterChosenCard: undefined,
    effectiveTeam: undefined,
    bottomCardStepRoles: undefined,

    // Thief
    thiefSeat: undefined,
    thiefChosenCard: undefined,

    // Cupid
    loverSeats: undefined,
    cupidSeat: undefined,
    cupidLoversRevealAcks: [],

    // boardNominations: preserved, not cleared on restart
    boardNominations: state.boardNominations,

    // ── Update nonce on restart ─────────────────────────
    roleRevealRandomNonce: newNonce,
  } satisfies Complete<GameState>;
}

/** Update game template (adjust seat count, keep seated players). */
export function handleUpdateTemplate(state: GameState, action: UpdateTemplateAction): GameState {
  const newTemplateRoles = action.payload.templateRoles;
  const newCount = getPlayerCount(newTemplateRoles);
  const oldPlayers = state.players;

  const newPlayers: GameState['players'] = {};

  for (let i = 0; i < newCount; i++) {
    const existingPlayer = oldPlayers[i];
    if (existingPlayer) {
      // Keep player but clear role (safety fallback; should not have role at this point)
      newPlayers[i] = {
        ...existingPlayer,
        role: null,
        hasViewedRole: false,
      };
    } else {
      // Empty seat or newly added seat from expansion
      newPlayers[i] = null;
    }
  }
  // Note: seats beyond newCount (shrink) are not copied, i.e. kicked

  // Check if all seats are occupied
  const allSeated = Object.values(newPlayers).every((p) => p !== null);

  return {
    ...state,
    templateRoles: newTemplateRoles,
    isPlagueMode: action.payload.isPlagueMode ?? false,
    players: newPlayers,
    status: allSeated ? GameStatus.Seated : GameStatus.Unseated,
    // boardNominations: preserved, not cleared on adopt
  };
}

/** Player takes a seat. */
export function handlePlayerJoin(state: GameState, action: PlayerJoinAction): GameState {
  const { seat, player, rosterEntry } = action.payload;
  const newPlayers = { ...state.players, [seat]: player };
  const allSeated = Object.values(newPlayers).every((p) => p !== null);
  const newStatus = allSeated ? GameStatus.Seated : state.status;

  return {
    ...state,
    players: newPlayers,
    roster: { ...state.roster, [player.userId]: rosterEntry },
    status: newStatus,
  };
}

/** Player leaves seat. */
export function handlePlayerLeave(state: GameState, action: PlayerLeaveAction): GameState {
  const { seat } = action.payload;
  const leavingPlayer = state.players[seat];
  const newRoster = { ...state.roster };
  if (leavingPlayer) {
    delete newRoster[leavingPlayer.userId];
  }
  return {
    ...state,
    players: { ...state.players, [seat]: null },
    roster: newRoster,
    status: state.status === GameStatus.Seated ? GameStatus.Unseated : state.status,
  };
}

/** Update player profile. */
export function handleUpdatePlayerProfile(
  state: GameState,
  action: UpdatePlayerProfileAction,
): GameState {
  const {
    userId,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  } = action.payload;
  const existing = state.roster[userId];
  if (!existing) return state; // no-op if userId not in roster

  return {
    ...state,
    roster: {
      ...state.roster,
      [userId]: {
        ...existing,
        ...(displayName !== undefined && { displayName }),
        ...(avatarUrl !== undefined && { avatarUrl }),
        ...(avatarFrame !== undefined && { avatarFrame }),
        ...(seatFlair !== undefined && { seatFlair }),
        ...(nameStyle !== undefined && { nameStyle }),
        ...(roleRevealEffect !== undefined && { roleRevealEffect }),
        ...(seatAnimation !== undefined && { seatAnimation }),
      },
    },
  };
}

/** Assign roles (write assignments into players, status transitions to Assigned). */
export function handleAssignRoles(state: GameState, action: AssignRolesAction): GameState {
  const { assignments, seerLabelMap, bottomCards, treasureMasterSeat, thiefSeat, cupidSeat } =
    action.payload;
  const newPlayers = { ...state.players };

  for (const [seatStr, role] of Object.entries(assignments)) {
    const seat = Number.parseInt(seatStr, 10);
    const player = newPlayers[seat];
    if (player) {
      newPlayers[seat] = { ...player, role, hasViewedRole: false };
    }
  }

  return {
    ...state,
    players: newPlayers,
    status: GameStatus.Assigned,
    seerLabelMap,
    bottomCards,
    treasureMasterSeat,
    thiefSeat,
    cupidSeat,
  };
}

/** Mark player as having viewed role (status transitions to Ready when all viewed). */
export function handlePlayerViewedRole(
  state: GameState,
  action: PlayerViewedRoleAction,
): GameState {
  const { seat } = action.payload;
  const player = state.players[seat];
  if (!player) {
    throw new Error(`[FAIL-FAST] PLAYER_VIEWED_ROLE: no player at seat ${seat}`);
  }

  // Update hasViewedRole for current player
  const newPlayers = {
    ...state.players,
    [seat]: { ...player, hasViewedRole: true },
  };

  // Check if all seated players have viewed roles
  const allViewed = Object.values(newPlayers).every((p) => p === null || p.hasViewedRole === true);

  // Only advance to GameStatus.Ready when status === GameStatus.Assigned and all viewed
  const newStatus =
    state.status === GameStatus.Assigned && allViewed ? GameStatus.Ready : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

/** Fill empty seats with bots. */
export function handleFillWithBots(state: GameState, action: FillWithBotsAction): GameState {
  const { bots, botRoster } = action.payload;

  // Merge existing players and bots
  const newPlayers = { ...state.players };
  for (const [seatStr, bot] of Object.entries(bots)) {
    const seat = Number.parseInt(seatStr, 10);
    newPlayers[seat] = bot;
  }

  // Check if all seats are occupied
  const allSeated = Object.values(newPlayers).every((p) => p !== null);

  return {
    ...state,
    players: newPlayers,
    roster: { ...state.roster, ...botRoster },
    status: allSeated ? GameStatus.Seated : state.status,
    debugMode: { botsEnabled: true },
  };
}

/** Mark all bots as having viewed roles. */
export function handleMarkAllBotsViewed(state: GameState): GameState {
  const newPlayers = { ...state.players };

  for (const [seatStr, player] of Object.entries(state.players)) {
    if (player?.isBot) {
      const seat = Number.parseInt(seatStr, 10);
      newPlayers[seat] = {
        ...player,
        hasViewedRole: true,
      };
    }
  }

  // Check if all players have viewed roles (null seat treated as viewed, consistent with handlePlayerViewedRole)
  const allViewed = Object.values(newPlayers).every((p) => p === null || p.hasViewedRole === true);
  const newStatus =
    state.status === GameStatus.Assigned && allViewed ? GameStatus.Ready : state.status;

  return {
    ...state,
    players: newPlayers,
    status: newStatus,
  };
}

// =============================================================================
// Board Nomination Reducers
// =============================================================================

/** Set board nomination. */
export function handleSetBoardNomination(
  state: GameState,
  action: SetBoardNominationAction,
): GameState {
  const { nomination } = action.payload;
  return {
    ...state,
    boardNominations: {
      ...state.boardNominations,
      [nomination.userId]: nomination,
    },
  };
}

/** Upvote board nomination (toggle, single choice). */
export function handleUpvoteBoardNomination(
  state: GameState,
  action: UpvoteBoardNominationAction,
): GameState {
  const { targetUserId, voterUid } = action.payload;
  const nominations = state.boardNominations;
  const target = nominations?.[targetUserId];
  if (!target) return state;

  // Toggle: cancel if already voted, add if not (each user can vote on only one globally)
  const alreadyVoted = target.upvoters.includes(voterUid);
  const updatedUpvoters = alreadyVoted
    ? target.upvoters.filter((userId) => userId !== voterUid)
    : [...target.upvoters, voterUid];

  // When voting new, withdraw old vote from other nominations (single choice)
  let updatedNominations = {
    ...nominations,
    [targetUserId]: { ...target, upvoters: updatedUpvoters },
  };
  if (!alreadyVoted) {
    for (const [userId, nom] of Object.entries(updatedNominations)) {
      if (userId !== targetUserId && nom.upvoters.includes(voterUid)) {
        updatedNominations = {
          ...updatedNominations,
          [userId]: { ...nom, upvoters: nom.upvoters.filter((u) => u !== voterUid) },
        };
      }
    }
  }

  return {
    ...state,
    boardNominations: updatedNominations,
  };
}

/** Withdraw board nomination. */
export function handleWithdrawBoardNomination(
  state: GameState,
  action: WithdrawBoardNominationAction,
): GameState {
  const { userId } = action.payload;
  const nominations = state.boardNominations;
  if (!nominations?.[userId]) return state;

  const { [userId]: _, ...rest } = nominations;
  return {
    ...state,
    boardNominations: Object.keys(rest).length > 0 ? rest : undefined,
  };
}
