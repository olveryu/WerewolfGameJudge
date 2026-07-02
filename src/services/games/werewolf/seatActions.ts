/**
 * Seat Actions - Seat operation orchestration (HTTP API)
 *
 * All seat operations (sit/unseat) go through HTTP to the server API.
 * Server handles handler -> reducer -> DB write -> Realtime broadcast.
 * Host and Player are no longer distinguished. Handles HTTP calls and result parsing.
 * Contains no business logic/validation rules (all in server handler), does not mutate state directly (all in server reducer).
 */

import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import type { WerewolfStore } from '@werewolf/game-engine/werewolf/store';

import { facadeLog } from '@/utils/logger';

import { type ApiResponse, callApiWithRetry } from './apiUtils';
import type { SeatProfile } from './IWerewolfFacade';

/**
 * Context interface required by Seat Actions
 *
 * After migration only needs roomCode + userId; no longer requires store / realtimeService etc.
 */
/** Context interface required by Seat Actions. */
export interface SeatActionsContext {
  myUserId: string | null;
  getRoomCode: () => string | null;
  /** WerewolfStore instance (for HTTP response immediate applySnapshot) */
  readonly store?: WerewolfStore;
}

/** Seat operation API response (alias for readability within this file) */
type SeatApiResponse = ApiResponse;

/**
 * Call seat API (with built-in client retry)
 *
 * Seat operations do not use client optimistic updates: low-frequency operations (click once and wait),
 * rely on applySnapshot from HTTP response for immediate render (~100-300ms latency acceptable).
 * Optimistic updates previously caused client state drift when server rejected / broadcast race.
 *
 * Transient server errors (CONFLICT_RETRY / INTERNAL_ERROR) are retried transparently up to 2 times.
 */
async function callSeatApi(
  roomCode: string,
  body: Record<string, unknown>,
  store?: WerewolfStore,
): Promise<SeatApiResponse> {
  return callApiWithRetry('/game/seat', { roomCode, ...body }, 'callSeatApi', store);
}

// =============================================================================
// Public API
// =============================================================================

/** Sit and return a boolean result for UI flows that do not need the failure reason. */
export async function takeSeat(
  ctx: SeatActionsContext,
  seat: number,
  profile: SeatProfile,
): Promise<boolean> {
  const result = await takeSeatWithAck(ctx, seat, profile);
  return result.success;
}

/**
 * Sit and return full result (including reason)
 */
export async function takeSeatWithAck(
  ctx: SeatActionsContext,
  seat: number,
  profile: SeatProfile,
): Promise<ActionResult> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUserId) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('takeSeatWithAck', { seat: seat, userId: ctx.myUserId });

  return callSeatApi(
    roomCode,
    {
      action: 'sit',
      userId: ctx.myUserId,
      seat: seat,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      avatarFrame: profile.avatarFrame,
      seatFlair: profile.seatFlair,
      nameStyle: profile.nameStyle,
      roleRevealEffect: profile.roleRevealEffect,
      seatAnimation: profile.seatAnimation,
      level: profile.level,
    },
    ctx.store,
  );
}

/** Unseat and return a boolean result for UI flows that do not need the failure reason. */
export async function leaveSeat(ctx: SeatActionsContext): Promise<boolean> {
  const result = await leaveSeatWithAck(ctx);
  return result.success;
}

/**
 * Unseat and return full result (including reason)
 */
export async function leaveSeatWithAck(ctx: SeatActionsContext): Promise<ActionResult> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUserId) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('leaveSeatWithAck', { userId: ctx.myUserId });

  const userId = ctx.myUserId;

  return callSeatApi(
    roomCode,
    {
      action: 'standup',
      userId,
    },
    ctx.store,
  );
}

/**
 * Kick player from seat (Host-only)
 */
export async function kickPlayer(
  ctx: SeatActionsContext,
  targetSeat: number,
): Promise<ActionResult> {
  const roomCode = ctx.getRoomCode();
  if (!roomCode || !ctx.myUserId) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  facadeLog.debug('kickPlayer', { targetSeat, userId: ctx.myUserId });

  return callSeatApi(
    roomCode,
    {
      action: 'kick',
      userId: ctx.myUserId,
      targetSeat,
    },
    ctx.store,
  );
}
