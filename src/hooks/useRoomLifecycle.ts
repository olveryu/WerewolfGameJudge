/**
 * useRoomLifecycle - Room creation, joining, leaving, and seat management
 *
 * Manages the full room lifecycle:
 * - Host room initialization (facade only, no DB)
 * - Player joining (with host rejoin detection)
 * - Leaving room + state cleanup
 * - Seat take/leave (with and without ACK)
 * - Snapshot requests (force sync)
 * - Seat error tracking
 *
 * 通过 facade 管理房间/座位，使用 authService/roomService。
 * 不直接调用 Supabase，不绕过 facade 修改游戏状态。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { useCallback, useState } from 'react';

import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import type { AuthService } from '@/services/infra/AuthService';
import type { RoomRecord, RoomService } from '@/services/infra/RoomService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { handleError } from '@/utils/errorPipeline';
import { getErrorMessage } from '@/utils/errorUtils';
import { gameRoomLog } from '@/utils/logger';

import type { ConnectionSyncActions } from './useConnectionSync';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RoomLifecycleState {
  loading: boolean;
  error: string | null;

  // Auth gate: true when first-time user entered via direct URL without session
  needsAuth: boolean;
  clearNeedsAuth: () => void;

  // Seat error (BUG-2 fix)
  lastSeatError: { seat: number; reason: 'seat_taken' } | null;
  clearLastSeatError: () => void;

  // Room actions
  initializeRoom: (roomNumber: string, template: GameTemplate) => Promise<boolean>;
  joinRoom: (roomNumber: string) => Promise<boolean>;
  leaveRoom: () => Promise<void>;

  // Seat actions
  takeSeat: (seatNumber: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  takeSeatWithAck: (seatNumber: number) => Promise<{ success: boolean; reason?: string }>;
  leaveSeatWithAck: () => Promise<{ success: boolean; reason?: string }>;

  // Sync
  requestSnapshot: () => Promise<boolean>;
}

interface RoomLifecycleDeps {
  facade: IGameFacade;
  authService: AuthService;
  roomService: RoomService;
  connection: ConnectionSyncActions;
  setRoomRecord: (record: RoomRecord | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomLifecycle(deps: RoomLifecycleDeps): RoomLifecycleState {
  const {
    facade,
    authService,
    roomService,
    connection: { setConnectionStatus },
    setRoomRecord,
  } = deps;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [lastSeatError, setLastSeatError] = useState<{
    seat: number;
    reason: 'seat_taken';
  } | null>(null);

  // =========================================================================
  // Room lifecycle
  // =========================================================================

  // Initialize room: facade only, no DB creation.
  // RoomScreen/useRoomInit calls this AFTER navigation with the confirmed roomNumber.
  const initializeRoom = useCallback(
    async (roomNumber: string, template: GameTemplate): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        await authService.waitForInit();
        const hostUid = authService.getCurrentUserId();
        if (!hostUid) {
          // First-time user (no session) — show login modal instead of silent anonymous sign-in
          gameRoomLog.info('[initializeRoom] No userId, requesting auth');
          setNeedsAuth(true);
          return false;
        }

        // Set roomRecord for connection sync & leaveRoom cleanup
        setRoomRecord({ roomNumber, hostUid, createdAt: new Date() });

        await facade.createRoom(roomNumber, hostUid, template);

        return true;
      } catch (err) {
        const message = getErrorMessage(err, '房间初始化失败，请重试');
        handleError(err, {
          label: '房间初始化',
          logger: gameRoomLog,
          alertTitle: false,
          isExpected: (e) =>
            e instanceof Error && e.message.includes('channel closed before subscribe'),
        });
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facade, authService, setRoomRecord],
  );

  // Join an existing room as player
  const joinRoom = useCallback(
    async (roomNumber: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        await authService.waitForInit();
        const playerUid = authService.getCurrentUserId();
        if (!playerUid) {
          // First-time user (no session) — show login modal instead of silent anonymous sign-in
          gameRoomLog.info('[joinRoom] No userId, requesting auth');
          setNeedsAuth(true);
          return false;
        }

        // Check if room exists
        const record = await roomService.getRoom(roomNumber);
        if (!record) {
          setError('房间不存在');
          // 防御性清理：房间已不存在，清除过时的 lastRoomNumber
          void AsyncStorage.removeItem(LAST_ROOM_NUMBER_KEY);
          return false;
        }
        setRoomRecord(record);

        // Host rejoin: isHost=true
        if (record.hostUid === playerUid) {
          gameRoomLog.debug('Host rejoin detected, attempting recovery');
          const result = await facade.joinRoom(roomNumber, playerUid, true);
          if (!result.success) {
            gameRoomLog.error('Host rejoin failed', { reason: result.reason });
            setError('房间状态已过期，请重新创建房间');
            return false;
          }
          gameRoomLog.debug('Host rejoin successful');
          return true;
        }

        // Player: isHost=false
        await facade.joinRoom(roomNumber, playerUid, false);

        return true;
      } catch (err) {
        const message = getErrorMessage(err, '加入房间失败，请重试');
        handleError(err, {
          label: '加入房间',
          logger: gameRoomLog,
          alertTitle: false,
          isExpected: (e) =>
            e instanceof Error && e.message.includes('channel closed before subscribe'),
        });
        setError(message);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [facade, authService, roomService, setRoomRecord],
  );

  // Leave the current room
  // NOTE: Room record is NOT deleted here — GitHub Actions cleanup-rooms.yml
  // automatically deletes rooms older than 24 hours, so host can rejoin after leaving.
  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      await facade.leaveRoom();
      setRoomRecord(null);
    } catch (err) {
      handleError(err, { label: '离开房间', logger: gameRoomLog, alertTitle: false });
    }
  }, [facade, setRoomRecord]);

  // =========================================================================
  // Seat actions
  // =========================================================================

  // Take a seat (unified API)
  const takeSeat = useCallback(
    async (seatNumber: number): Promise<boolean> => {
      try {
        const displayName = await authService.getCurrentDisplayName();
        const avatarUrl = await authService.getCurrentAvatarUrl();
        const avatarFrame = await authService.getCurrentAvatarFrame();

        return await facade.takeSeat(
          seatNumber,
          displayName ?? undefined,
          avatarUrl ?? undefined,
          avatarFrame ?? undefined,
        );
      } catch (err) {
        handleError(err, {
          label: '入座',
          logger: gameRoomLog,
          alertTitle: '入座失败',
        });
        return false;
      }
    },
    [facade, authService],
  );

  // Leave seat (unified API)
  const leaveSeat = useCallback(async (): Promise<void> => {
    try {
      await facade.leaveSeat();
    } catch (err) {
      handleError(err, {
        label: '离座',
        logger: gameRoomLog,
        alertTitle: '离座失败',
      });
    }
  }, [facade]);

  // Take seat with ack (unified API)
  const takeSeatWithAck = useCallback(
    async (seatNumber: number): Promise<{ success: boolean; reason?: string }> => {
      try {
        const displayName = await authService.getCurrentDisplayName();
        const avatarUrl = await authService.getCurrentAvatarUrl();

        const result = await facade.takeSeatWithAck(
          seatNumber,
          displayName ?? undefined,
          avatarUrl ?? undefined,
        );

        // Wire up seat error for downstream consumers (e.g., showAlert in useRoomScreenState)
        if (!result.success && result.reason === 'seat_taken') {
          setLastSeatError({ seat: seatNumber, reason: 'seat_taken' });
        }

        return result;
      } catch (err) {
        handleError(err, { label: '入座(ack)', logger: gameRoomLog, alertTitle: false });
        return { success: false, reason: String(err) };
      }
    },
    [facade, authService],
  );

  // Leave seat with ack (unified API)
  const leaveSeatWithAck = useCallback(async (): Promise<{ success: boolean; reason?: string }> => {
    try {
      return await facade.leaveSeatWithAck();
    } catch (err) {
      handleError(err, { label: '离座(ack)', logger: gameRoomLog, alertTitle: false });
      return { success: false, reason: String(err) };
    }
  }, [facade]);

  // =========================================================================
  // Sync
  // =========================================================================

  // Force sync: read latest state from DB (reliable, bypasses broadcast channel)
  const requestSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      setConnectionStatus(ConnectionStatus.Syncing);
      const result = await facade.fetchStateFromDB();
      if (result) {
        setConnectionStatus(ConnectionStatus.Live);
      } else {
        setConnectionStatus(ConnectionStatus.Disconnected);
      }
      return result;
    } catch (err) {
      handleError(err, { label: '同步状态', logger: gameRoomLog, alertTitle: false });
      setConnectionStatus(ConnectionStatus.Disconnected);
      return false;
    }
  }, [facade, setConnectionStatus]);

  // Clear seat error (BUG-2 fix)
  const clearLastSeatError = useCallback(() => {
    setLastSeatError(null);
  }, []);

  const clearNeedsAuth = useCallback(() => {
    setNeedsAuth(false);
  }, []);

  return {
    loading,
    error,
    needsAuth,
    clearNeedsAuth,
    lastSeatError,
    clearLastSeatError,
    initializeRoom,
    joinRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    takeSeatWithAck,
    leaveSeatWithAck,
    requestSnapshot,
  };
}
