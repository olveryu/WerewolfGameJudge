/** Compact, privacy-safe sheriff-election status for the room's one status bar. */
import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { formatSettleCountdown } from '@/features/room/model/formatCountdown';
import type { RoomBoardStatusModel } from '@/features/room/model/RoomBoardStatus';
import { getSheriffWaitingMessage } from '@/games/werewolf/room/day/sheriffElectionPlayerActions';
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
    if (submittedCount >= eligibleCount) {
      return formatSettleCountdown(model.remainingSeconds, '投票');
    }
    return '投票中';
  }
  if (view.phase === 'registration') {
    if (view.canCancelRegistration) return '你已报名，可在底部撤回报名';
    if (isHost) return '请在主持管理中结束报名';
    if (view.canRegister) return '可在底部报名上警';
    return '等待房主结束报名';
  }
  if (view.candidateRecords !== null) {
    return `${view.candidateRecords.activeCandidateSeats.length} 位候选人留在警上`;
  }
  return view.phaseDescription;
}

/** The sheriff election as the room's one status bar, shown in the day and kept at the end. */
export function buildSheriffElectionBoardStatus(
  model: SheriffElectionPanelModel,
  isHost: boolean,
  phaseLabel = '白天',
): RoomBoardStatusModel {
  const { view } = model;
  const progress = view.voteProgress;
  const isVoting = progress !== null && progress.submittedCount < progress.eligibleCount;
  const phase =
    view.finalResult !== null
      ? getResultSummary(view.finalResult)
      : view.phase === 'registration'
        ? getSheriffWaitingMessage(model)
        : view.phaseTitle;
  return {
    context: `${phaseLabel} · 警长竞选 · ${phase}${isVoting ? '中' : ''}`,
    contextTestId: TESTIDS.sheriffElectionHudPhase,
    message: view.finalResult !== null || isVoting ? null : getHudSummary(model, isHost),
    progress: isVoting ? `已投 ${progress.submittedCount}/${progress.eligibleCount}` : null,
    pendingSeats: isVoting
      ? { seats: progress.pendingSeats, label: '未投票', testId: TESTIDS.sheriffHudPendingSeats }
      : null,
    icon: isVoting ? 'checkbox-outline' : 'time-outline',
    tracks: [],
    footnote: null,
    testId: TESTIDS.sheriffElectionHud,
  };
}
