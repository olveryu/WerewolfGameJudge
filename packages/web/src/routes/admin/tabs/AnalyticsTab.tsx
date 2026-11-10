import './AdminTabs.css';

import { fetchAnalytics } from '@/features/admin/services/adminApi';
import IconFlashOutline from '~icons/ion/flash-outline';
import IconTimerOutline from '~icons/ion/timer-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { BarChart } from '../components/BarChart';
import { MetricCard } from '../components/MetricCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { useAdminRangeData } from './useAdminRangeData';

/** Admin performance tab: page-load timing by country, colo, and ISP. */
export function AnalyticsTab() {
  const { data, loading, error, handleRangeChange } = useAdminRangeData(
    'analytics',
    fetchAnalytics,
  );

  return (
    <div className="admin-tab">
      <TimeRangeSelector onRangeChange={handleRangeChange} />
      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <div className="admin-metrics-row">
            <MetricCard
              value={`${data.avgLoadMs.toLocaleString()} ms`}
              label="平均加载"
              icon={<IconTimerOutline />}
            />
            <MetricCard
              value={`${data.avgTtfbMs.toLocaleString()} ms`}
              label="平均 TTFB"
              icon={<IconFlashOutline />}
            />
          </div>
          <p className="admin-caption-center">加载样本: {data.totalRequests.toLocaleString()}</p>
          <BarChart
            title="按国家平均加载时间"
            items={data.countries.map((item) => ({
              label: item.country,
              value: item.count,
              displayValue: `${item.avgLoadMs} ms`,
            }))}
          />
          <BarChart
            title="按 Colo 请求数"
            items={data.colos.map((item) => ({ label: item.colo, value: item.count }))}
          />
          <BarChart
            title="Top ISP"
            items={data.isps.map((item) => ({ label: item.isp, value: item.count }))}
            labelWidth={100}
          />
        </>
      )}
    </div>
  );
}
