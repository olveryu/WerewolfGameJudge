import {
  GameStatsBar,
  GameStatsGroup,
  GameStatsNote,
  GameStatsPanel,
  GameStatsRow,
} from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { useFibPublicStats } from '../hooks/useFibPublicStats';

export function FibStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useFibPublicStats(userId);

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载瞎掰王战绩"
      errorLabel="瞎掰王战绩加载失败"
      emptyTitle="暂无瞎掰王战绩"
      emptyDescription="完成一轮符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          <section aria-label="身份轮数分布">
            <h4 className="game-stats-subheading">身份轮数分布</h4>
            <div className="game-stats-bars">
              <GameStatsBar
                label="大聪明"
                value={`${data.guesserRounds}轮`}
                numerator={data.guesserRounds}
                denominator={data.gamesPlayed}
              />
              <GameStatsBar
                label="老实人"
                value={`${data.honestRounds}轮`}
                numerator={data.honestRounds}
                denominator={data.gamesPlayed}
                tone="good"
              />
              <GameStatsBar
                label="瞎掰王"
                value={`${data.fibberRounds}轮`}
                numerator={data.fibberRounds}
                denominator={data.gamesPlayed}
                tone="special"
              />
            </div>
          </section>
          <GameStatsGroup>
            <GameStatsRow label="大聪明 · 找到老实人" value={`${data.honestFoundRounds}轮`} />
            <GameStatsRow label="老实人 · 被找出" value={`${data.honestRevealedRounds}轮`} />
            <GameStatsRow label="瞎掰王 · 被误选" value={`${data.fibberRevealedCount}次`} />
          </GameStatsGroup>
          <GameStatsNote>横条表示身份轮数占比，不是胜率。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
