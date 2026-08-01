/** React subscription for the single immutable room-session snapshot. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useSyncExternalStore } from 'react';

import type {
  RoomSessionClient,
  RoomSessionSnapshot,
  RoomUserEvent,
} from '@/features/room/session/types';

export function useRoomSessionSnapshot<
  TState extends BaseGameState<string>,
  TCommand extends object,
  TEvent extends RoomUserEvent,
>(
  session: RoomSessionClient<TState, TCommand, TEvent>,
  isActive = true,
): RoomSessionSnapshot<TState> {
  const subscribe = useCallback(
    (listener: () => void) => (isActive ? session.subscribe(listener) : () => undefined),
    [isActive, session],
  );
  const getSnapshot = useCallback(() => session.getSnapshot(), [session]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
