/**
 * useWerewolfRoomLifecycle - Room connection, joining, leaving, and seat management
 *
 * Manages the full room lifecycle:
 * - Host connects to an already-created room
 * - Player joining (with host rejoin detection)
 * - Leaving room + state cleanup
 * - Seat take/leave (with and without ACK)
 * - Snapshot requests (force sync)
 * - Seat error tracking
 *
 * Manages rooms/seats via facade, using authService/roomService.
 * Does not bypass facade to mutate game state.
 */

import { useQueryClient } from '@tanstack/react-query';
import type { ActionResult } from '@werewolf/game-engine/protocol/ActionResult';
import { WEREWOLF_GAME_TYPE } from '@werewolf/game-engine/protocol/gameTypes';
import { useCallback, useState } from 'react';

import type { User } from '@/contexts/AuthContext';
import { useJoinRoom } from '@/hooks/mutations/useRoomMutations';
import { userStatsOptions } from '@/hooks/queries/queryOptions';
import { addRecentRoom, removeRecentRoom } from '@/lib/recentRooms';
import { SupersededError } from '@/services/connection/types';
import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';
import type { IAuthService } from '@/services/types/IAuthService';
import type { RoomRecord } from '@/services/types/IRoomService';
import { handleError } from '@/utils/errorPipeline';
import { getErrorMessage } from '@/utils/errorUtils';
import { gameRoomLog } from '@/utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Discriminated union: success guarantees no error field; failure guarantees error string. */
export type RoomInitResult = { success: true } | { success: false; error: string };

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
  initializeRoom: (roomCode: string) => Promise<RoomInitResult>;
  joinRoom: (roomCode: string) => Promise<RoomInitResult>;
  leaveRoom: () => Promise<void>;

  // Seat actions
  takeSeat: (seat: number) => Promise<boolean>;
  leaveSeat: () => Promise<void>;
  takeSeatWithAck: (seat: number) => Promise<ActionResult>;
  leaveSeatWithAck: () => Promise<ActionResult>;
  kickPlayer: (targetSeat: number) => Promise<ActionResult>;

  // Sync
  requestSnapshot: () => Promise<boolean>;
}

