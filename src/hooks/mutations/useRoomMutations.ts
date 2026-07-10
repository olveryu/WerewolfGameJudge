/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoom: wraps roomService.createRoom (internal 409 conflict retry preserved)
 * useJoinRoom: wraps roomService.getRoom
 * Network retry handled by cfFetch (fetchWithRetry), no mutation-layer retry needed.
 */

import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';
import type { CreateRoomRequest } from '@/services/types/IRoomService';

export function useCreateRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (request: CreateRoomRequest) => roomService.createRoom(request),
  });
}

export function useJoinRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (roomCode: string) => roomService.getRoom(roomCode),
  });
}
