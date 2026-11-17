import { useQuery } from '@tanstack/react-query';

import { GameStatsNote, GameStatsPanel, GameStatsRow } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { spotmatchPublicStatsOptions } from '../services/spotmatchStats';

export function SpotmatchStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useQuery(spotmatchPublicStatsOptions(userId));
  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载一眼成对战绩"
      errorLabel="一眼成对战绩加载失败"
      emptyTitle="暂无一眼成对战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          {onGamesPlayedChange === undefined && (
            <GameStatsRow label="完成局数" value={`${data.gamesPlayed}局`} />
          )}
          <GameStatsRow label="获胜局数" value={`${data.wins}局`} />
          <GameStatsRow
            label="胜率"
            value={
              data.gamesPlayed === 0 ? '—' : `${Math.round((data.wins / data.gamesPlayed) * 100)}%`
            }
          />
          <GameStatsRow label="累计正确出牌" value={`${data.correctCards}张`} />
          <GameStatsRow label="累计误点" value={`${data.mistakes}次`} />
          <GameStatsNote>
            仅记录至少出对一张牌的真人正常终局；含机器人或中止的对局不计入。
          </GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
