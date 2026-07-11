/**
 * useRoomLifecycle - Room creation, joining, leaving, and seat management
 *
 * Manages the full room lifecycle:
 * - Entering a resolver-validated room (host identity derived from metadata)
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
import { useCallback, useState } from 'react';

import type { User } from '@/contexts/AuthContext';
import { userStatsOptions } from '@/hooks/queries/queryOptions';
import { addRecentRoom } from '@/lib/recentRooms';
import { SupersededError } from '@/services/connection/types';
import type { IAuthService } from '@/services/types/IAuthService';
import type { IGameFacade } from '@/services/types/IGameFacade';
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

  // Room actions
  enterRoom: (room: RoomRecord) => Promise<RoomInitResult>;
  leaveRoom: () => Promise<void>;

  // Seat actions
  takeSeat: (seat: number) => Promise<ActionResult>;
  leaveSeat: () => Promise<ActionResult>;
  kickPlayer: (targetSeat: number) => Promise<ActionResult>;

  // Sync
  requestSnapshot: () => Promise<boolean>;
}

interface RoomLifecycleDeps {
  facade: IGameFacade;
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
 */ export function useRoomLifecycle(deps: RoomLifecycleDeps): RoomLifecycleState {
  const { facade, authService, user: authUser, setRoomRecord } = deps;
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);

  // =========================================================================
  // Room lifecycle
  // =========================================================================

  const enterRoom = useCallback(
    async (room: RoomRecord): Promise<RoomInitResult> => {
      setLoading(true);
      setError(null);

      try {
        await authService.waitForInit();
        const playerUserId = authService.getCurrentUserId();
        if (!playerUserId) {
          // First-time user (no session) — show login modal instead of silent anonymous sign-in
          gameRoomLog.info('enterRoom: No userId, requesting auth');
          setNeedsAuth(true);
          return { success: false, error: 'needs_auth' };
        }

        setRoomRecord(room);
        await facade.enterRoom(room, playerUserId);
        addRecentRoom(room.roomCode);

        return { success: true };
      } catch (err) {
        // Superseded = old connectAndWait cancelled by a newer call (retry).
        // The new call is already in progress — silently ignore.
        if (err instanceof SupersededError) {
          gameRoomLog.debug('enterRoom: Superseded by retry, ignoring');
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
    [facade, authService, setRoomRecord],
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

  // Take a seat through the single reason-preserving API.
  const takeSeat = useCallback(
    async (seat: number): Promise<ActionResult> => {
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

      return facade.takeSeat(seat, {
        displayName,
        avatarUrl: authUser?.avatarUrl ?? undefined,
        avatarFrame: authUser?.avatarFrame ?? undefined,
        seatFlair: authUser?.seatFlair ?? undefined,
        nameStyle: authUser?.nameStyle ?? undefined,
        level,
        roleRevealEffect: authUser?.equippedEffect ?? undefined,
        seatAnimation: authUser?.seatAnimation ?? undefined,
      });
    },
    [facade, authService, authUser, queryClient],
  );

  const leaveSeat = useCallback((): Promise<ActionResult> => facade.leaveSeat(), [facade]);

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
  const clearNeedsAuth = useCallback(() => {
    setNeedsAuth(false);
  }, []);

  return {
    loading,
    error,
    needsAuth,
    clearNeedsAuth,
    enterRoom,
    leaveRoom,
    takeSeat,
    leaveSeat,
    kickPlayer,
    requestSnapshot,
  };
}
