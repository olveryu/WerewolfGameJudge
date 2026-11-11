import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import type { AdminUser, GameWordsStats } from '@/features/admin/model/adminContracts';
import {
  fetchD1Usage,
  fetchGameWordsStats,
  fetchRoomPlayers,
  fetchRooms,
  fetchStats,
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
import { showAlert } from '@/utils/alert';

import { AdminPage } from '../AdminPage';
import { GrowthPage } from '../pages/MonitoringPages';
import { RoomsPage } from '../pages/RoomsPage';
import { UsersPage } from '../pages/UsersPage';
import { WordsPage } from '../pages/WordsPage';

vi.mock('@/features/admin/services/adminApi', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/admin/services/adminApi')>()),
  fetchUsers: vi.fn(),
  fetchRooms: vi.fn(),
  fetchRoomPlayers: vi.fn(),
  fetchStats: vi.fn(),
  fetchD1Usage: vi.fn(),
  fetchGameWordsStats: vi.fn(),
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
const words: GameWordsStats = {
  game: 'fibking',
  supplyEnabled: true,
  monthlySupply: { month: '2026-11', published: 10, reserved: 2, batchLimit: 20, wordTarget: 100 },
  reviewDecisions: [{ decision: 'accepted', count: 10 }],
  reviewCheckStats: [],
  queryLeaderboard: [],
  tavilyRequestsUsed: 2,
  tavilyMonthlyQuota: 1000,
  modelBudget: { dailyUsed: 1, dailyLimit: 8, monthlyUsed: 5, monthlyLimit: 120 },
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

function mount(path = '/admin/users') {
  const client = new QueryClient();
  const router = createMemoryRouter(
    [
      {
        path: '/admin',
        Component: AdminPage,
        children: [
          { path: 'users', Component: UsersPage },
          { path: 'rooms', Component: RoomsPage },
          { path: 'growth', Component: GrowthPage },
          { path: 'words/:game', Component: WordsPage },
        ],
      },
    ],
    { initialEntries: [path] },
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
  vi.mocked(fetchUsers).mockResolvedValue({ users: [user], nextCursor: null });
  vi.mocked(fetchUserRewards).mockResolvedValue({ normalDraws: 0, goldenDraws: 5, grants: [] });
  vi.mocked(fetchRooms).mockResolvedValue({ rooms: [], total: 0, page: 1, limit: 50 });
  vi.mocked(fetchStats).mockResolvedValue({
    registered: 2,
    active: 3,
    totalGames: 4,
    countries: [],
    colos: [],
  });
  vi.mocked(fetchGameWordsStats).mockResolvedValue(words);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('admin workspace', () => {
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

  it('reveals and highlights a category outside the low-stock filter without another read', async () => {
    const low = words.categories[0];
    if (low === undefined) throw new Error('Expected category fixture');
    vi.mocked(fetchGameWordsStats).mockResolvedValue({
      ...words,
      categories: [low, { ...low, id: 'high', name: '高库存分类', active: 100 }],
    });
    const scroll = vi.fn();
    const getElement = document.getElementById.bind(document);
    vi.spyOn(document, 'getElementById').mockImplementation((id) => {
      const element = getElement(id);
      if (element !== null) element.scrollIntoView = scroll;
      return element;
    });
    const view = mount('/admin/words/fibking');
    await screen.findByRole('heading', { name: '分类库存' });
    expect(screen.queryByRole('row', { name: /高库存分类/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '高库存分类，在库 100 词，查看明细' }));
    const row = await screen.findByRole('row', { name: /高库存分类/ });
    expect(row).toHaveAttribute('data-highlighted', 'true');
    expect(scroll).toHaveBeenCalled();
    expect(fetchGameWordsStats).toHaveBeenCalledTimes(1);
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
    await screen.findByRole('heading', { name: '房间', level: 1 });
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
    fireEvent.change(screen.getByRole('combobox', { name: '国家' }), { target: { value: 'CN' } });
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

  it('reads room participants only after expansion and supports retry', async () => {
    vi.mocked(fetchRooms).mockResolvedValue({
      rooms: [
        {
          id: 'room',
          code: '1234',
          gameType: 'werewolf',
          status: 'failed',
          reconciliationAttemptCount: 3,
          reconcileAfter: null,
          lastError: 'RECOVERY_ERROR',
          hostUserId: 'host',
          hostName: '房主',
          hostCountry: 'CN',
          gamesStarted: 2,
          lastStartedAt: null,
          participantCount: 3,
          createdAt: '2026-11-11T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
    vi.mocked(fetchRoomPlayers)
      .mockRejectedValueOnce(new Error('participants unavailable'))
      .mockResolvedValueOnce({ players: [] });
    const view = mount('/admin/rooms');
    await screen.findByRole('button', { name: '#1234' });
    expect(fetchRoomPlayers).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '#1234' }));
    await screen.findByText('participants unavailable');
    expect(screen.getByText(/RECOVERY_ERROR/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    await waitFor(() => expect(fetchRoomPlayers).toHaveBeenCalledTimes(2));
    view.unmount();
    view.client.clear();
  });

  it('confirms quota-breaking supply and does not refetch inventory after a successful batch', async () => {
    vi.mocked(triggerGameWordSupply).mockResolvedValue({
      game: 'fibking',
      workflowId: 'run',
      force: true,
    });
    const view = mount('/admin/words/fibking');
    await screen.findByRole('heading', { name: '分类库存' });
    await userEvent.click(screen.getByRole('button', { name: /补词/ }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /强制补词 × 10/ }));
    await waitFor(() => expect(showAlert).toHaveBeenCalled());
    expect(triggerGameWordSupply).not.toHaveBeenCalled();
    const buttons = vi.mocked(showAlert).mock.calls.at(-1)?.[2];
    expect(vi.mocked(showAlert).mock.calls.at(-1)?.[1]).toContain(
      '突破本月 20 次配额及共享模型额度',
    );
    await act(async () => buttons?.find((button) => button.text === '确定')?.onPress?.());
    await screen.findByText('已触发 10 次，工作流需要几分钟，稍后手动刷新。');
    expect(triggerGameWordSupply).toHaveBeenCalledTimes(10);
    expect(fetchGameWordsStats).toHaveBeenCalledTimes(1);
    view.unmount();
    view.client.clear();
  });

  it('retains the grant identity after an uncertain result and refreshes the authoritative balance on retry', async () => {
    vi.mocked(grantUserReward).mockRejectedValueOnce(new Error('Network timeout'));
    let view = mount();
    await screen.findByText('测试用户');
    fireEvent.click(screen.getByRole('button', { name: '查看测试用户的详情' }));
    const drawer = await screen.findByRole('dialog');
    await within(drawer).findByText('普通抽：0 / 黄金抽：5');
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
    await screen.findByText('普通抽：0 / 黄金抽：105');
    view.unmount();
    view.client.clear();
  });
});
