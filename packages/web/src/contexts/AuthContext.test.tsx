import { isCancelledError, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import {
  fetchMaintenance,
  MAINTENANCE_POLL_MS,
  type MaintenanceConfig,
} from '@/features/maintenance/maintenance';
import { MaintenanceGate } from '@/features/maintenance/MaintenanceGate';
import type { AuthSession, AuthUser, GetCurrentUserResponse } from '@/services/types/IAuthService';

const authService = vi.hoisted(() => ({
  getAuthSession: vi.fn<() => AuthSession | null>(),
  subscribeAuth: vi.fn<(callback: () => void) => () => void>(),
  waitForInit: vi.fn<() => Promise<void>>(),
  getCurrentUser: vi.fn<() => Promise<GetCurrentUserResponse | null>>(),
  onAuthExpired: vi.fn<(callback: () => void) => () => void>(),
  needsWechatLogin: false,
}));

vi.mock('@/contexts/ServiceContext', () => ({
  useServices: () => ({ authService }),
}));
vi.mock('@/features/maintenance/maintenance', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/maintenance/maintenance')>()),
  fetchMaintenance: vi.fn(),
}));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const maintenance: MaintenanceConfig = {
  enabled: false,
  message: 'Scheduled maintenance',
  endsAt: '2099-01-02T09:00:00Z',
};

function createUser(userId: string): AuthUser {
  return {
    id: userId,
    email: null,
    is_anonymous: true,
    has_wechat: false,
    user_metadata: {
      display_name: null,
      avatar_url: null,
      custom_avatar_url: null,
      avatar_frame: null,
      seat_flair: null,
      name_style: null,
      equipped_effect: null,
      seat_animation: null,
    },
  };
}

function GameProbe({ onUnmount }: { onUnmount: () => void }) {
  const { user, loading } = useAuthContext();
  useEffect(() => onUnmount, [onUnmount]);
  return (
    <>
      <output aria-label="Current user">{loading ? 'loading' : (user?.id ?? 'signed out')}</output>
      <input aria-label="Game draft" defaultValue="" />
    </>
  );
}

function mountPlayer(initialUser: AuthUser | null) {
  let session: AuthSession | null =
    initialUser === null ? null : { userId: initialUser.id, initialUser };
  const listeners = new Set<() => void>();
  authService.getAuthSession.mockImplementation(() => session);
  authService.subscribeAuth.mockImplementation((listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  });
  authService.waitForInit.mockResolvedValue();
  authService.getCurrentUser.mockImplementation(async () =>
    session?.initialUser ? { data: { user: session.initialUser } } : null,
  );
  authService.onAuthExpired.mockReturnValue(() => undefined);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const onUnmount = vi.fn<() => void>();
  const view = render(
    <QueryClientProvider client={client}>
      <MaintenanceGate>
        <AuthProvider>
          <GameProbe onUnmount={onUnmount} />
        </AuthProvider>
      </MaintenanceGate>
    </QueryClientProvider>,
  );
  return {
    client,
    onUnmount,
    changeUser(user: AuthUser | null) {
      session = user === null ? null : { userId: user.id, initialUser: user };
      for (const listener of listeners) listener();
    },
    dispose() {
      view.unmount();
      client.clear();
    },
  };
}

afterEach(() => {
  vi.resetAllMocks();
  vi.useRealTimers();
});

describe('authentication query isolation', () => {
  it.each(['login', 'switch', 'logout'] as const)(
    'preserves the mounted game across %s and the next maintenance poll',
    async (transition) => {
      vi.useFakeTimers();
      vi.mocked(fetchMaintenance).mockResolvedValue(maintenance);
      const previousUser = transition === 'login' ? null : createUser('previous-user');
      const nextUser = transition === 'logout' ? null : createUser('next-user');
      const player = mountPlayer(previousUser);
      try {
        await act(() => vi.advanceTimersByTimeAsync(1));
        const draft = screen.getByRole('textbox', { name: 'Game draft' });
        fireEvent.change(draft, { target: { value: 'Unsubmitted guess' } });
        const privateKey = ['feedbackHistory', previousUser?.id ?? null];
        player.client.setQueryData(privateKey, ['Private feedback']);

        await act(async () => player.changeUser(nextUser));
        expect(player.client.getQueryData(privateKey)).toBeUndefined();
        if (previousUser !== null) {
          expect(player.client.getQueryData(['authUser', previousUser.id])).toBeUndefined();
        }
        expect(screen.getByLabelText('Current user')).toHaveTextContent(
          nextUser?.id ?? 'signed out',
        );
        let finishPoll: ((value: MaintenanceConfig) => void) | undefined;
        vi.mocked(fetchMaintenance).mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              finishPoll = resolve;
            }),
        );
        await act(() => vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS));
        expect(fetchMaintenance).toHaveBeenCalledTimes(2);
        expect(player.onUnmount).not.toHaveBeenCalled();
        expect(screen.getByRole('textbox', { name: 'Game draft' })).toBe(draft);
        expect(draft).toHaveValue('Unsubmitted guess');
        await act(async () => finishPoll?.(maintenance));
        expect(player.onUnmount).not.toHaveBeenCalled();
      } finally {
        player.dispose();
      }
    },
  );

  it('cancels private requests but keeps an in-flight maintenance check across identity changes', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchMaintenance).mockResolvedValueOnce(maintenance);
    const player = mountPlayer(createUser('previous-user'));
    try {
      await act(() => vi.advanceTimersByTimeAsync(1));
      let maintenanceSignal: AbortSignal | undefined;
      let finishMaintenance: ((value: MaintenanceConfig) => void) | undefined;
      vi.mocked(fetchMaintenance).mockImplementationOnce(
        (signal) =>
          new Promise((resolve) => {
            maintenanceSignal = signal;
            finishMaintenance = resolve;
          }),
      );
      await act(() => vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS));
      const privateKey = ['feedbackHistory', 'previous-user'];
      let privateSignal: AbortSignal | undefined;
      const privateRequest = player.client.fetchQuery({
        queryKey: privateKey,
        meta: { authScope: 'session' },
        queryFn: ({ signal }) => {
          privateSignal = signal;
          return new Promise<never>(() => undefined);
        },
      });
      const cancelledPrivateRequest = expect(privateRequest).rejects.toSatisfy(isCancelledError);

      await act(async () => player.changeUser(createUser('next-user')));
      await cancelledPrivateRequest;
      expect(privateSignal?.aborted).toBe(true);
      expect(player.client.getQueryData(privateKey)).toBeUndefined();
      expect(maintenanceSignal?.aborted).toBe(false);
      await act(async () => finishMaintenance?.(maintenance));
      await act(() => vi.advanceTimersByTimeAsync(1));
      expect(player.onUnmount).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Current user')).toHaveTextContent('next-user');

      vi.mocked(fetchMaintenance).mockResolvedValue({ ...maintenance, enabled: true });
      await act(() => vi.advanceTimersByTimeAsync(MAINTENANCE_POLL_MS));
      expect(screen.getByRole('heading', { name: '系统维护中' })).toBeInTheDocument();
      expect(player.onUnmount).toHaveBeenCalledTimes(1);
    } finally {
      player.dispose();
    }
  });
});
