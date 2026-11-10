import './AdminTabs.css';

import { fetchStats } from '@/features/admin/services/adminApi';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';
import IconPersonAddOutline from '~icons/ion/person-add-outline';
import IconPulseOutline from '~icons/ion/pulse-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { BarChart } from '../components/BarChart';
import { MetricCard } from '../components/MetricCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { useAdminRangeData } from './useAdminRangeData';

/** Admin stats tab: registrations, activity, games, and country / colo distribution. */
export function StatsTab() {
  const { data, loading, error, handleRangeChange } = useAdminRangeData('stats', fetchStats);

  return (
    <div className="admin-tab">
      <TimeRangeSelector onRangeChange={handleRangeChange} />
      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <div className="admin-metrics-row">
            <MetricCard
              value={String(data.registered)}
              label="新注册"
              icon={<IconPersonAddOutline />}
            />
            <MetricCard value={String(data.active)} label="活跃数" icon={<IconPulseOutline />} />
            <MetricCard
              value={String(data.totalGames)}
              label="总局数"
              icon={<IconGameControllerOutline />}
            />
          </div>
          <BarChart
            title="国家分布"
            items={data.countries.map((item) => ({ label: item.country, value: item.count }))}
          />
          <BarChart
            title="Colo 分布"
            items={data.colos.map((item) => ({ label: item.colo, value: item.count }))}
          />
        </>
      )}
    </div>
  );
}
