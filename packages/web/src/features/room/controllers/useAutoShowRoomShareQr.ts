/** Auto-opens the room share sheet once for a host who just created the room. */

import { useEffect, useRef } from 'react';

import type { RoomEntryReason } from '../model/RoomUiModule';

export interface AutoShowRoomShareQrInput {
  readonly isHost: boolean;
  readonly entryReason: RoomEntryReason;
  readonly openShare: () => void;
}

/**
 * Fires openShare exactly once, on the first render where the viewer is
 * the host and the room was entered via creation. Shared by all seven
 * games; previously each room hook (and the werewolf Screen) carried a
 * verbatim copy of this ref + effect.
 */
export function useAutoShowRoomShareQr(input: AutoShowRoomShareQrInput): void {
  const hasAutoShownQR = useRef(false);
  const { isHost, entryReason, openShare } = input;
  useEffect(() => {
    if (isHost && entryReason === 'created' && !hasAutoShownQR.current) {
      hasAutoShownQR.current = true;
      openShare();
    }
  }, [entryReason, isHost, openShare]);
}
