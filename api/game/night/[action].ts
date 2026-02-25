/**
 * Night Action Catch-All API Route — POST /api/game/night/[action]
 *
 * 将所有夜晚 API 子路由合并到一个 serverless function 中，
 * 以满足 Vercel Hobby 计划的 12 函数限制。
 * 根据 [action] path parameter 分派到对应的处理逻辑。
 *
 * 支持的 action：
 *   action, audio-ack, audio-gate, end, progression,
 *   reveal-ack, wolf-robot-viewed, wolf-vote
 *
 * 负责请求解析与分派到对应 handler，不直接操作 DB / state，不播放音频。
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  decideWolfVoteTimerAction,
  type EndNightIntent,
  gameReducer,
  type GameState,
  GameStatus,
  handleEndNight,
  handleSetAudioPlaying,
  handleSetWolfRobotHunterStatusViewed,
  handleSubmitAction,
  handleSubmitWolfVote,
  isWolfVoteAllComplete,
  type SetAudioPlayingIntent,
  type SubmitActionIntent,
  type SubmitWolfVoteIntent,
} from '@werewolf/game-engine';

import { handleCors } from '../../_lib/cors';
import { processGameAction } from '../../_lib/gameStateManager';
import { buildHandlerContext } from '../../_lib/handlerContext';
import { resultToStatus } from '../../_lib/responseStatus';
import type {
  ActionRequestBody,
  AudioGateRequestBody,
  WolfRobotViewedRequestBody,
  WolfVoteRequestBody,
} from '../../_lib/types';

// ---------------------------------------------------------------------------
// Sub-route handlers
// ---------------------------------------------------------------------------

async function handleAction(req: VercelRequest, res: VercelResponse) {
  const body = req.body as ActionRequestBody;
  const { roomCode, seat, role, target, extra } = body;

  if (!roomCode || typeof seat !== 'number' || !role) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      const intent: SubmitActionIntent = {
        type: 'SUBMIT_ACTION',
        payload: { seat, role, target, extra },
      };
      return handleSubmitAction(intent, handlerCtx);
    },
    { enabled: true },
  );

  return res.status(resultToStatus(result)).json(result);
}

async function handleAudioAck(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      // Guard: no-op if audio is already not playing and no pending effects
      if (
        !state.isAudioPlaying &&
        (!state.pendingAudioEffects || state.pendingAudioEffects.length === 0)
      ) {
        return { success: false, reason: 'no_audio_playing', actions: [] };
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

  return res.status(resultToStatus(result)).json(result);
}

async function handleAudioGate(req: VercelRequest, res: VercelResponse) {
  const body = req.body as AudioGateRequestBody;
  const { roomCode, isPlaying } = body;

  if (!roomCode || typeof isPlaying !== 'boolean') {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: SetAudioPlayingIntent = {
      type: 'SET_AUDIO_PLAYING',
      payload: { isPlaying },
    };
    return handleSetAudioPlaying(intent, handlerCtx);
  });

  return res.status(resultToStatus(result)).json(result);
}

async function handleEnd(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state: GameState) => {
    const handlerCtx = buildHandlerContext(state, state.hostUid);
    const intent: EndNightIntent = { type: 'END_NIGHT' };
    return handleEndNight(intent, handlerCtx);
  });

  return res.status(resultToStatus(result)).json(result);
}

async function handleProgression(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state) => {
      if (state.status !== GameStatus.Ongoing) {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }
      return { success: true, actions: [] };
    },
    { enabled: true },
  );

  return res.status(resultToStatus(result)).json(result);
}

async function handleRevealAck(req: VercelRequest, res: VercelResponse) {
  const body = req.body as { roomCode?: string };
  const { roomCode } = body;

  if (!roomCode) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
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

  return res.status(resultToStatus(result)).json(result);
}

async function handleWolfRobotViewed(req: VercelRequest, res: VercelResponse) {
  const body = req.body as WolfRobotViewedRequestBody;
  const { roomCode, seat } = body;

  if (!roomCode || typeof seat !== 'number') {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
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

  return res.status(resultToStatus(result)).json(result);
}

async function handleWolfVote(req: VercelRequest, res: VercelResponse) {
  const body = req.body as WolfVoteRequestBody;
  const { roomCode, voterSeat, targetSeat } = body;

  if (!roomCode || typeof voterSeat !== 'number' || typeof targetSeat !== 'number') {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state: GameState) => {
      const handlerCtx = buildHandlerContext(state, state.hostUid);
      const intent: SubmitWolfVoteIntent = {
        type: 'SUBMIT_WOLF_VOTE',
        payload: { seat: voterSeat, target: targetSeat },
      };
      const voteResult = handleSubmitWolfVote(intent, handlerCtx);
      if (!voteResult.success) return voteResult;

      // Apply vote actions locally to check timer decision
      let tempState = state;
      for (const action of voteResult.actions) {
        tempState = gameReducer(tempState, action);
      }

      // Wolf vote timer decision (based on post-vote state)
      const allVoted = isWolfVoteAllComplete(tempState);
      const hasExistingTimer = tempState.wolfVoteDeadline != null;
      const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

      // Add timer actions to the result
      const actions = [...voteResult.actions];
      if (timerAction.type === 'set') {
        actions.push({
          type: 'SET_WOLF_VOTE_DEADLINE' as const,
          payload: { deadline: timerAction.deadline },
        });
      } else if (timerAction.type === 'clear') {
        actions.push({ type: 'CLEAR_WOLF_VOTE_DEADLINE' as const });
      }

      return { ...voteResult, actions };
    },
    { enabled: true },
  );

  return res.status(resultToStatus(result)).json(result);
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

const ROUTE_MAP: Record<
  string,
  (req: VercelRequest, res: VercelResponse) => Promise<VercelResponse | void>
> = {
  action: handleAction,
  'audio-ack': handleAudioAck,
  'audio-gate': handleAudioGate,
  end: handleEnd,
  progression: handleProgression,
  'reveal-ack': handleRevealAck,
  'wolf-robot-viewed': handleWolfRobotViewed,
  'wolf-vote': handleWolfVote,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const actionName = req.query.action;
  if (typeof actionName !== 'string' || !ROUTE_MAP[actionName]) {
    return res.status(404).json({ success: false, reason: 'UNKNOWN_NIGHT_ACTION' });
  }

  return ROUTE_MAP[actionName](req, res);
}
