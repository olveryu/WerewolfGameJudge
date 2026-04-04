/**
 * handlers/night — 夜晚阶段 handlers (Workers 版)
 *
 * 与 Edge Functions 的 night.ts 逻辑一致。
 */

import { handleSubmitAction } from '@werewolf/game-engine/engine/handlers/actionHandler';
import {
  handleEndNight,
  handleSetAudioPlaying,
} from '@werewolf/game-engine/engine/handlers/stepTransitionHandler';
import { handleSetWolfRobotHunterStatusViewed } from '@werewolf/game-engine/engine/handlers/wolfRobotHunterGateHandler';
import type {
  EndNightIntent,
  SetAudioPlayingIntent,
  SubmitActionIntent,
} from '@werewolf/game-engine/engine/intents/types';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { SchemaId } from '@werewolf/game-engine/models/roles/spec/schemas';
import { SCHEMAS } from '@werewolf/game-engine/models/roles/spec/schemas';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import { broadcastIfNeeded } from '../lib/broadcast';
import { jsonResponse } from '../lib/cors';
import { processGameAction } from '../lib/gameStateManager';
import {
  buildHandlerContext,
  extractAudioActions,
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

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat, role: role as RoleId, target: target ?? null, extra },
      };
      return handleSubmitAction(intent, handlerCtx);
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleAudioAck: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state) => {
      if (
        !state.isAudioPlaying &&
        (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
      ) {
        return { success: true, actions: [] };
      }
      return {
        success: true,
        actions: [
          { type: 'CLEAR_PENDING_AUDIO_EFFECTS' as const },
          { type: 'SET_AUDIO_PLAYING' as const, payload: { isPlaying: false } },
        ],
      };
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleAudioGate: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; isPlaying?: boolean };
  const { roomCode, isPlaying } = body;
  if (!roomCode || typeof isPlaying !== 'boolean') return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: SetAudioPlayingIntent = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying },
    };
    return handleSetAudioPlaying(intent, handlerCtx);
  });
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleEnd: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(env.DB, roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: EndNightIntent = { type: 'END_NIGHT' };
    const handlerResult = handleEndNight(intent, handlerCtx);
    if (!handlerResult.success) return handlerResult;

    const extraActions = extractAudioActions(handlerResult.sideEffects);
    if (extraActions.length > 0) {
      return { ...handlerResult, actions: [...handlerResult.actions, ...extraActions] };
    }
    return handlerResult;
  });
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleProgression: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state) => {
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      return { success: true, actions: [] };
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleRevealAck: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state) => {
      if (!state.pendingRevealAcks || state.pendingRevealAcks.length === 0) {
        return { success: false, reason: 'no_pending_acks', actions: [] };
      }
      return {
        success: true,
        actions: [{ type: 'CLEAR_REVEAL_ACKS' as const }],
        sideEffects: [{ type: 'BROADCAST_STATE' as const }],
      };
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleWolfRobotViewed: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; seat?: number };
  const { roomCode, seat } = body;
  if (!roomCode || !isValidSeat(seat)) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      return handleSetWolfRobotHunterStatusViewed(handlerCtx, {
        type: 'SET_WOLF_ROBOT_HUNTER_STATUS_VIEWED',
        seat,
      });
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleGroupConfirmAck: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string; seat?: number; uid?: string };
  const { roomCode, seat, uid } = body;
  if (!roomCode || !isValidSeat(seat) || !uid) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state: GameState) => {
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      const stepId = state.currentStepId;
      if (!stepId) return { success: false, reason: 'no_current_step', actions: [] };
      const schema = SCHEMAS[stepId as SchemaId];
      if (!schema || schema.kind !== 'groupConfirm') {
        return { success: false, reason: 'not_group_confirm_step', actions: [] };
      }
      const player = state.players[seat];
      if (!player) return { success: false, reason: 'no_player_at_seat', actions: [] };
      if (player.uid !== uid && uid !== state.hostUid) {
        return { success: false, reason: 'uid_mismatch', actions: [] };
      }

      const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
      const isCupidLoversReveal = stepId === 'cupidLoversReveal';
      const acks = isConversionReveal
        ? (state.conversionRevealAcks ?? [])
        : isCupidLoversReveal
          ? (state.cupidLoversRevealAcks ?? [])
          : (state.piperRevealAcks ?? []);
      if (acks.includes(seat)) return { success: true, actions: [] };

      const actions: StateAction[] = isConversionReveal
        ? [{ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat } }]
        : isCupidLoversReveal
          ? [{ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat } }]
          : [{ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat } }];

      return { success: true, actions };
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};

export const handleMarkBotsGroupConfirmed: HandlerFn = async (req, env) => {
  const body = (await req.json()) as { roomCode?: string };
  const { roomCode } = body;
  if (!roomCode) return missingParams(env);

  const result = await processGameAction(
    env.DB,
    roomCode,
    (state: GameState) => {
      if (!state.debugMode?.botsEnabled) {
        return { success: false, reason: 'debug_not_enabled', actions: [] };
      }
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      const stepId = state.currentStepId;
      if (!stepId) return { success: false, reason: 'no_current_step', actions: [] };
      const schema = SCHEMAS[stepId as SchemaId];
      if (!schema || schema.kind !== 'groupConfirm') {
        return { success: false, reason: 'not_group_confirm_step', actions: [] };
      }

      const isConversionReveal = stepId === 'awakenedGargoyleConvertReveal';
      const isCupidLoversReveal = stepId === 'cupidLoversReveal';
      const existingAcks = isConversionReveal
        ? (state.conversionRevealAcks ?? [])
        : isCupidLoversReveal
          ? (state.cupidLoversRevealAcks ?? [])
          : (state.piperRevealAcks ?? []);

      const actions: StateAction[] = [];
      for (const [seatStr, player] of Object.entries(state.players)) {
        if (!player?.isBot) continue;
        const seatNum = Number.parseInt(seatStr, 10);
        if (existingAcks.includes(seatNum)) continue;

        if (isConversionReveal) {
          actions.push({ type: 'ADD_CONVERSION_REVEAL_ACK', payload: { seat: seatNum } });
        } else if (isCupidLoversReveal) {
          actions.push({ type: 'ADD_CUPID_LOVERS_REVEAL_ACK', payload: { seat: seatNum } });
        } else {
          actions.push({ type: 'ADD_PIPER_REVEAL_ACK', payload: { seat: seatNum } });
        }
      }

      return { success: true, actions };
    },
    { enabled: true },
  );
  broadcastIfNeeded(env, roomCode, result);
  return jsonResponse(result, resultToStatus(result), env);
};
