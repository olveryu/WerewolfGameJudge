import { useEffect, useRef } from 'react';

/** Hold time that turns a press into a long press. */
const DEFAULT_LONG_PRESS_MS = 500;

/**
 * Pointer handlers for an element that distinguishes a press from a long press. A long press
 * suppresses the click that follows its release; moving off the element cancels it.
 * `onLongPress` null disables long presses and leaves clicks untouched.
 */
export function useLongPress(
  onLongPress: (() => void) | null,
  delayMs: number = DEFAULT_LONG_PRESS_MS,
) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firedRef = useRef(false);

  const cancel = () => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  useEffect(() => cancel, []);

  return {
    onPointerDown: () => {
      firedRef.current = false;
      if (onLongPress === null) return;
      cancel();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, delayMs);
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (event: { preventDefault: () => void }) => {
      // The platform's long-press menu would cover the gesture.
      if (onLongPress !== null) event.preventDefault();
    },
    /** True when the click being handled ends a long press and must be ignored. */
    consumeLongPress: (): boolean => {
      const fired = firedRef.current;
      firedRef.current = false;
      return fired;
    },
  };
}
