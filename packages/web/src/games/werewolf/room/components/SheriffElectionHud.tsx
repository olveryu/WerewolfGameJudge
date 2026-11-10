/** Compact, privacy-safe sheriff-election status shown persistently above the seat board. */
import './SheriffElection.css';

import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';
import { getSheriffVoteButtonLabel } from '@/games/werewolf/room/day/sheriffElectionDockModel';
import { getSettleCountdownSuffix } from '@/games/werewolf/room/day/sheriffElectionPresentation';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';
import IconChevronUp from '~icons/ion/chevron-up';
import IconShieldCheckmarkOutline from '~icons/ion/shield-checkmark-outline';

function getResultSummary(result: SheriffElectionResult): string {
  return result.kind === 'elected' ? `${formatSeat(result.sheriffSeat)} 当选警长` : '本局没有警长';
}

export function getHudSummary(model: SheriffElectionPanelModel): string {
  const { view } = model;
  if (view.finalResult !== null) return getResultSummary(view.finalResult);
  if (view.speakingInstruction !== null) return `发言顺序：${view.speakingInstruction}`;
  if (view.voteProgress !== null) {
    const { submittedCount, eligibleCount } = view.voteProgress;
    const progress = `${submittedCount}/${eligibleCount} 人已投票`;
    if (submittedCount >= eligibleCount) {
      // The round closes itself: the settle countdown armed by the last ballot publishes the
      // result on expiry — no Host action. The countdown lives only here in the HUD: seconds while
      // they remain, the static sentence once the deadline is reached (0) or has not arrived in
      // the snapshot yet (null) — never a literal 0.
      return `${progress}${getSettleCountdownSuffix(model.remainingSeconds)}`;
    }
    const ballot = view.myBallot;
    if (view.canVote && (ballot === null || ballot.kind === 'notSubmitted')) {
      return `${progress}，点击下方「${getSheriffVoteButtonLabel(model)}」投票`;
    }
    return progress;
  }
  if (view.canCancelRegistration) return '你已报名，可在底部取消报名';
  if (view.candidateRecords !== null) {
    return `${view.candidateRecords.activeCandidateSeats.length} 位候选人留在警上`;
  }
  return view.phaseDescription;
}

export function SheriffElectionHud({
  model,
  onOpenDetails,
}: {
  readonly model: SheriffElectionPanelModel;
  /** Null while the side inspector shows the details. */
  readonly onOpenDetails: (() => void) | null;
}) {
  const { view } = model;
  const content = (
    <>
      <span className="sheriff-hud-top">
        <span className="sheriff-title-group">
          <IconShieldCheckmarkOutline aria-hidden />
          <span className="sheriff-hud-title">警长竞选</span>
        </span>
        <span className="sheriff-phase-badge" data-testid={TESTIDS.sheriffElectionHudPhase}>
          {view.phaseTitle}
        </span>
      </span>
      <span className="sheriff-hud-summary-row">
        <span className="sheriff-hud-summary">{getHudSummary(model)}</span>
        {onOpenDetails !== null && (
          <span className="sheriff-hud-details" data-testid={TESTIDS.sheriffDetailsButton}>
            详情
            <IconChevronUp aria-hidden />
          </span>
        )}
      </span>
      {view.voteProgress !== null && view.voteProgress.pendingSeats.length > 0 && (
        <span className="sheriff-hud-pending">
          <PendingSeatsRow
            label="未投票"
            seats={view.voteProgress.pendingSeats}
            testId={TESTIDS.sheriffHudPendingSeats}
          />
        </span>
      )}
    </>
  );

  if (onOpenDetails === null) {
    return (
      <div className="sheriff-hud" data-testid={TESTIDS.sheriffElectionHud}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="sheriff-hud"
      aria-label="查看警长竞选详情"
      data-testid={TESTIDS.sheriffElectionHud}
      onClick={onOpenDetails}
    >
      {content}
    </button>
  );
}
