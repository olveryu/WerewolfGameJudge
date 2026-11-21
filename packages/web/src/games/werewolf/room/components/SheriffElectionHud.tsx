/** Compact, privacy-safe sheriff-election status shown persistently above the seat board. */
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { RoomStatusSummary } from '@/features/room/components/RoomStatusSummary';
import {
  getSheriffVoteButtonLabel,
  getSheriffWaitingMessage,
} from '@/games/werewolf/room/day/sheriffElectionDockModel';
import { getSettleCountdownSuffix } from '@/games/werewolf/room/day/sheriffElectionPresentation';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/day/useSheriffElection';
import { TESTIDS } from '@/testids';

function getResultSummary(result: SheriffElectionResult): string {
  return result.kind === 'elected' ? `${formatSeat(result.sheriffSeat)} 当选警长` : '本局没有警长';
}

export function getHudSummary(model: SheriffElectionPanelModel, isHost = false): string {
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
  if (view.phase === 'registration') {
    if (view.canCancelRegistration) return '你已报名，可在底部取消报名';
    if (isHost) return '请在主持管理中结束报名';
    if (view.canRegister) return '可在底部报名上警';
    return '等待房主结束报名';
  }
  if (view.candidateRecords !== null) {
    return `${view.candidateRecords.activeCandidateSeats.length} 位候选人留在警上`;
  }
  return view.phaseDescription;
}

export function SheriffElectionHud({
  model,
  isHost,
  isDay = true,
}: {
  readonly model: SheriffElectionPanelModel;
  readonly isHost: boolean;
  readonly isDay?: boolean;
}) {
  const { view } = model;
  return (
    <RoomStatusSummary
      header={{
        prefix: isDay ? '白天' : undefined,
        title: '警长竞选',
        phase:
          view.finalResult !== null
            ? getResultSummary(view.finalResult)
            : view.phase === 'registration'
              ? getSheriffWaitingMessage(model)
              : view.phaseTitle,
        phaseTestId: TESTIDS.sheriffElectionHudPhase,
      }}
      summary={view.finalResult === null ? getHudSummary(model, isHost) : ''}
      action={null}
      testId={TESTIDS.sheriffElectionHud}
      pendingTestId={TESTIDS.sheriffHudPendingSeats}
    />
  );
}
