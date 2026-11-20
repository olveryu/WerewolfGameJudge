import '@/features/room/components/RoomTrack.css';

import {
  AVALON_QUEST_ROUNDS,
  type AvalonViewModel,
  getAvalonFailsNeeded,
  getAvalonQuestSize,
  isAvalonPlayerCount,
} from '@game-judge/game-engine/games/avalon/public';

/** Public mission progress and current proposal attempts. */
export function AvalonRoomTracks({ view }: { readonly view: AvalonViewModel }) {
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
  return (
    <div className="room-track-group">
      <p className="room-track-heading">任务轨道</p>
      <ol className="room-track-cells" aria-label="任务轨道">
        {AVALON_QUEST_ROUNDS.map((round) => {
          const result = view.questResults[round - 1];
          const state =
            result === 'success'
              ? 'success'
              : result === 'fail'
                ? 'fail'
                : round === currentRound
                  ? 'current'
                  : 'upcoming';
          const size = getAvalonQuestSize(playerCount, round);
          const fails = getAvalonFailsNeeded(playerCount, round);
          return (
            <li key={round}>
              <span className="room-track-cell" data-state={state}>
                <strong>任务{round}</strong>
                <span>{size}人</span>
                {fails === 2 && <span>2失败</span>}
                <span>
                  {result === 'success'
                    ? '成功'
                    : result === 'fail'
                      ? '失败'
                      : state === 'current'
                        ? '进行中'
                        : '未开始'}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
      <p className="room-track-heading">
        组队次数
        {view.phase === 'nominate' && currentAttempt === view.vetoLimit
          ? ' · 最后一次提交后自动通过'
          : ''}
      </p>
      <ol className="room-track-cells" aria-label="组队次数">
        {Array.from({ length: view.vetoLimit }, (_, index) => {
          const attempt = index + 1;
          const state =
            attempt <= rejected
              ? 'fail'
              : approvedAttempt !== undefined &&
                  approvedAttempt >= 0 &&
                  attempt === Math.min(approvedAttempt + 1, view.vetoLimit)
                ? 'success'
                : attempt === currentAttempt
                  ? 'current'
                  : 'upcoming';
          return (
            <li key={attempt}>
              <span className="room-track-cell" data-state={state}>
                <strong>第{attempt}次</strong>
                <span>
                  {state === 'fail'
                    ? '已否决'
                    : state === 'success'
                      ? '已通过'
                      : state === 'current'
                        ? '当前'
                        : '未到'}
                </span>
                {attempt === view.vetoLimit && <span>自动通过</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
