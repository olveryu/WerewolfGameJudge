/**
 * handlers/night — 夜晚阶段 handlers (Workers 版)
 *
 * Thin router 层：参数校验 → DO RPC → 错误处理 → 返回响应。
 * 夜晚逻辑在 DO (GameRoom) 内部执行。
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

// ── Night handlers ──────────────────────────────────────────────────────────

export const handleAction: HandlerFn = async (req, env) => {
  const body = (await req.json()) as {
    roomCode?: string;
    seat?: number;
    role?: string;
    target?: number | null;
    extra?: unknown;
  };
  const { roomCode, seat, role, target, extra } = body;
  if (!roomCode || !isValidSeat(seat) || !role) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.submitAction(seat, role as RoleId, target ?? null, extra);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleAudioAck = createSimpleHandler((stub) => stub.audioAck());

export const handleAudioGate: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; isPlaying?: boolean };
  const { roomCode, isPlaying } = body;
  if (!roomCode || typeof isPlaying !== 'boolean') return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.audioGate(isPlaying);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleProgression = createSimpleHandler((stub) => stub.progression());

export const handleRevealAck = createSimpleHandler((stub) => stub.revealAck());

export const handleWolfRobotViewed: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; seat?: number };
  const { roomCode, seat } = body;
  if (!roomCode || !isValidSeat(seat)) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.wolfRobotViewed(seat);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleGroupConfirmAck: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; seat?: number; uid?: string };
  const { roomCode, seat, uid } = body;
  if (!roomCode || !isValidSeat(seat) || !uid) return missingParams(env);

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.groupConfirmAck(seat, uid);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleMarkBotsGroupConfirmed = createSimpleHandler((stub) =>
  stub.markBotsGroupConfirmed(),
);
