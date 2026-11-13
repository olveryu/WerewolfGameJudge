import { useMemo } from 'react';

import type { RoomProfileSelection } from '@/features/room/controllers/useRoomProfileController';
import { getRoomOccupantUserId } from '@/features/room/model/RoomOccupant';
import type { RoomProfileCardModel } from '@/features/room/model/RoomProfile';

export function useGameProfileDetails(
  selection: RoomProfileSelection | null,
  title: string,
  countLabel: string,
): RoomProfileCardModel['gameDetails'] {
  return useMemo(() => {
    if (selection === null) return null;
    const statsUserId = getRoomOccupantUserId(selection.target.occupant);
    return statsUserId === null ? null : { title, statsUserId, countLabel };
  }, [countLabel, selection, title]);
}
