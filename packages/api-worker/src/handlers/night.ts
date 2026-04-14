/**
 * handlers/night — 夜晚阶段 handlers (Workers 版)
 *
 * Thin router 层：参数校验 → DO RPC → 错误处理 → 返回响应。
 * 夜晚逻辑在 DO (GameRoom) 内部执行。
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';

import { jsonResponse } from '../lib/cors';
import {
  audioGateSchema,
  groupConfirmAckSchema,
  nightActionSchema,
  wolfRobotViewedSchema,
} from '../schemas/night';
import {
  callDO,
  createSimpleHandler,
  getGameRoomStub,
  type HandlerFn,
  parseBody,
  resultToStatus,
} from './shared';

// ── Night handlers ──────────────────────────────────────────────────────────

export const handleAction: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, nightActionSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, seat, role, target, extra } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.submitAction(seat, role as RoleId, target ?? null, extra);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleAudioAck = createSimpleHandler((stub) => stub.audioAck());

export const handleAudioGate: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, audioGateSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, isPlaying } = parsed;

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
  const parsed = await parseBody(req, wolfRobotViewedSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, seat } = parsed;

  const doResult = await callDO(() => {
    const stub = getGameRoomStub(env, roomCode);
    return stub.wolfRobotViewed(seat);
  }, env);
  if (doResult instanceof Response) return doResult;
  return jsonResponse(doResult, resultToStatus(doResult), env);
};

export const handleGroupConfirmAck: HandlerFn = async (req, env) => {
  const parsed = await parseBody(req, groupConfirmAckSchema, env);
  if (parsed instanceof Response) return parsed;
  const { roomCode, seat, uid } = parsed;

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
