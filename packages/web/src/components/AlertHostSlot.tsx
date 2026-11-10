import { lazy, Suspense, useState, useSyncExternalStore } from 'react';

import { alertStore } from '@/utils/alert';

const AlertHost = lazy(async () => ({
  default: (await import('@/components/AlertHost')).AlertHost,
}));

/**
 * Loads the alert dialog chunk on the first alert, then keeps it mounted: the host keeps its
 * dialog content node across replacements and plays the exit motion.
 */
export function AlertHostSlot() {
  const alert = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
  const [mounted, setMounted] = useState(false);
  if (alert !== null && !mounted) setMounted(true);
  if (!mounted && alert === null) return null;
  return (
    <Suspense fallback={null}>
      <AlertHost />
    </Suspense>
  );
}
