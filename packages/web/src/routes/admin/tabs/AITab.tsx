import './AdminTabs.css';

import { fetchAIUsage } from '@/features/admin/services/adminApi';
import IconAlertCircleOutline from '~icons/ion/alert-circle-outline';
import IconChatbubbleOutline from '~icons/ion/chatbubble-outline';
import IconTimerOutline from '~icons/ion/timer-outline';

import { AdminEmptyState } from '../components/AdminEmptyState';
import { BarChart } from '../components/BarChart';
import { MetricCard } from '../components/MetricCard';
import { TimeRangeSelector } from '../components/TimeRangeSelector';
import { useAdminRangeData } from './useAdminRangeData';

function toBarItems(items: readonly { label: string; count: number }[]) {
  return items.map((item) => ({ label: item.label, value: item.count }));
}

/** Admin AI usage tab: request volume, latency, error rate, and breakdowns. */
export function AITab() {
  const { data, loading, error, handleRangeChange } = useAdminRangeData(fetchAIUsage);

  return (
    <div className="admin-tab">
      <TimeRangeSelector onRangeChange={handleRangeChange} />
      {loading || error || !data ? (
        <AdminEmptyState loading={loading} error={error} empty={!data && !loading && !error} />
      ) : (
        <>
          <div className="admin-metrics-row">
            <MetricCard
              value={data.totalRequests.toLocaleString()}
              label="总请求"
              icon={<IconChatbubbleOutline />}
            />
            <MetricCard
              value={`${data.avgTtfrMs.toLocaleString()} ms`}
              label="平均 TTFR"
              icon={<IconTimerOutline />}
            />
            <MetricCard
              value={`${data.errorRate}%`}
              label="错误率"
              icon={<IconAlertCircleOutline />}
            />
          </div>
          <BarChart title="按 Provider" items={toBarItems(data.providers)} />
          <BarChart title="按模型" items={toBarItems(data.models)} labelWidth={120} />
          <BarChart title="按国家" items={toBarItems(data.countries)} />
          <BarChart
            title="Top 用户"
            items={data.topUsers.map((user) => ({
              label: user.displayName ?? user.userId.slice(0, 8),
              value: user.count,
            }))}
          />
          <BarChart title="按状态" items={toBarItems(data.statuses)} />
        </>
      )}
    </div>
  );
}
