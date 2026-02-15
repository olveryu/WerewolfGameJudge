/**
 * Wolf Vote API Route — POST /api/game/night/wolf-vote
 *
 * 提交狼人投票（Host-only）。
 * 使用 game-engine handleSubmitWolfVote + decideWolfVoteTimerAction 纯函数。
 * 内联推进：投票后自动评估推进（受 wolfVoteDeadline gate 保护）。
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
  type SubmitWolfVoteIntent,
} from '@werewolf/game-engine';

import { handleCors } from '../../_lib/cors';
import { processGameAction } from '../../_lib/gameStateManager';
import type { WolfVoteRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as WolfVoteRequestBody;
  const { roomCode, hostUid, voterSeat, targetSeat } = body;

  if (!roomCode || !hostUid || voterSeat == null || targetSeat == null) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(
    roomCode,
    (state: BroadcastGameState) => {
      const isHost = state.hostUid === hostUid;
      const handlerCtx: HandlerContext = {
        state,
        isHost,
        myUid: hostUid,
        mySeat: findSeatByUid(state, hostUid),
      };
      const intent: SubmitWolfVoteIntent = {
        type: 'SUBMIT_WOLF_VOTE',
        payload: { seat: voterSeat, target: targetSeat },
      };
      const voteResult = handleSubmitWolfVote(intent, handlerCtx);
      if (!voteResult.success) return voteResult;

      // Apply vote actions locally to check timer decision
      // (processGameAction will also apply them, but we need intermediate state for timer calc)
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

      return {
        ...voteResult,
        actions,
      };
    },
    { enabled: true, hostUid },
  );

  return res.status(result.success ? 200 : 400).json(result);
}

function findSeatByUid(state: BroadcastGameState, uid: string): number | null {
  for (const [seatKey, player] of Object.entries(state.players)) {
    if (player?.uid === uid) return Number(seatKey);
  }
  return null;
}
