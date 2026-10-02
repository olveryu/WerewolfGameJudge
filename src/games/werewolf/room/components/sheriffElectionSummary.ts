/**
 * sheriffElectionSummary — Canonical one-line sheriff-election summary.
 *
 * Single source for the election status line shown on the HUD, the details
 * panel, and the wide-screen sidebar. All surfaces read the same
 * SheriffElectionPanelModel view; do not fork this copy per surface (W18).
 */

import type { SheriffElectionResult } from '@game-judge/game-engine/games/werewolf/public';
import { formatSeat } from '@game-judge/game-engine/platform/room/formatSeat';

import { HOST_MANAGEMENT_LABEL } from '@/features/room/model/RoomHostManagement';
import type { SheriffElectionPanelModel } from '@/games/werewolf/room/hooks/useSheriffElection';
import { getSheriffVoteButtonLabel } from '@/games/werewolf/room/sheriffElectionDockModel';

function getResultSummary(result: SheriffElectionResult): string {
  return result.kind === 'elected' ? `${formatSeat(result.sheriffSeat)} 当选警长` : '本局没有警长';
}

export function getSheriffElectionSummary(model: SheriffElectionPanelModel): string {
  const { view } = model;
  if (view.finalResult !== null) return getResultSummary(view.finalResult);
  if (view.speakingInstruction !== null) return `发言顺序：${view.speakingInstruction}`;
  if (view.voteProgress !== null) {
    const { submittedCount, eligibleCount } = view.voteProgress;
    const progress = `${submittedCount}/${eligibleCount} 人已投票`;
    if (submittedCount >= eligibleCount) {
      if (view.canAdvance && view.advanceLabel !== null) {
        return `${progress}，请在「${HOST_MANAGEMENT_LABEL}」公布`;
      }
      return `${progress}，等待房主公布结果`;
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
