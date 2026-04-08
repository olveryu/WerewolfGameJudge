/**
 * Game State Manager — D1 版"读-算-写"流程
 *
 * 与 Edge Functions 的 gameStateManager.ts 逻辑完全一致：
 * 1. 从 D1 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → ProcessResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. （可选）内联推进：runInlineProgression 循环
 * 5. 用 state_revision 做乐观锁写回 D1
 *
 * 使用 D1 prepared statements 替代 PostgREST HTTP API。
 */

import type { SideEffect } from '@werewolf/game-engine/engine/handlers/types';
import { runInlineProgression } from '@werewolf/game-engine/engine/inlineProgression';
import { gameReducer } from '@werewolf/game-engine/engine/reducer/gameReducer';
import type { StateAction } from '@werewolf/game-engine/engine/reducer/types';
import { normalizeState } from '@werewolf/game-engine/engine/state/normalize';
import type { GameState } from '@werewolf/game-engine/protocol/types';

/** processGameAction 回调的返回值 */
interface ProcessResult {
  success: boolean;
  reason?: string;
  actions: StateAction[];
  sideEffects?: readonly SideEffect[];
}

/** processGameAction 的最终返回值 */
export interface GameActionResult {
  success: boolean;
  reason?: string;
  state?: GameState;
  revision?: number;
  sideEffects?: readonly SideEffect[];
}

interface InlineProgressionOptions {
  enabled: boolean;
  nowMs?: number;
}

/**
 * 通用的"读-算-写"流程（D1 版）。
 *
 * @param db D1Database binding
 * @param roomCode 4 位房间号
 * @param process 接收当前 state 和 revision，返回 handler 计算结果
 * @param inlineProgression 可选的内联推进选项
 */
export async function processGameAction(
  db: D1Database,
  roomCode: string,
  process: (state: GameState, revision: number) => ProcessResult,
  inlineProgression?: InlineProgressionOptions,
): Promise<GameActionResult> {
  try {
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Step 1: 读 D1
      const row = await db
        .prepare('SELECT game_state, state_revision FROM rooms WHERE code = ?')
        .bind(roomCode)
        .first<{ game_state: string; state_revision: number }>();

      if (!row?.game_state) {
        return { success: false, reason: 'ROOM_NOT_FOUND' };
      }

      const currentState: GameState = JSON.parse(row.game_state);
      const currentRevision = row.state_revision ?? 0;

      // Step 2: 调用 game-engine 纯函数
      const result = process(currentState, currentRevision);

      if (!result.success) {
        return { success: false, reason: result.reason };
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

      // No-op guard
      if (totalActionsApplied === 0) {
        return {
          success: result.success,
          reason: result.reason,
          state: currentState,
          revision: currentRevision,
        };
      }

      newState = normalizeState(newState);

      // Step 4: 乐观锁写回 D1
      const writeResult = await db
        .prepare(
          `UPDATE rooms
           SET game_state = ?, state_revision = ?, updated_at = datetime('now')
           WHERE code = ? AND state_revision = ?`,
        )
        .bind(JSON.stringify(newState), currentRevision + 1, roomCode, currentRevision)
        .run();

      if (!writeResult.meta.changes || writeResult.meta.changes === 0) {
        // 乐观锁冲突 → 重试
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

    return { success: false, reason: 'CONFLICT_RETRY' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[processGameAction] Unhandled error:', message, err);
    return { success: false, reason: 'INTERNAL_ERROR' };
  }
}
