/**
 * broadcast — Durable Object 广播辅助
 *
 * 在 processGameAction 成功写入 D1 后，将新 state 推送给 DO，
 * 由 DO 分发到所有该房间的 WebSocket 客户端。
 * Fire-and-forget — 广播失败不阻塞 API 响应。
 */

import type { Env } from '../env';
import type { GameActionResult } from './gameStateManager';

/**
 * 若 result 包含有效 state + revision，通过 DO 广播给所有 WebSocket 客户端。
 * 同时检查 sideEffects 中是否包含 BROADCAST_STATE（仅有 BROADCAST_STATE 的 result 才广播）。
 */
export function broadcastIfNeeded(env: Env, roomCode: string, result: GameActionResult): void {
  if (!result.success || !result.state || result.revision == null) return;

  // Check for BROADCAST_STATE side effect
  const shouldBroadcast = result.sideEffects?.some((e) => e.type === 'BROADCAST_STATE') ?? true;

  if (!shouldBroadcast) return;

  // Fire-and-forget: don't await
  const id = env.GAME_ROOM.idFromName(roomCode);
  const stub = env.GAME_ROOM.get(id);
  stub
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
}
