/** Settings: rendering, signed-out login options, growth details and appearance / unlocks entries. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router';

import type { User } from '@/contexts/AuthContext';
import type { UserStats } from '@/features/account/services/accountApi';
import { SettingsPage } from '@/routes/settings/SettingsPage';

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as User | null,
    loading: false,
    error: null,
    refreshUser: vi.fn(),
  },
  stats: undefined as UserStats | undefined,
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => mocks.auth }));
vi.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => ({ data: mocks.stats }),
}));
vi.mock('@/features/account/accountMutations', () => ({
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  refreshSavedProfile: vi.fn(),
}));
vi.mock('@/features/auth/authMutations', () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useSignOut: mutation,
    useSignInAnonymously: mutation,
    useSignInWithEmail: mutation,
    useSignUpWithEmail: mutation,
    useForgotPassword: mutation,
    useResetPassword: mutation,
  };
});
vi.mock('@/games/clientModules', () => ({
  useActiveRoomAccount: () => ({ phase: 'idle', canSwitchAccount: true }),
}));
vi.mock('@/games/catalog', async () => {
  const { lazy } = await import('react');
  return {
    GAME_ACCOUNT_STATS_SECTIONS: [
      {
        gameType: 'werewolf',
        Section: lazy(async () => ({
          default: ({ userId }: { userId: string }) => <p>{`战绩 ${userId}`}</p>,
        })),
      },
    ],
  };
});
vi.mock('@/utils/alertPresets', () => ({
  showErrorAlert: vi.fn(),
  showDestructiveAlert: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), warning: vi.fn(), error: vi.fn() }),
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

async function renderSettings(initialPath = '/settings') {
  const router = createMemoryRouter(
    [
      { path: '/settings/:roomCode?', element: <SettingsPage /> },
      { path: '/appearance/:roomCode?', element: <CurrentLocation /> },
      { path: '/unlocks/:roomCode?', element: <CurrentLocation /> },
    ],
    { initialEntries: [initialPath] },
  );
  render(<RouterProvider router={router} />);
}

function CurrentLocation() {
  const location = useLocation();
  return <p>{`at ${location.pathname}`}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = null;
  mocks.stats = undefined;
});

describe('SettingsPage', () => {
  it('renders the title, account card and back button', async () => {
    await renderSettings();

    expect(screen.getByRole('heading', { name: '设置' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /账户/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回' })).toBeInTheDocument();
  });

  it('shows the login options when signed out, with a way to browse the avatars', async () => {
    await renderSettings();

    expect(screen.getByText('邮箱登录')).toBeInTheDocument();
    expect(screen.getByText('匿名登录')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '浏览全部头像 ›' }));

    expect(await screen.findByText('at /appearance')).toBeInTheDocument();
  });

  it('shows the unlock teaser to anonymous users, linking to the appearance page', async () => {
    mocks.auth.user = { ...REGISTERED_USER, email: null, displayName: null, isAnonymous: true };
    await renderSettings();

    expect(screen.getByText(/^绑定邮箱，解锁 \d+ 款暗黑头像/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '更换头像与装扮' })).toBeNull();
    await userEvent.click(screen.getByRole('link', { name: '浏览全部头像 ›' }));

    expect(await screen.findByText('at /appearance')).toBeInTheDocument();
  });

  it('shows the level, XP progress and game-owned account stats', async () => {
    mocks.auth.user = REGISTERED_USER;
    mocks.stats = { xp: 30, level: 2, gamesPlayed: 7, unlockedItems: [] };
    await renderSettings();

    expect(screen.getByText('Lv.2')).toBeInTheDocument();
    expect(await screen.findByRole('progressbar', { name: '经验进度' })).toBeInTheDocument();
    expect(screen.getByText(/^7 局 · 已解锁 \d+\/\d+$/)).toBeInTheDocument();
    expect(await screen.findByText('战绩 user-1')).toBeInTheDocument();
  });

  it('links the avatar, the wardrobe entry and the unlocks row, staying in the room', async () => {
    mocks.auth.user = REGISTERED_USER;
    mocks.stats = { xp: 30, level: 2, gamesPlayed: 7, unlockedItems: [] };
    await renderSettings('/settings/1234');

    expect(screen.getByRole('link', { name: '更换头像' })).toHaveAttribute(
      'href',
      '/appearance/1234',
    );
    expect(screen.getByRole('link', { name: '更换头像与装扮' })).toHaveAttribute(
      'href',
      '/appearance/1234',
    );
    await userEvent.click(await screen.findByRole('link', { name: /^7 局 · 已解锁/ }));

    expect(await screen.findByText('at /unlocks/1234')).toBeInTheDocument();
  });
});
