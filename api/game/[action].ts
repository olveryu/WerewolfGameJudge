/**
 * Game Action Catch-All API Route — POST /api/game/[action]
 *
 * 将所有游戏控制 API 子路由合并到一个 serverless function 中，
 * 共享同一实例 + 同一 postgres 连接池，消除跨 route 冷启动。
 * 根据 [action] path parameter 分派到对应的处理逻辑。
 *
 * 支持的 action：
 *   assign, clear-seats, fill-bots, mark-bots-viewed, restart,
 *   seat, set-animation, share-review, start, update-template, view-role
 *
 * 负责请求解析与分派到对应 handler，不直接操作 DB / state，不播放音频。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type AudioEffect,
  type BroadcastGameState,
  handleAssignRoles,
  handleClearAllSeats,
  handleFillWithBots,
  handleJoinSeat,
  handleLeaveMySeat,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetRoleRevealAnimation,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
  handleViewedRole,
  type JoinSeatIntent,
  type LeaveMySeatIntent,
  type StateAction,
} from '@werewolf/game-engine';

import { handleCors } from '../_lib/cors';
import { broadcastViaRest, processGameAction } from '../_lib/gameStateManager';
import { buildHandlerContext } from '../_lib/handlerContext';
import { resultToStatus } from '../_lib/responseStatus';
import type {
  AssignRequestBody,
  ClearSeatsRequestBody,
  FillBotsRequestBody,
  MarkBotsViewedRequestBody,
  RestartRequestBody,
  SeatRequestBody,
  SetAnimationRequestBody,
  ShareReviewRequestBody,
  StartRequestBody,
  UpdateTemplateRequestBody,
  ViewRoleRequestBody,
} from '../_lib/types';

// ---------------------------------------------------------------------------
// Sub-route handlers
// ---------------------------------------------------------------------------

async function handleAssign(req: VercelRequest, res: VercelResponse) {
  const body = req.body as AssignRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleAssignRoles({ type: 'ASSIGN_ROLES' }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleFillBots(req: VercelRequest, res: VercelResponse) {
  const body = req.body as FillBotsRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleFillWithBots({ type: 'FILL_WITH_BOTS' }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleMarkBotsViewed(req: VercelRequest, res: VercelResponse) {
  const body = req.body as MarkBotsViewedRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleMarkAllBotsViewed({ type: 'MARK_ALL_BOTS_VIEWED' }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleClearSeats(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ClearSeatsRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleClearAllSeats({ type: 'CLEAR_ALL_SEATS' }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleRestart(req: VercelRequest, res: VercelResponse) {
  const body = req.body as RestartRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleRestartGame({ type: 'RESTART_GAME' }, handlerCtx);
  });

  // 广播 GAME_RESTARTED 通知 Player（仅在验证通过后，fire-and-forget）
  if (result.success) {
    broadcastViaRest(roomCode, { type: 'GAME_RESTARTED' }).catch(() => {
      /* non-blocking */
    });
  }

  return res.status(resultToStatus(result)).json(result);
}

async function handleSeat(req: VercelRequest, res: VercelResponse) {
  const body = req.body as SeatRequestBody;
  const { roomCode, action, uid, seat, displayName, avatarUrl } = body;

  if (!roomCode || !uid || !action) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  if (action !== 'sit' && action !== 'standup') {
    return res.status(400).json({ success: false, reason: 'INVALID_ACTION' });
  }

  if (action === 'sit' && (seat == null || typeof seat !== 'number')) {
    return res.status(400).json({ success: false, reason: 'MISSING_SEAT' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    if (action === 'sit') {
      const intent: JoinSeatIntent = {
        type: 'JOIN_SEAT',
        payload: { seat: seat!, uid, displayName: displayName ?? '', avatarUrl },
      };
      return handleJoinSeat(intent, handlerCtx);
    } else {
      const intent: LeaveMySeatIntent = {
        type: 'LEAVE_MY_SEAT',
        payload: { uid },
      };
      return handleLeaveMySeat(intent, handlerCtx);
    }
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleSetAnimation(req: VercelRequest, res: VercelResponse) {
  const body = req.body as SetAnimationRequestBody;
  const { roomCode, hostUid, animation } = body;

  if (!roomCode || !hostUid || !animation) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleSetRoleRevealAnimation(
      { type: 'SET_ROLE_REVEAL_ANIMATION', animation },
      handlerCtx,
    );
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleStart(req: VercelRequest, res: VercelResponse) {
  const body = req.body as StartRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    const handlerResult = handleStartNight({ type: 'START_NIGHT' }, handlerCtx);
    if (!handlerResult.success) return handlerResult;

    const audioEffects: AudioEffect[] = (handlerResult.sideEffects ?? [])
      .filter(
        (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
          e.type === 'PLAY_AUDIO',
      )
      .map((e) => ({ audioKey: e.audioKey, isEndAudio: e.isEndAudio }));

    if (audioEffects.length > 0) {
      const extraActions: StateAction[] = [
        { type: 'SET_PENDING_AUDIO_EFFECTS', payload: { effects: audioEffects } },
        { type: 'SET_AUDIO_PLAYING', payload: { isPlaying: true } },
      ];
      return {
        ...handlerResult,
        actions: [...handlerResult.actions, ...extraActions],
      };
    }

    return handlerResult;
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleUpdateTemplateRoute(req: VercelRequest, res: VercelResponse) {
  const body = req.body as UpdateTemplateRequestBody;
  const { roomCode, hostUid, templateRoles } = body;

  if (!roomCode || !hostUid || !templateRoles || !Array.isArray(templateRoles)) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleUpdateTemplate(
      { type: 'UPDATE_TEMPLATE', payload: { templateRoles } },
      handlerCtx,
    );
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleViewRole(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ViewRoleRequestBody;
  const { roomCode, uid, seat } = body;

  if (!roomCode || !uid || typeof seat !== 'number') {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, uid);
    return handleViewedRole({ type: 'VIEWED_ROLE', payload: { seat } }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

async function handleShareReview(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ShareReviewRequestBody;
  const { roomCode, hostUid, allowedSeats } = body;

  if (!roomCode || !hostUid || !Array.isArray(allowedSeats)) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: BroadcastGameState) => {
    const handlerCtx = buildHandlerContext(state, hostUid);
    return handleShareNightReview({ type: 'SHARE_NIGHT_REVIEW', allowedSeats }, handlerCtx);
  });
  return res.status(resultToStatus(result)).json(result);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const ROUTE_MAP: Record<
  string,
  (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse | void>
> = {
  assign: handleAssign,
  'clear-seats': handleClearSeats,
  'fill-bots': handleFillBots,
  'mark-bots-viewed': handleMarkBotsViewed,
  restart: handleRestart,
  seat: handleSeat,
  'set-animation': handleSetAnimation,
  'share-review': handleShareReview,
  start: handleStart,
  'update-template': handleUpdateTemplateRoute,
  'view-role': handleViewRole,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const actionName = req.query.action;
  if (typeof actionName !== 'string' || !ROUTE_MAP[actionName]) {
    return res.status(404).json({ success: false, reason: 'UNKNOWN_ACTION' });
  }

  return ROUTE_MAP[actionName](req, res);
}
