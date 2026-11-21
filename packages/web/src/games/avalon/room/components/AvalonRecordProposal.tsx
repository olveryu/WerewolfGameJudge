/**
 * 阿瓦隆对局记录共享件：已结算提案块。
 *
 * 不许另写第二份提案渲染；票数文案走记录口径（avalonRecordCopy），与
 * 本局复盘文档同源。暗投时 ballots 为 null：被采用卡直接给静态
 * 说明；被否决行不渲染“展开逐人票”切换（展开也只能看到同一句说明，
 * 切换本身就是误导），直接给静态说明。
 */
import './AvalonRecord.css';

import type {
  AvalonBallot,
  AvalonProposalRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import { useState } from 'react';

import { SeatDot } from '@/components/SeatDot';
import IconCheckmark from '~icons/ion/checkmark';
import IconChevronDown from '~icons/ion/chevron-down';
import IconChevronUp from '~icons/ion/chevron-up';
import IconClose from '~icons/ion/close';

import { formatAvalonVoteTally } from '../avalonRecordCopy';

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
}

function BallotChips({
  ballots,
  testIdPrefix,
}: {
  readonly ballots: Readonly<Record<number, AvalonBallot>>;
  readonly testIdPrefix: string;
}) {
  const entries = Object.entries(ballots)
    .map(([seatText, ballot]) => ({ seat: Number(seatText), ballot }))
    .sort((left, right) => left.seat - right.seat);
  return (
    <ul className="avalon-ballot-chips" aria-label="逐人投票">
      {entries.map(({ seat, ballot }) => (
        <li
          key={seat}
          className="avalon-ballot-chip"
          data-ballot={ballot}
          aria-label={`${seat + 1}号，${ballotLabel(ballot)}`}
          data-testid={`${testIdPrefix}-ballot-seat-${seat + 1}`}
        >
          <SeatDot seat={seat} size="sm" />
          {ballot === 'approve' ? <IconCheckmark aria-hidden /> : <IconClose aria-hidden />}
        </li>
      ))}
    </ul>
  );
}

function VoteRatioBar({ proposal }: { readonly proposal: AvalonProposalRecordView }) {
  const totalCount = proposal.approveCount + proposal.rejectCount + proposal.abstainCount;
  const segments = [
    ['approve', proposal.approveCount],
    ['reject', proposal.rejectCount],
    ['abstain', proposal.abstainCount],
  ] as const;
  return (
    <>
      <div className="avalon-vote-bar" role="img" aria-label="表决比例">
        {segments.map(([kind, count]) =>
          count > 0 ? (
            <span
              key={kind}
              className="avalon-vote-bar-segment"
              data-kind={kind}
              style={{ flexGrow: count }}
            />
          ) : null,
        )}
        {totalCount === 0 && <span className="avalon-vote-bar-segment" />}
      </div>
      <div className="avalon-vote-counts">
        <span className="avalon-vote-count">
          赞成 <strong>{proposal.approveCount}</strong>
        </span>
        {proposal.abstainCount > 0 && (
          <span className="avalon-vote-count">
            弃权 <strong>{proposal.abstainCount}</strong>
          </span>
        )}
        <span className="avalon-vote-count">
          反对 <strong>{proposal.rejectCount}</strong>
        </span>
      </div>
    </>
  );
}

function LeaderDot({
  proposal,
  testIdPrefix,
}: {
  readonly proposal: AvalonProposalRecordView;
  readonly testIdPrefix: string;
}) {
  return (
    <SeatDot
      seat={proposal.leaderSeat}
      emphasis="leader"
      stateLabel="组队者"
      testId={`${testIdPrefix}-leader-seat-${proposal.leaderSeat + 1}`}
    />
  );
}

