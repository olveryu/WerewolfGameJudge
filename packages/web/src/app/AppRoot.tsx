import { QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { Outlet } from 'react-router';
import { Toaster } from 'sonner';

import { queryClient } from '@/app/queryClient';
import { createAppServices } from '@/app/services';
import { AlertHost } from '@/components/AlertHost';
import { AuthProvider } from '@/contexts/AuthContext';
import { ServiceProvider } from '@/contexts/ServiceContext';

/**
 * Root route element: app-wide providers around the active page, plus the global alert dialog
 * and toast region. Services are created once per page load.
 */
export function AppRoot() {
  const [services] = useState(createAppServices);
  return (
    <QueryClientProvider client={queryClient}>
      <ServiceProvider services={services}>
        <AuthProvider>
          <Outlet />
          <AlertHost />
          <Toaster position="top-center" />
        </AuthProvider>
      </ServiceProvider>
    </QueryClientProvider>
  );
}
