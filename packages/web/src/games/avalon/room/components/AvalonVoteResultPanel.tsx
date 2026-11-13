/**
 * 阿瓦隆投票结算面板（设计稿 §7 412 行）：全员可见的投票结论展示。
 *
 * 结论横幅（组队通过 / 组队被否决·第 N 次）+ 公投逐人投票（座位号·名字·赞成/反对/弃权）/
 * 暗投仅汇总数量。所有真人确认后进入下一阶段。
 */
import type {
  AvalonBallot,
  AvalonLastVoteResultView,
  AvalonSeatView,
} from '@game-judge/game-engine/games/avalon/public';

import { TESTIDS } from '@/testids';

import { AvalonResultDialog } from './AvalonResultDialog';

const BALLOT_LABEL: Record<AvalonBallot, string> = {
  approve: '赞成',
  reject: '反对',
};

interface AvalonVoteResultPanelProps {
  readonly result: AvalonLastVoteResultView;
  readonly seats: readonly AvalonSeatView[];
  readonly confirmedSeats: readonly number[];
  readonly mySeat: number | null;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => void;
}

/** 投票结算面板，展示确认进度并等待全员确认。 */
export function AvalonVoteResultPanel({
  result,
  seats,
  confirmedSeats,
  mySeat,
  isSubmitting,
  onConfirm,
}: AvalonVoteResultPanelProps) {
  const orderedSeats = [...seats].sort((a, b) => a.seat - b.seat);
  const pendingSeats = orderedSeats.filter((seat) => !confirmedSeats.includes(seat.seat));
  const banner = result.approved ? '组队通过' : `组队被否决·第 ${result.rejectStreak} 次`;
  return (
    <AvalonResultDialog
      banner={banner}
      outcome={result.approved ? 'positive' : 'negative'}
      kind="vote"
      onClose={onConfirm}
      confirmation={{
        confirmed: mySeat !== null && confirmedSeats.includes(mySeat),
        disabled: mySeat === null || isSubmitting,
        spectator: mySeat === null,
        onConfirm,
      }}
    >
      <p
        className="avalon-result-summary"
        data-testid={
          result.ballots === null ? TESTIDS.avalonVoteResultCounts : TESTIDS.avalonVoteResultSummary
        }
      >
        {result.ballots !== null && '汇总：'}赞成 {result.approveCount} · 反对 {result.rejectCount}{' '}
        · 弃权 {result.abstainCount}
      </p>
      {result.ballots !== null && (
        <section className="avalon-vote-details" aria-label="投票明细">
          <p className="avalon-vote-section-title">投票明细</p>
          <ul className="avalon-result-list">
            {orderedSeats.map((seatView) => {
              const ballot = result.ballots?.[seatView.seat];
              return (
                <li
                  key={seatView.seat}
                  className="avalon-result-row"
                  data-ballot={ballot ?? 'abstain'}
                  data-testid={TESTIDS.avalonVoteResultRow(seatView.seat)}
                >
                  <span className="avalon-vote-seat">
                    {seatView.seat + 1}
                    <span className="visually-hidden">号</span>
                  </span>{' '}
                  <span className="avalon-vote-name">{seatView.displayName}</span>{' '}
                  <span className="avalon-vote-separator" aria-hidden="true">
                    ·
                  </span>{' '}
                  <span className="avalon-vote-ballot">
                    {ballot === undefined ? '弃权' : BALLOT_LABEL[ballot]}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div
        className="avalon-result-confirmation"
        aria-live="polite"
        data-testid={TESTIDS.avalonVoteResultConfirmation}
      >
        <p>
          已确认 {seats.length - pendingSeats.length} / {seats.length}
        </p>
        <progress
          className="avalon-vote-progress"
          aria-label="确认进度"
          value={seats.length - pendingSeats.length}
          max={Math.max(seats.length, 1)}
        />
        <p>
          {pendingSeats.length > 0
            ? `等待：${pendingSeats.map((seat) => `${seat.seat + 1}号`).join('、')}`
            : '全员已确认'}
        </p>
      </div>
      <p className="avalon-vote-hint">全员确认后继续</p>
    </AvalonResultDialog>
  );
}
