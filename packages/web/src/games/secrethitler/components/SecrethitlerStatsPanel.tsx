import { useQuery } from '@tanstack/react-query';

import { GameStatsNote, GameStatsPanel, GameStatsRow } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { secrethitlerPublicStatsOptions } from '../services/secrethitlerStats';

export function SecrethitlerStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useQuery(secrethitlerPublicStatsOptions(userId));
  const liberalWinRate =
    data !== undefined && data.gamesPlayed > 0
      ? `${Math.round((data.liberalWins / data.gamesPlayed) * 100)}%`
      : '暂无数据';
  const fascistWinRate =
    data !== undefined && data.gamesPlayed > 0
      ? `${Math.round((data.fascistWins / data.gamesPlayed) * 100)}%`
      : '暂无数据';
  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载秘密希特勒战绩"
      errorLabel="秘密希特勒战绩加载失败"
      emptyTitle="暂无秘密希特勒战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          {onGamesPlayedChange === undefined && (
            <GameStatsRow label="完成局数" value={`${data.gamesPlayed}局`} />
          )}
          <GameStatsRow label="自由派胜场" value={`${data.liberalWins}场`} />
          <GameStatsRow label="自由派胜率" value={liberalWinRate} />
          <GameStatsRow label="法西斯胜场" value={`${data.fascistWins}场`} />
          <GameStatsRow label="法西斯胜率" value={fascistWinRate} />
          <GameStatsNote>胜率以正常完成局数为分母，被处决玩家仍按开局阵营计胜。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
