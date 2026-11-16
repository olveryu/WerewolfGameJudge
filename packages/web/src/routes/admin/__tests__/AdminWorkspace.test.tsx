import type {
  WordLibraryItem,
  WordSubmissionBatch,
} from '@game-judge/game-engine/product/wordSupply';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, Navigate, parsePath, RouterProvider, useNavigate } from 'react-router';

import type {
  AdminRequestTraffic,
  AdminRoom,
  AdminUser,
  GameWordsStats,
} from '@/features/admin/model/adminContracts';
import {
  fetchAdminMaintenance,
  fetchAIUsage,
  fetchAnalytics,
  fetchD1Insights,
  fetchD1Usage,
  fetchGameWordsStats,
  fetchLibraryItems,
  fetchRequestTraffic,
  fetchRoomPlayers,
  fetchRooms,
  fetchStats,
  fetchTavilyUsage,
  fetchUserCountries,
  fetchUserRewards,
  fetchUsers,
  grantUserReward,
  triggerGameWordSupply,
} from '@/features/admin/services/adminApi';
import { verifyAdminPassword } from '@/features/admin/services/adminAuth';
import {
  expireAdminSession,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { wordSubmissionsApi } from '@/features/admin/services/wordSubmissionsApi';
import { showAlert } from '@/utils/alert';

import { AdminPage } from '../AdminPage';
import { StatTile } from '../components/Primitives';
import { D1UsagePage } from '../pages/D1UsagePage';
import { MaintenanceSettingsPage } from '../pages/MaintenanceSettingsPage';
import { AiPage, GrowthPage, PerformancePage } from '../pages/MonitoringPages';
import { OverviewPage } from '../pages/OverviewPage';
import { RoomsPage } from '../pages/RoomsPage';
import { TrafficPage } from '../pages/TrafficPage';
import { UsersPage } from '../pages/UsersPage';
import { WordsPage } from '../pages/WordsPage';
import { SubmissionAgentsPage } from '../words/SubmissionAgents';

vi.mock('@/features/admin/services/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminApi')>()),
  fetchUsers: vi.fn(),
  fetchUserCountries: vi.fn(),
  fetchRooms: vi.fn(),
  fetchRoomPlayers: vi.fn(),
  fetchStats: vi.fn(),
  fetchAnalytics: vi.fn(),
  fetchAIUsage: vi.fn(),
  fetchD1Usage: vi.fn(),
  fetchD1Insights: vi.fn(),
  fetchTavilyUsage: vi.fn(),
  fetchAdminMaintenance: vi.fn(),
  fetchGameWordsStats: vi.fn(),
  fetchLibraryItems: vi.fn(),
  fetchRequestTraffic: vi.fn(),
  triggerGameWordSupply: vi.fn(),
  fetchUserRewards: vi.fn(),
  grantUserReward: vi.fn(),
}));
vi.mock('@/features/admin/services/adminAuth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminAuth')>()),
  verifyAdminPassword: vi.fn(),
}));
vi.mock('@/utils/alert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alert')>()),
  showAlert: vi.fn(),
}));
vi.mock('@/features/admin/services/wordSubmissionsApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/wordSubmissionsApi')>()),
  wordSubmissionsApi: {
    settings: vi.fn(),
    agents: vi.fn(),
    batch: vi.fn(),
    audit: vi.fn(),
    action: vi.fn(),
    dispatch: vi.fn(),
  },
}));

const user: AdminUser = {
  id: 'recipient',
  displayName: '测试用户',
  email: 'test@example.com',
  isAnonymous: false,
  lastCountry: 'CN',
  lastColo: 'HKG',
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-11T00:00:00Z',
  level: 2,
  xp: 10,
  gamesPlayed: 4,
};
const room: AdminRoom = {
  id: 'room',
  code: '1234',
  gameType: 'werewolf',
  status: 'failed',
  reconciliationAttemptCount: 3,
  reconcileAfter: null,
  lastError: 'RECOVERY_ERROR',
  hostUserId: '12345678-1234-1234-1234-123456789abc',
  hostName: '测试房主',
  hostCountry: 'CN',
  gamesStarted: 2,
  lastStartedAt: null,
  participantCount: 3,
  createdAt: '2026-11-11T00:00:00Z',
};
const words: GameWordsStats = {
  game: 'fibking',
  supplyEnabled: true,
  reviewDecisions: [{ decision: 'accepted', count: 10 }],
  reviewCheckStats: [],
  queryLeaderboard: [],
  tavilyRequestsUsed: 2,
  tavilyMonthlyQuota: 1000,
  modelBudget: {
    dailyUsed: 1,
    monthlyUsed: 5,
    byOperation: {
      generation: { dailyUsed: 1, monthlyUsed: 5 },
      review: { dailyUsed: 0, monthlyUsed: 0 },
    },
  },
  categories: [
    {
      id: 'food',
      name: '饮食',
      active: 12,
      total: 14,
      pending: 1,
      batches: 2,
      yieldCount: 10,
      lastAttempt: null,
      coolingDown: false,
      menuEligible: null,
    },
  ],
};

const traffic: AdminRequestTraffic = {
  generatedAt: '2026-11-11T00:00:00Z',
  platform: { requests: 2, errors: 0, subrequests: 0 },
  requestCountDelta: 0,
  http: {
    totalRequests: 2,
    clientErrorRequests: 0,
    serverErrorRequests: 0,
    successfulWebSocketConnections: 0,
    failedWebSocketConnections: 0,
    routes: [
      {
        method: 'GET',
        route: '/higher',
        count: 2,
        errorCount: 0,
        avgDurationMs: 1,
        sharePercent: 100,
        statusCounts: [],
      },
    ],
    series: [],
  },
  realtime: {
    stateSyncRequests: 0,
    commandRequests: 0,
    stateUpdateBroadcasts: 0,
    stateUpdateDeliveries: 0,
    stateUpdateBytes: 0,
    downlinkDeliveries: 0,
    downlinkBytes: 0,
    invalidClientMessages: 0,
  },
};

function AdminEntryPage() {
  const navigate = useNavigate();
  return <button onClick={() => void navigate('/admin')}>进入后台</button>;
}

