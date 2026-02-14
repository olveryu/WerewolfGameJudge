/**
 * Reveal ACK API Route — POST /api/game/night/reveal-ack
 *
 * 清除 pendingRevealAcks，解除推进阻断（Host-only）。
 * 直接使用 CLEAR_REVEAL_ACKS reducer action + gameStateManager。
 *
 * ✅ 允许：请求解析、reducer action + gameStateManager
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { processGameAction } from '../../_lib/gameStateManager';
import type { RevealAckRequestBody } from '../../_lib/types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, reason: 'METHOD_NOT_ALLOWED' });
  }

  const body = req.body as RevealAckRequestBody;
  const { roomCode, hostUid } = body;

  if (!roomCode || !hostUid) {
    return res.status(400).json({ success: false, reason: 'MISSING_PARAMS' });
  }

  const result = await processGameAction(roomCode, (state) => {
    // Gate: host_only
    if (state.hostUid !== hostUid) {
      return { success: false, reason: 'host_only', actions: [] };
    }

    // Gate: must have pending reveal acks
    if (!state.pendingRevealAcks || state.pendingRevealAcks.length === 0) {
      return { success: false, reason: 'no_pending_acks', actions: [] };
    }

    return {
      success: true,
      actions: [{ type: 'CLEAR_REVEAL_ACKS' as const }],
      sideEffects: [{ type: 'BROADCAST_STATE' as const }],
    };
  });

  return res.status(result.success ? 200 : 400).json(result);
}
