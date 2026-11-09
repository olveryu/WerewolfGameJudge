/** 底部半屏卡片：按紧急度排序的机器人列表。 */

import { BottomSheet } from '@/components/BottomSheet';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import IconClose from '~icons/ion/close';

import type { BotTakeoverBot, BotTakeoverStatus } from './BotTakeover';

interface TakeoverSheetProps {
  readonly bots: readonly BotTakeoverBot[];
  readonly activeSeat: number | null;
  readonly onTakeOver: (seat: number) => void;
  readonly onClose: () => void;
}

const STATUS_ORDER: Record<BotTakeoverStatus, number> = { acting: 0, waiting: 1, done: 2 };

const STATUS_ICON: Record<BotTakeoverStatus, string> = {
  acting: '🔴',
  waiting: '⚪',
  done: '✅',
};

function sortBots(
  bots: readonly BotTakeoverBot[],
  activeSeat: number | null,
): readonly BotTakeoverBot[] {
  return [...bots].sort((a, b) => {
    // 当前行动者置顶
    if (a.seat === activeSeat) return -1;
    if (b.seat === activeSeat) return 1;
    return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  });
}

/** Lists the room's bots, current actor first, each with its take-over action. */
export function TakeoverSheet({ bots, activeSeat, onTakeOver, onClose }: TakeoverSheetProps) {
  return (
    <BottomSheet title="机器人接管" onClose={onClose}>
      <div className="bot-takeover-sheet">
        <div className="bot-takeover-sheet-header">
          <h2 className="bot-takeover-sheet-title">机器人接管</h2>
          <IconButton label="关闭" icon={<IconClose aria-hidden />} onClick={onClose} />
        </div>
        <ul className="bot-takeover-sheet-list">
          {sortBots(bots, activeSeat).map((bot) => (
            <li key={bot.seat} className="bot-takeover-sheet-row">
              <div className="bot-takeover-sheet-row-info">
                <p className="bot-takeover-sheet-row-title">
                  {STATUS_ICON[bot.status]} {bot.seat + 1}号位 · {bot.displayName}
                </p>
                <p className="bot-takeover-sheet-row-subtitle">{bot.statusLabel}</p>
              </div>
              {bot.status !== 'done' && (
                <Button variant="secondary" size="sm" onClick={() => onTakeOver(bot.seat)}>
                  {bot.actionLabel}
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </BottomSheet>
  );
}
