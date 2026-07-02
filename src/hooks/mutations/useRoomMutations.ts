/**
 * useRoomMutations — TanStack Query mutation hooks for room operations
 *
 * useCreateRoom: wraps roomService.createRoom (internal 409 conflict retry preserved)
 * useJoinRoom: wraps roomService.getRoom
 * Network retry handled by cfFetch (fetchWithRetry), no mutation-layer retry needed.
 */

import { useMutation } from '@tanstack/react-query';
import type { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import type { WerewolfCreateConfig } from '@werewolf/game-engine/werewolf/state/buildInitialWerewolfState';

import { useServices } from '@/contexts/ServiceContext';

export function useCreateRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (params: {
      gameType: typeof WEREWOLF_GAME_TYPE;
      initialRoomNumber?: string;
      maxRetries?: number;
      config: WerewolfCreateConfig;
    }) => roomService.createRoom(params),
  });
}

export function useJoinRoom() {
  const { roomService } = useServices();
  return useMutation({
    mutationFn: (roomCode: string) => roomService.getRoom(roomCode),
  });
}
