/**
 * handlers/gameControl — 游戏生命周期 handlers (Workers 版)
 *
 * Thin router 层：参数校验 → DO RPC → 错误处理 → 返回响应。
 * 游戏逻辑在 DO (GameRoom) 内部执行。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { jsonResponse } from '../lib/cors';
import {
  callDO,
  createSimpleHandler,
  getGameRoomStub,
  type HandlerFn,
  isValidSeat,
  missingParams,
  resultToStatus,
} from './shared';

// ── Simple no-arg handlers (roomCode only) ──────────────────────────────────

export const handleAssign = createSimpleHandler((stub) => stub.assignRoles());
export const handleFillBots = createSimpleHandler((stub) => stub.fillWithBots());
export const handleMarkBotsViewed = createSimpleHandler((stub) => stub.markAllBotsViewed());
export const handleClearSeats = createSimpleHandler((stub) => stub.clearAllSeats());
export const handleRestart = createSimpleHandler((stub) => stub.restartGame());

// ── Parameterized handlers ──────────────────────────────────────────────────

export const handleSeat: HandlerFn = async (req, env) => {
  const body = (await req.json()) as {
    roomCode?: string;
    action?: string;
    uid?: string;
    seat?: number;
    targetSeat?: number;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
  };
  const { roomCode, action, uid, seat, targetSeat, displayName, avatarUrl, avatarFrame } = body;

  if (!roomCode || !uid || !action) return missingParams(env);
  if (action !== 'sit' && action !== 'standup' && action !== 'kick') {
    return jsonResponse({ success: false, reason: 'INVALID_ACTION' }, 400, env);
  }
  if (action === 'sit' && (seat == null || !isValidSeat(seat))) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400, env);
  }
  if (action === 'kick' && (targetSeat == null || !isValidSeat(targetSeat))) {
    return jsonResponse({ success: false, reason: 'MISSING_SEAT' }, 400, env);
  }

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.seat(
      action as 'sit' | 'standup' | 'kick',
      uid,
      seat ?? null,
      displayName,
      avatarUrl,
      avatarFrame,
      targetSeat,
    );
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleSetAnimation: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; animation?: string };
  const { roomCode, animation } = body;
  if (!roomCode || !animation) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.setAnimation(animation);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleStart: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.startNight();
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleUpdateTemplateRoute: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; templateRoles?: string[] };
  const { roomCode, templateRoles } = body;
  if (!roomCode || !templateRoles || !Array.isArray(templateRoles)) {
    return missingParams(env);
  }

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.updateTemplate(templateRoles as RoleId[]);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleViewRole: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; uid?: string; seat?: number };
  const { roomCode, uid, seat } = body;
  if (!roomCode || !uid || !isValidSeat(seat)) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.viewRole(uid, seat);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleShareReview: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; allowedSeats?: number[] };
  const { roomCode, allowedSeats } = body;
  if (!roomCode || !Array.isArray(allowedSeats)) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.shareReview(allowedSeats);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleUpdateProfileRoute: HandlerFn = async (req, env) => {
  const body = (await req.json()) as {
    roomCode?: string;
    uid?: string;
    displayName?: string;
    avatarUrl?: string;
    avatarFrame?: string;
  };
  const { roomCode, uid, displayName, avatarUrl, avatarFrame } = body;
  if (!roomCode || !uid) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.updateProfile(uid, displayName, avatarUrl, avatarFrame);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};
