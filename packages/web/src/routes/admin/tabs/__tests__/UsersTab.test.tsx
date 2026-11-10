import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchUserRewards, fetchUsers, grantUserReward } from '@/features/admin/services/adminApi';
import { AdminApiError } from '@/features/admin/services/adminAuth';

import { UsersTab } from '../UsersTab';

vi.mock('@/features/admin/services/adminApi', () => ({
  fetchUsers: vi.fn(),
  fetchUserRewards: vi.fn(),
  grantUserReward: vi.fn(),
}));
vi.mock('@/utils/alert', () => ({ showAlert: vi.fn() }));

function renderUsersTab(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <UsersTab />
    </QueryClientProvider>,
  );
}

describe('UsersTab request ownership', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  it('cancels the old filter and never displays its late response', async () => {
    const pending: {
      signal: AbortSignal;
      resolve: (value: Awaited<ReturnType<typeof fetchUsers>>) => void;
    }[] = [];
    vi.mocked(fetchUsers).mockImplementation((_params, signal) => {
      if (!signal) throw new Error('Query cancellation signal required');
      return new Promise((resolve) => pending.push({ signal, resolve }));
    });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = renderUsersTab(client);
    await waitFor(() => expect(pending).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'CN' }));
    await waitFor(() => expect(pending).toHaveLength(2));
    const [first, second] = pending;
    if (first === undefined || second === undefined) throw new Error('Two requests expected');
    expect(first.signal.aborted).toBe(true);
    await act(async () => second.resolve({ users: [], total: 2, page: 1, limit: 50 }));
    await screen.findByText('总用户: 2');
    await act(async () => first.resolve({ users: [], total: 99, page: 1, limit: 50 }));
    expect(screen.queryByText('总用户: 99')).toBeNull();
    expect(screen.getByText('总用户: 2')).toBeDefined();
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
    vi.mocked(fetchUsers).mockResolvedValue({ users: [user], total: 1, page: 1, limit: 50 });
    vi.mocked(fetchUserRewards).mockResolvedValue({ normalDraws: 0, goldenDraws: 5, grants: [] });
    vi.mocked(grantUserReward).mockRejectedValueOnce(new Error('Network timeout'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    let view = renderUsersTab(client);
    await screen.findByText('蒙鼓人');
    fireEvent.click(screen.getByRole('button', { name: '给蒙鼓人发放奖励' }));
    await screen.findByText('普通抽：0 / 黄金抽：5');
    fireEvent.change(screen.getByLabelText('奖励数量'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: '核对发放' }));
    expect(
      await screen.findByText('数量须为 1 至 10000 的整数，备注须填写且不超过 200 字'),
    ).toBeDefined();
    expect(grantUserReward).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('奖励数量'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('发放备注'), { target: { value: '活动奖励' } });
    fireEvent.click(screen.getByRole('button', { name: '核对发放' }));
    expect(await screen.findByText('用户 ID：recipient')).toBeDefined();
    expect(grantUserReward).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认发放奖励' }));
    await screen.findByText('尚未确认到账结果，请重试本次发放');
    const input = vi.mocked(grantUserReward).mock.calls[0]?.[1];
    if (input === undefined) throw new Error('The grant request was not sent');

    view.unmount();
    view = renderUsersTab(client);
    await screen.findByText('蒙鼓人');
    fireEvent.click(screen.getByRole('button', { name: '给蒙鼓人发放奖励' }));
    expect(await screen.findByText('待确认发放')).toBeDefined();
    const grant = {
      ...input,
      userId: user.id,
      balanceBefore: 5,
      balanceAfter: 105,
      createdAt: '2026-09-18T00:00:00Z',
    };
    vi.mocked(grantUserReward).mockRejectedValueOnce(new AdminApiError(403, 'INVALID_ADMIN_TOKEN'));
    fireEvent.click(screen.getByRole('button', { name: '重试本次发放' }));
    await screen.findByText('管理员验证失败，请重新登录');
    expect(screen.getByText('待确认发放')).toBeDefined();
    expect(screen.queryByRole('button', { name: '核对发放' })).toBeNull();
    vi.mocked(grantUserReward).mockResolvedValueOnce(grant);
    vi.mocked(fetchUserRewards).mockResolvedValue({
      normalDraws: 0,
      goldenDraws: 105,
      grants: [grant],
    });
    fireEvent.click(screen.getByRole('button', { name: '重试本次发放' }));
    await screen.findByText('发放成功：黄金抽 +100');
    await screen.findByText('普通抽：0 / 黄金抽：105');
    expect(grantUserReward).toHaveBeenLastCalledWith(user.id, input);
    view.unmount();
    client.clear();
  });
});
