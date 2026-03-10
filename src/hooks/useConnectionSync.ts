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
  onDeadChannelRetriesExhausted?: (context: { attempt: number; roomNumber: string }) => void,
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
  const DEAD_CHANNEL_BASE_MS = 5_000;
  const DEAD_CHANNEL_MAX_MS = 60_000;
  const MAX_DEAD_CHANNEL_RETRIES = 10;
  const exhaustedNotifiedRef = useRef(false);
  const recoveryStatsRef = useRef({
    L3: 0,
    L4: 0,
    L5: 0,
    success: 0,
    failure: 0,
  });

  const reconnectWithTelemetry = useCallback(
    (trigger: 'online' | 'foreground' | 'deadChannel', layer: 'L3' | 'L4' | 'L5') => {
      recoveryStatsRef.current[layer] += 1;
      const startedAt = Date.now();
      facade
        .reconnectChannel(trigger)
        .then(() => {
          recoveryStatsRef.current.success += 1;
          connectionSyncLog.info('Reconnect succeeded', {
            trigger,
            layer,
            elapsedMs: Date.now() - startedAt,
            stats: recoveryStatsRef.current,
          });
        })
        .catch((e) => {
          recoveryStatsRef.current.failure += 1;
          connectionSyncLog.error('Reconnect failed', {
            trigger,
            layer,
            elapsedMs: Date.now() - startedAt,
            stats: recoveryStatsRef.current,
            error: e,
          });
        });
    },
    [facade],
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!roomRecord) return;

    const FOREGROUND_FETCH_COOLDOWN_MS = 3_000;

    const onForeground = () => {
      if (document.visibilityState !== 'visible') return;
      const now = Date.now();
      if (now - lastForegroundFetchRef.current < FOREGROUND_FETCH_COOLDOWN_MS) return;
      lastForegroundFetchRef.current = now;

      // Reset dead channel retries counter (diagnostic only)
      deadChannelRetriesRef.current = 0;
      exhaustedNotifiedRef.current = false;

      const currentStatus = connectionStatusRef.current;
      if (currentStatus === ConnectionStatus.Disconnected) {
        // Channel dead → full recovery: rebuild WS channel + fetch DB
        connectionSyncLog.info('Foreground: channel disconnected, triggering reconnectChannel', {
          layer: 'L4',
        });
        reconnectWithTelemetry('foreground', 'L4');
      } else {
        // Channel alive → just fetch DB to cover missed broadcasts
        connectionSyncLog.info('Foreground: fetching state from DB', { layer: 'L4' });
        facade.fetchStateFromDB().catch((e) => {
          connectionSyncLog.warn('Foreground fetchStateFromDB failed:', e);
        });
      }
    };

    document.addEventListener('visibilitychange', onForeground);
    return () => document.removeEventListener('visibilitychange', onForeground);
  }, [roomRecord, facade, reconnectWithTelemetry]);

  // ── L3 补充：browser online 事件 → reconnectChannel ──
  // ConnectionRecoveryManager 的 L3 handler 仅调 fetchStateFromDB()，不重建 WS channel。
  // 当 Dead Channel Detector 重试耗尽后 status 卡在 Disconnected，
  // fetchStateFromDB → markAsLive 只接受 Syncing → Live，对 Disconnected 是 no-op。
  // 此 handler 在 online 事件触发时重置 retry 计数并 reconnectChannel()，补上缺口。
  useEffect(() => {
    if (typeof globalThis.window?.addEventListener !== 'function') return;
    if (!roomRecord) return;

    const onOnline = () => {
      const currentStatus = connectionStatusRef.current;
      if (currentStatus === ConnectionStatus.Live) return; // 已连接，无需重连

      connectionSyncLog.info('Browser online event: resetting retries and reconnecting', {
        currentStatus,
        layer: 'L3',
      });
      deadChannelRetriesRef.current = 0;
      exhaustedNotifiedRef.current = false;

      // 无论是 Disconnected（dead channel）还是其他非 Live 状态，都尝试重建
      reconnectWithTelemetry('online', 'L3');
    };

    globalThis.window.addEventListener('online', onOnline);
    return () => globalThis.window.removeEventListener('online', onOnline);
  }, [roomRecord, facade, reconnectWithTelemetry]);

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
      exhaustedNotifiedRef.current = false;
      return;
    }

    if (connectionStatus !== ConnectionStatus.Disconnected) return;

    // Retry limit: stop after MAX_DEAD_CHANNEL_RETRIES to avoid infinite reconnect storm
    if (deadChannelRetriesRef.current >= MAX_DEAD_CHANNEL_RETRIES) {
      connectionSyncLog.warn(
        'Dead channel retries exhausted, waiting for manual action or online event',
        {
          attempt: deadChannelRetriesRef.current,
        },
      );

      if (!exhaustedNotifiedRef.current && roomRecord) {
        exhaustedNotifiedRef.current = true;
        onDeadChannelRetriesExhausted?.({
          attempt: deadChannelRetriesRef.current,
          roomNumber: roomRecord.roomNumber,
        });
      }
      return;
    }

    // Exponential backoff: 5s, 10s, 20s, 40s, ... capped at 60s
    const delay = Math.min(
      DEAD_CHANNEL_BASE_MS * Math.pow(2, deadChannelRetriesRef.current),
      DEAD_CHANNEL_MAX_MS,
    );

    const timer = setTimeout(() => {
      // Re-check: still Disconnected after threshold?
      // (connectionStatus is captured in closure — if it changed, this effect
      // would have been cleaned up and re-run)
      deadChannelRetriesRef.current += 1;
      connectionSyncLog.info('Dead channel detector: triggering reconnectChannel', {
        attempt: deadChannelRetriesRef.current,
        layer: 'L5',
        nextDelay: Math.min(
          DEAD_CHANNEL_BASE_MS * Math.pow(2, deadChannelRetriesRef.current),
          DEAD_CHANNEL_MAX_MS,
        ),
      });
      reconnectWithTelemetry('deadChannel', 'L5');
    }, delay);

    return () => clearTimeout(timer);
  }, [connectionStatus, roomRecord, facade, onDeadChannelRetriesExhausted, reconnectWithTelemetry]);

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
