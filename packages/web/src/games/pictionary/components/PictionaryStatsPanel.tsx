import { GameStatsNote, GameStatsPanel, GameStatsRow } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { usePictionaryPublicStats } from '../hooks/usePictionaryPublicStats';

export function PictionaryStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = usePictionaryPublicStats(userId);

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载你画我猜接龙战绩"
      errorLabel="你画我猜接龙战绩加载失败"
      emptyTitle="暂无你画我猜接龙战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          <GameStatsRow label="写词" value={`${data.textSubmissions}次`} />
          <GameStatsRow label="作画" value={`${data.drawingSubmissions}次`} />
          <GameStatsNote>只记录已结算对局中的创作，不设胜负。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
