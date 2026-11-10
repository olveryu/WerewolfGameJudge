/** Appearance: equipping a draft, the guest pitch and the collection load error. */
import { NAME_STYLE_IDS } from '@game-judge/game-engine/product/rewards';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { toast } from 'sonner';

import type { User } from '@/contexts/AuthContext';
import { loadClientProductUi } from '@/features/product/loadClientProductUi';
import { NAME_STYLE_NAMES } from '@/features/product/model/cosmeticNames';
import { AppearancePage } from '@/routes/appearance/AppearancePage';
import { TESTIDS } from '@/testids';

const mocks = vi.hoisted(() => ({
  auth: { user: null as User | null, loading: false, refreshUser: vi.fn() },
  stats: {
    data: undefined as { unlockedItems: readonly string[] } | undefined,
    isError: false,
    isFetching: false,
    refetch: vi.fn(),
  },
  updateProfile: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => mocks.auth }));
vi.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => mocks.stats,
}));
vi.mock('@/features/account/accountMutations', () => ({
  useUpdateProfile: () => ({ mutateAsync: mocks.updateProfile, isPending: false }),
  useUploadAvatar: () => ({ mutateAsync: vi.fn(), isPending: false }),
  refreshSavedProfile: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/games/clientModules', () => ({
  useActiveRoomAccount: () => ({ phase: 'idle', canSwitchAccount: true }),
}));
// The scene stage needs a canvas; the previews' own tests cover it.
vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentSceneLayer: () => null,
  ResidentAvatarTile: () => <span data-testid="resident-tile" />,
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), warning: vi.fn(), info: vi.fn() }),
}));

const REGISTERED_USER: User = {
  id: 'user-1',
  email: 'a@b.c',
  displayName: '狼王',
  avatarUrl: null,
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: false,
};
const UNLOCKED_NAME_STYLE = NAME_STYLE_IDS[0];

/** Renders inside an awaited `act` so the editor's `use()` of the product UI settles. */
async function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/appearance/:roomCode?', element: <AppearancePage /> },
      { path: '/settings/:roomCode?', element: <p>设置页</p> },
    ],
    { initialEntries: [path] },
  );
  // eslint-disable-next-line testing-library/no-unnecessary-act -- the sync act inside render leaves the use() retry unflushed; only an async act settles it.
  await act(async () => {
    render(<RouterProvider router={router} />);
  });
  return router;
}

beforeAll(async () => {
  // Load the game product UI modules once so the page does not wait on a cold import.
  await loadClientProductUi();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = REGISTERED_USER;
  mocks.stats = { data: undefined, isError: false, isFetching: false, refetch: vi.fn() };
  mocks.updateProfile.mockResolvedValue(undefined);
});

describe('AppearancePage', () => {
  it('equips a selected name style through the account API and returns to settings', async () => {
    mocks.stats.data = { unlockedItems: [UNLOCKED_NAME_STYLE] };
    const router = await renderAt('/appearance/1234');

    expect(await screen.findByRole('button', { name: '未做更改' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await userEvent.click(screen.getByRole('tab', { name: '名字' }));
    await userEvent.click(
      screen.getByRole('button', { name: NAME_STYLE_NAMES[UNLOCKED_NAME_STYLE] }),
    );
    expect(screen.getByText('有未保存的更改')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '确认使用' }));

    expect(mocks.updateProfile).toHaveBeenCalledWith({ nameStyle: UNLOCKED_NAME_STYLE });
    expect(toast.success).toHaveBeenCalledWith('形象已更新');
    expect(router.state.location.pathname).toBe('/settings/1234');
  });

  it('shows guests the register pitch instead of the upload', async () => {
    mocks.auth.user = null;
    const router = await renderAt('/appearance');

    expect(await screen.findByText('绑定后可上传')).toBeInTheDocument();
    expect(screen.queryByTestId(TESTIDS.appearanceAvatarInput)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '立即注册' }));

    expect(router.state.location.pathname).toBe('/settings');
  });

  it('offers a retry when the collection fails to load', async () => {
    mocks.stats.isError = true;
    await renderAt('/appearance');

    expect(screen.getByRole('alert')).toHaveTextContent('藏品加载失败');
    await userEvent.click(screen.getByRole('button', { name: '重试' }));

    expect(mocks.stats.refetch).toHaveBeenCalledTimes(1);
  });
});
