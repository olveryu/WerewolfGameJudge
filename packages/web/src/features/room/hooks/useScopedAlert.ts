import { useCallback, useEffect, useRef } from 'react';

import { dismissAlert } from '@/utils/alert';

interface ScopedAlert {
  readonly generation: number;
  readonly identity: string;
}

/**
 * Dismisses an alert when its owning state identity changes or unmounts.
 * The generation guard leaves any newer global alert untouched.
 */
export function useScopedAlert(identity: string) {
  const alertRef = useRef<ScopedAlert | null>(null);

  useEffect(() => {
    const alert = alertRef.current;
    if (alert === null || alert.identity === identity) return;
    dismissAlert(alert.generation);
    alertRef.current = null;
  }, [identity]);

  useEffect(
    () => () => {
      const alert = alertRef.current;
      if (alert === null) return;
      dismissAlert(alert.generation);
      alertRef.current = null;
    },
    [],
  );

  return useCallback(
    (generation: number | null, alertIdentity = identity): void => {
      if (generation === null) return;
      alertRef.current = { generation, identity: alertIdentity };
    },
    [identity],
  );
}
