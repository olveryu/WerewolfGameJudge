/**
 * 阿瓦隆投票结算面板（设计稿 §7 412 行）：全员可见的投票结论展示。
 *
 * 结论横幅（组队通过 / 组队被否决·第 N 次）+ 公投逐人投票（座位号·名字·赞成/反对/弃权）/
 * 暗投仅汇总数量。6 秒自动关闭，也可手动点"知道了"关闭；展示后游戏自动进入下一阶段。
 */
import type {
  AvalonBallot,
  AvalonLastVoteResultView,
  AvalonSeatView,
} from '@game-judge/game-engine/games/avalon/public';

import { AvalonResultDialog } from './AvalonResultDialog';

const BALLOT_LABEL: Record<AvalonBallot, string> = {
  approve: '赞成',
  reject: '反对',
};

interface AvalonVoteResultPanelProps {
  readonly result: AvalonLastVoteResultView;
  readonly seats: readonly AvalonSeatView[];
  readonly onClose: () => void;
}

function seatLabel(seat: number, name: string): string {
  return `${seat + 1} 号 · ${name}`;
}

/** 投票结算面板；挂载即开始 6 秒倒计时，到时或手动"知道了"都走 onClose。 */
export function AvalonVoteResultPanel({ result, seats, onClose }: AvalonVoteResultPanelProps) {
  const orderedSeats = [...seats].sort((a, b) => a.seat - b.seat);
  const banner = result.approved ? '组队通过' : `组队被否决·第 ${result.rejectStreak} 次`;
  return (
    <AvalonResultDialog
      banner={banner}
      outcome={result.approved ? 'positive' : 'negative'}
      testIdPrefix="avalon-vote-result"
      onClose={onClose}
    >
      {result.ballots === null ? (
        <p className="avalon-result-summary" data-testid="avalon-vote-result-counts">
          赞成 {result.approveCount} · 反对 {result.rejectCount} · 弃权 {result.abstainCount}
        </p>
      ) : (
        <>
          <ul className="avalon-result-list">
            {orderedSeats.map((seatView) => {
              const ballot = result.ballots?.[seatView.seat];
              return (
                <li
                  key={seatView.seat}
                  className="avalon-result-row"
                  data-testid={`avalon-vote-result-row-${seatView.seat}`}
                >
                  {seatLabel(seatView.seat, seatView.displayName)} ·{' '}
                  {ballot === undefined ? '弃权' : BALLOT_LABEL[ballot]}
                </li>
              );
            })}
          </ul>
          <p className="avalon-result-summary">
            汇总：赞成 {result.approveCount} · 反对 {result.rejectCount} · 弃权{' '}
            {result.abstainCount}
          </p>
        </>
      )}
    </AvalonResultDialog>
  );
}
