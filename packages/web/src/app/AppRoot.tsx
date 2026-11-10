import { Portal } from '@ark-ui/react/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useCallback, useLayoutEffect, useSyncExternalStore } from 'react';
import { Outlet, useMatches } from 'react-router';
import { Toaster } from 'sonner';

import { queryClient } from '@/app/queryClient';
import { getAppServices } from '@/app/services';
import { AlertHostSlot } from '@/components/AlertHostSlot';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ServiceProvider, useServices } from '@/contexts/ServiceContext';
import { LoginDialogSlot } from '@/features/auth/LoginDialogSlot';
import { WechatLoginEntry } from '@/features/auth/WechatLoginEntry';
import { ClientGameModulesProvider, ClientGameOverlays } from '@/games/clientModules';

// The inbox consumer's Zod schemas stay out of the start-up chunk.
const AccountInboxHost = lazy(async () => ({
  default: (await import('@/features/account/AccountInboxHost')).AccountInboxHost,
}));
// The daily-reward claim and its toast stay out of the start-up chunk.
const DailyRewardHost = lazy(async () => ({
  default: (await import('@/features/gacha/DailyRewardHost')).DailyRewardHost,
}));

/**
 * Root route element: app-wide providers around the active page, the loaded games' overlays, plus
 * the global alert dialog and toast region. Services are created once per page load.
 */
export function AppRoot() {
  const services = getAppServices();
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <AuthProvider>
          <ClientGameModulesProvider>
            <RoomLinkScope />
            <Suspense fallback={null}>
              <AccountInboxHost />
              <DailyRewardHost />
            </Suspense>
            <AppContent />
            <ClientGameOverlays />
          </ClientGameModulesProvider>
          <AlertHostSlot />
          <LoginDialogSlot />
          {/* Body-level like the dialogs, so its own z-index puts toasts above an open dialog. */}
          <Portal>
            <Toaster position="top-center" />
          </Portal>
        </AuthProvider>
      </ServiceProvider>
    </QueryClientProvider>
  );
}

/**
 * Room links live for the room flow: the room page and its subpages share the `roomCode` route
 * param. A layout effect releases the rest before any page's passive effect enters a room, so a
 * new room never finds the previous room still holding the lease.
 */
function RoomLinkScope() {
  const matches = useMatches();
  const roomCode = matches.at(-1)?.params.roomCode ?? null;
  const { authService, releaseRoomLinksOutside } = useServices();
  // The session user, not the profile: a profile refetch must not read as a user change.
  const userId = useSyncExternalStore(
    useCallback((onChange: () => void) => authService.subscribeAuth(onChange), [authService]),
    () => authService.getAuthSession()?.userId ?? null,
  );
  useLayoutEffect(() => {
    releaseRoomLinksOutside({ roomCode, userId });
  }, [releaseRoomLinksOutside, roomCode, userId]);
  return null;
}

/** Inside the mini-program, an unclaimed WeChat login replaces the app with its entry page. */
function AppContent() {
  const { needsWechatLogin } = useAuthContext();
  return needsWechatLogin ? <WechatLoginEntry /> : <Outlet />;
}
