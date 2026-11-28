/** Responsive navigation and outlet for the admin workspace. */
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { ScreenHeader } from '@/components/ScreenHeader';
import IconBarChartOutline from '~icons/ion/bar-chart-outline';
import IconCheckmarkOutline from '~icons/ion/checkmark-outline';
import IconConstructOutline from '~icons/ion/construct-outline';
import IconGridOutline from '~icons/ion/grid-outline';
import IconHomeOutline from '~icons/ion/home-outline';
import IconLibraryOutline from '~icons/ion/library-outline';
import IconPeopleOutline from '~icons/ion/people-outline';
import IconPulseOutline from '~icons/ion/pulse-outline';
import IconRefreshOutline from '~icons/ion/refresh-outline';
import IconServerOutline from '~icons/ion/server-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconSpeedometerOutline from '~icons/ion/speedometer-outline';

import { DetailDrawer } from './components/Overlays';

interface PageSwitcher {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

const PageSwitcherContext = createContext<PageSwitcher | null>(null);

/** Open the page-switcher drawer from a page title; null outside the admin shell. */
export function usePageSwitcher(): PageSwitcher | null {
  return useContext(PageSwitcherContext);
}

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
  { path: '/admin/d1', label: 'D1 用量', icon: IconServerOutline },
  { path: '/admin/ai', label: 'AI', icon: IconSparklesOutline },
];

function AdminNavigation({ monitoringSearch }: { monitoringSearch: string }) {
  const { pathname } = useLocation();
  const switcher = usePageSwitcher();
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
        replace
        end={item.path === '/admin'}
        className={
          menu
            ? 'admin-page-menu-link'
            : ({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`
        }
        onClick={menu ? () => switcher?.close() : undefined}
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
      {switcher?.isOpen && (
        <DetailDrawer variant="sheet" title="切换页面" onClose={() => switcher.close()}>
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
export function AdminShell({ onBack }: { readonly onBack: () => void }) {
  const localMockMode = import.meta.env.DEV && import.meta.env.MODE === 'admin-mock';
  const client = useQueryClient();
  const fetching = useIsFetching({ queryKey: ['admin'] });
  const location = useLocation();
  const monitoring = MONITORING_PATHS.includes(location.pathname);
  const [monitoringSearch, setMonitoringSearch] = useState(monitoring ? location.search : '');
  const [previousSearch, setPreviousSearch] = useState(location.search);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const switcher = useMemo<PageSwitcher>(
    () => ({
      isOpen: switcherOpen,
      open: () => setSwitcherOpen(true),
      close: () => setSwitcherOpen(false),
    }),
    [switcherOpen],
  );
  const workspace = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = header.current;
    if (element === null) return;
    const measure = () =>
      workspace.current?.style.setProperty(
        '--admin-workspace-header-height',
        `${element.getBoundingClientRect().height}px`,
      );
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (monitoring && previousSearch !== location.search) {
    setPreviousSearch(location.search);
    setMonitoringSearch(location.search);
  }
  return (
    <PageSwitcherContext.Provider value={switcher}>
      <div className="admin-workspace" ref={workspace}>
        <div className="admin-workspace-header" ref={header}>
          <ScreenHeader title="管理后台" onBack={onBack} tone="admin">
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
          {localMockMode && (
            <p className="admin-mock-banner" role="status">
              本地模拟数据 · 修改只保留在当前标签页，刷新后重置
            </p>
          )}
          <AdminNavigation monitoringSearch={monitoring ? location.search : monitoringSearch} />
        </div>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </PageSwitcherContext.Provider>
  );
}
