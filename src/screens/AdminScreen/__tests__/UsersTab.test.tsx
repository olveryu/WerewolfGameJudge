import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { fetchUsers } from '@/features/admin/services/adminApi';

import { UsersTab } from '../tabs/UsersTab';

jest.mock('@tanstack/react-query', () =>
  jest.requireActual<typeof import('@tanstack/react-query')>(
    '../../../../node_modules/@tanstack/react-query',
  ),
);
jest.mock('@/features/admin/services/adminApi', () => ({ fetchUsers: jest.fn() }));

describe('UsersTab request ownership', () => {
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
});
