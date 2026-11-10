import { lazy, Suspense, useSyncExternalStore } from 'react';

import { loginRequestStore } from '@/features/auth/loginRequests';

const LoginDialog = lazy(async () => {
  const module = await import('@/features/auth/LoginDialog');
  return { default: module.LoginDialog };
});

/** Loads the login dialog chunk only once a login is requested. */
export function LoginDialogSlot() {
  const pending = useSyncExternalStore(loginRequestStore.subscribe, loginRequestStore.getSnapshot);
  if (pending === null) return null;
  return (
    <Suspense fallback={null}>
      <LoginDialog />
    </Suspense>
  );
}
