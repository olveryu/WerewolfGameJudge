/** Responsive navigation and outlet for the admin workspace. */
import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';

import { adminQueryOptions } from '@/features/admin/queries/adminQueryOptions';
import { fetchD1Usage } from '@/features/admin/services/adminApi';
import type { AdminTheme } from '@/features/admin/services/adminTheme';
import IconBarChartOutline from '~icons/ion/bar-chart-outline';
import IconGridOutline from '~icons/ion/grid-outline';
import IconHomeOutline from '~icons/ion/home-outline';
import IconLibraryOutline from '~icons/ion/library-outline';
import IconLogOutOutline from '~icons/ion/log-out-outline';
import IconMoonOutline from '~icons/ion/moon-outline';
import IconPeopleOutline from '~icons/ion/people-outline';
import IconPulseOutline from '~icons/ion/pulse-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconSpeedometerOutline from '~icons/ion/speedometer-outline';
import IconSunnyOutline from '~icons/ion/sunny-outline';

import { Meter } from './components/Charts';

const NAVIGATION = [
  { path: '/admin', label: '总览', group: '工作台', icon: IconGridOutline },
  { path: '/admin/users', label: '用户', group: '运营', icon: IconPeopleOutline },
  { path: '/admin/rooms', label: '房间', group: '运营', icon: IconHomeOutline },
  { path: '/admin/words', label: '词库', group: '运营', icon: IconLibraryOutline },
  { path: '/admin/growth', label: '增长', group: '监控', icon: IconBarChartOutline },
  { path: '/admin/performance', label: '性能', group: '监控', icon: IconSpeedometerOutline },
  { path: '/admin/traffic', label: '请求', group: '监控', icon: IconPulseOutline },
  { path: '/admin/ai', label: 'AI', group: '监控', icon: IconSparklesOutline },
];
const ThemeContext = createContext<{ theme: AdminTheme; toggle: () => void } | null>(null);

/** Toggle the scoped palette; portal contents inherit the same theme explicitly. */
export function ThemeToggle() {
  const context = useContext(ThemeContext);
  if (context === null) throw new Error('Admin theme requires AdminShell');
  return (
    <button
      type="button"
      className="admin-icon-button"
      onClick={context.toggle}
      aria-label={context.theme === 'light' ? '切换深色模式' : '切换浅色模式'}
    >
      {context.theme === 'light' ? (
        <IconMoonOutline aria-hidden />
      ) : (
        <IconSunnyOutline aria-hidden />
      )}
    </button>
  );
}

/** Keep navigation visible on desktop and horizontally scrollable on narrow displays. */
export function AdminShell({
  onLogout,
  theme,
  onThemeChange,
}: {
  onLogout: () => void;
  theme: AdminTheme;
  onThemeChange: () => void;
}) {
  const location = useLocation();
  const monitoring = ['/admin/growth', '/admin/performance', '/admin/ai'].includes(
    location.pathname,
  );
  const [monitoringSearch, setMonitoringSearch] = useState(monitoring ? location.search : '');
  const [previousSearch, setPreviousSearch] = useState(location.search);
  if (monitoring && previousSearch !== location.search) {
    setPreviousSearch(location.search);
    setMonitoringSearch(location.search);
  }
  const usage = useQuery(adminQueryOptions('d1-usage', null, fetchD1Usage));
  return (
    <ThemeContext.Provider value={{ theme, toggle: onThemeChange }}>
      <div className="admin-workspace">
        <aside className="admin-sidebar">
          <NavLink to="/admin" className="admin-brand">
            <span className="admin-brand-mark">G</span>
            <span>
              管理后台<small>GAME JUDGE</small>
            </span>
          </NavLink>
          <nav aria-label="管理后台导航">
            {NAVIGATION.map((item, index) => (
              <div key={item.path} className="admin-nav-entry">
                {NAVIGATION[index - 1]?.group !== item.group && (
                  <div className="admin-nav-group">{item.group}</div>
                )}
                <NavLink
                  to={
                    item.path +
                    (['/admin/growth', '/admin/performance', '/admin/ai'].includes(item.path)
                      ? monitoring
                        ? location.search
                        : monitoringSearch
                      : '')
                  }
                  end={item.path === '/admin'}
                  className={({ isActive }) => `admin-nav-link${isActive ? ' is-active' : ''}`}
                >
                  <item.icon aria-hidden />
                  <span>{item.label}</span>
                </NavLink>
              </div>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            {usage.data !== undefined ? (
              <Meter
                label="D1 今日读取 · UTC"
                value={usage.data.rowsRead}
                limit={usage.data.rowsReadLimit}
              />
            ) : (
              <span className="admin-muted">
                {usage.isError ? 'D1 用量暂不可用' : '正在读取 D1 用量…'}
              </span>
            )}
            <button type="button" onClick={onLogout}>
              <IconLogOutOutline aria-hidden />
              管理员 · 退出
            </button>
          </div>
          <button type="button" className="admin-mobile-logout" onClick={onLogout}>
            退出
          </button>
        </aside>
        <main className="admin-main">
          <Outlet />
        </main>
      </div>
    </ThemeContext.Provider>
  );
}
