/**
 * 对局摘要：座位表上方唯一状态条的内容（入口按狼人杀口径）——最新结算结论或
 * 当前轮次状态一句，附任务轨道；纯投影，无私密信息。
 */
import type { ReactElement } from 'react';

import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';
import { TESTIDS } from '@/testids';
import IconCheckboxOutline from '~icons/ion/checkbox-outline';
import IconTimeOutline from '~icons/ion/time-outline';

/** 对局摘要状态：进行中阶段附未提交座位行，轨道与最新结论放在同一状态条内。 */
export function buildAvalonBoardStatus({
  latestResult,
  tracks = null,
  pendingSeats = null,
  pendingLabel = '未投票',
  compact,
}: {
  readonly latestResult: string | null;
  readonly tracks?: ReactElement | null;
  /** 未提交的座位（投票/任务进行中）；其余阶段为 null，不渲染第二行。 */
  readonly pendingSeats?: readonly number[] | null;
  readonly pendingLabel?: '未投票' | '未出牌';
  readonly compact: {
    readonly context: string | null;
    readonly message: string | null;
    readonly progress: string | null;
    readonly isVoting: boolean;
  };
}): RoomBoardStatusModel {
  return {
    context: compact.context,
    message: compact.message,
    progress: compact.progress,
    pendingSeats:
      pendingSeats === null
        ? null
        : {
            seats: pendingSeats,
            label: pendingLabel,
            testId: TESTIDS.avalonHistorySummaryPendingSeats,
          },
    icon: compact.isVoting ? <IconCheckboxOutline aria-hidden /> : <IconTimeOutline aria-hidden />,
    attachment:
      tracks === null && latestResult === null ? null : (
        <>
          {tracks}
          {latestResult !== null && <p className="room-compact-status-result">{latestResult}</p>}
        </>
      ),
    testId: TESTIDS.avalonHistorySummary,
  };
}
