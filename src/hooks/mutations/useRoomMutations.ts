/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoomSaga: create through RoomDirectory, persist recent room, acknowledge creation
 * Network retry handled by cfFetch (fetchWithRetry), no mutation-layer retry needed.
 */

import { useMutation } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useServices } from '@/contexts/ServiceContext';
import { completeRoomCreation } from '@/features/room/services/completeRoomCreation';
import type { CreatedRoom, CreateRoomRequest } from '@/services/types/IRoomDirectoryService';

/** Complete client side of the room-creation saga after the server returns a durable record. */
export function useCreateRoomSaga(): {
  readonly createRoom: (request: CreateRoomRequest) => Promise<CreatedRoom>;
} {
  const { roomDirectory } = useServices();
  const { mutateAsync } = useMutation({
    mutationFn: (request: CreateRoomRequest) => roomDirectory.createRoom(request),
  });
  const createRoom = useCallback(
    async (request: CreateRoomRequest): Promise<CreatedRoom> => {
      const record = await mutateAsync(request);
      return completeRoomCreation(roomDirectory, record);
    },
    [mutateAsync, roomDirectory],
  );
  return { createRoom };
}
