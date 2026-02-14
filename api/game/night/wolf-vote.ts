/**
 * Wolf Vote API Route — POST /api/game/night/wolf-vote
 *
 * 提交狼人投票（Host-only）。
 * 使用 game-engine handleSubmitWolfVote + decideWolfVoteTimerAction 纯函数。
 * 返回 wolfVoteTimer 指令供客户端管理本地 timer。
 *
 * ✅ 允许：请求解析、调用 handler + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state、管理 timer
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  decideWolfVoteTimerAction,
  gameReducer,
  type HandlerContext,
  handleSubmitWolfVote,
  isWolfVoteAllComplete,
  normalizeState,
  type SubmitWolfVoteIntent,
} from '@werewolf/game-engine';

import { getServiceClient } from '../../_lib/supabase';
import type { WolfVoteRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as WolfVoteRequestBody;
  const { roomCode, hostUid, voterSeat, targetSeat } = body;

  if (!roomCode || !hostUid || voterSeat == null || targetSeat == null) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const supabase = getServiceClient();

  // Step 1: 读 DB
  const { data, error: readError } = await supabase
    .from('rooms')
    .select('game_state, state_revision')
    .eq('code', roomCode)
    .single();

  if (readError || !data?.game_state) {
    return res.status(400).json({ success: false, reason: 'ROOM_NOT_FOUND' });
  }

  const currentState = data.game_state as BroadcastGameState;
  const currentRevision = (data.state_revision as number) ?? 0;

  // Step 2: 调用 handler
  const isHost = currentState.hostUid === hostUid;
  const handlerCtx: HandlerContext = {
    state: currentState,
    isHost,
    myUid: hostUid,
    mySeat: findSeatByUid(currentState, hostUid),
  };
  const intent: SubmitWolfVoteIntent = {
    type: 'SUBMIT_WOLF_VOTE',
    payload: { seat: voterSeat, target: targetSeat },
  };
  const result = handleSubmitWolfVote(intent, handlerCtx);

  // Step 3: apply actions → 新 state
  let newState = currentState;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
  }

  // Step 4: wolf vote timer 决策（基于新 state）
  const allVoted = isWolfVoteAllComplete(newState);
  const hasExistingTimer = newState.wolfVoteDeadline != null;
  const timerAction = decideWolfVoteTimerAction(allVoted, hasExistingTimer, Date.now());

  // Apply timer action to state
  if (timerAction.type === 'set') {
    newState = gameReducer(newState, {
      type: 'SET_WOLF_VOTE_DEADLINE',
      payload: { deadline: timerAction.deadline },
    });
  } else if (timerAction.type === 'clear') {
    newState = gameReducer(newState, { type: 'CLEAR_WOLF_VOTE_DEADLINE' });
  }

  newState = normalizeState(newState);

  // Step 5: 乐观锁写回 DB
  const { data: writeData, error: writeError } = await supabase
    .from('rooms')
    .update({
      game_state: newState,
      state_revision: currentRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('code', roomCode)
    .eq('state_revision', currentRevision)
    .select('state_revision')
    .single();

  if (writeError || !writeData) {
    return res.status(409).json({ success: false, reason: 'CONFLICT_RETRY' });
  }

  // Step 6: 广播 STATE_UPDATE
  const channel = supabase.channel(`room:${roomCode}`);
  await channel.send({
    type: 'broadcast',
    event: 'host',
    payload: {
      type: 'STATE_UPDATE',
      state: newState,
      revision: currentRevision + 1,
    },
  });
  await supabase.removeChannel(channel);

  return res.status(result.success ? 200 : 400).json({
    success: result.success,
    reason: result.reason,
    state: newState,
    sideEffects: result.sideEffects,
    wolfVoteTimer: timerAction.type,
  });
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