/** 被否决提案的摘要行内容：组队者、小队伍、票数、否决徽章（toggle 与静态行共用）。 */
function RejectedSummary({
  proposal,
  index,
  testIdPrefix,
}: {
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
  readonly testIdPrefix: string;
}) {
  return (
    <>
      <LeaderDot proposal={proposal} testIdPrefix={testIdPrefix} />
      <span className="avalon-rejected-summary">
        <span className="avalon-rejected-title">
          {proposal.leaderSeat + 1} 号 · 组队者 · 第 {index + 1} 次提议
        </span>
        <span className="avalon-rejected-meta">
          <span className="avalon-mini-team" data-testid={`${testIdPrefix}-team`}>
            {proposal.teamSeats.map((seat) => (
              <SeatDot
                key={seat}
                seat={seat}
                size="sm"
                testId={`${testIdPrefix}-team-seat-${seat + 1}`}
              />
            ))}
          </span>
          <span className="avalon-vote-count">{formatAvalonVoteTally(proposal)}</span>
        </span>
      </span>
      <span className="avalon-rejected-badge">否决</span>
    </>
  );
}

/** 已结算提案：被采用者完整展开；被否决者默认只保留一行摘要。 */
export function AvalonRecordProposal({
  round,
  proposal,
  index,
  testIdPrefix,
}: {
  readonly round: number;
  readonly proposal: AvalonProposalRecordView;
  readonly index: number;
  readonly testIdPrefix?: string;
}) {
  const [isExpanded, setExpanded] = useState(false);
  const prefix = testIdPrefix ?? `avalon-history-proposal-${round}-${index + 1}`;

  if (proposal.approved) {
    return (
      <article className="avalon-adopted-proposal" data-testid={prefix}>
        <div className="avalon-proposer-row">
          <LeaderDot proposal={proposal} testIdPrefix={prefix} />
          <span className="avalon-proposer-text">
            <strong>{proposal.leaderSeat + 1} 号</strong>
            <span className="avalon-proposer-meta"> · 组队者 · 第 {index + 1} 次提议</span>
          </span>
          <span className="avalon-adopted-badge">通过 · 采用</span>
        </div>
        <div className="avalon-team-row" data-testid={`${prefix}-team`}>
          <span className="avalon-team-label">队伍</span>
          {proposal.teamSeats.map((seat) => (
            <SeatDot
              key={seat}
              seat={seat}
              emphasis="filled"
              testId={`${prefix}-team-seat-${seat + 1}`}
            />
          ))}
        </div>
        <VoteRatioBar proposal={proposal} />
        {proposal.ballots === null ? (
          <p className="avalon-secret-note">暗投模式不公布逐人票</p>
        ) : (
          <BallotChips ballots={proposal.ballots} testIdPrefix={prefix} />
        )}
      </article>
    );
  }

  // 暗投被否决：没有可展开的逐人票，不渲染切换，只给静态说明。
  if (proposal.ballots === null) {
    return (
      <article className="avalon-rejected-proposal" data-testid={prefix}>
        <div className="avalon-rejected-header">
          <RejectedSummary proposal={proposal} index={index} testIdPrefix={prefix} />
        </div>
        <div className="avalon-rejected-details">
          <p className="avalon-secret-note">暗投模式不公布逐人票</p>
        </div>
      </article>
    );
  }

  return (
    <article className="avalon-rejected-proposal" data-testid={prefix}>
      <button
        type="button"
        className="avalon-rejected-header"
        aria-expanded={isExpanded}
        aria-label={`展开第${index + 1}次提案的逐人票`}
        data-testid={`${prefix}-toggle`}
        onClick={() => setExpanded((current) => !current)}
      >
        <RejectedSummary proposal={proposal} index={index} testIdPrefix={prefix} />
        {isExpanded ? (
          <IconChevronUp className="avalon-rejected-chevron" aria-hidden />
        ) : (
          <IconChevronDown className="avalon-rejected-chevron" aria-hidden />
        )}
      </button>
      {isExpanded && (
        <div className="avalon-rejected-details">
          <BallotChips ballots={proposal.ballots} testIdPrefix={prefix} />
        </div>
      )}
    </article>
  );
}
