/**
 * 阿瓦隆对局记录共享件：一轮记录（结论横幅 + 提案时间线 + 湖仙节）。
 *
 * 横幅状态由本件统一推导：已结算轮给成功 / 失败；否决终局轮给组队失败；
 * 终局时仍在记录里的未结算轮给“未完成（提前刺杀打断）”，不许再写成
 * “组队投票中”——6532 的任务三就是被这句误导成“进行中”。终局文案走
 * 记录口径（avalonRecordCopy），与本局复盘文档同源。
 */
import './AvalonRecord.css';

import type {
  AvalonBallot,
  AvalonLadyCheckRecordView,
  AvalonRoundRecordView,
} from '@game-judge/game-engine/games/avalon/public';
import type { ReactElement } from 'react';

import { formatPendingSeats } from '@/features/room/components/PendingSeatsRow';
import IconCheckmark from '~icons/ion/checkmark';
import IconClose from '~icons/ion/close';
import IconHourglassOutline from '~icons/ion/hourglass-outline';
import IconPeopleOutline from '~icons/ion/people-outline';

import {
  AVALON_INTERRUPTED_LABEL,
  AVALON_INTERRUPTED_NOTE,
  AVALON_QUEST_CARD_LABELS,
  AVALON_QUEST_RESULT_LABELS,
  AVALON_VETO_ENDED_LABEL,
  formatAvalonVetoEndedNote,
} from '../avalonRecordCopy';
import { formatAvalonQuestLabel } from '../policy/avalonInteractionPolicy';
import { AvalonRecordLakeSection } from './AvalonRecordLakeSection';
import { AvalonRecordProposal } from './AvalonRecordProposal';

function ballotLabel(ballot: AvalonBallot): string {
  return ballot === 'approve' ? '赞成' : '反对';
}

function QuestCard({
  label,
  count,
  kind,
}: {
  readonly label: string;
  readonly count: number;
  readonly kind: 'success' | 'fail';
}) {
  return (
    <div
      className="avalon-quest-card"
      data-kind={kind}
      data-empty={count === 0}
      role="group"
      aria-label={`${label} ${count} 张`}
    >
      <span className="avalon-quest-card-count">×{count}</span>
      <span className="avalon-quest-card-label">{label}</span>
    </div>
  );
}

type BannerTone = 'success' | 'fail' | 'active';

function AvalonQuestBanner({
  record,
  ended,
  testIdPrefix,
}: {
  readonly record: AvalonRoundRecordView;
  readonly ended: boolean;
  readonly testIdPrefix: string;
}) {
  const questLabel = formatAvalonQuestLabel(record.round);
  let icon: ReactElement = <IconPeopleOutline aria-hidden />;
  let title = `${questLabel} · 组队投票中`;
  let subtitle =
    record.currentProposal !== null
      ? `第${record.proposals.length + 1}次提案进行中`
      : `第${record.proposals.length + 1}次提案组队中`;
  let tone: BannerTone = 'active';

  if (record.quest !== null) {
    const isSuccess = record.quest.result === 'success';
    icon = isSuccess ? <IconCheckmark aria-hidden /> : <IconClose aria-hidden />;
    title = `${questLabel} · ${AVALON_QUEST_RESULT_LABELS[record.quest.result]}`;
    subtitle = '任务出牌结果（出了什么牌不公开）';
    tone = isSuccess ? 'success' : 'fail';
  } else if (record.vetoEnded) {
    icon = <IconClose aria-hidden />;
    title = AVALON_VETO_ENDED_LABEL;
    subtitle = formatAvalonVetoEndedNote(record.proposals.length);
    tone = 'fail';
  } else if (ended) {
    // 否决终局轮已在上一分支处理；走到这里的终局未结算轮只能是被刺杀打断。
    icon = <IconClose aria-hidden />;
    title = `${questLabel} · ${AVALON_INTERRUPTED_LABEL}`;
    subtitle = AVALON_INTERRUPTED_NOTE;
  } else if (record.questProgress !== null) {
    icon = <IconHourglassOutline aria-hidden />;
    title = `${questLabel} · 任务执行中`;
    subtitle = `已出牌 ${record.questProgress.playedCount}/${record.questProgress.teamSize}`;
  }

  return (
    <div
      className="avalon-round-banner"
      data-tone={tone}
      role="group"
      aria-label={`${title}。${subtitle}`}
      data-testid={`${testIdPrefix}-banner-${record.round}`}
    >
      <span className="avalon-round-banner-medal" data-tone={tone}>
        {icon}
      </span>
      <div className="avalon-round-banner-copy">
        <h3 className="avalon-round-banner-title">{title}</h3>
        <p className="avalon-round-banner-subtitle">{subtitle}</p>
        {record.questProgress !== null && record.questProgress.pendingSeats.length > 0 && (
          <p className="avalon-round-banner-subtitle">
            {formatPendingSeats('未出牌', record.questProgress.pendingSeats)}
          </p>
        )}
      </div>
      {record.quest !== null && (
        <div className="avalon-quest-cards">
          <QuestCard
            label={AVALON_QUEST_CARD_LABELS.success}
            count={record.quest.successCount}
            kind="success"
          />
          <QuestCard
            label={AVALON_QUEST_CARD_LABELS.fail}
            count={record.quest.failCount}
            kind="fail"
          />
        </div>
      )}
    </div>
  );
}

