/**
 * handlers/gameControl — 游戏生命周期 handlers (Workers 版)
 *
 * Thin router 层：参数校验 → DO RPC → 错误处理 → 返回响应。
 * 游戏逻辑在 DO (GameRoom) 内部执行。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { jsonResponse } from '../lib/cors';
import {
  boardNominateSchema,
  boardUpvoteSchema,
  boardWithdrawSchema,
  roomCodeSchema,
  seatActionSchema,
  setAnimationSchema,
  shareReviewSchema,
  updateProfileRouteSchema,
  updateTemplateSchema,
  viewRoleSchema,
} from '../schemas/game';
import {
  callDO,
  createSimpleHandler,
  getGameRoomStub,
  type HandlerFn,
  parseBody,
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
  const parsed = await parseBody(req, seatActionSchema, env);
  if (parsed instanceof Response) return parsed;
  const {
    roomCode,
    action,
    uid,
    seat,
    targetSeat,
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    level,
  } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.seat(
      action,
      uid,
      seat ?? null,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      targetSeat,
      level,
    );
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleSetAnimation: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, setAnimationSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, animation } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.setAnimation(animation);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleStart: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, roomCodeSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.startNight();
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleUpdateTemplateRoute: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, updateTemplateSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, templateRoles } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.updateTemplate(templateRoles as RoleId[]);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleViewRole: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, viewRoleSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, uid, seat } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.viewRole(uid, seat);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleShareReview: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, shareReviewSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, allowedSeats } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.shareReview(allowedSeats);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleUpdateProfileRoute: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, updateProfileRouteSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, uid, displayName, avatarUrl, avatarFrame, seatFlair } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.updateProfile(uid, displayName, avatarUrl, avatarFrame, seatFlair);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

// ── Board Nomination handlers ───────────────────────────────────────────────

export const handleBoardNominate: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, boardNominateSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, uid, displayName, roles } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.boardNominate(uid, displayName, roles as RoleId[]);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleBoardUpvote: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, boardUpvoteSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, uid, targetUid } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.boardUpvote(uid, targetUid);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleBoardWithdraw: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, boardWithdrawSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, uid } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.boardWithdraw(uid);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};