interface RoomLifecycleDeps {
  facade: IWerewolfFacade;
  authService: IAuthService;
  user: User | null;
  setRoomRecord: (record: RoomRecord | null) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Room lifecycle hook — create/join/leave/take-seat operations.
 *
 * Manages WS connection and room state via facade, exposes loading/error/needsAuth.
 */ export function useWerewolfRoomLifecycle(deps: RoomLifecycleDeps): RoomLifecycleState {
  const { facade, authService, user: authUser, setRoomRecord } = deps;
  const queryClient = useQueryClient();
  const { mutateAsync: joinRoomAsync } = useJoinRoom();

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

  // Initialize room: connect to the room already created by /room/create.
  // RoomScreen/useRoomInit calls this AFTER navigation with the confirmed roomCode.
  const initializeRoom = useCallback(
    async (roomCode: string): Promise<RoomInitResult> => {
      setLoading(true);
      setError(null);

      try {
        await authService.waitForInit();
        const hostUserId = authService.getCurrentUserId();
        if (!hostUserId) {
          // First-time user (no session) — show login modal instead of silent anonymous sign-in
          gameRoomLog.info('initializeRoom: No userId, requesting auth');
          setNeedsAuth(true);
          return { success: false, error: 'needs_auth' };
        }

        const record = await joinRoomAsync(roomCode);
        if (!record) {
          const msg = '房间不存在';
          setError(msg);
          return { success: false, error: msg };
        }
        if (record.gameType !== WEREWOLF_GAME_TYPE) {
          const msg = '房间类型不匹配';
          setError(msg);
          return { success: false, error: msg };
        }
        if (record.hostUserId !== hostUserId) {
          const msg = '房主身份不匹配';
          setError(msg);
          return { success: false, error: msg };
        }

        setRoomRecord(record);

        await facade.connectCreatedRoom(roomCode, hostUserId);
        addRecentRoom(roomCode);

        return { success: true };
      } catch (err) {
        // Superseded = old connectAndWait cancelled by a newer call (retry).
        // The new call is already in progress — silently ignore.
        if (err instanceof SupersededError) {
          gameRoomLog.debug('initializeRoom: Superseded by retry, ignoring');
          return { success: false, error: 'superseded' };
        }
        const message = getErrorMessage(err, '房间初始化失败，请重试');
        handleError(err, {
          label: '房间初始化',
          logger: gameRoomLog,
          feedback: false,
          isExpected: (e) =>
            e instanceof Error &&
            (e.message.includes('channel closed before subscribe') ||
              e.message.includes('connectAndWait timeout')),
        });
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [facade, authService, joinRoomAsync, setRoomRecord],
  );

  // Join an existing room as player
  const joinRoom = useCallback(
    async (roomCode: string): Promise<RoomInitResult> => {
      setLoading(true);
      setError(null);

      try {
        await authService.waitForInit();
        const playerUserId = authService.getCurrentUserId();
        if (!playerUserId) {
          // First-time user (no session) — show login modal instead of silent anonymous sign-in
          gameRoomLog.info('joinRoom: No userId, requesting auth');
          setNeedsAuth(true);
          return { success: false, error: 'needs_auth' };
        }

        // Check if room exists
        const record = await joinRoomAsync(roomCode);
        if (!record) {
          const msg = '房间不存在';
          setError(msg);
          removeRecentRoom(roomCode);
          return { success: false, error: msg };
        }
        setRoomRecord(record);

        // Host rejoin: isHost=true
        if (record.hostUserId === playerUserId) {
          gameRoomLog.debug('Host rejoin detected, attempting recovery');
          const result = await facade.joinRoom(roomCode, playerUserId, true);
          if (!result.success) {
            const msg = '房间状态已过期，请重新创建房间';
            gameRoomLog.error('Host rejoin failed', { reason: result.reason });
            setError(msg);
            return { success: false, error: msg };
          }
          gameRoomLog.debug('Host rejoin successful');
          addRecentRoom(roomCode);
          return { success: true };
        }

        // Player: isHost=false
        await facade.joinRoom(roomCode, playerUserId, false);
        addRecentRoom(roomCode);

        return { success: true };
      } catch (err) {
        // Superseded = old connectAndWait cancelled by a newer call (retry).
        // The new call is already in progress — silently ignore.
        if (err instanceof SupersededError) {
          gameRoomLog.debug('joinRoom: Superseded by retry, ignoring');
          return { success: false, error: 'superseded' };
        }
        const message = getErrorMessage(err, '加入房间失败，请重试');
        handleError(err, {
          label: '加入房间',
          logger: gameRoomLog,
          feedback: false,
          isExpected: (e) =>
            e instanceof Error &&
            (e.message.includes('channel closed before subscribe') ||
              e.message.includes('connectAndWait timeout')),
        });
        setError(message);
        return { success: false, error: message };
      } finally {
        setLoading(false);
      }
    },
    [facade, authService, joinRoomAsync, setRoomRecord],
  );

  // Leave the current room
  // NOTE: Room record is NOT deleted here — GitHub Actions cleanup-rooms.yml
  // automatically deletes rooms older than 24 hours, so host can rejoin after leaving.
  const leaveRoom = useCallback(async (): Promise<void> => {
    try {
      await facade.leaveRoom();
      setRoomRecord(null);
    } catch (err) {
      handleError(err, { label: '离开房间', logger: gameRoomLog, feedback: false });
    }
  }, [facade, setRoomRecord]);

  // =========================================================================
  // Seat actions
  // =========================================================================

  // Take a seat (unified API)
  const takeSeat = useCallback(
    async (seat: number): Promise<boolean> => {
      try {
        const displayName = authUser?.displayName ?? authService.generateDisplayName();
        const level = authUser?.isAnonymous
          ? undefined
          : await queryClient
              .ensureQueryData(userStatsOptions())
              .then((s) => s.level)
              .catch((err: unknown) => {
                gameRoomLog.warn('failed to fetch user level for takeSeat', {
                  error: err instanceof Error ? err.message : String(err),
                });
                return undefined;
              });

        return await facade.takeSeat(seat, {
          displayName,
          avatarUrl: authUser?.avatarUrl ?? undefined,
          avatarFrame: authUser?.avatarFrame ?? undefined,
          seatFlair: authUser?.seatFlair ?? undefined,
          nameStyle: authUser?.nameStyle ?? undefined,
          level,
          roleRevealEffect: authUser?.equippedEffect ?? undefined,
          seatAnimation: authUser?.seatAnimation ?? undefined,
        });
      } catch (err) {
        handleError(err, {
          label: '入座',
          logger: gameRoomLog,
        });
        return false;
      }
    },
    [facade, authService, authUser, queryClient],
  );

  // Leave seat (unified API)
  const leaveSeat = useCallback(async (): Promise<void> => {
    try {
      await facade.leaveSeat();
    } catch (err) {
      handleError(err, {
        label: '离座',
        logger: gameRoomLog,
      });
    }
  }, [facade]);

  // Take seat with ack (unified API)
  const takeSeatWithAck = useCallback(
    async (seat: number): Promise<ActionResult> => {
      try {
        const displayName = authUser?.displayName ?? authService.generateDisplayName();
        const level = authUser?.isAnonymous
          ? undefined
          : await queryClient
              .ensureQueryData(userStatsOptions())
              .then((s) => s.level)
              .catch((err: unknown) => {
                gameRoomLog.warn('failed to fetch user level for takeSeatWithAck', {
                  error: err instanceof Error ? err.message : String(err),
                });
                return undefined;
              });

        const result = await facade.takeSeatWithAck(seat, {
          displayName,
          avatarUrl: authUser?.avatarUrl ?? undefined,
          avatarFrame: authUser?.avatarFrame ?? undefined,
          seatFlair: authUser?.seatFlair ?? undefined,
          nameStyle: authUser?.nameStyle ?? undefined,
          level,
          roleRevealEffect: authUser?.equippedEffect ?? undefined,
          seatAnimation: authUser?.seatAnimation ?? undefined,
        });

        // Wire up seat error for downstream consumers (e.g., showAlert in useRoomScreenState)
        if (!result.success && result.reason === 'seat_taken') {
          setLastSeatError({ seat: seat, reason: 'seat_taken' });
        }

        return result;
      } catch (err) {
        handleError(err, { label: '入座(ack)', logger: gameRoomLog, feedback: false });
        return { success: false, reason: String(err) };
      }
    },
    [facade, authService, authUser, queryClient],
  );

  // Leave seat with ack (unified API)
  const leaveSeatWithAck = useCallback(async (): Promise<ActionResult> => {
    try {
      return await facade.leaveSeatWithAck();
    } catch (err) {
      handleError(err, { label: '离座(ack)', logger: gameRoomLog, feedback: false });
      return { success: false, reason: String(err) };
    }
  }, [facade]);

  // Kick player (Host-only)
  const kickPlayer = useCallback(
    async (targetSeat: number): Promise<ActionResult> => {
      try {
        return await facade.kickPlayer(targetSeat);
      } catch (err) {
        handleError(err, { label: '移出', logger: gameRoomLog });
        return { success: false, reason: String(err) };
      }
    },
    [facade],
  );

  // =========================================================================
  // Sync
  // =========================================================================

  // Force sync: read latest state from DB (reliable, bypasses broadcast channel)
  const requestSnapshot = useCallback(async (): Promise<boolean> => {
    try {
      return await facade.fetchStateFromDB();
    } catch (err) {
      handleError(err, { label: '同步状态', logger: gameRoomLog, feedback: false });
      return false;
    }
  }, [facade]);

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
    kickPlayer,
    requestSnapshot,
  };
}
