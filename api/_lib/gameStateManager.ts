/**
 * Game State Manager — 通用"读-算-写-广播"流程
 *
 * 所有 API Route 共享同一个处理模式：
 * 1. 从 DB 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → ProcessResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. 用 state_revision 做乐观锁写回 DB
 * 5. 通过 Supabase Realtime 广播新状态
 *
 * ✅ 允许：DB 读写、状态计算、Realtime 广播
 * ❌ 禁止：游戏逻辑校验（由 handler 纯函数负责）
 */

import { type BroadcastGameState, gameReducer, normalizeState } from '@werewolf/game-engine';

import { getServiceClient } from './supabase';
import type { GameActionResult, ProcessResult } from './types';

/**
 * 通用的"读-算-写-广播"流程。
 *
 * @param roomCode 4 位房间号
 * @param process  接收当前 state 和 revision，返回 handler 计算结果
 * @returns 操作结果（含新 state）
 */
export async function processGameAction(
  roomCode: string,
  process: (state: BroadcastGameState, revision: number) => ProcessResult,
): Promise<GameActionResult> {
  const supabase = getServiceClient();

  // Step 1: 读 DB
  const { data, error: readError } = await supabase
    .from('rooms')
    .select('game_state, state_revision')
    .eq('code', roomCode)
    .single();

  if (readError || !data?.game_state) {
    return { success: false, reason: 'ROOM_NOT_FOUND' };
  }

  const currentState = data.game_state as BroadcastGameState;
  const currentRevision = (data.state_revision as number) ?? 0;

  // Step 2: 调用 game-engine 纯函数
  const result = process(currentState, currentRevision);

  if (!result.success) {
    return { success: false, reason: result.reason };
  }

  // Step 3: apply actions → 新 state
  let newState = currentState;
  for (const action of result.actions) {
    newState = gameReducer(newState, action);
  }
  newState = normalizeState(newState);

  // Step 4: 乐观锁写回 DB
  const { data: writeData, error: writeError } = await supabase
    .from('rooms')
    .update({
      game_state: newState,
      state_revision: currentRevision + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('code', roomCode)
    .eq('state_revision', currentRevision) // 乐观锁
    .select('state_revision')
    .single();

  if (writeError || !writeData) {
    return { success: false, reason: 'CONFLICT_RETRY' };
  }

  // Step 5: 广播 STATE_UPDATE
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

  return { success: true, state: newState };
}
