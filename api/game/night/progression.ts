/**
 * Night Progression API Route — POST /api/game/night/progression
 *
 * 执行服务端内联推进（Host-only）。
 * 主要用于 wolf vote deadline 到期时客户端触发推进。
 * 使用 processGameAction + inlineProgression 执行。
 *
 * ✅ 允许：请求解析、内联推进执行
 * ❌ 禁止：直接操作 DB 或 state
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { processGameAction } from '../../_lib/gameStateManager';
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

  // No-op process: no actions to apply, inline progression does the work
  const result = await processGameAction(
    roomCode,
    (state) => {
      // Gate: host_only
      if (state.hostUid !== hostUid) {
        return { success: false, reason: 'host_only', actions: [] };
      }

      // Gate: must be ongoing
      if (state.status !== 'ongoing') {
        return { success: false, reason: 'not_ongoing', actions: [] };
      }

      // Return success with no actions — inline progression handles the rest
      return {
        success: true,
        actions: [],
      };
    },
    { enabled: true, hostUid },
  );

  return res.status(result.success ? 200 : 400).json(result);
}
