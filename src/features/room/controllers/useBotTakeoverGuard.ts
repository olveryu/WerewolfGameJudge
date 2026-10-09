/**
 * useBotTakeoverGuard - 共享的机器人接管生命周期守卫（七个游戏统一接入）。
 *
 * 接管规则只有一条（用户裁决）：只要有机器人座位，房主随时可以接管，
 * 不设阶段等任何其它条件。释放守卫是这条规则的安全不变量——客户端不得
 * 持有已经失去资格的座位控制权。已接管座位在以下任一情况成立时自动释放：
 * - 不再是房主（canControlBots 为 false）；
 * - 被接管座位不再是机器人座位（seatStillBot 为 false）：机器人被踢出、
 *   座位被清空等。
 *
 * 各游戏只提供策略输入：canControlBots（是否仍是房主）与 seatStillBot
 * （本游戏引擎的机器人座位判定）。不许另写一份保持条件，更不许手写等价
 * effect。
 *
 * 消费者（七家全量）：狼人杀 useWerewolfRoom、阿瓦隆 useAvalonRoomState、
 * 瞎掰王 useFibRoomScreenState、卧底 useUndercoverRoster、你画我猜
 * usePictionaryRoomScreenState、故事接龙 useStoryRelayRoomState、
 * drawguess useDrawGuessRoomState。
 * 有座位表的游戏（含狼人杀）长按入口统一走 useBotTakeoverLongPress；
 * 无座位表的游戏走 BotTakeover 菜单/浮钮。入口形态不同，守卫规则同一。
 */

import { useEffect } from 'react';

export interface BotTakeoverGuardOptions {
  /** Currently controlled seat, null if none. */
  readonly controlledSeat: number | null;
  /** 是否仍是房主（接管是房主权限，失去房主身份即释放）。 */
  readonly canControlBots: boolean;
  /** 被接管座位仍是机器人座位时为 true；当前无接管时传 true。 */
  readonly seatStillBot: boolean;
  /** Release function. */
  readonly release: () => void;
}

/**
 * Auto-releases the controlled seat when control is no longer legitimate.
 * Must be called unconditionally at the top level of the room state hook.
 */
export function useBotTakeoverGuard({
  controlledSeat,
  canControlBots,
  seatStillBot,
  release,
}: BotTakeoverGuardOptions): void {
  useEffect(() => {
    if (controlledSeat !== null && (!canControlBots || !seatStillBot)) {
      // Fail-safe release: without this, a stale controlledSeat would keep
      // acting as a seat the user no longer has the right to control.
      release();
    }
  }, [controlledSeat, canControlBots, seatStillBot, release]);
}
