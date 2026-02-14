/**
 * useConnectionSync - Connection status tracking + Player auto-recovery
 *
 * Manages:
 * - BroadcastService connection status subscription
 * - Player auto-recovery after reconnect (throttled snapshot request)
 * - State staleness detection + automatic self-healing
 *
 * Self-healing: When a player's WebSocket stays connected but a broadcast
 * message is silently dropped (Supabase Realtime is at-most-once), the
 * staleness detector automatically requests the latest state from Host.
 *
 * ✅ 允许：订阅 BroadcastService 连接状态、派生 staleness
 * ❌ 禁止：直接修改游戏状态、业务校验逻辑
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { ConnectionStatus } from '@/services/types/IGameFacade';
import type { IGameFacade } from '@/services/types/IGameFacade';
import { gameRoomLog } from '@/utils/logger';

/**
 * How long without a state update before we consider the state stale.
 * Supabase broadcast is fire-and-forget — a single missed message leaves the
 * player stuck. 15 seconds is short enough to recover within a night step, but
 * long enough to avoid false positives during normal pauses.
 */
const STALE_THRESHOLD_MS = 15_000;

/** How often we check staleness and potentially trigger auto-heal. */
const STALE_CHECK_INTERVAL_MS = 5_000;

/** Minimum gap between consecutive auto-heal requests (prevents spam). */
const AUTO_HEAL_COOLDOWN_MS = 15_000;

export interface ConnectionSyncState {
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;
  stateRevision: number;
  setStateRevision: (rev: number) => void;
  lastStateReceivedAt: number | null;
  setLastStateReceivedAt: (ts: number | null) => void;
  isStateStale: boolean;
  /** Call when a state update is received to reset auto-recovery throttle */
  onStateReceived: () => void;
}

/** Subset of ConnectionSyncState used by useRoomLifecycle for status updates */
export type ConnectionSyncActions = Pick<ConnectionSyncState, 'setConnectionStatus'>;

/**
 * Tracks connection status and handles Player auto-recovery after reconnect.
 */
export function useConnectionSync(
  facade: IGameFacade,
  isHost: boolean,
  roomRecord: { roomNumber: string } | null,
): ConnectionSyncState {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [stateRevision, setStateRevision] = useState(0);
  const [lastStateReceivedAt, setLastStateReceivedAt] = useState<number | null>(null);

  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Throttle: only request once per live session (reset when state is received)
  const hasRequestedInSessionRef = useRef<boolean>(false);
  // Track when connection last transitioned to 'live' (for auto-heal grace period)
  const connectionLiveAtRef = useRef<number>(0);

  // Called when a state update is received — resets throttle and clears timer
  const onStateReceived = useCallback(() => {
    setLastStateReceivedAt(Date.now());
    hasRequestedInSessionRef.current = false;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  // Subscribe to connection status changes
  useEffect(() => {
    const unsubscribe = facade.addConnectionStatusListener((status) => {
      setConnectionStatus(status);
      if (status === 'live') {
        connectionLiveAtRef.current = Date.now();
      }
    });
    return unsubscribe;
  }, [facade]);

  // Player 自动恢复：断线重连后自动请求状态
  // Throttle: 只在同一 live session 中请求一次（收到 STATE_UPDATE 后重置）
  useEffect(() => {
    // 只有 Player 需要自动恢复（Host 是权威）
    if (isHost) return;
    // 只在连接恢复时触发
    if (connectionStatus !== 'live') return;
    // 如果没有 roomRecord，说明还没加入房间
    if (!roomRecord) return;
    // Throttle: 已经请求过，跳过（避免 REQUEST_STATE spam）
    if (hasRequestedInSessionRef.current) {
      gameRoomLog.debug('Player auto-recovery: already requested in this session, skipping');
      return;
    }

    // 启动定时器：如果 2 秒内没有收到 STATE_UPDATE，主动请求
    reconnectTimerRef.current = setTimeout(() => {
      if (hasRequestedInSessionRef.current) return; // 双重保险
      hasRequestedInSessionRef.current = true;
      gameRoomLog.debug('Player auto-recovery: requesting state after reconnect');
      facade.requestSnapshot().catch((e) => {
        gameRoomLog.warn('Player auto-recovery requestSnapshot failed:', e);
      });
    }, 2000);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectionStatus, isHost, roomRecord, facade]);

  // 一致性提示：状态是否可能过时
  const [isStateStale, setIsStateStale] = useState(true);
  useEffect(() => {
    const check = () => {
      if (connectionStatus !== 'live') {
        setIsStateStale(true);
        return;
      }
      if (!lastStateReceivedAt) {
        setIsStateStale(true);
        return;
      }
      setIsStateStale(Date.now() - lastStateReceivedAt > STALE_THRESHOLD_MS);
    };
    check();
    const id = setInterval(check, STALE_CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [connectionStatus, lastStateReceivedAt]);

  // ── Player 自动自愈：连接正常但漏收广播时，主动拉取最新状态 ──
  // Supabase broadcast 是 at-most-once，单条消息丢失不会触发断线重连。
  // 此 effect 在 staleness 检测到后自动发 REQUEST_STATE，无需用户手动刷新。
  const lastAutoHealRef = useRef<number>(0);
  useEffect(() => {
    if (isHost) return;
    if (!isStateStale) return;
    if (connectionStatus !== 'live') return;
    if (!roomRecord) return;
    // Only auto-heal when we previously received state (baseline established).
    // If lastStateReceivedAt is null, reconnect recovery handles initial fetch.
    if (!lastStateReceivedAt) return;
    // Grace period: don't auto-heal right after connection goes live — the
    // reconnect recovery effect already handles that window.
    const now = Date.now();
    if (now - connectionLiveAtRef.current < AUTO_HEAL_COOLDOWN_MS) return;

    if (now - lastAutoHealRef.current < AUTO_HEAL_COOLDOWN_MS) {
      return;
    }
    lastAutoHealRef.current = now;

    gameRoomLog.info('Auto-heal: state stale while connected, requesting snapshot from Host');
    facade.requestSnapshot().catch((e) => {
      gameRoomLog.warn('Auto-heal requestSnapshot failed:', e);
    });
  }, [isStateStale, connectionStatus, isHost, roomRecord, facade, lastStateReceivedAt]);

  return {
    connectionStatus,
    setConnectionStatus,
    stateRevision,
    setStateRevision,
    lastStateReceivedAt,
    setLastStateReceivedAt,
    isStateStale,
    onStateReceived,
  };
}
