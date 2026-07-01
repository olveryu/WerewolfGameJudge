/**
 * useConnectionStatus — subscribes to facade connection status
 *
 * Replaces useConnectionSync: a minimal hook that only subscribes to ConnectionStatus
 * and tracks lastStateReceivedAt / stateRevision.
 * All reconnect/ping/pong/revision-poll logic has been moved into ConnectionManager.
 *
 * Does not directly mutate game state or contain business validation logic.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import { ConnectionStatus } from '@/services/types/IGameFacade';
import { connectionLog } from '@/utils/logger';

export interface ConnectionStatusSource {
  addConnectionStatusListener(fn: (status: ConnectionStatus) => void): () => void;
}

interface ConnectionStatusState {
  connectionStatus: ConnectionStatus;
  lastStateReceivedAt: number | null;
  setLastStateReceivedAt: (ts: number | null) => void;
  /** Call when a state update is received to update lastStateReceivedAt */
  onStateReceived: () => void;
  stateRevision: number;
  setStateRevision: (rev: number) => void;
}

/**
 * Tracks connection status via facade listener.
 */
export function useConnectionStatus(facade: ConnectionStatusSource): ConnectionStatusState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.Disconnected,
  );
  const [stateRevision, setStateRevision] = useState(0);
  const [lastStateReceivedAt, setLastStateReceivedAt] = useState<number | null>(null);

  const onStateReceived = useCallback(() => {
    setLastStateReceivedAt(Date.now());
  }, []);

  // Subscribe to connection status changes from facade (mapped from ConnectionManager FSM)
  useEffect(() => {
    const unsubscribe = facade.addConnectionStatusListener((status) => {
      connectionLog.debug('Status changed', { status });
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, [facade]);

  return useMemo(
    () => ({
      connectionStatus,
      lastStateReceivedAt,
      setLastStateReceivedAt,
      onStateReceived,
      stateRevision,
      setStateRevision,
    }),
    [connectionStatus, lastStateReceivedAt, onStateReceived, stateRevision],
  );
}
