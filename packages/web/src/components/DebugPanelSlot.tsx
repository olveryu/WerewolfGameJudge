import { lazy, Suspense, useState, useSyncExternalStore } from 'react';

import { debugLogStore } from '@/utils/debugLogStore';

const DebugPanel = lazy(async () => ({
  default: (await import('@/components/DebugPanel')).DebugPanel,
}));

/**
 * Loads the debug console chunk the first time it is opened, then keeps it mounted so its
 * filter and search survive closing and reopening.
 */
export function DebugPanelSlot() {
  const { visible } = useSyncExternalStore(debugLogStore.subscribe, debugLogStore.getSnapshot);
  const [mounted, setMounted] = useState(false);
  if (visible && !mounted) setMounted(true);
  if (!mounted && !visible) return null;
  return (
    <Suspense fallback={null}>
      <DebugPanel />
    </Suspense>
  );
}
