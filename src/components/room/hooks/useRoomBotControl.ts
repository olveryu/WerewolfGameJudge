/**
 * useRoomBotControl — shared controlled-seat state for Host bot testing.
 *
 * The hook owns only local control state. Game adapters decide whether bot control
 * is enabled and how to identify bot seats.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

export type RoomBotControlToggleResult =
  | { kind: 'controlled'; seat: number }
  | { kind: 'released'; seat: number }
  | { kind: 'ignored' }
  | { kind: 'invalid_target' };

interface UseRoomBotControlParams {
  enabled: boolean;
  mySeat: number | null;
  isBotSeat: (seat: number) => boolean;
}

export function useRoomBotControl({ enabled, mySeat, isBotSeat }: UseRoomBotControlParams) {
  const [controlledSeat, setControlledSeat] = useState<number | null>(null);

  const activeControlledSeat = enabled ? controlledSeat : null;
  const effectiveSeat = activeControlledSeat ?? mySeat;

  useEffect(() => {
    if (controlledSeat === null) return;
    if (!enabled || !isBotSeat(controlledSeat)) {
      setControlledSeat(null);
    }
  }, [controlledSeat, enabled, isBotSeat]);

  const releaseControlledSeat = useCallback(() => {
    setControlledSeat(null);
  }, []);

  const toggleControlledSeat = useCallback(
    (seat: number): RoomBotControlToggleResult => {
      if (!enabled) return { kind: 'ignored' };
      if (!isBotSeat(seat)) return { kind: 'invalid_target' };

      if (controlledSeat === seat) {
        setControlledSeat(null);
        return { kind: 'released', seat };
      }

      setControlledSeat(seat);
      return { kind: 'controlled', seat };
    },
    [controlledSeat, enabled, isBotSeat],
  );

  return useMemo(
    () => ({
      controlledSeat,
      activeControlledSeat,
      effectiveSeat,
      isDelegating: activeControlledSeat !== null,
      setControlledSeat,
      releaseControlledSeat,
      toggleControlledSeat,
    }),
    [
      activeControlledSeat,
      controlledSeat,
      effectiveSeat,
      releaseControlledSeat,
      toggleControlledSeat,
    ],
  );
}
