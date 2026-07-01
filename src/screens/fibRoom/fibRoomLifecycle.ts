/**
 * fibRoomLifecycle — Fib phase adapter for the shared room shell.
 *
 * Fib keeps its engine-native phases, but UI code consumes GameStatus-shaped
 * lifecycle values plus explicit capabilities.
 */

import type { FibState } from '@werewolf/game-engine/fibking/types';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';

import {
  getRoomLifecycleCapabilities,
  type RoomLifecycleCapabilities,
} from '@/components/room/policy/roomLifecycle';

interface GetFibRoomCapabilitiesParams {
  state: FibState;
  filled: number;
  isHost: boolean;
  hasBots: boolean;
}

export interface FibRoomLifecycle {
  status: GameStatus;
  capabilities: RoomLifecycleCapabilities;
}

function getFibRoomStatus(state: FibState, filled: number): GameStatus {
  switch (state.phase) {
    case 'Lobby':
      return filled >= state.numberOfPlayers ? GameStatus.Seated : GameStatus.Unseated;
    case 'Starting':
    case 'Playing':
      return GameStatus.Ongoing;
    case 'Revealed':
      return GameStatus.Ended;
    default: {
      const _exhaustive: never = state.phase;
      throw new Error(`getFibRoomStatus: unknown phase ${_exhaustive}`);
    }
  }
}

export function getFibRoomLifecycle({
  state,
  filled,
  isHost,
  hasBots,
}: GetFibRoomCapabilitiesParams): FibRoomLifecycle {
  const status = getFibRoomStatus(state, filled);

  return {
    status,
    capabilities: getRoomLifecycleCapabilities({
      status,
      isHost,
      hasBots,
      isBotControlEnabled: state.phase === 'Playing' || state.phase === 'Revealed',
    }),
  };
}
