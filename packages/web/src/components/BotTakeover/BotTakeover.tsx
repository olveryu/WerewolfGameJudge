/**
 * 共用机器人接管 UI（2026 重设计）：无座位表的游戏统一（故事接龙等），防 drift。
 * 有座位表的游戏走长按座位接管。
 *
 * 平时隐形（浮钮），战时显形（强提醒 + 底部卡片）。
 */

import './BotTakeover.css';

import { useState } from 'react';

import IconGameControllerOutline from '~icons/ion/game-controller-outline';

import { TakeoverSheet } from './TakeoverSheet';

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

interface BotTakeoverProps {
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
}

const URGENT_SECONDS_THRESHOLD = 30;

/**
 * urgent 条件（同时满足）：有行动席位、行动者是机器人、没人接管、剩余时间 < 30s
 * （无倒计时则不升级）。
 */
function isTakeoverUrgent({
  bots,
  activeSeat,
  remainingSeconds,
  controlledSeat,
}: Pick<BotTakeoverProps, 'bots' | 'activeSeat' | 'remainingSeconds' | 'controlledSeat'>): boolean {
  if (activeSeat === null || controlledSeat !== null) return false;
  if (!bots.some((bot) => bot.seat === activeSeat)) return false;
  return remainingSeconds !== null && remainingSeconds < URGENT_SECONDS_THRESHOLD;
}

/**
 * 机器人接管统一入口。
 *
 * 显示逻辑：
 * - 非房主 / 无机器人 / 大厅 → 不显示（大厅用座位长按）
 * - 接管中 → 由 RoomShell 的接管横幅显示，这里不重复
 * - 其他 → 右下角浮钮（点开底部卡片）
 */
export function BotTakeover(props: BotTakeoverProps) {
  const { bots, activeSeat, controlledSeat, canControl, isLobby, onTakeOver } = props;
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  if (!canControl || bots.length === 0 || isLobby) return null;
  if (controlledSeat !== null) return null;
  const isUrgent = isTakeoverUrgent(props);
  const handleTakeOver = (seat: number) => {
    setIsSheetOpen(false);
    onTakeOver(seat);
  };
  return (
    <>
      <button
        type="button"
        className="bot-takeover-fab"
        data-urgent={isUrgent || undefined}
        aria-label={
          isUrgent
            ? `机器人需要接管，有 ${bots.length} 个机器人`
            : `机器人接管，有 ${bots.length} 个机器人`
        }
        onClick={() => setIsSheetOpen(true)}
      >
        <IconGameControllerOutline aria-hidden />
        <span className="bot-takeover-fab-badge" aria-hidden>
          {isUrgent ? '!' : String(bots.length)}
        </span>
      </button>
      {isSheetOpen && (
        <TakeoverSheet
          bots={bots}
          activeSeat={activeSeat}
          onTakeOver={handleTakeOver}
          onClose={() => setIsSheetOpen(false)}
        />
      )}
    </>
  );
}
