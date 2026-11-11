import { useSyncExternalStore } from 'react';

import { LoginDialog } from '@/features/auth/LoginDialog';
import { loginRequestStore } from '@/features/auth/loginRequests';

/** Mounts the login dialog only while a login is requested. */
export function LoginDialogSlot() {
  const pending = useSyncExternalStore(loginRequestStore.subscribe, loginRequestStore.getSnapshot);
  if (pending === null) return null;
  return <LoginDialog />;
}
