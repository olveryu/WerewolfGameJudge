/**
 * broadcast — Durable Object 广播辅助
 *
 * 在 processGameAction 成功写入 D1 后，将新 state 推送给 DO，
 * 由 DO 分发到所有该房间的 WebSocket 客户端。
 * 使用 ctx.waitUntil 确保广播在 Response 返回后仍能完成。
 */

import type { Env } from '../env';
import type { GameActionResult } from './gameStateManager';

/**
 * 若 result 包含有效 state + revision，通过 DO 广播给所有 WebSocket 客户端。
 * 同时检查 sideEffects 中是否包含 BROADCAST_STATE（仅有 BROADCAST_STATE 的 result 才广播）。
 */
export function broadcastIfNeeded(
  env: Env,
  roomCode: string,
  result: GameActionResult,
  ctx: ExecutionContext,
): void {
  // Don't gate on result.success — business rejections (e.g. ACTION_REJECTED)
  // carry state + revision + BROADCAST_STATE and must reach WebSocket clients.
  if (!result.state || result.revision == null) return;

  // Check for BROADCAST_STATE side effect
  const shouldBroadcast = result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;

  if (!shouldBroadcast) return;

  const id = env.GAME_ROOM.idFromName(roomCode);
  const stub = env.GAME_ROOM.get(id);
  const broadcastPromise = stub
    .fetch(
      new Request('https://do/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state: result.state,
          revision: result.revision,
          roomCode,
        }),
      }),
    )
    .catch((err) => {
      console.error('[broadcast] DO broadcast failed:', err);
    });

  ctx.waitUntil(broadcastPromise);
}
