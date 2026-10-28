/** Single auth, entry, retry, and exit controller for resolved rooms. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { useRoomLinkSnapshot } from '@/features/room/controllers/useRoomLinkSnapshot';
import { getLinkCloseMessage } from '@/features/room/model/linkCloseMessages';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RoomConnectionViewModel } from '@/features/room/model/RoomShellModel';
import { addRecentRoom } from '@/features/room/services/recentRooms';
import type { RoomIdentity, RoomLink } from '@/platform/realtime/types';
import { RoomLinkClosedError } from '@/platform/realtime/types';
import { showConfirmAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const SLOW_CONNECTION_HINT_MS = 8_000;

interface UseRoomEntryControllerParams<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
> {
  readonly room: RoomRecord<TState['gameType']>;
  readonly link: RoomLink<TState, TCommand>;
  readonly authUserId: string | null;
  readonly isAuthLoading: boolean;
  readonly onExit: () => void;
}

export interface RoomEntryController {
  readonly isReady: boolean;
  readonly isAuthRequired: boolean;
  readonly loadingMessage: string;
  /** The link ended on a terminal reason; entering again requires a fresh connect. */
  readonly showRetryButton: boolean;
  readonly connection: RoomConnectionViewModel;
  readonly retry: () => void;
  readonly requestExit: (shouldConfirm: boolean) => void;
}

function matchesIdentity<TGameType extends string>(
  identity: RoomIdentity<TGameType>,
  room: RoomRecord<TGameType>,
  userId: string,
): boolean {
  return (
    identity.userId === userId &&
    identity.room.roomCode === room.roomCode &&
    identity.room.roomId === room.roomId &&
    identity.room.gameType === room.gameType &&
    identity.room.hostUserId === room.hostUserId
  );
}

export function useRoomEntryController<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
>({
  room,
  link,
  authUserId,
  isAuthLoading,
  onExit,
}: UseRoomEntryControllerParams<TState, TCommand>): RoomEntryController {
  const snapshot = useRoomLinkSnapshot(link);
  const phase = snapshot.phase;
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const roomCreatedAtMs = room.createdAt.getTime();
  const stableRoom = useMemo<RoomRecord<TState['gameType']>>(
    () => ({
      roomCode: room.roomCode,
      roomId: room.roomId,
      gameType: room.gameType,
      hostUserId: room.hostUserId,
      createdAt: new Date(roomCreatedAtMs),
    }),
    [roomCreatedAtMs, room.gameType, room.hostUserId, room.roomCode, room.roomId],
  );

  useEffect(() => {
    if (authUserId === null || phase !== 'ready') return;
    const current = link.getSnapshot();
    if (current.identity === null || !matchesIdentity(current.identity, stableRoom, authUserId)) {
      throw new Error('[FAIL-FAST] Ready room does not match recent-room identity');
    }
    try {
      addRecentRoom(authUserId, {
        roomCode: current.identity.room.roomCode,
        roomId: current.identity.room.roomId,
        gameType: current.identity.room.gameType,
      });
    } catch (error) {
      handleError(error, {
        label: '记录最近房间',
        logger: roomScreenLog,
        alertMessage: '最近房间记录保存失败',
      });
    }
  }, [authUserId, link, phase, stableRoom]);

  useEffect(() => {
    if (isAuthLoading || authUserId === null) return;

    const controller = new AbortController();
    const identity: RoomIdentity<TState['gameType']> = { room: stableRoom, userId: authUserId };

    const enter = async (): Promise<void> => {
      const current = link.getSnapshot();
      if (current.identity !== null && current.status.kind !== 'closed') {
        if (!matchesIdentity(current.identity, stableRoom, authUserId)) {
          throw new Error('[FAIL-FAST] Resolved room does not match the active room link');
        }
        return;
      }
      // A terminal close keeps its identity until released; retry starts a fresh epoch.
      if (current.status.kind === 'closed') link.close();
      await link.connect(identity, controller.signal);
    };

    void enter().catch((error: unknown) => {
      // Terminal closes are presented by the entry boundary from the link status itself.
      if (controller.signal.aborted || error instanceof RoomLinkClosedError) {
        roomScreenLog.warn('room entry ended', { error: String(error) });
        return;
      }
      handleError(error, {
        label: '加入房间',
        logger: roomScreenLog,
        alertMessage: '加入房间失败，请重试',
      });
    });

    return () => {
      controller.abort();
      const current = link.getSnapshot();
      if (current.identity !== null && matchesIdentity(current.identity, stableRoom, authUserId)) {
        link.close();
      }
    };
  }, [authUserId, isAuthLoading, retryGeneration, link, stableRoom]);

  useEffect(() => {
    if (phase !== 'entering') {
      setIsSlowConnection(false);
      return;
    }
    const timeout = setTimeout(() => setIsSlowConnection(true), SLOW_CONNECTION_HINT_MS);
    return () => clearTimeout(timeout);
  }, [phase, snapshot.epoch]);

  const retry = useCallback(() => {
    if (link.getSnapshot().status.kind !== 'closed') {
      throw new Error('[FAIL-FAST] Room entry retry requires a closed link');
    }
    setRetryGeneration((generation) => generation + 1);
  }, [link]);

  const retryNow = useCallback(() => link.retryNow(), [link]);

  const performExit = useCallback(() => {
    link.close();
    onExit();
  }, [onExit, link]);

  const requestExit = useCallback(
    (shouldConfirm: boolean) => {
      if (shouldConfirm) {
        showConfirmAlert('离开房间？', '离开后将退出当前对局，座位可能被他人占用。', performExit);
        return;
      }
      performExit();
    },
    [performExit],
  );

  const status = snapshot.status;
  return {
    isReady: phase === 'ready',
    isAuthRequired: !isAuthLoading && authUserId === null,
    loadingMessage:
      status.kind === 'closed'
        ? getLinkCloseMessage(status.reason)
        : isSlowConnection
          ? '网络较慢，请耐心等待'
          : '正在加入房间',
    showRetryButton: status.kind === 'closed' && status.reason !== 'released',
    connection: {
      status,
      pendingDurableCount: snapshot.pendingDurableCount,
      onRetryNow: retryNow,
    },
    retry,
    requestExit,
  };
}
