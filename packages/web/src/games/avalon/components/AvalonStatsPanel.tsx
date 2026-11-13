import { AVALON_ROLES } from '@game-judge/game-engine/games/avalon/public';

import { GameStatsBar, GameStatsNote, GameStatsPanel } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';

import { useAvalonPublicStats } from '../hooks/useAvalonPublicStats';
import { getAvalonRoleMeta } from '../model/avalonRoleMeta';

export function AvalonStatsPanel({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useAvalonPublicStats(userId);
  const roleStats = AVALON_ROLES.map((role) => {
    const stats = data?.roles.find((entry) => entry.role === role);
    return {
      role,
      gamesPlayed: stats?.gamesPlayed ?? 0,
      wins: stats?.wins ?? 0,
      meta: getAvalonRoleMeta(role),
    };
  });
  const factionStats = roleStats.reduce(
    (totals, role) => {
      const faction = role.meta.isEvil ? 'evil' : 'good';
      totals[faction].gamesPlayed += role.gamesPlayed;
      totals[faction].wins += role.wins;
      return totals;
    },
    { good: { gamesPlayed: 0, wins: 0 }, evil: { gamesPlayed: 0, wins: 0 } },
  );
  const outcomeBar = (label: string, wins: number, gamesPlayed: number, tone: 'good' | 'evil') => (
    <GameStatsBar
      label={label}
      value={`${wins}胜/${gamesPlayed}局`}
      numerator={wins}
      denominator={gamesPlayed}
      tone={tone}
    />
  );

  return (
    <GameStatsPanel
      gamesPlayed={data?.gamesPlayed}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载阿瓦隆战绩"
      errorLabel="阿瓦隆战绩加载失败"
      emptyTitle="暂无阿瓦隆战绩"
      emptyDescription="完成一局符合结算条件的游戏后，这里会留下你的记录。"
    >
      <section aria-label="阿瓦隆阵营胜率">
        <h4 className="game-stats-subheading">阵营胜率</h4>
        <div className="game-stats-bars">
          {outcomeBar('好人', factionStats.good.wins, factionStats.good.gamesPlayed, 'good')}
          {outcomeBar('坏人', factionStats.evil.wins, factionStats.evil.gamesPlayed, 'evil')}
        </div>
      </section>
      <details className="game-stats-identities">
        <summary>各身份胜率 · {AVALON_ROLES.length} 种</summary>
        <div className="game-stats-bars" aria-label="阿瓦隆各身份胜率">
          {roleStats.map(({ role, gamesPlayed, wins, meta }) => (
            <GameStatsBar
              key={role}
              label={meta.displayName}
              value={`${wins}胜/${gamesPlayed}局`}
              numerator={wins}
              denominator={gamesPlayed}
              tone={meta.isEvil ? 'evil' : 'good'}
            />
          ))}
        </div>
      </details>
      <GameStatsNote>胜率按身份和阵营分别计算。</GameStatsNote>
    </GameStatsPanel>
  );
}
