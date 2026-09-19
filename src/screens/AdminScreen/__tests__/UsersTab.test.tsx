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
  grantUserReward,
} from '@/features/admin/services/adminApi';
import { storage } from '@/services/infra/localStorage';

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
}));
jest.mock('@/utils/alert', () => ({ showAlert: jest.fn() }));
jest.mock('@/components/BaseCenterModal', () => ({
  BaseCenterModal: ({ children }: { children: React.ReactNode }) => children,
}));

describe('UsersTab request ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.clearAll();
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
