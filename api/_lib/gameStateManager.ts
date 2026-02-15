/**
 * Game State Manager — 通用"读-算-写-广播"流程
 *
 * 所有 API Route 共享同一个处理模式：
 * 1. 从 DB 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → ProcessResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. （可选）内联推进：evaluateProgression → advance/endNight 循环
 * 5. 用 state_revision 做乐观锁写回 DB
 * 6. 通过 Supabase Realtime 广播新状态
 *
 * ✅ 允许：DB 读写、状态计算、Realtime 广播
 * ❌ 禁止：游戏逻辑校验（由 handler 纯函数负责）
 */

import {
  type BroadcastGameState,
  gameReducer,
  normalizeState,
  runInlineProgression,
} from '@werewolf/game-engine';

import { getServiceClient } from './supabase';
import type { GameActionResult, ProcessResult } from './types';

/**
 * 内联推进选项
 */
export interface InlineProgressionOptions {
  /** 启用内联推进（action 处理后自动 evaluate + advance/endNight） */
  enabled: boolean;
  /** Host UID（用于构建 HandlerContext） */
  hostUid: string;
  /** 当前时间戳（用于 wolfVoteDeadline 检查，默认 Date.now()） */
  nowMs?: number;
}

/**
 * 通用的"读-算-写-广播"流程。
 *
 * @param roomCode 4 位房间号
 * @param process  接收当前 state 和 revision，返回 handler 计算结果
 * @param inlineProgression 可选的内联推进选项
 * @returns 操作结果（含新 state）
 */
export async function processGameAction(
  roomCode: string,
  process: (state: BroadcastGameState, revision: number) => ProcessResult,
  inlineProgression?: InlineProgressionOptions,
): Promise<GameActionResult> {
  const supabase = getServiceClient();
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
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
      // Handler 逻辑失败不重试
      return { success: false, reason: result.reason };
    }

    // Step 3: apply actions → 新 state
    let newState = currentState;
    for (const action of result.actions) {
      newState = gameReducer(newState, action);
    }

    // Step 3.5: 内联推进（可选）
    if (inlineProgression?.enabled) {
      const progressionResult = runInlineProgression(
        newState,
        inlineProgression.hostUid,
        inlineProgression.nowMs,
      );
      for (const action of progressionResult.actions) {
        newState = gameReducer(newState, action);
      }
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
      // 乐观锁冲突 → 重试（重新读 DB + 重新计算）
      if (attempt < MAX_RETRIES) {
        // 短暂退避，减少再次冲突概率
        await new Promise((r) => setTimeout(r, 50 * attempt));
        continue;
      }
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

    return { success: true, state: newState, sideEffects: result.sideEffects };
  }

  // TypeScript exhaustiveness — 不应到达此处
  return { success: false, reason: 'CONFLICT_RETRY' };
}
