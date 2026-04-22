/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoom: wraps roomService.createRoom with retry:1 (internal 409 retry + 1 network retry)
 * useJoinRoom: wraps roomService.getRoom with retry:2
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
    retry: 1,
    // createRoom 内部已有 409 冲突重试，这里再加 1 次网络重试
  });
}

export function useJoinRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (roomCode: string) => roomService.getRoom(roomCode),
    retry: 2,
  });
}
