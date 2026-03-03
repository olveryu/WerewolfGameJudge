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
import { connectionSyncLog } from '@/utils/logger';

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

      connectionSyncLog.info('Foreground: immediately fetching state from DB');
      facade.fetchStateFromDB().catch((e) => {
        connectionSyncLog.warn('Foreground fetchStateFromDB failed:', e);
      });
    };

    document.addEventListener('visibilitychange', onForeground);
    return () => document.removeEventListener('visibilitychange', onForeground);
  }, [roomRecord, facade]);

  // ── Dead Channel Detector ──
  // Supabase SDK gives up reconnecting after repeated CHANNEL_ERROR / TIMED_OUT
  // (common on mobile background/foreground cycles). When Disconnected persists
  // beyond DEAD_CHANNEL_THRESHOLD_MS without SDK self-healing, tear down the
  // dead channel and rebuild from scratch.
  const deadChannelRetriesRef = useRef(0);
  const MAX_DEAD_CHANNEL_RETRIES = 3;
  const DEAD_CHANNEL_THRESHOLD_MS = 5_000;

  useEffect(() => {
    if (!roomRecord) return;

    if (connectionStatus === ConnectionStatus.Live) {
      // Channel is healthy — reset retry counter
      deadChannelRetriesRef.current = 0;
      return;
    }

    if (connectionStatus !== ConnectionStatus.Disconnected) return;
    if (deadChannelRetriesRef.current >= MAX_DEAD_CHANNEL_RETRIES) {
      connectionSyncLog.warn('Dead channel detector: max retries reached, giving up', {
        retries: deadChannelRetriesRef.current,
      });
      return;
    }

    const timer = setTimeout(() => {
      // Re-check: still Disconnected after threshold?
      // (connectionStatus is captured in closure — if it changed, this effect
      // would have been cleaned up and re-run)
      deadChannelRetriesRef.current += 1;
      connectionSyncLog.info('Dead channel detector: triggering reconnectChannel', {
        attempt: deadChannelRetriesRef.current,
      });
      facade.reconnectChannel().catch((e) => {
        connectionSyncLog.error('Dead channel detector: reconnectChannel failed', e);
      });
    }, DEAD_CHANNEL_THRESHOLD_MS);

    return () => clearTimeout(timer);
  }, [connectionStatus, roomRecord, facade]);

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
