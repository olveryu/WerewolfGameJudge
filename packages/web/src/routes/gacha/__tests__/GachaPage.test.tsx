/** Gacha query states must not present missing data as a confirmed zero balance. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';

import type { User } from '@/contexts/AuthContext';
import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';
import { GachaPage } from '@/routes/gacha/GachaPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'gacha-user', isAnonymous: false } as User }),
}));
vi.mock('@/features/gacha/queries/useGachaQuery', () => ({ useGachaStatusQuery: vi.fn() }));
vi.mock('@/features/gacha/queries/gachaMutations', () => ({
  useDrawMutation: () => ({ mutate: vi.fn(), isPending: false }),
  usePendingGachaOperation: () => ({ pendingOperation: null, confirmRecovery: vi.fn() }),
}));
vi.mock('@/features/gacha/machine/CapsuleMachine', () => ({ default: () => null }));
vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
  ResidentAvatarTile: () => <span data-testid="resident-tile" />,
}));

const refetch = vi.fn();
const status = { normalDraws: 7, goldenDraws: 2, normalPity: 1, goldenPity: 0, shards: 13 };
const queryClient = new QueryClient();

function setQuery(data: typeof status | undefined, isError: boolean) {
  vi.mocked(useGachaStatusQuery).mockReturnValue({
    data,
    isError,
    isPending: data === undefined && !isError,
    isFetching: false,
    fetchStatus: 'idle',
    refetch,
  } as unknown as ReturnType<typeof useGachaStatusQuery>);
}

function page() {
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/gacha']}>
        <Routes>
          <Route path="/gacha/:roomCode?" element={<GachaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GachaPage query states', () => {
  it('shows a retry action without balances when the initial read fails', async () => {
    setQuery(undefined, true);
    const view = render(page());

    expect(screen.getByText('资产读取失败，请重试')).toBeInTheDocument();
    expect(screen.queryByText('碎片')).toBeNull();
    expect(screen.queryByText('券不足')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: '重新读取' }));
    expect(refetch).toHaveBeenCalledTimes(1);

    setQuery(status, false);
    view.rerender(page());
    expect(screen.queryByText('资产读取失败，请重试')).toBeNull();
    expect(screen.getByText('13')).toBeInTheDocument();
  });

  it('labels cached balances when a refresh fails', () => {
    setQuery(status, true);
    render(page());

    expect(screen.getByText('刷新失败，当前显示上次读取的资产')).toBeInTheDocument();
    expect(screen.getByText('13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抽 ×7仅剩 7 抽' })).toBeInTheDocument();
  });

  it('renders a confirmed zero balance without an error', () => {
    setQuery({ ...status, normalDraws: 0, goldenDraws: 0, shards: 0 }, false);
    render(page());

    expect(screen.getByText('碎片')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '抽 ×10券不足' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: '重新读取' })).toBeNull();
  });
});
