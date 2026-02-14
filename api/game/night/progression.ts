/**
 * Night Progression API Route — POST /api/game/night/progression
 *
 * 评估夜晚推进决策（Host-only）。
 * 使用 game-engine evaluateNightProgression 纯函数，不自动执行。
 * 返回 decision（'advance' | 'end_night' | 'none'）供客户端驱动推进循环。
 *
 * ✅ 允许：请求解析、调用 evaluator
 * ❌ 禁止：直接操作 DB 或 state、执行推进
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  type BroadcastGameState,
  createProgressionTracker,
  evaluateNightProgression,
} from '@werewolf/game-engine';

import { getServiceClient } from '../../_lib/supabase';
import type { ProgressionRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as ProgressionRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const supabase = getServiceClient();

  // 读 DB（只读，不写）
  const { data, error: readError } = await supabase
    .from('rooms')
    .select('game_state, state_revision')
    .eq('code', roomCode)
    .single();

  if (readError || !data?.game_state) {
    return res.status(400).json({ success: false, reason: 'ROOM_NOT_FOUND' });
  }

  const state = data.game_state as BroadcastGameState;
  const revision = (data.state_revision as number) ?? 0;
  const isHost = state.hostUid === hostUid;

  // 使用一次性 tracker（服务端无状态，不保留幂等 tracker）
  const tracker = createProgressionTracker();
  const decision = evaluateNightProgression(state, revision, tracker, isHost);

  return res.status(200).json({
    success: true,
    decision: decision.action,
    reason: decision.reason,
  });
}
