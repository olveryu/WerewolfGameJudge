import type {
  SpotmatchState,
  SpotmatchViewModel,
} from '@game-judge/game-engine/games/spotmatch/public';

import { RoomRanking } from '@/features/room/components/RoomRanking';
import { RoomStagePanel } from '@/features/room/components/RoomStagePanel';
import { TESTIDS } from '@/testids';
import IconTrophyOutline from '~icons/ion/trophy-outline';

/** Final facts use the engine's ranks and the same ranking presentation as other games. */
export function SpotmatchResults({
  state,
  viewModel,
  effectiveSeat,
}: {
  readonly state: SpotmatchState;
  readonly viewModel: SpotmatchViewModel;
  readonly effectiveSeat: number | null;
}) {
  const winner = viewModel.seats.find((seat) => seat.seat === state.round?.winnerSeat);
  if (winner === undefined) throw new Error('Missing Spotmatch winner');
  const rows = viewModel.seats
    .toSorted((a, b) => {
      if (a.rank === null || b.rank === null) throw new Error('Missing final Spotmatch rank');
      return a.rank - b.rank || a.seat - b.seat;
    })
    .map((seat) => {
      if (seat.rank === null || seat.remaining === null)
        throw new Error('Incomplete Spotmatch result');
      return {
        seat: seat.seat,
        rank: seat.rank,
        displayName: `${seat.displayName}${seat.isBot ? ' · 机器人' : ''}${seat.seat === effectiveSeat ? ' · 你' : ''}`,
        isSelf: seat.seat === effectiveSeat,
        detail: `出对 ${seat.correct} · 误点 ${seat.mistakes}`,
        value: `剩余 ${seat.remaining} 张`,
      };
    });
  return (
    <section className="spotmatch-result" data-testid={TESTIDS.spotmatchResult}>
      <RoomStagePanel className="spotmatch-result-winner">
        <IconTrophyOutline className="spotmatch-result-trophy" aria-hidden />
        <h2>{winner.displayName} 率先出完</h2>
        <p>本局结束</p>
      </RoomStagePanel>
      <RoomRanking title="最终排名" rows={rows} />
      <p className="spotmatch-result-note">
        {state.round?.isTest
          ? '含机器人，不计战绩与奖励'
          : '符合条件的玩家获得 5 XP 和 1 次普通抽奖'}
      </p>
    </section>
  );
}
