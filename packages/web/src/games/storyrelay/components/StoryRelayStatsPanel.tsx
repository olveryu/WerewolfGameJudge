import { GameStatsNote, GameStatsPanel, GameStatsRow } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { useStoryRelayPublicStats } from '../hooks/useStoryRelayPublicStats';

export function StoryRelayStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useStoryRelayPublicStats(userId);

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载故事接龙战绩"
      errorLabel="故事接龙战绩加载失败"
      emptyTitle="暂无故事接龙战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          <GameStatsRow label="写下的段落" value={`${data.paragraphsSubmitted}段`} />
          <GameStatsNote>只记录已结算对局中的创作，不设胜负。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
