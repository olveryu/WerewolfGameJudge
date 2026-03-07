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
  /** True when L5 dead channel auto-retries are exhausted (user action needed) */
  retriesExhausted: boolean;
  /** Manual reconnect triggered by user tap — resets retry counter */
  manualReconnect: () => void;
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

  // ── 前台恢复：DB 拉取 + Dead Channel 重连 ──
  // 移动端切后台时 WebSocket 可能被 OS 杀掉，但 `worker: true` 大概率保活。
  // 切回前台后：
  //   - 连接正常（Live）→ 仅 fetchStateFromDB 补漏广播
  //   - 连接已断（Disconnected）→ reconnectChannel 重建 WS + fetchStateFromDB
  //   - 同时重置 deadChannelRetriesRef，给 Dead Channel Detector 新的重试机会
  const lastForegroundFetchRef = useRef<number>(0);
  // Ref mirror: allows visibilitychange callback to read current status
  // without adding connectionStatus to the effect deps (avoids re-registering listener).
  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  // Shared ref: declared before both foreground + dead-channel effects so both can access it.
  const deadChannelRetriesRef = useRef(0);
  const [retriesExhausted, setRetriesExhausted] = useState(false);
  const MAX_DEAD_CHANNEL_RETRIES = 3;
  const DEAD_CHANNEL_THRESHOLD_MS = 5_000;

  // Manual reconnect: user taps the retry button
  const manualReconnect = useCallback(() => {
    connectionSyncLog.info('Manual reconnect triggered by user');
    deadChannelRetriesRef.current = 0;
    setRetriesExhausted(false);
    facade.reconnectChannel().catch((e) => {
      connectionSyncLog.error('Manual reconnectChannel failed', e);
    });
  }, [facade]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!roomRecord) return;

    const FOREGROUND_FETCH_COOLDOWN_MS = 3_000;

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundFetchRef.current < FOREGROUND_FETCH_COOLDOWN_MS) return;
      lastForegroundFetchRef.current = now;

      // Reset dead channel retries so L5 detector gets fresh attempts after foreground
      deadChannelRetriesRef.current = 0;
      setRetriesExhausted(false);

      const currentStatus = connectionStatusRef.current;
      if (currentStatus === ConnectionStatus.Disconnected) {
        // Channel dead → full recovery: rebuild WS channel + fetch DB
        connectionSyncLog.info('Foreground: channel disconnected, triggering reconnectChannel');
        facade.reconnectChannel().catch((e) => {
          connectionSyncLog.error('Foreground reconnectChannel failed', e);
        });
      } else {
        // Channel alive → just fetch DB to cover missed broadcasts
        connectionSyncLog.info('Foreground: fetching state from DB');
        facade.fetchStateFromDB().catch((e) => {
          connectionSyncLog.warn('Foreground fetchStateFromDB failed:', e);
        });
      }
    };

    document.addEventListener('visibilitychange', onForeground);
    return () => document.removeEventListener('visibilitychange', onForeground);
  }, [roomRecord, facade]);

  // ── Dead Channel Detector ──
  // Supabase SDK gives up reconnecting after repeated CHANNEL_ERROR / TIMED_OUT
  // (common on mobile background/foreground cycles). When Disconnected persists
  // beyond DEAD_CHANNEL_THRESHOLD_MS without SDK self-healing, tear down the
  // dead channel and rebuild from scratch.

  useEffect(() => {
    if (!roomRecord) return;

    if (connectionStatus === ConnectionStatus.Live) {
      // Channel is healthy — reset retry counter
      deadChannelRetriesRef.current = 0;
      setRetriesExhausted(false);
      return;
    }

    if (connectionStatus !== ConnectionStatus.Disconnected) return;
    if (deadChannelRetriesRef.current >= MAX_DEAD_CHANNEL_RETRIES) {
      connectionSyncLog.warn('Dead channel detector: max retries reached, giving up', {
        retries: deadChannelRetriesRef.current,
      });
      setRetriesExhausted(true);
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
      retriesExhausted,
      manualReconnect,
    }),
    [
      connectionStatus,
      stateRevision,
      lastStateReceivedAt,
      onStateReceived,
      retriesExhausted,
      manualReconnect,
    ],
  );
}
