/** 紧急度计算：机器人该行动但没人接管时升级为强提醒。 */

import { useMemo } from 'react';

import type { BotTakeoverBot } from './BotTakeover';

export type TakeoverUrgency = 'idle' | 'urgent';

const URGENT_SECONDS_THRESHOLD = 30;

interface UseTakeoverUrgencyInput {
  readonly bots: readonly BotTakeoverBot[];
  readonly activeSeat: number | null;
  readonly remainingSeconds: number | null;
  readonly controlledSeat: number | null;
}

/**
 * 计算是否需要强提醒。
 *
 * urgent 条件（同时满足）：
 * - 有行动席位（activeSeat !== null）
 * - 行动者是机器人
 * - 没人接管（controlledSeat === null）
 * - 剩余时间 < 30s（无倒计时则不触发时间条件）
 */
export function useTakeoverUrgency({
  bots,
  activeSeat,
  remainingSeconds,
  controlledSeat,
}: UseTakeoverUrgencyInput): TakeoverUrgency {
  return useMemo(() => {
    if (activeSeat === null || controlledSeat !== null) return 'idle';
    const isBot = bots.some((b) => b.seat === activeSeat);
    if (!isBot) return 'idle';
    if (remainingSeconds !== null && remainingSeconds < URGENT_SECONDS_THRESHOLD) return 'urgent';
    return 'idle';
  }, [bots, activeSeat, remainingSeconds, controlledSeat]);
}
