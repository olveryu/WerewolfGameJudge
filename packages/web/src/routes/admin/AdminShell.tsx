/** Responsive navigation and outlet for the admin workspace. */
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { ScreenHeader } from '@/components/ScreenHeader';
import IconBarChartOutline from '~icons/ion/bar-chart-outline';
import IconCheckmarkOutline from '~icons/ion/checkmark-outline';
import IconChevronDown from '~icons/ion/chevron-down';
import IconConstructOutline from '~icons/ion/construct-outline';
import IconGridOutline from '~icons/ion/grid-outline';
import IconHomeOutline from '~icons/ion/home-outline';
import IconLibraryOutline from '~icons/ion/library-outline';
import IconPeopleOutline from '~icons/ion/people-outline';
import IconPulseOutline from '~icons/ion/pulse-outline';
import IconRefreshOutline from '~icons/ion/refresh-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconSpeedometerOutline from '~icons/ion/speedometer-outline';

import { DetailDrawer } from './components/Overlays';

const MONITORING_PATHS = ['/admin/growth', '/admin/performance', '/admin/ai'];
const NAVIGATION = [
  { path: '/admin', label: '总览', icon: IconGridOutline },
  { path: '/admin/maintenance', label: '维护', icon: IconConstructOutline },
  { path: '/admin/users', label: '用户', icon: IconPeopleOutline },
  { path: '/admin/rooms', label: '房间', icon: IconHomeOutline },
  { path: '/admin/words', label: '词库', icon: IconLibraryOutline },
  { path: '/admin/growth', label: '增长', icon: IconBarChartOutline },
  { path: '/admin/performance', label: '性能', icon: IconSpeedometerOutline },
  { path: '/admin/traffic', label: '请求', icon: IconPulseOutline },
  { path: '/admin/ai', label: 'AI', icon: IconSparklesOutline },
];

function AdminNavigation({ monitoringSearch }: { monitoringSearch: string }) {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const current = NAVIGATION.find((item) =>
    item.path === '/admin'
      ? pathname === item.path
      : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  function navigationLink(item: (typeof NAVIGATION)[number], menu = false) {
    return (
      <NavLink
        key={item.path}
        to={item.path + (MONITORING_PATHS.includes(item.path) ? monitoringSearch : '')}
        end={item.path === '/admin'}
        className={
          menu
            ? 'admin-page-menu-link'
            : ({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`
        }
        onClick={menu ? () => setOpen(false) : undefined}
      >
        <item.icon aria-hidden />
        <span>{item.label}</span>
        {menu && item === current && (
          <IconCheckmarkOutline className="admin-page-menu-selected" aria-hidden />
        )}
      </NavLink>
    );
  }
  return (
    <>
      <nav className="admin-navigation" aria-label="管理后台导航">
        {NAVIGATION.map((item) => navigationLink(item))}
      </nav>
      <button
        type="button"
        className="admin-mobile-navigation"
        aria-label={`切换页面，当前：${current?.label ?? '管理后台'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <span>
          <small>当前页面</small>
          <strong>{current?.label ?? '管理后台'}</strong>
        </span>
        <span>
          <small>切换页面</small>
          <IconChevronDown aria-hidden />
        </span>
      </button>
      {open && (
        <DetailDrawer variant="sheet" title="切换页面" onClose={() => setOpen(false)}>
          <nav aria-label="选择管理页面">
            {[
              { label: '管理', items: NAVIGATION.slice(0, 5) },
              { label: '分析', items: NAVIGATION.slice(5) },
            ].map((group) => (
              <section key={group.label} className="admin-page-menu-group">
                <h3>{group.label}</h3>
                <div className="admin-page-menu-grid">
                  {group.items.map((item) => navigationLink(item, true))}
                </div>
              </section>
            ))}
          </nav>
        </DetailDrawer>
      )}
    </>
  );
}

/** Keep the shared site header above navigation, refreshing only mounted admin reads. */
export function AdminShell() {
  const client = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['admin'] });
  const location = useLocation();
  const monitoring = MONITORING_PATHS.includes(location.pathname);
  const [monitoringSearch, setMonitoringSearch] = useState(monitoring ? location.search : '');
  const [previousSearch, setPreviousSearch] = useState(location.search);
  if (monitoring && previousSearch !== location.search) {
    setPreviousSearch(location.search);
    setMonitoringSearch(location.search);
  }
  return (
    <div className="admin-workspace">
      <div className="admin-workspace-header">
        <ScreenHeader title="管理后台" parentPath="/">
          <button
            type="button"
            className="admin-icon-button"
            aria-label="刷新当前页面"
            disabled={fetching > 0}
            onClick={() => void client.refetchQueries({ queryKey: ['admin'], type: 'active' })}
          >
            <IconRefreshOutline aria-hidden />
          </button>
        </ScreenHeader>
        <AdminNavigation monitoringSearch={monitoring ? location.search : monitoringSearch} />
      </div>
      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
