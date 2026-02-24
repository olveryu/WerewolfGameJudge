/**
 * useConnectionSync - Connection status tracking + auto-recovery
 *
 * Manages:
 * - RealtimeService connection status subscription
 * - Auto-recovery after reconnect (DB read — throttled)
 * - State staleness detection + automatic self-healing via DB fallback
 *
 * Self-healing: When a client's WebSocket stays connected but a broadcast
 * message is silently dropped (Supabase Realtime is at-most-once), the
 * staleness detector automatically reads the latest state from DB.
 * Host and Player use the same recovery path (server-authoritative).
 *
 * 订阅 RealtimeService 连接状态并派生 staleness。
 * 不直接修改游戏状态，不包含业务校验逻辑。
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ConnectionStatus } from '@/services/types/IGameFacade';
import type { IGameFacade } from '@/services/types/IGameFacade';
import { gameRoomLog } from '@/utils/logger';

/**
 * How long without a state update before we consider the state stale.
 *
 * Active phases (ongoing / ready / ended): 8s — state changes frequently,
 * a dropped postgres_changes notification must be recovered quickly.
 *
 * Idle phases (unseated / seated / assigned): 60s — state changes are rare
 * and user-initiated (seat / assign), so a longer threshold avoids unnecessary
 * DB reads. Real disconnections are still caught instantly by Layer 0
 * (browser offline) and Layer 1 (Supabase SDK reconnect).
 */
const STALE_THRESHOLD_ACTIVE_MS = 8_000;
const STALE_THRESHOLD_IDLE_MS = 60_000;

/** Phases where state changes frequently and require fast stale detection. */
const ACTIVE_STATUSES = new Set<GameStatus>([
  GameStatus.Ongoing,
  GameStatus.Ready,
  GameStatus.Ended,
]);

function getStaleThreshold(gameStatus: GameStatus | null): number {
  if (gameStatus && ACTIVE_STATUSES.has(gameStatus)) return STALE_THRESHOLD_ACTIVE_MS;
  return STALE_THRESHOLD_IDLE_MS;
}

/** How often we check staleness and potentially trigger auto-heal. */
const STALE_CHECK_INTERVAL_MS = 3_000;

/** Minimum gap between consecutive auto-heal requests (prevents spam). */
const AUTO_HEAL_COOLDOWN_MS = 8_000;

interface ConnectionSyncState {
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
  roomRecord: { roomNumber: string } | null,
  gameStatus: GameStatus | null,
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
      if (status === 'disconnected') {
        // Reset throttle so auto-recovery can fire again after reconnection
        hasRequestedInSessionRef.current = false;
      }
    });
    return unsubscribe;
  }, [facade]);

  // Auto-recovery：断线重连后自动请求状态
  // Throttle: 只在同一 live session 中请求一次（收到 STATE_UPDATE 后重置）
  useEffect(() => {
    // 只在连接恢复时触发
    if (connectionStatus !== 'live') return;
    // 如果没有 roomRecord，说明还没加入房间
    if (!roomRecord) return;
    // Throttle: 已经请求过，跳过
    if (hasRequestedInSessionRef.current) {
      gameRoomLog.debug('Auto-recovery: already requested in this session, skipping');
      return;
    }

    // 启动定时器：如果 2 秒内没有收到 STATE_UPDATE，主动从 DB 读取
    reconnectTimerRef.current = setTimeout(() => {
      if (hasRequestedInSessionRef.current) return; // 双重保险
      hasRequestedInSessionRef.current = true;
      gameRoomLog.debug('Auto-recovery: fetching state from DB after reconnect');
      facade.fetchStateFromDB().catch((e) => {
        gameRoomLog.warn('Auto-recovery fetchStateFromDB failed:', e);
      });
    }, 2000);

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connectionStatus, roomRecord, facade]);

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
      setIsStateStale(Date.now() - lastStateReceivedAt > getStaleThreshold(gameStatus));
    };
    check();
    const id = setInterval(check, STALE_CHECK_INTERVAL_MS);

    // Page Visibility API: mobile browsers freeze WebSocket when backgrounded
    // but may not fire an 'offline' event. When the tab becomes visible again,
    // run an immediate staleness check instead of waiting for the next 3s tick.
    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        gameRoomLog.debug('Page became visible — running immediate stale check');
        check();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange);
    }

    return () => {
      clearInterval(id);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange);
      }
    };
  }, [connectionStatus, lastStateReceivedAt, gameStatus]);

  // ── 自动自愈：连接正常但漏收广播时，从 DB 直接读取最新状态 ──
  // Supabase broadcast 是 at-most-once，单条消息丢失不会触发断线重连。
  // 此 effect 在 staleness 检测到后自动从 DB 读取。
  const lastAutoHealRef = useRef<number>(0);
  useEffect(() => {
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

    gameRoomLog.info('Auto-heal: state stale while connected, fetching from DB');
    facade.fetchStateFromDB().catch((e) => {
      gameRoomLog.warn('Auto-heal fetchStateFromDB failed:', e);
    });
  }, [isStateStale, connectionStatus, roomRecord, facade, lastStateReceivedAt]);

  return useMemo(
    () => ({
      connectionStatus,
      setConnectionStatus,
      stateRevision,
      setStateRevision,
      lastStateReceivedAt,
      setLastStateReceivedAt,
      isStateStale,
      onStateReceived,
    }),
    [connectionStatus, stateRevision, lastStateReceivedAt, isStateStale, onStateReceived],
  );
}
