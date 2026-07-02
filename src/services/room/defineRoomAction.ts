/**
 * defineRoomAction — declarative HTTP action helper for room-like game facades.
 *
 * Used by non-werewolf engines that dispatch through game-specific HTTP routes
 * while still sharing result/error handling.
 */

import { cfPost } from '@/services/cloudflare/cfFetch';
import { facadeLog } from '@/utils/logger';

export interface RoomActionResult {
  success: boolean;
  reason?: string;
}

export interface RoomActionContext {
  getRoomCode(): string;
}

interface RoomActionDef<TArgs extends unknown[]> {
  name: string;
  path: string;
  body?: (...args: TArgs) => Record<string, unknown>;
}

export function defineRoomAction<TArgs extends unknown[]>(
  def: RoomActionDef<TArgs>,
): (ctx: RoomActionContext, ...args: TArgs) => Promise<RoomActionResult> {
  return async (ctx: RoomActionContext, ...args: TArgs): Promise<RoomActionResult> => {
    const roomCode = ctx.getRoomCode();
    const requestBody = { roomCode, ...(def.body?.(...args) ?? {}) };

    try {
      await cfPost(def.path, requestBody);
      return { success: true };
    } catch (err) {
      const reason = hasReason(err) ? String(err.reason) : 'REQUEST_FAILED';
      facadeLog.warn('room action failed', { name: def.name, path: def.path, reason });
      return { success: false, reason };
    }
  };
}

function hasReason(err: unknown): err is { reason: unknown } {
  return typeof err === 'object' && err !== null && 'reason' in err;
}