/** 一轮记录：结论横幅在前，提案与表决时间线在后，湖仙节在末。 */
export function AvalonRecordRound({
  record,
  completedLadyCheck,
  inProgressLadyHolderSeat,
  ended,
}: {
  readonly record: AvalonRoundRecordView;
  readonly completedLadyCheck: AvalonLadyCheckRecordView | null;
  readonly inProgressLadyHolderSeat: number | null;
  readonly ended: boolean;
}) {
  const prefix = 'avalon-history';
  const currentProposal = record.currentProposal;
  return (
    <div className="avalon-round" data-testid={`${prefix}-round-${record.round}`}>
      <AvalonQuestBanner record={record} ended={ended} testIdPrefix={prefix} />
      {(record.proposals.length > 0 || currentProposal !== null) && (
        <h4 className="avalon-round-section-title">提案与表决</h4>
      )}
      <div className="avalon-round-timeline">
        {record.proposals.map((proposal, index) => (
          <AvalonRecordProposal
            key={`${record.round}-${index}`}
            round={record.round}
            proposal={proposal}
            index={index}
            testIdPrefix={`${prefix}-proposal-${record.round}-${index + 1}`}
          />
        ))}
        {currentProposal !== null && (
          <div
            className="avalon-current-proposal"
            data-testid={`${prefix}-current-proposal-${record.round}`}
          >
            <p className="avalon-current-proposal-header">
              <IconHourglassOutline className="avalon-current-proposal-icon" aria-hidden />
              <span>
                第{record.proposals.length + 1}次提案 · 进行中（已投 {currentProposal.castCount}/
                {currentProposal.totalCount}）
              </span>
            </p>
            {currentProposal.pendingSeats.length > 0 && (
              <p className="avalon-current-proposal-line">
                {formatPendingSeats('未投票', currentProposal.pendingSeats)}
              </p>
            )}
            {currentProposal.myBallot !== null && (
              <p className="avalon-current-proposal-line">
                你投了：{ballotLabel(currentProposal.myBallot)}
              </p>
            )}
          </div>
        )}
      </div>
      <AvalonRecordLakeSection
        afterRound={record.round}
        record={record}
        completed={completedLadyCheck}
        inProgressHolderSeat={inProgressLadyHolderSeat}
        ended={ended}
        testIdPrefix={`${prefix}-round-lake-${record.round}`}
      />
    </div>
  );
}
