/** Gallery-only server clock; resample after returning from the background. */

import { useEffect, useState } from 'react';

import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';
import { type ServerClock, synchronizeServerClock } from '@/services/serverClock';
import { roomScreenLog } from '@/utils/logger';

const LOCAL_CLOCK: ServerClock = { nowMs: () => Date.now() };

/** Null while the first calibration is pending, so a reveal cannot flash its completed state. */
export function useGalleryClock(isActive: boolean): ServerClock | null {
  const [clock, setClock] = useState<ServerClock | null>(null);
  const isVisible = useAppVisibility();
  useEffect(() => {
    if (!isActive || !isVisible) return;
    const controller = new AbortController();
    synchronizeServerClock(controller.signal).then(
      (calibrated) => setClock(calibrated),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        roomScreenLog.warn('Gallery clock calibration unavailable; using device time', { error });
        setClock(LOCAL_CLOCK);
      },
    );
    return () => controller.abort();
  }, [isActive, isVisible]);
  return clock;
}
