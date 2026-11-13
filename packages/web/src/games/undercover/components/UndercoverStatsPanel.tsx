import {
  UNDERCOVER_ROLE_NAMES,
  type UndercoverRole,
} from '@game-judge/game-engine/games/undercover/public';

import { GameStatsBar, GameStatsNote, GameStatsPanel } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { useUndercoverPublicStats } from '../hooks/useUndercoverPublicStats';

const UNDERCOVER_ROLE_ORDER: readonly UndercoverRole[] = ['civilian', 'undercover', 'blank'];
const UNDERCOVER_ROLE_TONES = {
  civilian: 'good',
  undercover: 'evil',
  blank: 'special',
} as const;

export function UndercoverStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useUndercoverPublicStats(userId);

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载谁是卧底战绩"
      errorLabel="谁是卧底战绩加载失败"
      emptyTitle="暂无谁是卧底战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      {data !== undefined && (
        <>
          <section aria-label="谁是卧底各身份胜率">
            <h4 className="game-stats-subheading">各身份胜率</h4>
            <div className="game-stats-bars">
              {UNDERCOVER_ROLE_ORDER.map((role) => {
                const stats = data.roles.find((entry) => entry.role === role);
                const gamesPlayed = stats?.gamesPlayed ?? 0;
                const wins = stats?.wins ?? 0;
                return (
                  <GameStatsBar
                    key={role}
                    label={UNDERCOVER_ROLE_NAMES[role]}
                    value={`${wins}胜/${gamesPlayed}局`}
                    numerator={wins}
                    denominator={gamesPlayed}
                    tone={UNDERCOVER_ROLE_TONES[role]}
                  />
                );
              })}
            </div>
          </section>
          <GameStatsNote>胜率按身份分别计算。</GameStatsNote>
        </>
      )}
    </GameStatsPanel>
  );
}
