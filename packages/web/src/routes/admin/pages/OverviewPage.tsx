/** Overview reads only lightweight reports, never all three word libraries. */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import {
  fetchD1Usage,
  fetchRequestTraffic,
  fetchRooms,
  fetchStats,
  getTimeRange,
} from '@/features/admin/services/adminApi';

import { AreaChart, formatNumber, Meter, QuotaRing } from '../components/Charts';
import { AsyncBoundary, PageHeading, Panel, StatTile, StatusBadge } from '../components/Primitives';

/** Entry dashboard with independent error boundaries for each provider. */
export function OverviewPage() {
  const usage = useQuery(adminQueryOptions('d1-usage', null, fetchD1Usage));
  const growth = useQuery(
    adminQueryOptions('growth', { preset: 'today' }, (signal) => {
      const range = getTimeRange('today');
      return fetchStats(range.from, range.to, signal);
    }),
  );
  const traffic = useQuery(
    adminQueryOptions('traffic', { preset: '24h' }, (signal) => {
      const range = getTimeRange('24h');
      return fetchRequestTraffic(range.from, range.to, signal);
    }),
  );
  const rooms = useQuery(
    adminQueryOptions('rooms', 1, (signal) => fetchRooms({ page: 1 }, signal)),
  );
  const all = [usage, growth, traffic, rooms];
  const completedUpdates = all
    .map((query) => query.dataUpdatedAt)
    .filter((updatedAt) => updatedAt > 0);
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  const hours = Math.ceil((reset.getTime() - Date.now()) / 3600000);
  return (
    <>
      <PageHeading
        title="总览"
        description="把握今天的运营与系统运行状况。"
        query={{
          dataUpdatedAt: completedUpdates.length === 0 ? 0 : Math.min(...completedUpdates),
          isFetching: all.some((query) => query.isFetching),
        }}
      />
      <div className="admin-content admin-grid">
        <Panel
          title="D1 今日用量"
          description={`账号级 · UTC 日 · 约 ${hours} 小时后重置`}
          className="admin-span-5"
        >
          <AsyncBoundary query={usage}>
            {(data) => (
              <div className="admin-quota-layout">
                <QuotaRing value={data.rowsRead} limit={data.rowsReadLimit} />
                <div>
                  <Meter label="读取行数" value={data.rowsRead} limit={data.rowsReadLimit} />
                  <Meter label="写入行数" value={data.rowsWritten} limit={data.rowsWrittenLimit} />
                  <p className="admin-muted">免费计划额度参考 · 分析数据可能延迟</p>
                </div>
              </div>
            )}
          </AsyncBoundary>
        </Panel>
        <Panel
          title="今天"
          description="注册与活跃按 UTC 今日统计；请求为近 24 小时。"
          className="admin-span-7"
        >
          <AsyncBoundary query={growth}>
            {(data) => (
              <div className="admin-stats-grid">
                <StatTile label="新注册" value={formatNumber(data.registered)} />
                <StatTile label="活跃用户" value={formatNumber(data.active)} />
              </div>
            )}
          </AsyncBoundary>
          <AsyncBoundary query={traffic}>
            {(data) => (
              <div className="admin-stats-grid">
                <StatTile label="平台请求 · 24 小时" value={formatNumber(data.platform.requests)} />
                <StatTile
                  label="Worker 错误 · 24 小时"
                  value={formatNumber(data.platform.errors)}
                />
              </div>
            )}
          </AsyncBoundary>
        </Panel>
        <Panel
          title="近 24 小时请求"
          description="应用记录的 HTTP 请求"
          className="admin-span-8"
          action={<Link to="/admin/traffic">查看请求 →</Link>}
        >
          <AsyncBoundary query={traffic}>
            {(data) => <AreaChart points={data.http.series} />}
          </AsyncBoundary>
        </Panel>
        <Panel title="运营工作区" className="admin-span-4">
          <h3>最近房间的恢复状态</h3>
          <AsyncBoundary query={rooms}>
            {(data) => {
              const failed = data.rooms.filter((room) => room.status === 'failed');
              return (
                <>
                  <p className="admin-muted">
                    仅检查最新 {data.rooms.length} 个房间，不代表全部房间。
                  </p>
                  {failed.length === 0 ? (
                    <StatusBadge tone="success">本页未发现恢复失败</StatusBadge>
                  ) : (
                    <ul className="admin-link-list">
                      {failed.map((room) => (
                        <li key={room.id}>
                          <Link to={`/admin/rooms?room=${room.code}`}>#{room.code}</Link>
                          <StatusBadge tone="danger">恢复失败</StatusBadge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link to="/admin/rooms">查看房间目录 →</Link>
                </>
              );
            }}
          </AsyncBoundary>
          <div className="admin-section-divider" />
          <h3>词库管理</h3>
          <ul className="admin-link-list">
            <li>
              <Link to="/admin/words/fibking">
                瞎掰王 <span aria-hidden>↗</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/words/undercover">
                谁是卧底 <span aria-hidden>↗</span>
              </Link>
            </li>
            <li>
              <Link to="/admin/words/drawguess">
                你画我猜 <span aria-hidden>↗</span>
              </Link>
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
