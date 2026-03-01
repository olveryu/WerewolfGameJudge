/**
 * Game State Manager — 通用"读-算-写"流程 (Edge Function 版)
 *
 * 从 api/_lib/gameStateManager.ts 移植，核心逻辑完全一致：
 * 1. 从 DB 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → ProcessResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. （可选）内联推进：runInlineProgression 循环
 * 5. 用 state_revision 做乐观锁写回 DB
 *
 * 使用 supabase-js（PostgREST HTTP API）替代 postgres.js 直连，
 * 彻底消除 Supabase Free tier 连接池耗尽问题。
 */

import {
  gameReducer,
  type GameState,
  normalizeState,
  runInlineProgression,
} from '../_shared/game-engine/index.js';

import { supabaseAdmin } from './supabaseAdmin.ts';
import type { GameActionResult, ProcessResult } from './types.ts';

/**
 * 内联推进选项
 */
interface InlineProgressionOptions {
  /** 启用内联推进（action 处理后自动 evaluate + advance/endNight） */
  enabled: boolean;
  /** 当前时间戳（用于 wolfVoteDeadline 检查，默认 Date.now()） */
  nowMs?: number;
}

/**
 * 通用的"读-算-写"流程。
 *
 * @param roomCode 4 位房间号
 * @param process  接收当前 state 和 revision，返回 handler 计算结果
 * @param inlineProgression 可选的内联推进选项
 * @returns 操作结果（含新 state）
 */
export async function processGameAction(
  roomCode: string,
  process: (state: GameState, revision: number) => ProcessResult,
  inlineProgression?: InlineProgressionOptions,
): Promise<GameActionResult> {
  try {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Step 1: 读 DB（PostgREST HTTP，无持久连接）
      const { data: row, error: readError } = await supabaseAdmin
        .from('rooms')
        .select('game_state, state_revision')
        .eq('code', roomCode)
        .single();

      if (readError || !row?.game_state) {
        return { success: false, reason: 'ROOM_NOT_FOUND' };
      }

      const currentState: GameState = row.game_state as GameState;
      const currentRevision = (row.state_revision as number) ?? 0;

      // Step 2: 调用 game-engine 纯函数
      const result = process(currentState, currentRevision);

      if (!result.success) {
        // Handler 逻辑拒绝 — 仍需 apply 附带 actions（如 ACTION_REJECTED）并写回 DB，
        // 这样客户端能通过 postgres_changes 收到拒绝通知。
        // 无 actions 时直接返回，不写 DB。
        if (!result.actions || result.actions.length === 0) {
          return { success: false, reason: result.reason };
        }
        // Fall through: apply actions → write DB → return failure with sideEffects
      }

      // Step 3: apply actions → 新 state
      let newState = currentState;
      let totalActionsApplied = 0;
      for (const action of result.actions) {
        newState = gameReducer(newState, action);
        totalActionsApplied++;
      }

      // Step 3.5: 内联推进（可选）
      if (inlineProgression?.enabled) {
        const progressionResult = runInlineProgression(
          newState,
          newState.hostUid,
          inlineProgression.nowMs,
        );
        for (const action of progressionResult.actions) {
          newState = gameReducer(newState, action);
          totalActionsApplied++;
        }
      }

      // No-op guard: skip DB write if nothing changed
      if (totalActionsApplied === 0) {
        return {
          success: result.success,
          reason: result.reason,
          state: currentState,
          revision: currentRevision,
        };
      }

      newState = normalizeState(newState);

      // Step 4: 乐观锁写回 DB（PostgREST HTTP，无持久连接）
      // .eq('state_revision', currentRevision) 确保只有当前 revision 才能写入。
      // 无匹配行时 data 为空数组 — 等效于 SQL RETURNING 0 行。
      const { data: writeRows, error: writeError } = await supabaseAdmin
        .from('rooms')
        .update({
          game_state: newState,
          state_revision: currentRevision + 1,
          updated_at: new Date().toISOString(),
        })
        .eq('code', roomCode)
        .eq('state_revision', currentRevision)
        .select('state_revision');

      if (writeError) {
        console.error('[processGameAction] DB write error:', writeError.message);
        return {
          success: false,
          reason: 'INTERNAL_ERROR',
          error: writeError.message,
        } as GameActionResult;
      }

      if (!writeRows || writeRows.length === 0) {
        // 乐观锁冲突 → 重试（重新读 DB + 重新计算）
        if (attempt < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        return { success: false, reason: 'CONFLICT_RETRY' };
      }

      return {
        success: result.success,
        reason: result.reason,
        state: newState,
        revision: currentRevision + 1,
        sideEffects: result.sideEffects,
      };
    }

    // TypeScript exhaustiveness — 不应到达此处
    return { success: false, reason: 'CONFLICT_RETRY' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[processGameAction] Unhandled error:', message, err);
    // Always include error message for debugging — Edge Functions are internal,
    // not publicly browseable. Error visibility is critical for CI diagnosis.
    return { success: false, reason: 'INTERNAL_ERROR', error: message } as GameActionResult;
  }
}
