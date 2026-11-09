import { Portal } from '@ark-ui/react/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

import { queryClient } from '@/app/queryClient';
import { getAppServices } from '@/app/services';
import { AlertHost } from '@/components/AlertHost';
import { AuthProvider, useAuthContext } from '@/contexts/AuthContext';
import { ServiceProvider } from '@/contexts/ServiceContext';
import { LoginDialogSlot } from '@/features/auth/LoginDialogSlot';
import { WechatLoginEntry } from '@/features/auth/WechatLoginEntry';
import { ClientGameModulesProvider } from '@/games/clientModules';

/**
 * Root route element: app-wide providers around the active page, plus the global alert dialog
 * and toast region. Services are created once per page load.
 */
export function AppRoot() {
  const services = getAppServices();
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <AuthProvider>
          <ClientGameModulesProvider>
            <AppContent />
          </ClientGameModulesProvider>
          <AlertHost />
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

/** Inside the mini-program, an unclaimed WeChat login replaces the app with its entry page. */
function AppContent() {
  const { needsWechatLogin } = useAuthContext();
  return needsWechatLogin ? <WechatLoginEntry /> : <Outlet />;
}
