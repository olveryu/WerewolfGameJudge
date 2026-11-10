/** Unlocks: own collection, guest free items, another player's collection and the load error. */
import {
  AVATAR_IDS,
  FREE_AVATAR_IDS,
  NAME_STYLE_IDS,
} from '@game-judge/game-engine/product/rewards';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';

import type { User } from '@/contexts/AuthContext';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { NAME_STYLE_NAMES } from '@/features/product/model/cosmeticNames';
import { UnlocksPage } from '@/routes/unlocks/UnlocksPage';

const mocks = vi.hoisted(() => ({
  auth: { user: null as User | null, loading: false },
  stats: {
    data: undefined as { unlockedItems: readonly string[] } | undefined,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  fetchUserUnlocks: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => mocks.auth }));
vi.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => mocks.stats,
}));
vi.mock('@/features/account/services/accountApi', () => ({
  fetchUserUnlocks: mocks.fetchUserUnlocks,
}));
// The scene stage needs a canvas; the previews' own tests cover it.
vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
  ResidentAvatarTile: () => <span data-testid="resident-tile" />,
}));

const REGISTERED_USER = { id: 'user-1', isAnonymous: false } as User;
const UNLOCKED_NAME_STYLE = NAME_STYLE_IDS[0];

/** Renders inside an awaited `act` so the page's `use()` of the product UI settles. */
async function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/unlocks/:roomCode?', element: <UnlocksPage /> },
      { path: '/settings', element: <p>设置页</p> },
      { path: '/room/:roomCode', element: <p>房间页</p> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // eslint-disable-next-line testing-library/no-unnecessary-act -- the sync act inside render leaves the use() retry unflushed; only an async act settles it.
  await act(async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
  });
  return router;
}

function percentOf(count: number, total: number) {
  return Math.round((count / total) * 100);
}

beforeAll(async () => {
  // Load the game product UI modules once so the pages do not wait on a cold import.
  await loadClientProductUi();
});

beforeEach(() => {
  mocks.auth = { user: REGISTERED_USER, loading: false };
  mocks.stats = { data: undefined, isError: false, isFetching: false, refetch: vi.fn() };
  mocks.fetchUserUnlocks.mockReset();
});

describe('UnlocksPage', () => {
  it('shows the own collection by category and resets the rarity filter on a tab change', async () => {
    mocks.stats.data = { unlockedItems: [UNLOCKED_NAME_STYLE] };
    await renderAt('/unlocks');

    expect(await screen.findByRole('heading', { name: '解锁一览' })).toBeInTheDocument();
    const avatarPercent = percentOf(FREE_AVATAR_IDS.size, AVATAR_IDS.length);
    expect(
      await screen.findByText(`已收集 ${avatarPercent}%，继续游玩解锁更多`),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(AVATAR_IDS.length);

    await userEvent.click(screen.getByRole('button', { name: '史诗稀有度' }));
    await userEvent.click(screen.getByRole('tab', { name: '名字' }));

    expect(screen.getByRole('button', { name: '全部稀有度' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const grid = screen.getByRole('tabpanel', { name: '名字' });
    const cells = within(grid).getAllByRole('listitem');
    expect(cells).toHaveLength(NAME_STYLE_IDS.length);
    expect(cells[0]).toHaveAccessibleName(NAME_STYLE_NAMES[UNLOCKED_NAME_STYLE]);
    expect(within(grid).getAllByRole('listitem', { name: '未解锁' })).toHaveLength(
      NAME_STYLE_IDS.length - 1,
    );
    expect(screen.getByText(`/${NAME_STYLE_IDS.length}`)).toBeInTheDocument();
  });

  it('shows guests only the free items, ignoring any cached stats', async () => {
    mocks.auth = { user: null, loading: false };
    mocks.stats.data = { unlockedItems: [UNLOCKED_NAME_STYLE] };
    await renderAt('/unlocks');

    await userEvent.click(await screen.findByRole('tab', { name: '名字' }));

    expect(screen.getAllByRole('listitem', { name: '未解锁' })).toHaveLength(NAME_STYLE_IDS.length);
  });

  it("shows another player's collection and returns to the room", async () => {
    mocks.fetchUserUnlocks.mockResolvedValue({ unlockedItems: [] });
    const router = await renderAt('/unlocks/1234?userId=user-2&displayName=狼王');

    expect(await screen.findByRole('heading', { name: '狼王的收藏' })).toBeInTheDocument();
    expect(mocks.fetchUserUnlocks).toHaveBeenCalledWith('user-2', expect.any(AbortSignal));
    const avatarPercent = percentOf(FREE_AVATAR_IDS.size, AVATAR_IDS.length);
    expect(await screen.findByText(`已收集 ${avatarPercent}%`)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: '返回' }));
    expect(router.state.location.pathname).toBe('/room/1234');
  });

  it('offers a retry when the collection fails to load', async () => {
    mocks.fetchUserUnlocks.mockRejectedValueOnce(new Error('offline'));
    mocks.fetchUserUnlocks.mockResolvedValueOnce({ unlockedItems: [] });
    await renderAt('/unlocks?userId=user-2');

    expect(await screen.findByRole('alert')).toHaveTextContent('加载失败');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(await screen.findByRole('region', { name: 'TA的收藏' })).toBeInTheDocument();
  });
});
