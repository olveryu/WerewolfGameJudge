/** Shared local identity state for taking over and releasing bot seats. */

import { useCallback, useState } from 'react';

export interface RoomBotControl {
  readonly controlledSeat: number | null;
  readonly takeOver: (seat: number) => void;
  readonly release: () => void;
}

export function useRoomBotControl(): RoomBotControl {
  const [controlledSeat, setControlledSeat] = useState<number | null>(null);

  const takeOver = useCallback((seat: number) => {
    if (!Number.isSafeInteger(seat) || seat < 0) {
      throw new Error(`Controlled bot seat must be a non-negative safe integer: ${seat}`);
    }
    setControlledSeat(seat);
  }, []);

  const release = useCallback(() => {
    if (controlledSeat === null) {
      throw new Error('Cannot release bot control when no bot seat is controlled');
    }
    setControlledSeat(null);
  }, [controlledSeat]);

  return { controlledSeat, takeOver, release };
}
