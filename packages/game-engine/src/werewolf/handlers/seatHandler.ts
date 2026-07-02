/**
 * Seat Handler - seat operations handler (Host-only)
 *
 * Responsibilities:
 * - Handle JOIN_SEAT / LEAVE_MY_SEAT intents
 * - All validation (state/userId/seat validity/duplicate occupancy) lives here; Facade does no validation
 *
 * Performs seat validation and returns a StateAction list. No IO (network / audio / alert),
 * does not mutate state directly (returned StateAction list is executed by the reducer).
 */

import { seatClearAll, seatJoin, seatKick, seatLeave } from '../../engine/seating/kernel';
import {
  SEAT_KERNEL_INVALID_SEAT,
  SEAT_KERNEL_NOT_SEATED,
  SEAT_KERNEL_SEAT_EMPTY,
  SEAT_KERNEL_SEAT_TAKEN,
} from '../../engine/seating/types';
import {
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
} from '../../protocol/reasonCodes';
import type {
  ClearAllSeatsIntent,
  JoinSeatIntent,
  KickPlayerIntent,
  LeaveMySeatIntent,
  UpdatePlayerProfileIntent,
} from '../intents/types';
import { GameStatus } from '../models';
import type { Player } from '../protocol/types';
import type {
  PlayerJoinAction,
  PlayerLeaveAction,
  UpdatePlayerProfileAction,
} from '../reducer/types';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

/**
 * Handle joining a seat
 * Supports seat changes: if the player already has a seat, the old seat is cleared first
 */
export function handleJoinSeat(intent: JoinSeatIntent, context: HandlerContext): HandlerResult {
  const {
    seat,
    userId,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
    level,
  } = intent.payload;
  const { state } = context;

  // Validate: state exists
  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // Validate: userId is valid
  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  const op = seatJoin<Player>(
    state.players,
    Object.keys(state.players).length,
    seat,
    userId,
    (seatNum) => ({
      userId,
      seat: seatNum,
      role: null,
      hasViewedRole: false,
    }),
  );
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_INVALID_SEAT) return handlerError(REASON_INVALID_SEAT);
    if (op.reason === SEAT_KERNEL_SEAT_TAKEN) return handlerError(REASON_SEAT_TAKEN);
    return handlerError(op.reason);
  }

  // Validate: game status allows joining
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const actions: (PlayerJoinAction | PlayerLeaveAction)[] = [];
  for (const change of op.changes) {
    if (change.value === null) {
      actions.push({
        type: 'PLAYER_LEAVE',
        payload: { seat: change.seat },
      });
      continue;
    }

    actions.push({
      type: 'PLAYER_JOIN',
      payload: {
        seat: change.seat,
        player: change.value,
        rosterEntry: {
          displayName,
          avatarUrl,
          avatarFrame,
          seatFlair,
          nameStyle,
          roleRevealEffect,
          seatAnimation,
          level,
        },
      },
    });
  }

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}

/**
 * Handle leaving "my seat"
 *
 * No need to specify seat in payload; seat comes from context.mySeat
 * If not seated (mySeat === null), returns REASON_NOT_SEATED
 */
export function handleLeaveMySeat(
  intent: LeaveMySeatIntent,
  context: HandlerContext,
): HandlerResult {
  const { userId } = intent.payload;
  const { state, mySeat } = context;

  // Validate: state exists
  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // Validate: userId is valid
  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  // Validate: player is seated
  if (mySeat === null) {
    return handlerError(REASON_NOT_SEATED);
  }
  const op = seatLeave(state.players, userId);
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_NOT_SEATED) return handlerError(REASON_NOT_SEATED);
    return handlerError(op.reason);
  }

  // Validate: game status allows leaving (only Unseated/Seated allowed)
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const actions: PlayerLeaveAction[] = op.changes.map((change) => ({
    type: 'PLAYER_LEAVE',
    payload: { seat: change.seat },
  }));

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}

/**
 * Handle clearing all seats (Host-only)
 *
 * Removes all seated players and returns status to unseated.
 * Precondition: status in (GameStatus.Unseated, GameStatus.Seated)
 */
export function handleClearAllSeats(
  _intent: ClearAllSeatsIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const op = seatClearAll(state.players);
  const actions: PlayerLeaveAction[] =
    op.kind === 'success'
      ? op.changes.map((change) => ({ type: 'PLAYER_LEAVE', payload: { seat: change.seat } }))
      : [];

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}

/**
 * Update seated player's display info (displayName / avatarUrl)
 *
 * Any seated player can call this (to update their own info).
 * mySeat is provided by context (looked up via userId); the client does not pass seat.
 */
export function handleUpdatePlayerProfile(
  intent: UpdatePlayerProfileIntent,
  context: HandlerContext,
): HandlerResult {
  const {
    userId,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  } = intent.payload;
  const { state, mySeat } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  if (mySeat === null) {
    return handlerError(REASON_NOT_SEATED);
  }

  const action: UpdatePlayerProfileAction = {
    type: 'UPDATE_PLAYER_PROFILE',
    payload: {
      userId,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
      roleRevealEffect,
      seatAnimation,
    },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * Handle kicking a player from a seat (Host-only)
 *
 * Host can remove the player at a given seat during Unseated/Seated phase.
 * After kick, the seat becomes empty; if previously Seated, status reverts to Unseated.
 */
export function handleKickPlayer(intent: KickPlayerIntent, context: HandlerContext): HandlerResult {
  const { targetSeat } = intent.payload;
  const { state } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // Validate: only Host can kick
  if (state.hostUserId !== context.myUserId) {
    return handlerError(REASON_NOT_HOST);
  }

  // Validate: only during Unseated/Seated phase
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const op = seatKick(state.players, Object.keys(state.players).length, targetSeat);
  if (op.kind === 'error') {
    if (op.reason === SEAT_KERNEL_INVALID_SEAT) return handlerError(REASON_INVALID_SEAT);
    if (op.reason === SEAT_KERNEL_SEAT_EMPTY) return handlerError(REASON_SEAT_EMPTY);
    return handlerError(op.reason);
  }

  const actions: PlayerLeaveAction[] = op.changes.map((change) => ({
    type: 'PLAYER_LEAVE',
    payload: { seat: change.seat },
  }));

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}
