/**
 * 对局摘要条：座位表上方常驻（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句，行尾「对局记录 ›」是打开对局记录浮层的唯一入口。
 * 整条可点；纯投影，无私密信息。
 */
import './AvalonRecord.css';

import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';

/** 对局摘要条：整条是打开对局记录的按钮，进行中阶段附未提交座位行。 */
export function AvalonHistorySummary({
  summary,
  pendingSeats = null,
  pendingLabel = '未投票',
  onOpenHistory,
}: {
  readonly summary: string;
  /** 未提交的座位（投票/任务进行中）；其余阶段为 null，不渲染第二行。 */
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: '未投票' | '未出牌';
  readonly onOpenHistory: () => void;
}) {
  return (
    <button
      type="button"
      className="avalon-history-summary"
      aria-label="对局记录"
      data-testid="avalon-history-summary"
      onClick={onOpenHistory}
    >
      <span className="avalon-history-summary-row">
        <span className="avalon-history-summary-text">{summary}</span>
        <span className="avalon-history-summary-entry">对局记录 ›</span>
      </span>
      {pendingSeats !== null && (
        <PendingSeatsRow
          label={pendingLabel}
          seats={pendingSeats}
          testId="avalon-history-summary-pending-seats"
        />
      )}
    </button>
  );
}
