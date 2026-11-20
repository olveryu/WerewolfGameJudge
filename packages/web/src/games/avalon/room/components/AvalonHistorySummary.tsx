/**
 * 对局摘要条：座位表上方常驻（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句；纯投影，无私密信息。
 */
import { RoomStatusSummary } from '@/features/room/components/RoomStatusSummary';
import { TESTIDS } from '@/testids';

/** 对局摘要条：进行中阶段附未提交座位行。 */
export function AvalonHistorySummary({
  status,
  latestResult,
  pendingSeats = null,
  pendingLabel = '未投票',
}: {
  readonly status: string;
  readonly latestResult: string | null;
  /** 未提交的座位（投票/任务进行中）；其余阶段为 null，不渲染第二行。 */
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: '未投票' | '未出牌';
}) {
  return (
    <RoomStatusSummary
      summary={status}
      detail={latestResult ?? undefined}
      pendingSeats={pendingSeats}
      pendingLabel={pendingLabel}
      action={null}
      testId={TESTIDS.avalonHistorySummary}
      pendingTestId={TESTIDS.avalonHistorySummaryPendingSeats}
    />
  );
}
