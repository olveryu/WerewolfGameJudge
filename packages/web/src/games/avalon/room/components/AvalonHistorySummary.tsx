/**
 * 对局摘要条：座位表上方常驻（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句；纯投影，无私密信息。
 */
import type { ReactNode } from 'react';

import { RoomCompactStatus } from '@/features/room/components/RoomCompactStatus';
import { TESTIDS } from '@/testids';
import IconCheckboxOutline from '~icons/ion/checkbox-outline';
import IconTimeOutline from '~icons/ion/time-outline';

/** 对局摘要条：进行中阶段附未提交座位行。 */
export function AvalonHistorySummary({
  latestResult,
  tracks = null,
  pendingSeats = null,
  pendingLabel = '未投票',
  compact,
}: {
  readonly latestResult: string | null;
  readonly tracks?: ReactNode;
  /** 未提交的座位（投票/任务进行中）；其余阶段为 null，不渲染第二行。 */
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: '未投票' | '未出牌';
  readonly compact: {
    readonly context: string | null;
    readonly message: string | null;
    readonly progress: string | null;
    readonly isVoting: boolean;
  };
}) {
  return (
    <div data-testid={TESTIDS.avalonHistorySummary}>
      <RoomCompactStatus
        context={compact.context}
        message={compact.message}
        progress={compact.progress}
        pendingSeats={pendingSeats}
        pendingLabel={pendingLabel}
        pendingTestId={TESTIDS.avalonHistorySummaryPendingSeats}
        messageTestId={compact.progress === null ? TESTIDS.actionMessage : undefined}
        progressTestId={compact.progress !== null ? TESTIDS.actionMessage : undefined}
        icon={
          compact.isVoting ? <IconCheckboxOutline aria-hidden /> : <IconTimeOutline aria-hidden />
        }
      />
      {(tracks !== null || latestResult !== null) && (
        <div className="room-compact-status-tracks">
          {tracks}
          {latestResult !== null && <p className="room-compact-status-result">{latestResult}</p>}
        </div>
      )}
    </div>
  );
}
