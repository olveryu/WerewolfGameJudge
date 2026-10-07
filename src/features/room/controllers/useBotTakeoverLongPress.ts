/**
 * 有座位游戏共用的机器人接管长按处理（2026-10-07）。
 *
 * 统一模式：长按机器人座位 → 已接管则释放，否则接管。
 * 各游戏只需提供"是否为 bot 座位"的判断函数。
 *
 * Werewolf 用 interaction policy dispatcher，不用这个（更复杂）。
 */

import { useCallback } from 'react';

import type { RoomBotControl } from './useRoomBotControl';

export interface BotTakeoverLongPressOptions {
  /** 当前接管的座位。 */
  readonly controlledSeat: number | null;
  /** 接管/释放操作。 */
  readonly takeOver: RoomBotControl['takeOver'];
  readonly release: RoomBotControl['release'];
  /** 是否允许接管。 */
  readonly canTakeOver: boolean;
  /** 判断指定座位是否为机器人。游戏各自实现。 */
  readonly isBotSeat: (seat: number) => boolean;
  /** 游戏名，用于错误信息。 */
  readonly gameName: string;
}

/**
 * 返回统一的长按处理函数。
 * 非 bot 座位 fail-fast；已接管则释放，否则接管。
 */
export function useBotTakeoverLongPress(
  options: BotTakeoverLongPressOptions,
): (seat: number) => void {
  const { controlledSeat, takeOver, release, canTakeOver, isBotSeat, gameName } = options;
  return useCallback(
    (seat: number) => {
      if (!isBotSeat(seat)) {
        throw new Error(`[FAIL-FAST] ${gameName} bot takeover received non-bot seat ${seat}`);
      }
      if (controlledSeat === seat) {
        release();
        return;
      }
      if (!canTakeOver) {
        throw new Error(`[FAIL-FAST] ${gameName} bot takeover not allowed`);
      }
      takeOver(seat);
    },
    [controlledSeat, takeOver, release, canTakeOver, isBotSeat, gameName],
  );
}
