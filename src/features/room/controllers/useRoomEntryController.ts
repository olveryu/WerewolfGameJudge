/** Single auth, entry, reconnect, retry, and exit controller for resolved rooms. */

import type { GameType } from '@werewolf/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoomSessionSnapshot } from '@/features/room/controllers/useRoomSessionSnapshot';
import type { RoomRecord } from '@/features/room/model/RoomDirectory';
import type { RoomConnectionViewModel } from '@/features/room/model/RoomShellModel';
import type {
  ActiveRoomIdentity,
  RoomSessionClient,
  RoomUserEvent,
} from '@/features/room/session/types';
import { showConfirmAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const SLOW_CONNECTION_HINT_MS = 8_000;

interface UseRoomEntryControllerParams<
  TState extends BaseGameState<GameType>,
  TCommand extends object,
  TEvent extends RoomUserEvent,
> {
  readonly room: RoomRecord;
  readonly session: RoomSessionClient<TState, TCommand, TEvent>;
  readonly authUserId: string | null;
  readonly isAuthLoading: boolean;
  readonly onExit: () => void;
}

export interface RoomEntryController {
  readonly isReady: boolean;
  readonly isAuthRequired: boolean;
  readonly loadingMessage: string;
  readonly showRetryButton: boolean;
  readonly connection: RoomConnectionViewModel;
  readonly retry: () => void;
  readonly requestExit: (shouldConfirm: boolean) => void;
}

function matchesIdentity(identity: ActiveRoomIdentity, room: RoomRecord, userId: string): boolean {
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
  TEvent extends RoomUserEvent,
>({
  room,
  session,
  authUserId,
  isAuthLoading,
  onExit,
}: UseRoomEntryControllerParams<TState, TCommand, TEvent>): RoomEntryController {
  const sessionSnapshot = useRoomSessionSnapshot(session);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const [isSlowConnection, setIsSlowConnection] = useState(false);
  const reconnectAbortRef = useRef<AbortController | null>(null);
  const roomCreatedAtMs = room.createdAt.getTime();
  const stableRoom = useMemo<RoomRecord>(
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
    if (isAuthLoading || authUserId === null) return;

    const controller = new AbortController();
    const identity: ActiveRoomIdentity = { room: stableRoom, userId: authUserId };

    const enter = async (): Promise<void> => {
      const current = session.getSnapshot();
      if (current.phase === 'ready') {
        if (!matchesIdentity(current.identity, stableRoom, authUserId)) {
          throw new Error('[FAIL-FAST] Resolved room does not match the active room session');
        }
        return;
      }
      if (current.phase === 'failed') {
        if (!matchesIdentity(current.identity, stableRoom, authUserId)) {
          throw new Error('[FAIL-FAST] Failed room identity changed before retry');
        }
        session.disconnect();
      } else if (current.phase !== 'idle') {
        throw new Error(`[FAIL-FAST] Room entry started while session was ${current.phase}`);
      }

      const outcome = await session.connect(identity, controller.signal);
      if (outcome.kind === 'superseded' && !controller.signal.aborted) {
        throw new Error('[FAIL-FAST] Room entry was superseded without effect cleanup');
      }
    };

    void enter().catch((error: unknown) => {
      handleError(error, {
        label: '加入房间',
        logger: roomScreenLog,
        alertMessage: '加入房间失败，请重试',
      });
    });

    return () => {
      controller.abort();
      const current = session.getSnapshot();
      if (current.phase !== 'idle' && matchesIdentity(current.identity, stableRoom, authUserId)) {
        session.disconnect();
      }
    };
  }, [authUserId, isAuthLoading, retryGeneration, session, stableRoom]);

  useEffect(() => {
    if (sessionSnapshot.phase !== 'entering') {
      setIsSlowConnection(false);
      return;
    }
    const timeout = setTimeout(() => setIsSlowConnection(true), SLOW_CONNECTION_HINT_MS);
    return () => clearTimeout(timeout);
  }, [sessionSnapshot.phase, sessionSnapshot.epoch]);

  const retry = useCallback(() => {
    if (session.getSnapshot().phase !== 'failed') {
      throw new Error('[FAIL-FAST] Room entry retry requires a failed session');
    }
    setRetryGeneration((generation) => generation + 1);
  }, [session]);

  const manualReconnect = useCallback(() => {
    if (reconnectAbortRef.current !== null) {
      throw new Error('[FAIL-FAST] Room reconnect is already in progress');
    }
    const controller = new AbortController();
    reconnectAbortRef.current = controller;
    void session
      .reconnect(controller.signal)
      .catch((error: unknown) => {
        handleError(error, {
          label: '重新连接房间',
          logger: roomScreenLog,
          alertMessage: '重新连接失败，请稍后重试',
        });
      })
      .finally(() => {
        if (reconnectAbortRef.current === controller) reconnectAbortRef.current = null;
      });
  }, [session]);

  useEffect(
    () => () => {
      reconnectAbortRef.current?.abort();
      reconnectAbortRef.current = null;
    },
    [],
  );

  const performExit = useCallback(() => {
    session.disconnect();
    onExit();
  }, [onExit, session]);

  const requestExit = useCallback(
    (shouldConfirm: boolean) => {
      if (shouldConfirm) {
        showConfirmAlert('离开房间？', '', performExit);
        return;
      }
      performExit();
    },
    [performExit],
  );

  return {
    isReady: sessionSnapshot.phase === 'ready',
    isAuthRequired: !isAuthLoading && authUserId === null,
    loadingMessage:
      sessionSnapshot.phase === 'failed'
        ? '加入房间失败，请重试'
        : isSlowConnection
          ? '网络较慢，请耐心等待'
          : '正在加入房间',
    showRetryButton: sessionSnapshot.phase === 'failed',
    connection: {
      status: sessionSnapshot.connection,
      onManualReconnect: manualReconnect,
    },
    retry,
    requestExit,
  };
}
