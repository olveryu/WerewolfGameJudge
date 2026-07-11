/**
 * useRoomInit.ts - Room initialization hook
 *
 * Enters a resolver-validated room through the single connection path and manages local
 * loading/retry UI state. Error messages come from RoomInitResult.error
 * (synchronous return, not async state).
 * Does not control night phase or push game actions, does not import services
 * or business logic, does not access or modify GameState fields, does not
 * contain night flow / audio / policy logic, and does not create room record
 * in DB (that's done in ConfigScreen before navigation).
 */

import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoomInitResult } from '@/hooks/useRoomLifecycle';
import type { RoomRecord } from '@/services/types/IRoomService';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomInitParams {
  /** Active metadata already resolved by RoomResolverScreen. */
  room: RoomRecord;
  /** From useGameRoom: enter as host or player based on resolved metadata. */
  enterRoom: (room: RoomRecord) => Promise<RoomInitResult>;
  /** Check if we have received game state */
  hasGameState: boolean;
}

interface UseRoomInitResult {
  /** Whether initialization completed */
  isInitialized: boolean;
  /** Current loading/error message to display */
  loadingMessage: string;
  /** Whether to show retry/back buttons */
  showRetryButton: boolean;
  /** Callback to retry initialization (increments retryKey internally) */
  handleRetry: () => void;
}

/**
 * Manages room initialization lifecycle.
 * Retry: handleRetry resets state and increments retryKey to force re-trigger.
 */
export function useRoomInit({
  room,
  enterRoom,
  hasGameState,
}: UseRoomInitParams): UseRoomInitResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Guard: prevent concurrent initialization from useEffect re-triggers
  const initInProgressRef = useRef(false);
  // Once gameState has been received, never fire the loading timeout again.
  // hasGameState flips back to false only during leaveRoom (store.reset), not during load failure.
  const hadGameStateRef = useRef(false);
  useEffect(() => {
    if (hasGameState) hadGameStateRef.current = true;
  }, [hasGameState]);

  // Initialize room on mount (retryKey change forces re-trigger)
  useEffect(() => {
    if (isInitialized) return;
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initRoom = async () => {
      setLoadingMessage('正在加载房间');

      setLoadingMessage('正在加入房间');
      roomScreenLog.debug('Entering resolved room', {
        roomCode: room.roomCode,
        gameType: room.gameType,
      });
      const result = await enterRoom(room);

      if (result.success) {
        setIsInitialized(true);
        initInProgressRef.current = false;
        roomScreenLog.debug('Room entry complete');
      } else {
        initInProgressRef.current = false;
        roomScreenLog.warn('enterRoom failed', {
          roomCode: room.roomCode,
          error: result.error,
        });
        setLoadingMessage(result.error);
        setShowRetryButton(true);
      }
    };

    void initRoom();
    // retryKey change also triggers a retry
  }, [isInitialized, retryKey, room, enterRoom]);

  // Loading timeout — two-phase: soft hint at 8s, hard retry at 15s
  useEffect(() => {
    if (isInitialized && hasGameState) {
      setShowRetryButton(false);
      return;
    }

    // Already had state once → leaving room, not a load failure
    if (hadGameStateRef.current) return;

    // Phase 1: soft hint — reassure user without showing retry button
    const hintTimeout = setTimeout(() => {
      if (!isInitialized || !hasGameState) {
        roomScreenLog.info('Loading hint — still waiting', { isInitialized, hasGameState });
        setLoadingMessage('网络较慢，请耐心等待');
      }
    }, 8000);

    // Phase 2: hard timeout — show retry button
    const retryTimeout = setTimeout(() => {
      if (!isInitialized || !hasGameState) {
        setShowRetryButton(true);
        // Distinguish two timeout scenarios:
        // - Joined channel but no state received → host may be offline
        // - Init itself failed → generic load timeout
        if (isInitialized && !hasGameState) {
          roomScreenLog.warn('Loading timeout — waiting for host state', {
            isInitialized,
            hasGameState,
          });
          setLoadingMessage('等待房主上线');
        } else {
          roomScreenLog.warn('Loading timeout — init incomplete', {
            isInitialized,
            hasGameState,
          });
          setLoadingMessage('加载超时');
        }
      }
    }, 15000);

    return () => {
      clearTimeout(hintTimeout);
      clearTimeout(retryTimeout);
    };
  }, [isInitialized, hasGameState]);

  const handleRetry = useCallback(() => {
    roomScreenLog.debug('Retry triggered');
    setIsInitialized(false);
    setShowRetryButton(false);
    initInProgressRef.current = false;
    setLoadingMessage('重试中');
    // Increment retryKey to force useEffect retry (even when isInitialized is already false)
    setRetryKey((prev) => prev + 1);
  }, []);

  return {
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,
  };
}
