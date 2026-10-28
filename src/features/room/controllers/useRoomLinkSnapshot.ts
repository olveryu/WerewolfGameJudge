/** React subscription for the single immutable room-link snapshot. */

import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useSyncExternalStore } from 'react';

import type { LinkSnapshot, RoomLink } from '@/platform/realtime/types';

export function useRoomLinkSnapshot<TState extends BaseGameState<string>, TCommand extends object>(
  link: RoomLink<TState, TCommand>,
  isActive = true,
): LinkSnapshot<TState> {
  const subscribe = useCallback(
    (listener: () => void) => (isActive ? link.subscribe(listener) : () => undefined),
    [isActive, link],
  );
  const getSnapshot = useCallback(() => link.getSnapshot(), [link]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
