/** Werewolf-only statistics rendered inside the shared player profile card. */
import './CampDistributionBar.css';

import { GameStatsPanel } from '@/components/GameStatsPanel';
import type { GameStatsProps } from '@/games/model/GameStatsProps';
import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { CampDistributionBar } from './CampDistributionBar';

export function WerewolfProfileDetails({ userId, onGamesPlayedChange }: GameStatsProps) {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  return (
    <GameStatsPanel
      gamesPlayed={data?.campStats.total}
      onGamesPlayedChange={onGamesPlayedChange}
      isLoading={isPending}
      isError={isError}
      loadingLabel="加载阵营统计"
      errorLabel="阵营统计加载失败"
      emptyTitle="暂无阵营数据"
      emptyDescription="符合结算条件的对局结束两小时后，这里会显示阵营记录。"
    >
      {data !== undefined && <CampDistributionBar campStats={data.campStats} compact />}
    </GameStatsPanel>
  );
}
