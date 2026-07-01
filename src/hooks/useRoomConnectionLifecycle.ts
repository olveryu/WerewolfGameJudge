/**
 * useRoomConnectionLifecycle — shared room snapshot + connection lifecycle.
 *
 * Screens provide the room facade and authenticated user id. The hook owns
 * subscribe/getSnapshot wiring, initial connect, cleanup leave, and connection status.
 */
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';

import { type ConnectionStatusSource, useConnectionStatus } from './useConnectionStatus';

export interface RoomConnectionLifecycleFacade<TState> extends ConnectionStatusSource {
  subscribe(onChange: () => void): () => void;
  getState(): TState | null;
  connect(roomCode: string, userId: string): Promise<void>;
  leave(): Promise<void>;
  manualReconnect(): void;
}

interface UseRoomConnectionLifecycleParams<TState> {
  facade: RoomConnectionLifecycleFacade<TState>;
  roomCode: string;
  userId: string | null;
  onConnectError: (err: unknown) => void;
  onLeaveError: (err: unknown) => void;
}

export function useRoomConnectionLifecycle<TState>({
  facade,
  roomCode,
  userId,
  onConnectError,
  onLeaveError,
}: UseRoomConnectionLifecycleParams<TState>) {
  const state = useSyncExternalStore(
    useCallback((cb: () => void) => facade.subscribe(cb), [facade]),
    useCallback(() => facade.getState(), [facade]),
  );

  const connection = useConnectionStatus(facade);
  const connectedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const key = `${roomCode}:${userId}`;
    if (connectedKeyRef.current === key) return;
    connectedKeyRef.current = key;
    void facade.connect(roomCode, userId).catch(onConnectError);
  }, [facade, onConnectError, roomCode, userId]);

  useEffect(
    () => () => {
      void facade.leave().catch(onLeaveError);
      connectedKeyRef.current = null;
    },
    [facade, onLeaveError],
  );

  const manualReconnect = useCallback(() => {
    facade.manualReconnect();
  }, [facade]);

  return useMemo(
    () => ({
      state,
      connectionStatus: connection.connectionStatus,
      manualReconnect,
    }),
    [connection.connectionStatus, manualReconnect, state],
  );
}
