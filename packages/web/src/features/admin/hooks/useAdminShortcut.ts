import { useCallback, useRef } from 'react';

const TAP_THRESHOLD = 4;
const TAP_TIMEOUT_MS = 3000;

/** Open the password-gated admin portal after four consecutive taps within the gesture window. */
export function useAdminShortcut(onOpen: () => void) {
  const taps = useRef({ count: 0, lastTapMs: 0 });

  const reset = useCallback(() => {
    taps.current = { count: 0, lastTapMs: 0 };
  }, []);

  const onPress = useCallback(() => {
    const now = Date.now();
    const current = taps.current;
    current.count = now - current.lastTapMs <= TAP_TIMEOUT_MS ? current.count + 1 : 1;
    current.lastTapMs = now;
    if (current.count < TAP_THRESHOLD) return;
    reset();
    onOpen();
  }, [onOpen, reset]);

  return { onPress, reset };
}
