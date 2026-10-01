import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  act,
  fireEvent,
  fireEventAsync,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import {
  AdminApiError,
  fetchUserRewards,
  fetchUsers,
  getAdminWhoAmI,
  grantUserReward,
  setUserAdmin,
} from '@/features/admin/services/adminApi';
import { storage } from '@/services/infra/localStorage';
import { TESTIDS } from '@/testids';

import { UsersTab } from '../tabs/UsersTab';

jest.mock('@tanstack/react-query', () =>
  jest.requireActual<typeof import('@tanstack/react-query')>(
    '../../../../node_modules/@tanstack/react-query',
  ),
);
jest.mock('@/features/admin/services/adminApi', () => ({
  ...jest.requireActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  ),
  fetchUsers: jest.fn(),
  fetchUserRewards: jest.fn(),
  grantUserReward: jest.fn(),
  getAdminWhoAmI: jest.fn(),
  setUserAdmin: jest.fn(),
}));
jest.mock('@/utils/alert', () => ({
  showAlert: jest.fn(),
  getAlertGeneration: () => 0,
}));
jest.mock('@/components/BaseCenterModal', () => ({
  BaseCenterModal: ({ children }: { children: React.ReactNode }) => children,
}));

describe('UsersTab request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
    jest.mocked(getAdminWhoAmI).mockResolvedValue({ userId: 'tester', isSuperAdmin: false });
  });
  it('cancels the old filter and never displays its late response', async () => {
    const pending: Array<{
      signal: AbortSignal;
      resolve: (value: Awaited<ReturnType<typeof fetchUsers>>) => void;
    }> = [];
    jest.mocked(fetchUsers).mockImplementation((_params, signal) => {
      if (!signal) throw new Error('Query cancellation signal required');
      return new Promise((resolve) => pending.push({ signal, resolve }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(
      <QueryClientProvider client={client}>
        <UsersTab />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.press(screen.getByText('CN'));
    await waitFor(() => expect(pending).toHaveLength(2));
    expect(pending[0]!.signal.aborted).toBe(true);
    await act(async () => pending[1]!.resolve({ users: [], total: 2, page: 1, limit: 50 }));
    await screen.findByText('总用户: 2');
    await act(async () => pending[0]!.resolve({ users: [], total: 99, page: 1, limit: 50 }));
    expect(screen.queryByText('总用户: 99')).toBeNull();
    expect(screen.getByText('总用户: 2')).toBeTruthy();
    unmount();
    client.clear();
  });

  it('confirms the recipient, retains a failed request across remount, and refreshes after retry', async () => {
    const user = {
      id: 'recipient',
      displayName: '蒙鼓人',
      email: null,
      isAnonymous: true,
      isAdmin: false,
      lastCountry: null,
      lastColo: null,
      createdAt: '2026-09-18',
      updatedAt: '2026-09-18',
      level: 1,
      xp: 0,
      gamesPlayed: 0,
    };
    jest.mocked(fetchUsers).mockResolvedValue({ users: [user], total: 1, page: 1, limit: 50 });
    jest.mocked(fetchUserRewards).mockResolvedValue({ normalDraws: 0, goldenDraws: 5, grants: [] });
    jest.mocked(grantUserReward).mockRejectedValueOnce(new Error('Network timeout'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const mount = () =>
      render(
        <QueryClientProvider client={client}>
          <UsersTab />
        </QueryClientProvider>,
      );
    let view = mount();
    await screen.findByText('蒙鼓人');
    await fireEventAsync.press(screen.getByLabelText('给蒙鼓人发放奖励'));
    await screen.findByText('普通抽：0 / 黄金抽：5');
    fireEvent.changeText(screen.getByLabelText('奖励数量'), '0');
    await fireEventAsync.press(screen.getByText('核对发放'));
    expect(screen.getByText('数量须为 1 至 10000 的整数，备注须填写且不超过 200 字')).toBeTruthy();
    expect(grantUserReward).not.toHaveBeenCalled();
    fireEvent.changeText(screen.getByLabelText('奖励数量'), '100');
    fireEvent.changeText(screen.getByLabelText('发放备注'), '活动奖励');
    await fireEventAsync.press(screen.getByText('核对发放'));
    expect(screen.getByText('用户 ID：recipient')).toBeTruthy();
    expect(grantUserReward).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByText('确认发放奖励'));
    await screen.findByText('尚未确认到账结果，请重试本次发放');
    const input = jest.mocked(grantUserReward).mock.calls[0]![1];
    view.unmount();
    view = mount();
    await screen.findByText('蒙鼓人');
    await fireEventAsync.press(screen.getByLabelText('给蒙鼓人发放奖励'));
    expect(screen.getByText('待确认发放')).toBeTruthy();
    const grant = {
      ...input,
      userId: user.id,
      balanceBefore: 5,
      balanceAfter: 105,
      createdAt: '2026-09-18T00:00:00Z',
    };
    jest
      .mocked(grantUserReward)
      .mockRejectedValueOnce(new AdminApiError(403, 'INVALID_ADMIN_TOKEN'));
    await fireEventAsync.press(screen.getByText('重试本次发放'));
    await screen.findByText('管理员验证失败，请重新登录');
    expect(screen.getByText('待确认发放')).toBeTruthy();
    expect(screen.queryByText('核对发放')).toBeNull();
    jest.mocked(grantUserReward).mockResolvedValueOnce(grant);
    jest
      .mocked(fetchUserRewards)
      .mockResolvedValue({ normalDraws: 0, goldenDraws: 105, grants: [grant] });
    await fireEventAsync.press(screen.getByText('重试本次发放'));
    await screen.findByText('发放成功：黄金抽 +100');
    await screen.findByText('普通抽：0 / 黄金抽：105');
    expect(grantUserReward).toHaveBeenLastCalledWith(user.id, input);
    view.unmount();
    client.clear();
  });
});

describe('UsersTab admin grant/revoke', () => {
  const makeUser = (overrides: Record<string, unknown> = {}) => ({
    id: 'target-user',
    displayName: '候选人',
    email: null,
    isAnonymous: false,
    isAdmin: false,
    lastCountry: null,
    lastColo: null,
    createdAt: '2026-09-18',
    updatedAt: '2026-09-18',
    level: 1,
    xp: 0,
    gamesPlayed: 0,
    ...overrides,
  });

  const mountTab = () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <UsersTab />
      </QueryClientProvider>,
    );
    return { client, view };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
  });

  it('shows the grant button only for super admins and confirms via AlertModal', async () => {
    jest.mocked(getAdminWhoAmI).mockResolvedValue({ userId: 'super', isSuperAdmin: true });
    jest.mocked(fetchUsers).mockResolvedValue({
      users: [makeUser()],
      total: 1,
      page: 1,
      limit: 50,
    });
    jest
      .mocked(setUserAdmin)
      .mockResolvedValue({ success: true, id: 'target-user', isAdmin: true });
    const { client, view } = mountTab();

    await screen.findByText('候选人');
    // UUID is visible and selectable for the super admin to copy.
    expect(screen.getByText('ID: target-user')).toBeTruthy();
    await fireEventAsync.press(screen.getByLabelText('任命候选人为管理员'));
    // Confirm dialog (AlertModal, not Alert.alert). The modal title is located
    // by testID because the card button carries the same text.
    await screen.findByTestId(TESTIDS.alertTitle);
    expect(screen.getByTestId(TESTIDS.alertTitle)).toHaveTextContent('任命管理员');
    expect(setUserAdmin).not.toHaveBeenCalled();
    await fireEventAsync.press(screen.getByText('确定'));
    await waitFor(() => expect(setUserAdmin).toHaveBeenCalledWith('target-user', true));
    view.unmount();
    client.clear();
  });

  it('hides grant/revoke buttons for non-super-admins', async () => {
    jest.mocked(getAdminWhoAmI).mockResolvedValue({ userId: 'tester', isSuperAdmin: false });
    jest.mocked(fetchUsers).mockResolvedValue({
      users: [makeUser()],
      total: 1,
      page: 1,
      limit: 50,
    });
    const { client, view } = mountTab();

    await screen.findByText('候选人');
    expect(screen.queryByLabelText('任命候选人为管理员')).toBeNull();
    expect(screen.queryByLabelText('移除候选人的管理员权限')).toBeNull();
    view.unmount();
    client.clear();
  });

  it('shows revoke for other admins but never for yourself', async () => {
    jest.mocked(getAdminWhoAmI).mockResolvedValue({ userId: 'super', isSuperAdmin: true });
    jest.mocked(fetchUsers).mockResolvedValue({
      users: [
        makeUser({ id: 'super', displayName: '我', isAdmin: true }),
        makeUser({ id: 'other-admin', displayName: '同事', isAdmin: true }),
      ],
      total: 2,
      page: 1,
      limit: 50,
    });
    const { client, view } = mountTab();

    await screen.findByText('同事');
    // Own card: no revoke button even for a super admin.
    expect(screen.queryByLabelText('移除我的管理员权限')).toBeNull();
    // Other admin card: revoke button present, grant button absent.
    expect(screen.getByLabelText('移除同事的管理员权限')).toBeTruthy();
    expect(screen.queryByLabelText('任命同事为管理员')).toBeNull();
    // Admin badge shown for both.
    expect(screen.getAllByText('管理员').length).toBeGreaterThanOrEqual(2);
    view.unmount();
    client.clear();
  });

  it('does not offer grant for anonymous users', async () => {
    jest.mocked(getAdminWhoAmI).mockResolvedValue({ userId: 'super', isSuperAdmin: true });
    jest.mocked(fetchUsers).mockResolvedValue({
      users: [makeUser({ id: 'anon-1', displayName: null, isAnonymous: true })],
      total: 1,
      page: 1,
      limit: 50,
    });
    const { client, view } = mountTab();

    await screen.findByText('匿名用户');
    expect(screen.queryByLabelText('任命该用户为管理员')).toBeNull();
    view.unmount();
    client.clear();
  });
});
