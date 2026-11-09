/** Shared React controller for the single room-creation service. */

import { useMutation } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import type { RoomCreationRequest, RoomRecord } from '@/features/room/model/RoomDirectory';

export interface RoomCreationController {
  readonly createRoom: (request: RoomCreationRequest) => Promise<RoomRecord>;
  readonly isCreating: boolean;
}

export function useRoomCreationController(): RoomCreationController {
  const { roomCreator } = useServices();
  const { isPending, mutateAsync } = useMutation({
    mutationFn: (request: RoomCreationRequest) => roomCreator.createRoom(request),
  });

  const createRoom = useCallback(
    (request: RoomCreationRequest): Promise<RoomRecord> => mutateAsync(request),
    [mutateAsync],
  );

  return useMemo(() => ({ createRoom, isCreating: isPending }), [createRoom, isPending]);
}
