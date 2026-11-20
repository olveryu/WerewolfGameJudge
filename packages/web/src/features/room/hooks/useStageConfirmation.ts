import { useEffect, useRef } from 'react';

import { alertStore, dismissAlert } from '@/utils/alert';
import { showConfirmAlert } from '@/utils/alertPresets';

/** Dismisses a pending confirmation when its stage expires or unmounts. */
export function useStageConfirmation(stage: string) {
  const generation = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (generation.current !== null) dismissAlert(generation.current);
      generation.current = null;
    },
    [stage],
  );

  return (title: string, message: string, onConfirm: () => void | Promise<void>): void => {
    showConfirmAlert(title, message, onConfirm);
    generation.current = alertStore.getSnapshot()?.generation ?? null;
  };
}