function mount(path = '/admin/users', previousPath?: string) {
  const client = new QueryClient();
  const router = createMemoryRouter(
    [
      { path: '/', Component: AdminEntryPage },
      { path: '/room/:roomCode', Component: AdminEntryPage },
      {
        path: '/admin',
        Component: AdminPage,
        children: [
          { index: true, Component: OverviewPage },
          { path: 'users', Component: UsersPage },
          { path: 'rooms', Component: RoomsPage },
          { path: 'growth', Component: GrowthPage },
          { path: 'performance', Component: PerformancePage },
          { path: 'ai', Component: AiPage },
          { path: 'traffic', Component: TrafficPage },
          { path: 'd1', Component: D1UsagePage },
          { path: 'maintenance', Component: MaintenanceSettingsPage },
          { path: 'words', element: <Navigate to="/admin/words/fibking" replace /> },
          { path: 'words/:game', Component: WordsPage },
          { path: 'agents/:game', Component: SubmissionAgentsPage },
        ],
      },
    ],
    {
      initialEntries:
        previousPath === undefined
          ? [path]
          : [previousPath, { ...parsePath(path), key: 'current' }],
    },
  );
  const view = render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, client, router };
}

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.resetAllMocks();
  window.localStorage.clear();
  writeAdminCredential('test-credential');
  vi.mocked(verifyAdminPassword).mockResolvedValue(true);
  vi.mocked(fetchD1Usage).mockResolvedValue({
    day: '2026-11-11',
    rowsRead: 100,
    rowsWritten: 10,
    rowsReadLimit: 5_000_000,
    rowsWrittenLimit: 100_000,
    generatedAt: '2026-11-11T00:00:00Z',
  });
  vi.mocked(fetchD1Insights).mockResolvedValue({
    from: '2026-11-11T00:00:00Z',
    to: '2026-11-11T12:00:00Z',
    generatedAt: '2026-11-11T12:00:00Z',
    queries: [
      { id: 'abcdef1234567890', label: '可能涉及：你画我猜词库', reads: 100, writes: 10, count: 2 },
    ],
    series: [{ timestamp: '2026-11-11T08:00:00Z', reads: 100, writes: 10 }],
  });

  vi.mocked(fetchUsers).mockResolvedValue({ users: [user], nextCursor: null });
  vi.mocked(fetchUserCountries).mockResolvedValue({ countries: ['CN', 'JP', 'US'] });
  vi.mocked(fetchUserRewards).mockResolvedValue({ normalDraws: 0, goldenDraws: 5, grants: [] });
  vi.mocked(fetchRooms).mockResolvedValue({ rooms: [], total: 0, page: 1, limit: 50 });
  vi.mocked(fetchRequestTraffic).mockResolvedValue(traffic);
  vi.mocked(fetchStats).mockResolvedValue({
    registered: 2,
    active: 3,
    totalGames: 4,
    countries: [],
    colos: [],
  });
  vi.mocked(fetchGameWordsStats).mockResolvedValue(words);
  vi.mocked(fetchTavilyUsage).mockResolvedValue({
    planUsage: 750,
    planLimit: 1000,
    paygoUsage: 0,
    paygoLimit: 0,
  });
  vi.mocked(fetchLibraryItems).mockImplementation(async (game) => ({
    game,
    items: [],
    totals: { submissions: {} },
    nextCursor: null,
  }));
  vi.mocked(wordSubmissionsApi.audit).mockResolvedValue({ events: [], statuses: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin workspace', () => {
  it('opens user details from the row with the keyboard', async () => {
    const view = mount('/admin/users');
    await screen.findByText('测试用户');
    const row = screen.getByRole('row', { name: '查看用户测试用户详情' });

    row.focus();
    await userEvent.keyboard('{Enter}');

    expect(await screen.findByRole('dialog', { name: '测试用户' })).toBeVisible();
    view.unmount();
    view.client.clear();
  });

  it('shows D1 totals separately from sampled insights and changes the requested range and sort', async () => {
    const view = mount('/admin/d1?view=analysis');
    await screen.findByText('可能涉及：你画我猜词库');
    expect(screen.getByText(/不能用账号总量减去排行/)).toBeVisible();
    expect(fetchD1Insights).toHaveBeenCalledWith('today', 'reads', null, expect.any(AbortSignal));
    await userEvent.click(screen.getByText('可能涉及：你画我猜词库'));
    expect(screen.getByText(/估算单次平均：读取 50 行/)).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '按写入' }));
    await waitFor(() =>
      expect(fetchD1Insights).toHaveBeenCalledWith(
        'today',
        'writes',
        null,
        expect.any(AbortSignal),
      ),
    );
    const trendPanel = screen.getByRole('heading', { name: '读取趋势 · 估算' }).closest('section');
    if (trendPanel === null) throw new Error('Expected trend panel');
    const trend = within(trendPanel);
    expect(trend.getByText('仅有 1 个采样时段，暂时无法形成趋势。')).toBeVisible();
    expect(trend.queryByRole('img')).not.toBeInTheDocument();
    await userEvent.click(trend.getByRole('button', { name: /查看该时段查询/ }));
    await waitFor(() =>
      expect(fetchD1Insights).toHaveBeenCalledWith(
        'today',
        'writes',
        '2026-11-11T08:00:00Z',
        expect.any(AbortSignal),
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: '查看完整时间范围' }));
    expect(view.router.state.location.search).not.toContain('bucket=');
    await userEvent.click(screen.getByRole('button', { name: '7 天' }));
    await waitFor(() =>
      expect(fetchD1Insights).toHaveBeenCalledWith('7d', 'writes', null, expect.any(AbortSignal)),
    );
    expect(view.router.state.location.search).toContain('range=7d');
    expect(fetchD1Usage).not.toHaveBeenCalled();
    view.unmount();
    view.client.clear();
  });

  it('updates D1 interval totals from every trend bucket while keeping daily quota independent', async () => {
    vi.mocked(fetchD1Insights).mockImplementation(async (range) => ({
      from: '2026-11-11T00:00:00Z',
      to: '2026-11-11T12:00:00Z',
      generatedAt: '2026-11-11T12:00:00Z',
      queries: [{ id: 'ranked', label: '排行的一部分', reads: 99_999, writes: 99, count: 2 }],
      series:
        range === '7d'
          ? [
              { timestamp: '2026-11-10T00:00:00Z', reads: 1000, writes: 25 },
              { timestamp: '2026-11-11T00:00:00Z', reads: 2000, writes: 40 },
            ]
          : [{ timestamp: '2026-11-11T08:00:00Z', reads: 100, writes: 10 }],
    }));
    const view = mount('/admin/d1?view=analysis');
    await screen.findByRole('button', { name: '读取累计 · 估算：100，查看完整数值' });
    await userEvent.click(screen.getByRole('button', { name: '7 天' }));
    await screen.findByRole('button', { name: '读取累计 · 估算：3000，查看完整数值' });
    expect(screen.getByRole('heading', { name: '7 天累计 · 采样估算' })).toBeVisible();
    expect(
      screen.getByRole('img', { name: '读取趋势估算，共 2 个时段，最高 2,000 行' }),
    ).toBeVisible();
    expect(
      screen.getByRole('img', { name: '写入趋势估算，共 2 个时段，最高 40 行' }),
    ).toBeVisible();
    expect(screen.getAllByText('2026/11/10 00:00:00 UTC')).toHaveLength(2);
    expect(screen.getAllByText('2026/11/11 00:00:00 UTC')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '写入累计 · 估算：65，查看完整数值' })).toBeVisible();
    expect(
      screen.queryByRole('button', { name: '今日读取行数：100，查看完整数值' }),
    ).not.toBeInTheDocument();
    expect(fetchD1Usage).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('tab', { name: '今日额度' }));
    await screen.findByRole('button', { name: '今日读取行数：100，查看完整数值' });
    expect(screen.queryByRole('group', { name: '分析时间范围' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'D1 高消耗查询采样估算' })).not.toBeInTheDocument();
    expect(fetchD1Usage).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('tab', { name: '用量分析' }));
    expect(screen.getByRole('button', { name: '7 天' })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: '读取累计 · 估算：3000，查看完整数值' }),
    ).toBeVisible();
    expect(fetchD1Insights).toHaveBeenCalledTimes(2);
    await userEvent.click(screen.getByRole('button', { name: '按写入' }));
    await waitFor(() =>
      expect(fetchD1Insights).toHaveBeenLastCalledWith(
        '7d',
        'writes',
        null,
        expect.any(AbortSignal),
      ),
    );
    await screen.findByRole('button', { name: '读取累计 · 估算：3000，查看完整数值' });
    view.unmount();
    view.client.clear();
  });

  it('defaults to daily quota and supports keyboard tab switching without fetching hidden reports', async () => {
    const view = mount('/admin/d1');
    await screen.findByRole('button', { name: '今日读取行数：100，查看完整数值' });
    const quotaTab = screen.getByRole('tab', { name: '今日额度' });
    const pageSwitcher = screen.getByRole('button', { name: '切换页面，当前：D1 用量' });
    expect(pageSwitcher).toHaveTextContent('D1 用量');
    expect(quotaTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('group', { name: '分析时间范围' })).not.toBeInTheDocument();
    expect(fetchD1Insights).not.toHaveBeenCalled();
    quotaTab.focus();
    await userEvent.keyboard('{ArrowRight}');
    await waitFor(() => expect(screen.getByRole('tab', { name: '用量分析' })).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await screen.findByText('可能涉及：你画我猜词库');
    expect(screen.getByRole('tab', { name: '用量分析' })).toHaveFocus();
    expect(view.router.state.location.search).toContain('view=analysis');
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(quotaTab).toHaveFocus());
    await userEvent.keyboard('{Enter}');
    await screen.findByRole('button', { name: '今日读取行数：100，查看完整数值' });
    expect(fetchD1Usage).toHaveBeenCalledOnce();
    view.unmount();
    view.client.clear();
  });

  it('does not present missing D1 samples as zero interval usage', async () => {
    vi.mocked(fetchD1Insights).mockResolvedValue({
      from: '2026-11-11T00:00:00Z',
      to: '2026-11-11T12:00:00Z',
      generatedAt: '2026-11-11T12:00:00Z',
      queries: [],
      series: [],
    });
    const view = mount('/admin/d1?range=7d');
    await screen.findByText('所选时段没有查询样本，无法估算累计读写，不代表没有用量。');
    expect(screen.queryByRole('button', { name: /读取累计 · 估算：/ })).not.toBeInTheDocument();
    view.unmount();
    view.client.clear();
  });

  it('returns to the room after changing D1 time ranges', async () => {
    const view = mount('/room/1234');
    await userEvent.click(screen.getByRole('button', { name: '进入后台' }));
    await screen.findByRole('navigation', { name: '管理后台导航' });
    await userEvent.click(screen.getByRole('link', { name: 'D1 用量' }));
    await screen.findByRole('heading', { name: 'D1 用量' });
    await userEvent.click(screen.getByRole('tab', { name: '用量分析' }));

    await userEvent.click(screen.getByRole('button', { name: '24 小时' }));
    await waitFor(() => expect(view.router.state.location.search).toContain('range=24h'));
    await userEvent.click(screen.getByRole('button', { name: '7 天' }));
    await waitFor(() => expect(view.router.state.location.search).toContain('range=7d'));

    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/room/1234'));
    view.unmount();
    view.client.clear();
  });

  it('returns home after admin navigation replaces a direct entry', async () => {
    const view = mount('/admin');
    await screen.findByRole('navigation', { name: '管理后台导航' });
    await userEvent.click(screen.getByRole('link', { name: '用户' }));
    await screen.findByText('测试用户');

    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    view.unmount();
    view.client.clear();
  });

  it('redirects a legacy ?section=agents link to the agents workspace', async () => {
    vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [] });
    const view = mount('/admin/words/fibking?section=agents');
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/admin/agents/fibking'));
    expect(view.router.state.location.search).toBe('');
    view.unmount();
    view.client.clear();
  });

  it.each([true, false])(
    'returns to the previous page after a direct navigation, authenticated: %s',
    async (authenticated) => {
      if (!authenticated) window.localStorage.clear();
      const view = mount('/admin/users', '/admin/rooms');
      if (authenticated) await screen.findByText('测试用户');
      else await screen.findByRole('heading', { name: '进入管理后台' });

      await userEvent.click(screen.getByRole('button', { name: '返回' }));
      await waitFor(() => expect(view.router.state.location.pathname).toBe('/admin/rooms'));
      view.unmount();
      view.client.clear();
    },
  );

  it.each([
    { source: '/', mobile: false },
    { source: '/room/1234?tab=players#seats', mobile: true },
  ])(
    'returns directly to $source after switching admin sections and searching (mobile=$mobile)',
    async ({ source, mobile }) => {
      const view = mount(source);
      await userEvent.click(screen.getByRole('button', { name: '进入后台' }));
      let navigation = await screen.findByRole('navigation', { name: '管理后台导航' });
      if (mobile) {
        await userEvent.click(screen.getByRole('button', { name: '切换页面，当前：总览' }));
        navigation = await screen.findByRole('dialog', { name: '切换页面' });
      }
      await userEvent.click(within(navigation).getByRole('link', { name: '用户' }));
      await screen.findByText('测试用户');
      await userEvent.type(screen.getByRole('searchbox', { name: '搜索用户' }), '测试');
      await userEvent.click(screen.getByRole('button', { name: '搜索' }));
      await waitFor(() => expect(view.router.state.location.search).toContain('q='));
      await userEvent.click(screen.getByRole('button', { name: '返回' }));
      await waitFor(() => {
        const { pathname, search, hash } = view.router.state.location;
        expect(`${pathname}${search}${hash}`).toBe(source);
      });
      view.unmount();
      view.client.clear();
    },
  );

  it('keeps overview shortcuts, word tabs and library filters in one history entry', async () => {
    const view = mount('/');
    await userEvent.click(screen.getByRole('button', { name: '进入后台' }));
    await userEvent.click(await screen.findByRole('link', { name: '瞎掰王' }));
    const navigation = await screen.findByRole('navigation', { name: '选择词库' });
    await userEvent.click(within(navigation).getByRole('link', { name: '谁是卧底' }));
    await userEvent.type(screen.getByRole('searchbox', { name: '搜索投稿' }), 'lotus');
    await userEvent.click(screen.getByRole('button', { name: '搜' }));
    await waitFor(() => expect(view.router.state.location.search).toBe('?search=lotus'));
    expect(view.router.state.location.pathname).toBe('/admin/words/undercover');
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    view.unmount();
    view.client.clear();
  });

  it.each(['/', '/room/1234?tab=players#seats'])(
    'returns to %s after agent authorization, filters, and item drawer navigation',
    async (source) => {
      const batch: WordSubmissionBatch = {
        id: '10000000-0000-4000-8000-000000000001',
        game: 'fibking',
        agentId: '20000000-0000-4000-8000-000000000001',
        agentName: 'Navigation fixture',
        createdAt: '2026-11-13T00:00:00.000Z',
        items: [],
      };
      const libraryItem: WordLibraryItem = {
        id: '40000000-0000-4000-8000-000000000001',
        batchId: batch.id,
        agentName: 'Navigation fixture',
        game: 'fibking',
        title: '导航词',
        category: '饮食',
        definition: null,
        createdAt: batch.createdAt,
        status: 'pending',
        duplicateOf: null,
        contentHash: 'a'.repeat(64),
        revision: 1,
      };
      vi.mocked(wordSubmissionsApi.settings).mockResolvedValue({
        accepting: true,
        pending: 0,
        pendingLimit: 5000,
        awaitingReview: 0,
        awaitingPublication: 0,
        failed: 0,
        published: 0,
        submittedToday: 0,
        dailyLimit: 1000,
        modelBudget: {
          dailyUsed: 0,
          monthlyUsed: 0,
          byOperation: {
            generation: { dailyUsed: 0, monthlyUsed: 0 },
            review: { dailyUsed: 0, monthlyUsed: 0 },
          },
        },
      });
      vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [] });
      vi.mocked(wordSubmissionsApi.batch).mockResolvedValue(batch);
      vi.mocked(fetchLibraryItems).mockResolvedValue({
        game: 'fibking',
        items: [libraryItem],
        totals: { submissions: {} },
        nextCursor: null,
      });
      const view = mount(source);
      await userEvent.click(screen.getByRole('button', { name: '进入后台' }));
      await userEvent.click(await screen.findByRole('link', { name: '瞎掰王' }));
      await screen.findByRole('button', { name: '查看导航词审核详情' });
      await userEvent.click(screen.getByRole('button', { name: 'Agent 授权' }));
      await screen.findByRole('button', { name: '新建授权' });
      await userEvent.click(screen.getByRole('link', { name: '返回统一词库' }));
      await screen.findByRole('button', { name: '查看导航词审核详情' });
      await userEvent.type(screen.getByRole('searchbox', { name: '搜索投稿' }), 'lotus');
      await userEvent.click(screen.getByRole('button', { name: '搜' }));
      await waitFor(() => expect(view.router.state.location.search).toContain('search=lotus'));
      await userEvent.clear(screen.getByRole('searchbox', { name: '搜索投稿' }));
      await userEvent.click(screen.getByRole('button', { name: '搜' }));
      await waitFor(() => expect(view.router.state.location.search).toBe(''));
      await userEvent.click(await screen.findByRole('button', { name: '查看导航词审核详情' }));
      const drawer = await screen.findByRole('dialog', { name: '词条详情' });
      await userEvent.click(within(drawer).getByRole('button', { name: '关闭' }));
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: '词条详情' })).not.toBeInTheDocument(),
      );
      expect(view.router.state.location.search).toBe('');
      await userEvent.click(screen.getByRole('button', { name: '返回' }));
      await waitFor(() => {
        const { pathname, search, hash } = view.router.state.location;
        expect(`${pathname}${search}${hash}`).toBe(source);
      });
      view.unmount();
      view.client.clear();
    },
  );

  it('ignores a directly opened batch parameter and keeps the search filter', async () => {
    const batch: WordSubmissionBatch = {
      id: '10000000-0000-4000-8000-000000000001',
      game: 'fibking',
      agentId: '20000000-0000-4000-8000-000000000001',
      agentName: 'Navigation fixture',
      createdAt: '2026-11-13T00:00:00.000Z',
      items: [],
    };
    vi.mocked(wordSubmissionsApi.settings).mockResolvedValue({
      accepting: true,
      pending: 0,
      pendingLimit: 5000,
      awaitingReview: 0,
      awaitingPublication: 0,
      failed: 0,
      published: 0,
      submittedToday: 0,
      dailyLimit: 1000,
      modelBudget: {
        dailyUsed: 0,
        monthlyUsed: 0,
        byOperation: {
          generation: { dailyUsed: 0, monthlyUsed: 0 },
          review: { dailyUsed: 0, monthlyUsed: 0 },
        },
      },
    });
    vi.mocked(wordSubmissionsApi.agents).mockResolvedValue({ agents: [] });
    vi.mocked(wordSubmissionsApi.batch).mockResolvedValue(batch);
    vi.mocked(fetchLibraryItems).mockResolvedValue({
      game: 'fibking',
      items: [
        {
          id: '40000000-0000-4000-8000-000000000001',
          batchId: batch.id,
          agentName: 'Navigation fixture',
          game: 'fibking',
          title: '导航词',
          category: '饮食',
          definition: null,
          createdAt: batch.createdAt,
          status: 'pending',
          duplicateOf: null,
          contentHash: 'a'.repeat(64),
          revision: 1,
        },
      ],
      totals: { submissions: {} },
      nextCursor: null,
    });
    const view = mount(`/admin/words/fibking?batch=${batch.id}&search=lotus`);
    await screen.findByRole('button', { name: '查看导航词审核详情' });
    expect(screen.queryByRole('dialog', { name: '投稿批次审核' })).not.toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: '搜索投稿' })).toHaveValue('lotus');
    expect(view.router.state.location.pathname).toBe('/admin/words/fibking');
    expect(view.router.state.location.search).toBe(`?batch=${batch.id}&search=lotus`);
    view.unmount();
    view.client.clear();
  });

  it('switches pages through grouped navigation, highlights the current page and closes the sheet', async () => {
    const view = mount();
    await screen.findByText('测试用户');
    const switcher = screen.getByRole('button', { name: '切换页面，当前：用户' });
    await userEvent.click(switcher);
    const menu = await screen.findByRole('dialog', { name: '切换页面' });
    expect(within(menu).getByRole('heading', { name: '管理' })).toBeVisible();
    expect(within(menu).getByRole('heading', { name: '分析' })).toBeVisible();
    expect(within(menu).getAllByRole('link')).toHaveLength(10);
    expect(within(menu).getByRole('link', { name: '用户' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(view.router.state.location.pathname).toBe('/admin/users');
    await userEvent.click(switcher);
    await userEvent.click(
      within(await screen.findByRole('dialog', { name: '切换页面' })).getByRole('link', {
        name: '房间',
      }),
    );
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/admin/rooms'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '切换页面，当前：房间' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(fetchD1Usage).not.toHaveBeenCalled();
    view.unmount();
    view.client.clear();
  });

  it('preserves monitoring dates when using the page switcher to leave and return', async () => {
    const search = '?range=custom&from=2026-11-01&to=2026-11-07';
    const view = mount(`/admin/growth${search}`, '/');
    await screen.findByText('活跃用户');
    for (const label of ['用户', '增长']) {
      await userEvent.click(screen.getByRole('button', { name: /切换页面，当前：/ }));
      const menu = await screen.findByRole('dialog', { name: '切换页面' });
      await userEvent.click(within(menu).getByRole('link', { name: label }));
    }
    await screen.findByText('活跃用户');
    expect(view.router.state.location.search).toBe(search);
    expect(fetchStats).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole('button', { name: '7 天' }));
    await waitFor(() => expect(view.router.state.location.search).toContain('range=7d'));
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    view.unmount();
    view.client.clear();
  });

  it.each([
    {
      path: 'growth',
      fetcher: fetchStats,
      metric: '新注册',
      arrange: () =>
        vi
          .mocked(fetchStats)
          .mockResolvedValueOnce({
            registered: 2,
            active: 3,
            totalGames: 4,
            countries: [],
            colos: [],
          })
          .mockResolvedValueOnce({
            registered: 42,
            active: 3,
            totalGames: 4,
            countries: [],
            colos: [],
          }),
    },
    {
      path: 'performance',
      fetcher: fetchAnalytics,
      metric: '样本数',
      arrange: () =>
        vi
          .mocked(fetchAnalytics)
          .mockResolvedValueOnce({
            avgLoadMs: 1,
            avgTtfbMs: 1,
            totalRequests: 2,
            countries: [],
            colos: [],
            isps: [],
          })
          .mockResolvedValueOnce({
            avgLoadMs: 1,
            avgTtfbMs: 1,
            totalRequests: 42,
            countries: [],
            colos: [],
            isps: [],
          }),
    },
    {
      path: 'ai',
      fetcher: fetchAIUsage,
      metric: '总请求',
      arrange: () =>
        vi
          .mocked(fetchAIUsage)
          .mockResolvedValueOnce({
            totalRequests: 2,
            avgTtfrMs: 1,
            errorRate: 0,
            providers: [],
            models: [],
            countries: [],
            statuses: [],
            topUsers: [],
          })
          .mockResolvedValueOnce({
            totalRequests: 42,
            avgTtfrMs: 1,
            errorRate: 0,
            providers: [],
            models: [],
            countries: [],
            statuses: [],
            topUsers: [],
          }),
    },
  ])(
    'updates $path values, not just the selected range',
    async ({ path, fetcher, metric, arrange }) => {
      arrange();
      const view = mount(`/admin/${path}`);
      await screen.findByRole('button', { name: `${metric}：2，查看完整数值` });
      await userEvent.click(screen.getByRole('button', { name: '7 天' }));
      await screen.findByRole('button', { name: `${metric}：42，查看完整数值` });
      const call = vi.mocked(fetcher).mock.calls.at(-1);
      expect(call).toBeDefined();
      const [from = '', to = ''] = call ?? [];
      expect(Date.parse(to) - Date.parse(from)).toBe(7 * 86400000);
      expect(view.router.state.location.search).toBe('?range=7d');
      view.unmount();
      view.client.clear();
    },
  );

  it('loads all populated countries only on opening and reuses cached choices after filtering', async () => {
    const view = mount();
    await screen.findByText('测试用户');
    expect(fetchUserCountries).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /退出/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '国家：全部国家' }));
    fireEvent.click(await screen.findByRole('button', { name: '日本 · JP' }));
    await waitFor(() =>
      expect(fetchUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ country: 'JP', cursor: '' }),
        expect.any(AbortSignal),
      ),
    );
    expect(view.router.state.location.search).toContain('country=JP');
    fireEvent.click(screen.getByRole('button', { name: '国家：日本 · JP' }));
    fireEvent.click(await screen.findByRole('button', { name: '全部国家' }));
    await waitFor(() => expect(view.router.state.location.search).toBe(''));
    expect(fetchUserCountries).toHaveBeenCalledOnce();
    expect(fetchUsers).toHaveBeenCalledTimes(2);
    view.unmount();
    view.client.clear();
  });

  it.each([
    ['123,456,789,012.34 ms', '1,234.6亿 ms'],
    ['123,456 / 1,000,000', '12.3万 / 100万'],
  ])('keeps exact units and composite measurements available for %s', (value, compact) => {
    render(<StatTile label="测量" value={value} />);
    const button = screen.getByRole('button', { name: `测量：${value}，查看完整数值` });
    expect(button).toHaveTextContent(compact);
    fireEvent.click(button);
    expect(showAlert).toHaveBeenCalledWith('测量', value, [{ text: '知道了' }]);
  });

  it('opens maintenance controls without mounting any D1-backed report', async () => {
    vi.mocked(fetchAdminMaintenance).mockResolvedValue({
      enabled: false,
      message: '服务升级中',
      endsAt: null,
    });
    const view = mount('/admin/maintenance');
    await screen.findByRole('checkbox', { name: '开启维护模式' });
    expect(fetchUsers).not.toHaveBeenCalled();
    expect(fetchRooms).not.toHaveBeenCalled();
    expect(fetchStats).not.toHaveBeenCalled();
    expect(fetchGameWordsStats).not.toHaveBeenCalled();
    view.unmount();
    view.client.clear();
  });
  it('retains a directly opened custom monitoring range after leaving and returning', async () => {
    const search = '?range=custom&from=2026-11-01&to=2026-11-07';
    const view = mount(`/admin/growth${search}`);
    await screen.findByText('活跃用户');
    fireEvent.click(screen.getByRole('link', { name: '用户' }));
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByRole('link', { name: '增长' }));
    await screen.findByText('活跃用户');
    expect(view.router.state.location.search).toBe(search);
    expect(fetchStats).toHaveBeenCalledTimes(1);
    view.unmount();
    view.client.clear();
  });

  it('starts request-route sorting in ascending order on the first click', async () => {
    const view = mount('/admin/traffic', '/');
    await screen.findByText('/higher');
    fireEvent.click(screen.getByRole('button', { name: '请求数' }));
    await waitFor(() => expect(view.router.state.location.search).toContain('order=asc'));
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    view.unmount();
    view.client.clear();
  });

  it('only searches on submission, keeps filters in the URL, and reuses fresh data across navigation/focus', async () => {
    const view = mount();
    await screen.findByText('测试用户');
    fireEvent.change(screen.getByRole('searchbox', { name: '搜索用户' }), {
      target: { value: 'someone@example.com' },
    });
    expect(fetchUsers).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: '搜索' }));
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(2));
    expect(view.router.state.location.search).toContain('q=someone%40example.com');
    fireEvent.click(screen.getByRole('link', { name: '房间' }));
    await screen.findByRole('heading', { name: '房间', level: 2 });
    await act(() => view.router.navigate('/admin/users?q=someone%40example.com'));
    await screen.findByText('测试用户');
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    expect(fetchUsers).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '刷新当前页面' }));
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(3));
    view.unmount();
    view.client.clear();
  });

  it('uses cached previous cursors and resets pagination on a sort change', async () => {
    vi.mocked(fetchUsers).mockImplementation(async (parameters) =>
      parameters?.cursor
        ? { users: [{ ...user, id: 'second', displayName: '第二页用户' }], nextCursor: null }
        : { users: [user], nextCursor: 'cursor-two' },
    );
    const view = mount();
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await screen.findByText('第二页用户');
    fireEvent.click(screen.getByRole('button', { name: '上一页' }));
    await screen.findByText('测试用户');
    expect(fetchUsers).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: /等级/ }));
    await waitFor(() => expect(fetchUsers).toHaveBeenCalledTimes(3));
    expect(view.router.state.location.search).toContain('sort=level');
    expect(await screen.findByText('此排序只包含有战绩记录的用户')).toBeInTheDocument();
    expect(vi.mocked(fetchUsers).mock.calls.at(-1)?.[0]?.cursor).toBe('');
    view.unmount();
    view.client.clear();
  });

  it('cancels the old filter read and ignores its late result', async () => {
    const pending: {
      signal: AbortSignal;
      resolve: (value: Awaited<ReturnType<typeof fetchUsers>>) => void;
    }[] = [];
    vi.mocked(fetchUsers).mockImplementation((_parameters, signal) => {
      if (signal === undefined) throw new Error('Expected query cancellation');
      return new Promise((resolve) => pending.push({ signal, resolve }));
    });
    const view = mount();
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '国家：全部国家' }));
    fireEvent.click(await screen.findByRole('button', { name: '中国 · CN' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]?.signal.aborted).toBe(true);
    await act(async () => pending[1]?.resolve({ users: [user], nextCursor: null }));
    await screen.findByText('测试用户');
    await act(async () =>
      pending[0]?.resolve({ users: [{ ...user, displayName: '过时用户' }], nextCursor: null }),
    );
    expect(screen.queryByText('过时用户')).not.toBeInTheDocument();
    view.unmount();
    view.client.clear();
  });

  it('clears cached admin data on expiry and never mounts a report before authentication', async () => {
    let resolve: ((valid: boolean) => void) | undefined;
    vi.mocked(verifyAdminPassword).mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const view = mount();
    expect(fetchUsers).not.toHaveBeenCalled();
    await act(async () => resolve?.(true));
    await screen.findByText('测试用户');
    act(() => expireAdminSession());
    await screen.findByRole('heading', { name: '管理后台' });
    expect(screen.queryByText('测试用户')).not.toBeInTheDocument();
    expect(view.client.getQueriesData({ queryKey: ['admin', 'users'] })).toHaveLength(0);
    view.unmount();
    view.client.clear();
  });

  it.each([
    { label: 'short name', hostName: '测试房主' },
    { label: 'long Chinese name', hostName: '这是一个很长的房主名字'.repeat(12) },
    { label: 'long unbroken name', hostName: 'LongHostNameWithoutSpaces'.repeat(12) },
    { label: 'user ID fallback', hostName: null },
  ])('keeps the host visible and opens its full identity: $label', async ({ hostName }) => {
    vi.mocked(fetchRooms).mockResolvedValue({
      rooms: [{ ...room, hostName }],
      total: 1,
      page: 1,
      limit: 50,
    });
    const view = mount('/admin/rooms');
    const table = await screen.findByRole('table', { name: '房间目录' });
    const hostHeading = within(table).getByRole('columnheader', { name: '房主' });
    const identity = hostName ?? room.hostUserId;
    const accessibleName = `房主：${identity}，查看完整名字`;
    const hostCell = within(table).getByRole('cell', { name: identity });
    const hostButton = within(hostCell).getByRole('button', { name: accessibleName });
    expect(hostHeading).not.toHaveClass('admin-secondary-column');
    expect(hostCell).not.toHaveClass('admin-secondary-column');
    expect(hostButton).toBeVisible();
    await userEvent.click(hostButton);
    expect(showAlert).toHaveBeenCalledWith('房主', identity, [
      { text: '知道了', style: 'default' },
    ]);
    expect(fetchRoomPlayers).not.toHaveBeenCalled();
    view.unmount();
    view.client.clear();
  });

  it.each([
    ['active', '活跃'],
    ['creating', '创建中'],
    ['deleting', '删除中'],
    ['failed', '恢复失败'],
  ] as const)(
    'exposes %s beside the room code without a separate status column',
    async (status, label) => {
      vi.mocked(fetchRooms).mockResolvedValue({
        rooms: [{ ...room, status }],
        total: 1,
        page: 1,
        limit: 50,
      });
      const view = mount('/admin/rooms');
      const table = await screen.findByRole('table', { name: '房间目录' });
      expect(within(table).queryByRole('columnheader', { name: '状态' })).not.toBeInTheDocument();
      const button = within(table).getByRole('button', { name: '#1234' });
      expect(button).toHaveAccessibleDescription(label);
      expect(button).toHaveAttribute('title', label);
      expect(button).toHaveAttribute('aria-expanded', 'false');
      expect(fetchRoomPlayers).not.toHaveBeenCalled();
      view.unmount();
      view.client.clear();
    },
  );

  it('reads room participants only after expansion and supports retry', async () => {
    vi.mocked(fetchRooms).mockResolvedValue({
      rooms: [room, { ...room, id: 'other-room', code: '5678', status: 'active' }],
      total: 51,
      page: 1,
      limit: 50,
    });
    vi.mocked(fetchRoomPlayers)
      .mockRejectedValueOnce(new Error('participants unavailable'))
      .mockResolvedValueOnce({
        players: [
          {
            userId: 'participant',
            displayName: '参与者甲',
            lastCountry: 'CN',
            lastColo: 'HKG',
            createdAt: '2026-11-01T00:00:00Z',
            joinedAt: '2026-11-11T00:00:00Z',
            level: 2,
            xp: 20,
            gamesPlayed: 7,
          },
        ],
      });
    const view = mount('/admin/rooms', '/');
    await screen.findByRole('button', { name: '#1234' });
    expect(fetchRoomPlayers).not.toHaveBeenCalled();
    const roomButton = screen.getByRole('button', { name: '#1234' });
    const roomRow = roomButton.closest('tr');
    if (roomRow === null) throw new Error('Room row not found');
    expect(roomButton).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(within(roomRow).getByRole('cell', { name: '3' }));
    await screen.findByText('participants unavailable');
    const detail = screen
      .getByRole('heading', { name: '#1234 · 参与者' })
      .closest<HTMLElement>('.admin-room-detail');
    expect(detail).not.toBeNull();
    expect(roomButton).toHaveAttribute('aria-expanded', 'true');
    expect(roomButton).toHaveAttribute('aria-controls', detail?.id);
    expect(roomRow?.nextElementSibling).toContainElement(detail);
    expect(roomRow?.nextElementSibling?.nextElementSibling).toContainElement(
      screen.getByRole('button', { name: '#5678' }),
    );
    expect(screen.getByText(/RECOVERY_ERROR/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(fetchRoomPlayers).toHaveBeenCalledTimes(2));
    const participants = await screen.findByRole('table', { name: '1234 的参与者' });
    expect(within(participants).getByRole('cell', { name: '参与者甲' })).toBeVisible();
    expect(within(participants).getByRole('columnheader', { name: '局数' })).toBeVisible();
    expect(within(participants).getByRole('cell', { name: '7' })).toBeVisible();
    expect(fetchRoomPlayers).toHaveBeenLastCalledWith('1234', expect.any(AbortSignal));
    fireEvent.click(within(roomRow).getByRole('cell', { name: '3' }));
    expect(roomButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('table', { name: '1234 的参与者' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '#1234' }));
    await screen.findByRole('table', { name: '1234 的参与者' });
    expect(fetchRoomPlayers).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: '下一页' }));
    await waitFor(() => expect(view.router.state.location.search).toBe('?page=2'));
    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/'));
    view.unmount();
    view.client.clear();
  });

  it('switches expanded rooms on row clicks without changing the host or enter actions', async () => {
    vi.mocked(fetchRooms).mockResolvedValue({
      rooms: [room, { ...room, id: 'other-room', code: '5678', status: 'active' }],
      total: 2,
      page: 1,
      limit: 50,
    });
    vi.mocked(fetchRoomPlayers).mockResolvedValue({ players: [] });
    const view = mount('/admin/rooms');
    const firstButton = await screen.findByRole('button', { name: '#1234' });
    const secondButton = screen.getByRole('button', { name: '#5678' });
    const firstRow = firstButton.closest('tr');
    const secondRow = secondButton.closest('tr');
    if (firstRow === null || secondRow === null) throw new Error('Room row not found');

    await userEvent.click(within(firstRow).getByRole('cell', { name: '3' }));
    await screen.findByRole('heading', { name: '#1234 · 参与者' });
    await userEvent.click(within(firstRow).getByRole('button', { name: /房主：/ }));
    expect(firstButton).toHaveAttribute('aria-expanded', 'true');
    expect(showAlert).toHaveBeenCalled();

    await userEvent.click(within(secondRow).getByRole('cell', { name: '3' }));
    await screen.findByRole('heading', { name: '#5678 · 参与者' });
    expect(firstButton).toHaveAttribute('aria-expanded', 'false');
    expect(secondButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.queryByRole('heading', { name: '#1234 · 参与者' })).not.toBeInTheDocument();

    await userEvent.click(within(secondRow).getByRole('button', { name: '进入房间 5678' }));
    await waitFor(() => expect(view.router.state.location.pathname).toBe('/room/5678'));
    expect(fetchRoomPlayers).toHaveBeenCalledTimes(2);
    view.unmount();
    view.client.clear();
  });

  it('resets cancelled supply options and preserves the normal single-task action', async () => {
    vi.mocked(triggerGameWordSupply).mockResolvedValue({
      game: 'fibking',
      category: 'food',
      workflowId: 'normal-run',
    });
    const view = mount('/admin/words/fibking');
    await screen.findByRole('button', { name: '补词' });
    await userEvent.click(screen.getByRole('button', { name: '补词' }));
    let sheet = await screen.findByRole('dialog', { name: '补充词库' });
    await userEvent.click(within(sheet).getByRole('button', { name: '10 次' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '取消' }));
    expect(showAlert).not.toHaveBeenCalled();
    expect(triggerGameWordSupply).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: '补词' }));
    sheet = await screen.findByRole('dialog', { name: '补充词库' });
    expect(within(sheet).getByRole('button', { name: '1 次' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(sheet).queryByRole('switch', { name: '强制补词' })).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: '提交 1 次任务' }));
    const buttons = vi.mocked(showAlert).mock.calls.at(-1)?.[2];
    await act(async () => buttons?.find((button) => button.text === '确定')?.onPress?.());
    await screen.findByText('已触发 1 次，工作流需要几分钟，稍后手动刷新。');
    expect(triggerGameWordSupply).toHaveBeenCalledExactlyOnceWith('fibking', 'food');
    expect(fetchGameWordsStats).toHaveBeenCalledOnce();
    view.unmount();
    view.client.clear();
  });

  it('never disables count options: there is no quota and no force switch', async () => {
    const view = mount('/admin/words/fibking');
    await screen.findByRole('button', { name: '补词' });
    await userEvent.click(screen.getByRole('button', { name: '补词' }));
    const sheet = await screen.findByRole('dialog', { name: '补充词库' });
    expect(within(sheet).getByRole('button', { name: '1 次' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: '10 次' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: '100 次' })).toBeEnabled();
    expect(within(sheet).getByRole('button', { name: '提交 1 次任务' })).toBeEnabled();
    expect(within(sheet).queryByRole('switch', { name: '强制补词' })).not.toBeInTheDocument();
    view.unmount();
    view.client.clear();
  });

  it('stops triggering when the server rejects a request', async () => {
    vi.mocked(triggerGameWordSupply)
      .mockResolvedValueOnce({ game: 'fibking', category: 'food', workflowId: 'run' })
      .mockRejectedValueOnce(new Error('网络异常'));
    const view = mount('/admin/words/fibking');
    await screen.findByRole('button', { name: '补词' });
    await userEvent.click(screen.getByRole('button', { name: '补词' }));
    const sheet = await screen.findByRole('dialog', { name: '补充词库' });
    await userEvent.click(within(sheet).getByRole('button', { name: '10 次' }));
    await userEvent.click(within(sheet).getByRole('button', { name: '提交 10 次任务' }));
    const buttons = vi.mocked(showAlert).mock.calls.at(-1)?.[2];
    await act(async () => buttons?.find((button) => button.text === '确定')?.onPress?.());
    expect(await screen.findByRole('alert')).toHaveTextContent('已确认触发 1 次');
    expect(triggerGameWordSupply).toHaveBeenCalledTimes(2);
    view.unmount();
    view.client.clear();
  });

  it.each([{ count: 10 }, { count: 100 }])(
    'confirms $count supplies without rereading inventory',
    async ({ count }) => {
      vi.mocked(triggerGameWordSupply).mockResolvedValue({
        game: 'fibking',
        category: 'food',
        workflowId: 'run',
      });
      const view = mount('/admin/words/fibking');
      await screen.findByRole('button', { name: '补词' });
      await userEvent.click(screen.getByRole('button', { name: /补词/ }));
      const sheet = await screen.findByRole('dialog', { name: '补充词库' });
      await userEvent.click(within(sheet).getByRole('button', { name: `${count} 次` }));
      await userEvent.click(within(sheet).getByRole('button', { name: `提交 ${count} 次任务` }));
      await waitFor(() => expect(showAlert).toHaveBeenCalled());
      expect(triggerGameWordSupply).not.toHaveBeenCalled();
      const buttons = vi.mocked(showAlert).mock.calls.at(-1)?.[2];
      const confirmation = vi.mocked(showAlert).mock.calls.at(-1)?.[1];
      expect(confirmation).toContain(`触发 ${count} 次补词`);
      expect(confirmation).not.toContain('突破');
      await act(async () => buttons?.find((button) => button.text === '确定')?.onPress?.());
      await screen.findByText(`已触发 ${count} 次，工作流需要几分钟，稍后手动刷新。`);
      expect(triggerGameWordSupply).toHaveBeenCalledTimes(count);
      expect(triggerGameWordSupply).toHaveBeenLastCalledWith('fibking', 'food');
      expect(fetchGameWordsStats).toHaveBeenCalledTimes(1);
      view.unmount();
      view.client.clear();
    },
  );

  it('retains the grant identity after an uncertain result and refreshes the authoritative balance on retry', async () => {
    vi.mocked(grantUserReward).mockRejectedValueOnce(new Error('Network timeout'));
    let view = mount();
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByRole('button', { name: '查看测试用户的详情' }));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByText('普通抽', {
      selector: '.admin-balance-grid .admin-stat > span',
    });
    expect(
      within(drawer).getByText('黄金抽', {
        selector: '.admin-balance-grid .admin-stat > span',
      }),
    ).toBeInTheDocument();
    fireEvent.change(within(drawer).getByLabelText('发放备注'), { target: { value: '活动奖励' } });
    fireEvent.click(within(drawer).getByRole('button', { name: '核对发放' }));
    fireEvent.click(within(drawer).getByRole('button', { name: '确认发放奖励' }));
    await within(drawer).findByText('尚未确认到账结果，请重试本次发放');
    const input = vi.mocked(grantUserReward).mock.calls[0]?.[1];
    if (input === undefined) throw new Error('Expected one reward operation');
    view.unmount();
    view.client.clear();
    const grant = {
      ...input,
      userId: user.id,
      balanceBefore: 5,
      balanceAfter: 105,
      createdAt: '2026-11-11T00:00:00Z',
    };
    vi.mocked(grantUserReward).mockResolvedValueOnce(grant);
    vi.mocked(fetchUserRewards).mockResolvedValue({
      normalDraws: 0,
      goldenDraws: 105,
      grants: [grant],
    });
    view = mount();
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByRole('button', { name: '查看测试用户的详情' }));
    await screen.findByText('待确认发放');
    fireEvent.click(screen.getByRole('button', { name: '重试本次发放' }));
    await screen.findByText('发放成功：黄金抽 +100');
    expect(grantUserReward).toHaveBeenLastCalledWith(user.id, input);
    await screen.findByText('普通抽', {
      selector: '.admin-balance-grid .admin-stat > span',
    });
    expect(
      screen.getByText('黄金抽', { selector: '.admin-balance-grid .admin-stat > span' }),
    ).toBeInTheDocument();
    view.unmount();
    view.client.clear();
  });
});
