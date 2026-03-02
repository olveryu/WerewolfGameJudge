/**
 * useConnectionSync - Connection status tracking + foreground DB fetch
 *
 * Manages:
 * - RealtimeService connection status subscription
 * - Foreground DB fetch (immediate data recovery on tab visible)
 *
 * Recovery strategy: Supabase SDK handles WebSocket lifecycle (heartbeat +
 * auto-reconnect). When the user switches back to the app, we immediately
 * read the latest state from DB to cover any broadcasts missed while
 * backgrounded. This is the standard community pattern for Supabase
 * Realtime apps.
 *
 * 订阅 RealtimeService 连接状态并提供前台 DB 拉取。
 * 不直接修改游戏状态，不包含业务校验逻辑。
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { gameRoomLog } from '@/utils/logger';

interface ConnectionSyncState {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  stateRevision: number;
  setStateRevision: (rev: number) => void;
  lastStateReceivedAt: number | null;
  setLastStateReceivedAt: (ts: number | null) => void;
  /** Call when a state update is received to update lastStateReceivedAt */
  onStateReceived: () => void;
}

/** Subset of ConnectionSyncState used by useRoomLifecycle for status updates */
export type ConnectionSyncActions = Pick<ConnectionSyncState, 'setConnectionStatus'>;

/**
 * Tracks connection status and provides foreground DB fetch for data recovery.
 */
export function useConnectionSync(
  facade: IGameFacade,
  roomRecord: { roomNumber: string } | null,
): ConnectionSyncState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    ConnectionStatus.Disconnected,
  );
  const [stateRevision, setStateRevision] = useState(0);
  const [lastStateReceivedAt, setLastStateReceivedAt] = useState<number | null>(null);

  // Called when a state update is received
  const onStateReceived = useCallback(() => {
    setLastStateReceivedAt(Date.now());
  }, []);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = facade.addConnectionStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, [facade]);

  // ── 前台恢复立即 DB 拉取 ──
  // 移动端切后台时 WebSocket 可能被 OS 杀掉，但 `worker: true` 大概率保活。
  // 无论连接是否中断，切回前台后立即从 DB 读取最新状态，保证 ~1s 内数据同步。
  const lastForegroundFetchRef = useRef<number>(0);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!roomRecord) return;

    const FOREGROUND_FETCH_COOLDOWN_MS = 3_000;

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundFetchRef.current < FOREGROUND_FETCH_COOLDOWN_MS) return;
      lastForegroundFetchRef.current = now;

      gameRoomLog.info('Foreground: immediately fetching state from DB');
      facade.fetchStateFromDB().catch((e) => {
        gameRoomLog.warn('Foreground fetchStateFromDB failed:', e);
      });
    };

    document.addEventListener('visibilitychange', onForeground);
    return () => document.removeEventListener('visibilitychange', onForeground);
  }, [roomRecord, facade]);

  return useMemo(
    () => ({
      connectionStatus,
      setConnectionStatus,
      stateRevision,
      setStateRevision,
      lastStateReceivedAt,
      setLastStateReceivedAt,
      onStateReceived,
    }),
    [connectionStatus, stateRevision, lastStateReceivedAt, onStateReceived],
  );
}
