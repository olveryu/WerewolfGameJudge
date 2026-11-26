import {
  AVALON_QUEST_ROUNDS,
  type AvalonViewModel,
  getAvalonFailsNeeded,
  getAvalonQuestSize,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

import type { RoomTrack, RoomTrackCellState } from '@/features/room/model/RoomBoardStatus';

/** Public mission progress and current proposal attempts, as tracks for the room's status bar. */
export function buildAvalonRoomTracks(view: AvalonViewModel): readonly RoomTrack[] {
  if (!isAvalonPlayerCount(view.playerCount)) {
    throw new Error(`Unsupported Avalon player count: ${view.playerCount}`);
  }
  const playerCount = view.playerCount;
  const proposing =
    view.phase === 'nominate' || view.phase === 'vote' || view.phase === 'voteResult';
  const currentRound =
    proposing || view.phase === 'quest' ? view.questResults.length + 1 : undefined;
  const activeRecord = proposing
    ? view.roundHistory.find((record) => record.round === currentRound)
    : view.roundHistory.at(-1);
  const approvedAttempt = activeRecord?.proposals.findIndex((proposal) => proposal.approved);
  const currentAttempt =
    proposing && !(view.phase === 'voteResult' && view.lastVoteResult?.approved === false)
      ? view.rejectStreak + 1
      : null;
  const rejectionCount =
    activeRecord?.proposals.filter((proposal) => !proposal.approved).length ?? 0;
  const rejected =
    currentAttempt === view.vetoLimit ||
    (approvedAttempt !== undefined && approvedAttempt >= view.vetoLimit - 1)
      ? Math.min(rejectionCount, view.vetoLimit - 1)
      : rejectionCount;
  const questTrack: RoomTrack = {
    key: 'quests',
    heading: '任务轨道',
    accessibleLabel: '任务轨道',
    cells: AVALON_QUEST_ROUNDS.map((round) => {
      const result = view.questResults[round - 1];
      const state: RoomTrackCellState =
        result === 'success'
          ? 'success'
          : result === 'fail'
            ? 'fail'
            : round === currentRound
              ? 'current'
              : 'upcoming';
      const outcome =
        state === 'success'
          ? '成功'
          : state === 'fail'
            ? '失败'
            : state === 'current'
              ? '进行中'
              : '未开始';
      return {
        key: String(round),
        state,
        title: `任务${round}`,
        lines: [
          `${getAvalonQuestSize(playerCount, round)}人`,
          ...(getAvalonFailsNeeded(playerCount, round) === 2 ? ['2失败'] : []),
          outcome,
        ],
      };
    }),
  };
  const attemptTrack: RoomTrack = {
    key: 'attempts',
    heading: `组队次数${
      view.phase === 'nominate' && currentAttempt === view.vetoLimit
        ? ' · 最后一次提交后自动通过'
        : ''
    }`,
    accessibleLabel: '组队次数',
    cells: Array.from({ length: view.vetoLimit }, (_, index) => {
      const attempt = index + 1;
      const state: RoomTrackCellState =
        attempt <= rejected
          ? 'fail'
          : approvedAttempt !== undefined &&
              approvedAttempt >= 0 &&
              attempt === Math.min(approvedAttempt + 1, view.vetoLimit)
            ? 'success'
            : attempt === currentAttempt
              ? 'current'
              : 'upcoming';
      const outcome =
        state === 'fail'
          ? '已否决'
          : state === 'success'
            ? '已通过'
            : state === 'current'
              ? '当前'
              : '未到';
      return {
        key: String(attempt),
        state,
        title: `第${attempt}次`,
        lines: [outcome, ...(attempt === view.vetoLimit ? ['自动通过'] : [])],
      };
    }),
  };
  return [questTrack, attemptTrack];
}
