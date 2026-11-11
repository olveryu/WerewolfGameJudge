import { useState, useSyncExternalStore } from 'react';

import { AlertHost } from '@/components/AlertHost';
import { alertStore } from '@/utils/alert';

/**
 * Mounts the alert dialog on the first alert, then keeps it mounted: the host keeps its
 * dialog content node across replacements and plays the exit motion.
 */
export function AlertHostSlot() {
  const alert = useSyncExternalStore(alertStore.subscribe, alertStore.getSnapshot);
  const [mounted, setMounted] = useState(false);
  if (alert !== null && !mounted) setMounted(true);
  if (!mounted && alert === null) return null;
  return <AlertHost />;
}
