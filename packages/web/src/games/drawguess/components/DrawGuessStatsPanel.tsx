import {
  GameStatsBar,
  GameStatsGroup,
  GameStatsNote,
  GameStatsPanel,
  GameStatsReactionIcon,
  GameStatsRow,
} from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { useDrawGuessPublicStats } from '../hooks/useDrawGuessPublicStats';

export function DrawGuessStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useDrawGuessPublicStats(userId);
  const averageGuessTime =
    data !== undefined && data.guessTimedRounds > 0
      ? `${(data.guessTimeMs / data.guessTimedRounds / 1000).toFixed(1)}秒`
      : '—';

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载你画我猜战绩"
      errorLabel="你画我猜战绩加载失败"
      emptyTitle="暂无你画我猜战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          <section aria-label="猜中与作画被猜中比例">
            <div className="game-stats-bars">
              <GameStatsBar
                label="猜中"
                value={`${data.guessedRounds}/${data.guessRounds}回合`}
                numerator={data.guessedRounds}
                denominator={data.guessRounds}
              />
              <GameStatsBar
                label="作画猜中"
                value={`${data.guessedDrawingRounds}/${data.drawingRounds}回合`}
                numerator={data.guessedDrawingRounds}
                denominator={data.drawingRounds}
                tone="good"
              />
            </div>
          </section>
          <GameStatsGroup>
            <GameStatsRow label="猜词次数" value={`${data.guessAttempts}次`} />
            <GameStatsRow label="平均猜中用时" value={averageGuessTime} />
            <GameStatsRow label="累计得分" value={`${data.totalScore}分`} />
          </GameStatsGroup>
          <section aria-label="累计收到的互动">
            <h4 className="game-stats-subheading">累计收到</h4>
            <div className="game-stats-reactions">
              <div className="game-stats-reaction" data-reaction="flower">
                <GameStatsReactionIcon kind="flower" />
                <span>鲜花</span>
                <strong>{data.flowersReceived}</strong>
              </div>
              <div className="game-stats-reaction" data-reaction="egg">
                <GameStatsReactionIcon kind="egg" />
                <span>鸡蛋</span>
                <strong>{data.eggsReceived}</strong>
              </div>
              <div className="game-stats-reaction" data-reaction="tomato">
                <GameStatsReactionIcon kind="tomato" />
                <span>番茄</span>
                <strong>{data.tomatoesReceived}</strong>
              </div>
            </div>
          </section>
          <GameStatsNote>猜中率按回合计算；用时从作画开始计，仅统计猜中回合。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
