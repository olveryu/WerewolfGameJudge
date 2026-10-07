/**
 * 阿瓦隆局内机器人接管入口（§8；D12：不做任何接管提示）。
 *
 * 房主专属的中性常驻浮钮，点开底部卡片后逐席位接管/释放。不用 <BotTakeover>
 *（它在接管中返回 null 且跑 urgency 逻辑）；直接复用共享 TakeoverFab +
 * TakeoverSheet，不自创视觉语言。isUrgent 恒为 false，永不脉冲。
 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import type React from 'react';
import { useState } from 'react';

import type { BotTakeoverBot } from '@/components/BotTakeover/BotTakeover';
import { TakeoverFab } from '@/components/BotTakeover/TakeoverFab';
import { TakeoverSheet } from '@/components/BotTakeover/TakeoverSheet';

interface AvalonTakeoverEntryProps {
  readonly isHost: boolean;
  readonly viewModel: AvalonViewModel;
  /** 当前接管中的机器人席位（未接管为 null）；D12 不做任何高亮。 */
  readonly controlledSeat: number | null;
  readonly onTakeOver: (seat: number) => void;
  readonly onRelease: () => void;
}

export const AvalonTakeoverEntry: React.FC<AvalonTakeoverEntryProps> = ({
  isHost,
  viewModel,
  controlledSeat,
  onTakeOver,
  onRelease,
}) => {
  const [sheetOpen, setSheetOpen] = useState(false);
  const bots: BotTakeoverBot[] = viewModel.seats
    .filter((seatView) => seatView.isBot)
    .map((seatView) => ({
      seat: seatView.seat,
      displayName: seatView.displayName,
      status: 'waiting' as const,
      statusLabel: '等待',
      actionLabel: seatView.seat === controlledSeat ? '停止代打' : '接管代打',
    }));
  if (!isHost || bots.length === 0) return null;

  const handleTakeOver = (seat: number) => {
    setSheetOpen(false);
    if (seat === controlledSeat) onRelease();
    else onTakeOver(seat);
  };

  return (
    <>
      <TakeoverFab botCount={bots.length} isUrgent={false} onPress={() => setSheetOpen(true)} />
      <TakeoverSheet
        visible={sheetOpen}
        bots={bots}
        activeSeat={null}
        onTakeOver={handleTakeOver}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
};
