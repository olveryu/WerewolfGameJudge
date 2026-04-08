/**
 * handlers/gameControl — 游戏生命周期 handlers (Workers 版)
 *
 * 与 Edge Functions 的 gameControl.ts 逻辑一致。
 * 差异：`processGameAction` 多接 `db` 参数；`jsonResponse`/`missingParams` 多接 `env`。
 */

import {
  handleAssignRoles,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetRoleRevealAnimation,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from '@werewolf/game-engine/engine/handlers/gameControlHandler';
import {
  handleClearAllSeats,
  handleJoinSeat,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from '@werewolf/game-engine/engine/handlers/seatHandler';
import { handleViewedRole } from '@werewolf/game-engine/engine/handlers/viewedRoleHandler';
import type {
  JoinSeatIntent,
  LeaveMySeatIntent,
  UpdatePlayerProfileIntent,
} from '@werewolf/game-engine/engine/intents/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';

import { broadcastIfNeeded } from '../lib/broadcast';
import { jsonResponse } from '../lib/cors';
import { processGameAction } from '../lib/gameStateManager';
import {
  buildHandlerContext,
  createSimpleHandler,
  extractAudioActions,
  type HandlerFn,
  isValidSeat,
  missingParams,
  resultToStatus,
} from './shared';

// ── Simple intent-only handlers ─────────────────────────────────────────────

export const handleAssign = createSimpleHandler(handleAssignRoles, {
  type: 'ASSIGN_ROLES' as const,
});
export const handleFillBots = createSimpleHandler(handleFillWithBots, {
  type: 'FILL_WITH_BOTS' as const,
});
export const handleMarkBotsViewed = createSimpleHandler(handleMarkAllBotsViewed, {
  type: 'MARK_ALL_BOTS_VIEWED' as const,
});
export const handleClearSeats = createSimpleHandler(handleClearAllSeats, {
  type: 'CLEAR_ALL_SEATS' as const,
});
export const handleRestart = createSimpleHandler(handleRestartGame, {
  type: 'RESTART_GAME' as const,
});

// ── Parameterized handlers ──────────────────────────────────────────────────

export const handleSeat: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as {
    roomCode?: string;
    action?: string;
    uid?: string;
    seat?: number;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
  };
  const { roomCode, action, uid, seat, displayName, avatarUrl, avatarFrame } = body;

  if (!roomCode || !uid || !action) return missingParams(env);
  if (action !== 'sit' && action !== 'standup') {
    return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400, env);
  }
  if (action === 'sit' && (seat == null || !isValidSeat(seat))) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400, env);
  }

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    if (action === 'sit') {
      const intent: JoinSeatIntent = {
        type: 'JOIN_SEAT',
        payload: { seat: seat!, uid, displayName: displayName ?? '', avatarUrl, avatarFrame },
      };
      return handleJoinSeat(intent, handlerCtx);
    } else {
      const intent: LeaveMySeatIntent = { type: 'LEAVE_MY_SEAT', payload: { uid } };
      return handleLeaveMySeat(intent, handlerCtx);
    }
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleSetAnimation: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as { roomCode?: string; animation?: string };
  const { roomCode, animation } = body;
  if (!roomCode || !animation) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleSetRoleRevealAnimation(
      { type: 'SET_ROLE_REVEAL_ANIMATION', animation: animation as RoleRevealAnimation },
      handlerCtx,
    );
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleStart: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const handlerResult = handleStartNight({ type: 'START_NIGHT' }, handlerCtx);
    if (!handlerResult.success) return handlerResult;

    const extraActions = extractAudioActions(handlerResult.sideEffects);
    if (extraActions.length > 0) {
      return { ...handlerResult, actions: [...handlerResult.actions, ...extraActions] };
    }
    return handlerResult;
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleUpdateTemplateRoute: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as { roomCode?: string; templateRoles?: string[] };
  const { roomCode, templateRoles } = body;
  if (!roomCode || !templateRoles || !Array.isArray(templateRoles)) {
    return missingParams(env);
  }

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleUpdateTemplate(
      { type: 'UPDATE_TEMPLATE', payload: { templateRoles: templateRoles as RoleId[] } },
      handlerCtx,
    );
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleViewRole: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as { roomCode?: string; uid?: string; seat?: number };
  const { roomCode, uid, seat } = body;
  if (!roomCode || !uid || !isValidSeat(seat)) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    return handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat } }, handlerCtx);
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleShareReview: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as { roomCode?: string; allowedSeats?: number[] };
  const { roomCode, allowedSeats } = body;
  if (!roomCode || !Array.isArray(allowedSeats)) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    return handleShareNightReview({ type: 'SHARE_NIGHT_REVIEW', allowedSeats }, handlerCtx);
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleUpdateProfileRoute: HandlerFn = async (req, env, ctx) => {
  const body = (await req.json()) as {
    roomCode?: string;
    uid?: string;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
  };
  const { roomCode, uid, displayName, avatarUrl, avatarFrame } = body;
  if (!roomCode || !uid) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    const intent: UpdatePlayerProfileIntent = {
      type: 'UPDATE_PLAYER_PROFILE',
      payload: { uid, displayName, avatarUrl, avatarFrame },
    };
    return handleUpdatePlayerProfile(intent, handlerCtx);
  });
  broadcastIfNeeded(env, roomCode, result, ctx);
  return jsonResponse(result, resultToStatus(result), env);
};
