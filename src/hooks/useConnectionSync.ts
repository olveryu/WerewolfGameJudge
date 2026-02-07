/**
 * useConnectionSync - Connection status tracking + Player auto-recovery
 *
 * Manages:
 * - BroadcastService connection status subscription
 * - Player auto-recovery after reconnect (throttled snapshot request)
 * - State staleness detection
 *
 * ✅ 允许：订阅 BroadcastService 连接状态、派生 staleness
 * ❌ 禁止：直接修改游戏状态、业务校验逻辑
 */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { BroadcastService, type ConnectionStatus } from '../services/transport/BroadcastService';
import { gameRoomLog } from '../utils/logger';
import type { IGameFacade } from '../services/types/IGameFacade';

const STALE_THRESHOLD_MS = 30000;

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

  const broadcastService = useRef(BroadcastService.getInstance());

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
    const unsubscribe = broadcastService.current.addStatusListener((status) => {
      setConnectionStatus(status);
    });
    return unsubscribe;
  }, []);

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
      facade.requestSnapshot().catch(() => {
        // Ignore — best-effort recovery
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
  const isStateStale = useMemo(() => {
    if (connectionStatus !== 'live') return true;
    if (!lastStateReceivedAt) return true;
    return Date.now() - lastStateReceivedAt > STALE_THRESHOLD_MS;
  }, [connectionStatus, lastStateReceivedAt]);

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
