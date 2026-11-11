import { Portal } from '@ark-ui/react/portal';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';

import { queryClient } from '@/app/queryClient';
import { AlertHostSlot } from '@/components/AlertHostSlot';
import { AdminPage } from '@/routes/admin/AdminPage';

/** Keep the standalone admin portal accessible without player authentication or D1. */
export function AdminRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminPage />
      <AlertHostSlot />
      <Portal>
        <Toaster position="top-center" />
      </Portal>
    </QueryClientProvider>
  );
}
