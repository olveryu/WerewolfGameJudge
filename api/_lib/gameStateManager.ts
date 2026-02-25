/**
 * Game State Manager — 通用"读-算-写"流程
 *
 * 所有 API Route 共享同一个处理模式：
 * 1. 从 DB 读 game_state + state_revision
 * 2. 调用 game-engine 纯函数处理 intent → ProcessResult
 * 3. 用 gameReducer 将 actions apply 到 state
 * 4. （可选）内联推进：evaluateProgression → advance/endNight 循环
 * 5. 用 state_revision 做乐观锁写回 DB
 *
 * 客户端通过 postgres_changes 单通道接收状态变更，无需服务端主动广播。
 * 负责 DB 读写与状态计算，不包含游戏逻辑校验（由 handler 纯函数负责）。
 */

import {
  gameReducer,
  type GameState,
  normalizeState,
  runInlineProgression,
} from '@werewolf/game-engine';

import { getDb, jsonb } from './db';
import type { GameActionResult, ProcessResult } from './types';

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
 * 通用的"读-算-写-广播"流程。
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
    const sql = getDb();
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      // Step 1: 读 DB（直连 Postgres，~5-15ms）
      const rows = await sql`
        SELECT game_state, state_revision
        FROM rooms
        WHERE code = ${roomCode}
        LIMIT 1
      `;

      if (rows.length === 0 || !rows[0].game_state) {
        return { success: false, reason: 'ROOM_NOT_FOUND' };
      }

      // postgres.js + Supavisor (prepare:false) 可能将 jsonb 作为字符串返回
      const rawState = rows[0].game_state;
      const currentState: GameState =
        typeof rawState === 'string' ? JSON.parse(rawState) : rawState;
      const currentRevision = (rows[0].state_revision as number) ?? 0;

      // Step 2: 调用 game-engine 纯函数
      const result = process(currentState, currentRevision);

      if (!result.success) {
        // Handler 逻辑拒绝 — 仍需 apply 附带 actions（如 ACTION_REJECTED）并写回 DB，
        // 这样客户端能通过 postgres_changes 收到拒绝通知（UI 读 gameState.actionRejected）。
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

      // No-op guard: skip DB write if nothing changed (avoids wasted writes + postgres_changes noise)
      if (totalActionsApplied === 0) {
        return {
          success: result.success,
          reason: result.reason,
          state: currentState,
          revision: currentRevision,
        };
      }

      newState = normalizeState(newState);

      // Step 4: 乐观锁写回 DB（直连 Postgres，~5-15ms）
      const writeRows = await sql`
        UPDATE rooms
        SET game_state = ${jsonb(newState)},
            state_revision = ${currentRevision + 1},
            updated_at = ${new Date().toISOString()}
        WHERE code = ${roomCode}
          AND state_revision = ${currentRevision}
        RETURNING state_revision
      `;

      if (writeRows.length === 0) {
        // 乐观锁冲突 → 重试（重新读 DB + 重新计算）
        if (attempt < MAX_RETRIES) {
          // 短暂退避，减少再次冲突概率
          await new Promise((r) => setTimeout(r, 50 * attempt));
          continue;
        }
        return { success: false, reason: 'CONFLICT_RETRY' };
      }

      // 客户端通过 postgres_changes 单通道接收 DB 变更，无需服务端主动广播
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
    // 所有未捕获异常兜底 — 返回 JSON 而非 Vercel 默认 500 HTML
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error('[processGameAction] Unhandled error:', message, err);
    // Strip error details in production to avoid leaking internals
    const isProd = globalThis.process?.env?.NODE_ENV === 'production';
    const error = isProd ? undefined : message;
    return { success: false, reason: 'INTERNAL_ERROR', error } as GameActionResult;
  }
}
