/**
 * 共用机器人接管 UI（2026 重设计）：5 游戏统一，防 drift。
 *
 * 平时隐形（浮钮），战时显形（强提醒 + 底部卡片）。
 * 有座位表场景用长按（RoomShell），无座位表场景用浮钮，双入口接同一套回调。
 */

import type React from 'react';
import { useState } from 'react';

import { TakeoverFab } from './TakeoverFab';
import { TakeoverSheet } from './TakeoverSheet';
import { useTakeoverUrgency } from './useTakeoverUrgency';

export type BotTakeoverStatus = 'acting' | 'waiting' | 'done';

export interface BotTakeoverBot {
  readonly seat: number;
  readonly displayName: string;
  readonly status: BotTakeoverStatus;
  /** 状态描述，如 "正在作画 · 剩余 45s" */
  readonly statusLabel: string;
  /** 接管按钮文案，如 "接管代画" / "接管" */
  readonly actionLabel: string;
}

export interface BotTakeoverProps {
  /** 机器人列表 */
  readonly bots: readonly BotTakeoverBot[];
  /** 当前行动席位（无座位表场景的关键；无行动者时传 null） */
  readonly activeSeat: number | null;
  /** 剩余秒数（用于紧急度判断；无倒计时传 null） */
  readonly remainingSeconds: number | null;
  /** 当前接管的席位（未接管为 null） */
  readonly controlledSeat: number | null;
  /** 只有房主能接管 */
  readonly canControl: boolean;
  /** 是否在大厅（大厅用长按，不显示浮钮） */
  readonly isLobby: boolean;
  readonly onTakeOver: (seat: number) => void;
  readonly onRelease: () => void;
}

/**
 * 机器人接管统一入口。
 *
 * 显示逻辑：
 * - 非房主 / 无机器人 / 大厅 → 不显示（大厅用座位长按）
 * - 接管中 → 顶部细条
 * - 其他 → 右下角浮钮（点开底部卡片）
 */
export const BotTakeover: React.FC<BotTakeoverProps> = (props) => {
  const { bots, activeSeat, remainingSeconds, controlledSeat, canControl, isLobby } = props;
  const [sheetOpen, setSheetOpen] = useState(false);

  const urgency = useTakeoverUrgency({ bots, activeSeat, remainingSeconds, controlledSeat });

  if (!canControl || bots.length === 0 || isLobby) return null;

  // 接管中由 RoomShell 的 ControlledSeatBanner 显示，这里不重复
  if (controlledSeat !== null) return null;

  const handleTakeOver = (seat: number) => {
    setSheetOpen(false);
    props.onTakeOver(seat);
  };

  return (
    <>
      <TakeoverFab
        botCount={bots.length}
        isUrgent={urgency === 'urgent'}
        onPress={() => setSheetOpen(true)}
      />
      <TakeoverSheet
        visible={sheetOpen}
        bots={bots}
        activeSeat={activeSeat}
        onTakeOver={handleTakeOver}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
};
