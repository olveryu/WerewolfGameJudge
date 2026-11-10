/** Werewolf statistics extension rendered on the account settings screen. */
import './CampDistributionBar.css';
import './WerewolfAccountStatsSection.css';

import { Spinner } from '@/components/Spinner';
import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { CampDistributionBar } from './CampDistributionBar';

/** Camp distribution of the signed-in user's werewolf games. */
export function WerewolfAccountStatsSection({ userId }: { readonly userId: string }) {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  return (
    <section className="werewolf-account-stats" aria-label="狼人杀阵营分布">
      <div className="werewolf-account-stats-header">
        <h3 className="werewolf-account-stats-title">狼人杀阵营分布</h3>
        {data && <span className="werewolf-account-stats-count">{data.campStats.total} 局</span>}
      </div>
      {isPending ? (
        <Spinner label="加载阵营统计" />
      ) : isError ? (
        <p className="camp-distribution-error">阵营统计加载失败</p>
      ) : (
        <CampDistributionBar campStats={data.campStats} />
      )}
    </section>
  );
}
