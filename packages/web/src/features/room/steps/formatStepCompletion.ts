import { defineCopy, renderCopy } from '@game-judge/game-engine/platform/steps';

import { formatSettleCountdown } from '@/features/room/model/formatCountdown';

const COPY = defineCopy({
  viewed: '已查看 {done}/{total}',
  votes: '已投 {done}/{total}',
  vote: '投票',
  settle: '结算',
  revisable: '{summary}（可改票或撤回）',
});

/**
 * The status line that tells an actor how far a shared step has come: how many have viewed,
 * how many have voted, or the countdown once every vote is in.
 */
export function formatStepCompletion(input: {
  readonly isActor: boolean;
  readonly progressKind: 'vote' | 'confirmation' | null;
  readonly progress: { readonly done: number; readonly total: number } | null;
  readonly deadlineMs: number | null;
  readonly nowMs: number;
}): string | null {
  const { progress } = input;
  if (!input.isActor || progress === null || input.progressKind === null) return null;
  if (input.progressKind === 'confirmation') {
    return progress.total <= 1 ? null : renderCopy(COPY.viewed, progress);
  }
  if (input.deadlineMs === null) return renderCopy(COPY.votes, progress);
  const remainingSeconds = Math.max(0, Math.ceil((input.deadlineMs - input.nowMs) / 1000));
  return renderCopy(COPY.revisable, {
    summary: formatSettleCountdown(remainingSeconds, COPY.vote, COPY.settle),
  });
}
