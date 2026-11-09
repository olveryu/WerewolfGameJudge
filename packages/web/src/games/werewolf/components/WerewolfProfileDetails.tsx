/** Werewolf-only statistics rendered inside the shared player profile card. */
import './CampDistributionBar.css';

import { Spinner } from '@/components/Spinner';
import { useWerewolfPublicStats } from '@/games/werewolf/hooks/useWerewolfPublicStats';

import { CampDistributionBar } from './CampDistributionBar';

export function WerewolfProfileDetails({ userId }: { readonly userId: string }) {
  const { data, isPending, isError } = useWerewolfPublicStats(userId);

  if (isPending) return <Spinner label="加载阵营统计" />;
  if (isError) return <p className="camp-distribution-error">阵营统计加载失败</p>;
  return (
    <>
      <p className="camp-distribution-count">统计 {data.campStats.total} 局</p>
      <CampDistributionBar campStats={data.campStats} compact />
    </>
  );
}
