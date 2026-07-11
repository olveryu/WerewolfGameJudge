/** Shared resolved-room entry, retry, reconnect view, and exit controller. */

import { useCallback, useEffect, useEffectEvent, useRef, useState } from 'react';

import type { RoomEntryResult } from '@/features/room/model/RoomConnection';
import type { RoomConnectionViewModel } from '@/features/room/model/RoomShellModel';
import type { RoomRecord } from '@/services/types/IRoomService';
import { showConfirmAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const SLOW_CONNECTION_HINT_MS = 8_000;
const ROOM_ENTRY_TIMEOUT_MS = 15_000;

interface UseRoomConnectionParams {
  readonly room: RoomRecord;
  readonly enterRoom: (room: RoomRecord) => Promise<RoomEntryResult>;
  readonly disconnect: () => Promise<void>;
  readonly hasRoomState: boolean;
  readonly connection: RoomConnectionViewModel;
  readonly onExit: () => void;
}

export interface RoomConnectionController {
  readonly isInitialized: boolean;
  readonly loadingMessage: string;
  readonly showRetryButton: boolean;
  readonly connection: RoomConnectionViewModel;
  readonly retry: () => void;
  readonly requestExit: (shouldConfirm: boolean) => void;
}

type EntryState =
  | { readonly kind: 'joining' }
  | { readonly kind: 'joined' }
  | { readonly kind: 'failed'; readonly message: string };

export function useRoomConnection({
  room,
  enterRoom,
  disconnect,
  hasRoomState,
  connection,
  onExit,
}: UseRoomConnectionParams): RoomConnectionController {
  const [entryState, setEntryState] = useState<EntryState>({ kind: 'joining' });
  const [loadingMessage, setLoadingMessage] = useState('正在加入房间');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [retryGeneration, setRetryGeneration] = useState(0);
  const activeAttemptRef = useRef(0);
  const hasReceivedStateRef = useRef(false);
  const exitSubmissionRef = useRef<Promise<void> | null>(null);
  const enterResolvedRoom = useEffectEvent((resolvedRoom: RoomRecord) => enterRoom(resolvedRoom));

  useEffect(() => {
    if (hasRoomState) hasReceivedStateRef.current = true;
  }, [hasRoomState]);

  useEffect(() => {
    const attempt = activeAttemptRef.current + 1;
    activeAttemptRef.current = attempt;
    setEntryState({ kind: 'joining' });
    setLoadingMessage('正在加入房间');
    setShowRetryButton(false);
    roomScreenLog.debug('Entering resolved room', {
      roomCode: room.roomCode,
      gameType: room.gameType,
      attempt,
    });

    void enterResolvedRoom(room)
      .then((result) => {
        if (activeAttemptRef.current !== attempt) return;
        if (result.success) {
          setEntryState({ kind: 'joined' });
          roomScreenLog.debug('Room entry complete', { attempt });
          return;
        }
        roomScreenLog.warn('Room entry rejected', {
          roomCode: room.roomCode,
          error: result.error,
          attempt,
        });
        setEntryState({ kind: 'failed', message: result.error });
        setLoadingMessage(result.error);
        setShowRetryButton(true);
      })
      .catch((error: unknown) => {
        if (activeAttemptRef.current !== attempt) return;
        setEntryState({ kind: 'failed', message: '加入房间失败，请重试' });
        setLoadingMessage('加入房间失败，请重试');
        setShowRetryButton(true);
        handleError(error, {
          label: '加入房间',
          logger: roomScreenLog,
          alertMessage: '加入房间失败，请重试',
        });
      });

    return () => {
      if (activeAttemptRef.current === attempt) {
        activeAttemptRef.current += 1;
      }
    };
  }, [retryGeneration, room]);

  const isInitialized = entryState.kind === 'joined';

  useEffect(() => {
    if (isInitialized && hasRoomState) {
      setShowRetryButton(false);
      return;
    }
    if (entryState.kind === 'failed') return;
    if (hasReceivedStateRef.current) return;

    const hintTimeout = setTimeout(() => {
      setLoadingMessage('网络较慢，请耐心等待');
    }, SLOW_CONNECTION_HINT_MS);
    const retryTimeout = setTimeout(() => {
      setShowRetryButton(true);
      setLoadingMessage(isInitialized ? '等待房主上线' : '加载超时');
      roomScreenLog.warn('Room entry timed out', { isInitialized, hasRoomState });
    }, ROOM_ENTRY_TIMEOUT_MS);

    return () => {
      clearTimeout(hintTimeout);
      clearTimeout(retryTimeout);
    };
  }, [entryState.kind, hasRoomState, isInitialized]);

  const retry = useCallback(() => {
    setRetryGeneration((generation) => generation + 1);
  }, []);

  const performExit = useCallback(async (): Promise<void> => {
    if (exitSubmissionRef.current !== null) {
      throw new Error('Room exit is already in progress');
    }
    const submission = Promise.resolve().then(disconnect);
    exitSubmissionRef.current = submission;
    try {
      await submission;
      onExit();
    } catch (error) {
      handleError(error, {
        label: '离开房间',
        logger: roomScreenLog,
        alertMessage: '无法离开房间，请稍后重试。',
      });
    } finally {
      exitSubmissionRef.current = null;
    }
  }, [disconnect, onExit]);

  const requestExit = useCallback(
    (shouldConfirm: boolean) => {
      if (shouldConfirm) {
        showConfirmAlert('离开房间？', '', performExit);
        return;
      }
      void performExit();
    },
    [performExit],
  );

  return {
    isInitialized,
    loadingMessage,
    showRetryButton,
    connection,
    retry,
    requestExit,
  };
}
