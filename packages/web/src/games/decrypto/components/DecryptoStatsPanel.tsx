import { useQuery } from '@tanstack/react-query';

import { GameStatsNote, GameStatsPanel, GameStatsRow } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { decryptoPublicStatsOptions } from '../services/decryptoStats';

export function DecryptoStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useQuery(decryptoPublicStatsOptions(userId));
  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载解码战战绩"
      errorLabel="解码战战绩加载失败"
      emptyTitle="暂无解码战战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          {onGamesPlayedChange === undefined && (
            <GameStatsRow label="完成局数" value={`${data.gamesPlayed}局`} />
          )}
          {onGamesPlayedChange === undefined && (
            <GameStatsRow
              label="胜率"
              value={
                data.gamesPlayed === 0
                  ? '—'
                  : `${Math.round((data.wins / data.gamesPlayed) * 100)}%`
              }
            />
          )}
          <GameStatsNote>
            共享胜利会分别计为两队玩家获胜；未达到真人门槛的对局不计入。
          </GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
