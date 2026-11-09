/** Settings: rendering, signed-out login options, growth details and avatar upload. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { toast } from 'sonner';

import type { User } from '@/contexts/AuthContext';
import type { UserStats } from '@/features/account/services/accountApi';
import { SettingsPage } from '@/routes/settings/SettingsPage';
import { showErrorAlert } from '@/utils/alertPresets';

const mocks = vi.hoisted(() => ({
  auth: {
    user: null as User | null,
    loading: false,
    error: null,
    refreshUser: vi.fn(),
  },
  stats: undefined as UserStats | undefined,
  uploadAvatar: vi.fn(),
  refreshSavedProfile: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({ useAuthContext: () => mocks.auth }));
vi.mock('@/features/account/queries/useUserStatsQuery', () => ({
  useUserStatsQuery: () => ({ data: mocks.stats }),
}));
vi.mock('@/features/account/accountMutations', () => ({
  useUpdateProfile: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useChangePassword: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUploadAvatar: () => ({ mutateAsync: mocks.uploadAvatar, isPending: false }),
  refreshSavedProfile: mocks.refreshSavedProfile,
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

async function renderSettings() {
  const router = createMemoryRouter([{ path: '/settings', element: <SettingsPage /> }], {
    initialEntries: ['/settings'],
  });
  render(<RouterProvider router={router} />);
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

  it('shows the login options when signed out', async () => {
    await renderSettings();

    expect(screen.getByText('邮箱登录')).toBeInTheDocument();
    expect(screen.getByText('匿名登录')).toBeInTheDocument();
  });

  it('shows the unlock teaser to anonymous users', async () => {
    mocks.auth.user = { ...REGISTERED_USER, email: null, displayName: null, isAnonymous: true };
    await renderSettings();

    expect(screen.getByText(/^绑定邮箱，解锁 \d+ 款暗黑头像/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '上传头像' })).toBeNull();
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

  it('uploads the picked avatar and refreshes the profile', async () => {
    mocks.auth.user = REGISTERED_USER;
    mocks.uploadAvatar.mockResolvedValue('https://cdn.example/avatar.jpg');
    mocks.refreshSavedProfile.mockResolvedValue(true);
    await renderSettings();
    const file = new File(['image'], 'me.png', { type: 'image/png' });

    await userEvent.upload(screen.getByTestId('settings-avatar-input'), file);

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('头像已更新'));
    expect(mocks.uploadAvatar).toHaveBeenCalledWith(file);
    expect(mocks.refreshSavedProfile).toHaveBeenCalledWith(mocks.auth.refreshUser);
  });

  it('warns when the avatar saved but the profile refresh failed', async () => {
    mocks.auth.user = REGISTERED_USER;
    mocks.uploadAvatar.mockResolvedValue('https://cdn.example/avatar.jpg');
    mocks.refreshSavedProfile.mockResolvedValue(false);
    await renderSettings();

    await userEvent.upload(
      screen.getByTestId('settings-avatar-input'),
      new File(['image'], 'me.png', { type: 'image/png' }),
    );

    await waitFor(() => expect(toast.warning).toHaveBeenCalledWith('头像已保存，资料刷新失败'));
  });

  it('alerts when the upload fails', async () => {
    mocks.auth.user = REGISTERED_USER;
    mocks.uploadAvatar.mockRejectedValue(new Error('图片解码失败，请换一张图片重试'));
    await renderSettings();

    await userEvent.upload(
      screen.getByTestId('settings-avatar-input'),
      new File(['image'], 'me.png', { type: 'image/png' }),
    );

    await waitFor(() =>
      expect(showErrorAlert).toHaveBeenCalledWith('上传失败', expect.any(String)),
    );
    expect(mocks.refreshSavedProfile).not.toHaveBeenCalled();
  });
});
