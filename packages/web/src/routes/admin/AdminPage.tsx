/**
 * AdminPage — the admin portal.
 *
 * A password gate leads to a seven-tab dashboard. The password is cached in local storage and
 * verified again on the next entry. The portal does not use the player JWT; requests carry a
 * standalone admin token.
 */
import './AdminPage.css';

import {
  type ComponentType,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from 'react';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Spinner } from '@/components/Spinner';
import { verifyAdminPassword } from '@/features/admin/services/adminAuth';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import IconBarChartOutline from '~icons/ion/bar-chart-outline';
import IconGameControllerOutline from '~icons/ion/game-controller-outline';
import IconHomeOutline from '~icons/ion/home-outline';
import IconLockClosed from '~icons/ion/lock-closed';
import IconPeopleOutline from '~icons/ion/people-outline';
import IconPulseOutline from '~icons/ion/pulse-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconSpeedometerOutline from '~icons/ion/speedometer-outline';

import { AITab } from './tabs/AITab';
import { AnalyticsTab } from './tabs/AnalyticsTab';
import { GamesTab } from './tabs/GamesTab';
import { RequestTrafficTab } from './tabs/RequestTrafficTab';
import { RoomsTab } from './tabs/RoomsTab';
import { StatsTab } from './tabs/StatsTab';
import { UsersTab } from './tabs/UsersTab';

type TabId = 'users' | 'rooms' | 'stats' | 'analytics' | 'requests' | 'ai' | 'games';

interface AdminTab {
  readonly id: TabId;
  readonly label: string;
  readonly Icon: ComponentType<{ 'aria-hidden'?: boolean }>;
  readonly Panel: ComponentType;
}

const TABS: readonly AdminTab[] = [
  { id: 'users', label: '用户', Icon: IconPeopleOutline, Panel: UsersTab },
  { id: 'rooms', label: '房间', Icon: IconHomeOutline, Panel: RoomsTab },
  { id: 'stats', label: '统计', Icon: IconBarChartOutline, Panel: StatsTab },
  { id: 'analytics', label: '性能', Icon: IconSpeedometerOutline, Panel: AnalyticsTab },
  { id: 'requests', label: '请求', Icon: IconPulseOutline, Panel: RequestTrafficTab },
  { id: 'ai', label: 'AI', Icon: IconSparklesOutline, Panel: AITab },
  { id: 'games', label: '游戏', Icon: IconGameControllerOutline, Panel: GamesTab },
];

const PANEL_ID = 'admin-tab-panel';
const adminPageLog = log.extend('AdminScreen');

function adminTabId(tab: TabId): string {
  return `admin-tab-${tab}`;
}

function getTab(index: number): AdminTab {
  const tab = TABS[(index + TABS.length) % TABS.length];
  if (tab === undefined) throw new Error(`[FAIL-FAST] No admin tab at ${index}`);
  return tab;
}

/** Admin portal page. */
export function AdminPage() {
  const [cachedCredential] = useState(readAdminCredential);
  const [authenticated, setAuthenticated] = useState(false);
  const [verifying, setVerifying] = useState(cachedCredential !== null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  // On mount, check whether the cached password is still valid.
  useEffect(() => {
    if (cachedCredential === null) return;
    void verifyAdminPassword(cachedCredential)
      .then((valid) => {
        if (valid) {
          setAuthenticated(true);
        } else {
          clearAdminCredential();
        }
      })
      .catch((cause: unknown) => {
        handleError(cause, { label: '验证管理员身份', logger: adminPageLog, feedback: false });
        setError('验证失败，请重试');
      })
      .finally(() => {
        setVerifying(false);
      });
  }, [cachedCredential]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = password.trim();
    if (!trimmed) return;
    setError(null);
    setVerifying(true);
    try {
      const valid = await verifyAdminPassword(trimmed);
      if (valid) {
        writeAdminCredential(trimmed);
        setAuthenticated(true);
      } else {
        setError('密码错误');
      }
    } catch (cause: unknown) {
      handleError(cause, { label: '验证管理员身份', logger: adminPageLog, feedback: false });
      setError('网络错误，请重试');
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="admin-page">
        <ScreenHeader title="Admin Portal" />
        <div className="admin-page-status">
          <Spinner label="正在验证管理员身份" size="lg" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="admin-page">
        <ScreenHeader title="Admin Portal" />
        <div className="admin-page-status">
          <form className="admin-auth-card" onSubmit={(event) => void handleSubmit(event)}>
            <IconLockClosed className="admin-auth-icon" aria-hidden />
            <h2 className="admin-auth-title">Admin 验证</h2>
            <input
              className="admin-auth-input"
              type="password"
              placeholder="输入管理密码"
              aria-label="管理密码"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoFocus
            />
            {error !== null && (
              <p role="alert" className="admin-auth-error">
                {error}
              </p>
            )}
            <Button type="submit" className="admin-auth-submit">
              确认进入
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <AdminDashboard />;
}

/** The tabbed dashboard shown once the password is verified. */
function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>('users');
  const listRef = useRef<HTMLDivElement>(null);
  const activeIndex = TABS.findIndex((tab) => tab.id === activeTab);
  const ActivePanel = getTab(activeIndex).Panel;

  const focusTab = (index: number) => {
    const tab = getTab(index);
    setActiveTab(tab.id);
    listRef.current?.querySelector<HTMLElement>(`#${adminTabId(tab.id)}`)?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target: Partial<Record<string, number>> = {
      ArrowRight: activeIndex + 1,
      ArrowLeft: activeIndex - 1,
      Home: 0,
      End: TABS.length - 1,
    };
    const index = target[event.key];
    if (index === undefined) return;
    event.preventDefault();
    focusTab(index);
  };

  return (
    <div className="admin-page">
      <ScreenHeader title="Admin Portal" />
      <div
        ref={listRef}
        className="admin-tab-bar"
        role="tablist"
        aria-label="管理面板"
        onKeyDown={handleKeyDown}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={adminTabId(tab.id)}
              type="button"
              role="tab"
              className="admin-tab-item"
              aria-selected={isActive}
              aria-controls={PANEL_ID}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.Icon aria-hidden />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
      <div
        id={PANEL_ID}
        className="admin-page-scroll"
        role="tabpanel"
        aria-labelledby={adminTabId(activeTab)}
      >
        <ActivePanel />
      </div>
    </div>
  );
}
