/** Compose shared room presentation controllers without interpreting game state or permissions. */

import { useGachaStatusQuery } from '@/features/gacha/queries/useGachaQuery';

import { type AutoShowRoomShareQrInput, useAutoShowRoomShareQr } from './useAutoShowRoomShareQr';
import { useRoomShareController } from './useRoomShareController';
import { useRoomTitleActions } from './useRoomTitleActions';

type RoomPresentationInput = Parameters<typeof useRoomShareController>[0] &
  Omit<AutoShowRoomShareQrInput, 'openShare'>;

/** Bind the share sheet, creation-entry effect, title gestures and user reward status once. */
export function useRoomPresentationController(input: RoomPresentationInput) {
  const share = useRoomShareController(input);
  const titleActions = useRoomTitleActions();
  const { data: gachaStatus } = useGachaStatusQuery();
  useAutoShowRoomShareQr({
    isHost: input.isHost,
    entryReason: input.entryReason,
    openShare: share.open,
  });
  return { share, titleActions, gachaStatus };
}
