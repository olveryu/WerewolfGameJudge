/**
 * useConnectionStatus — 订阅 facade 连接状态
 *
 * 替代 useConnectionSync：精简版 hook，仅订阅 ConnectionStatus
 * 并追踪 lastStateReceivedAt / stateRevision。
 * 所有重连/ping/pong/revision-poll 逻辑已移入 ConnectionManager。
 *
 * 不直接修改游戏状态，不包含业务校验逻辑。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';

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
export function useConnectionStatus(facade: IGameFacade): ConnectionStatusState {
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
