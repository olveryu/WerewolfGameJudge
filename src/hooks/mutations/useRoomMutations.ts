/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoom: wraps roomDirectory.createRoom (internal creation replay preserved)
 * Network retry handled by cfFetch (fetchWithRetry), no mutation-layer retry needed.
 */

import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';
import type { CreateRoomRequest } from '@/services/types/IRoomDirectoryService';

export function useCreateRoom() {
  const { roomDirectory } = useServices();
  return useMutation({
    mutationFn: (request: CreateRoomRequest) => roomDirectory.createRoom(request),
  });
}
