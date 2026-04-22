/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoom: wraps roomService.createRoom (internal 409 conflict retry preserved)
 * useJoinRoom: wraps roomService.getRoom
 * Network retry handled by cfFetch (fetchWithRetry), no mutation-layer retry needed.
 */

import { useMutation } from '@tanstack/react-query';
import type { GameState } from '@werewolf/game-engine';

import { useServices } from '@/contexts/ServiceContext';

export function useCreateRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (params: {
      hostUserId: string;
      initialRoomNumber?: string;
      maxRetries?: number;
      buildInitialState?: (roomCode: string) => GameState;
    }) =>
      roomService.createRoom(
        params.hostUserId,
        params.initialRoomNumber,
        params.maxRetries,
        params.buildInitialState,
      ),
  });
}

export function useJoinRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (roomCode: string) => roomService.getRoom(roomCode),
  });
}
