/**
 * useRoomInit.ts - Room initialization hook
 *
 * Calls useGameRoom init APIs (initializeRoom, joinRoom), manages local
 * loading/retry UI state. Error messages come from RoomInitResult.error
 * (synchronous return, not async state).
 * Does not control night phase or push game actions, does not import services
 * or business logic, does not access or modify GameState fields, does not
 * contain night flow / audio / policy logic, and does not create room record
 * in DB (that's done in ConfigScreen before navigation).
 */

import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { RoomInitResult } from '@/hooks/useRoomLifecycle';
import { roomScreenLog } from '@/utils/logger';

interface UseRoomInitParams {
  /** Room number (4-digit code) — confirmed/final, already created in DB */
  roomCode: string;
  /** Whether this client is creating the room (host) */
  isHostParam: boolean;
  /** Template for room creation (host only) */
  template: GameTemplate | undefined;
  /** From useGameRoom: initialize room (facade only, no DB) */
  initializeRoom: (roomCode: string, template: GameTemplate) => Promise<RoomInitResult>;
  /** From useGameRoom: join existing room */
  joinRoom: (roomCode: string) => Promise<RoomInitResult>;
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
 * Host: initializeRoom → initialized
 * Player: joinRoom → initialized
 *
 * Note: DB room creation is done in ConfigScreen BEFORE navigation.
 * This hook only handles facade initialization (host) or joining (player).
 *
 * Retry: handleRetry resets state and increments retryKey to force re-trigger.
 */
export function useRoomInit({
  roomCode,
  isHostParam,
  template,
  initializeRoom,
  joinRoom,
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

      // Guard: template must be a real GameTemplate object, not a URL-parsed string.
      // On refresh, URL params may produce isHost=true + template="[object Object]".
      const hasValidTemplate =
        isHostParam &&
        template != null &&
        typeof template === 'object' &&
        Array.isArray(template.roles);

      if (hasValidTemplate) {
        // Host initializes room (DB record already created before navigation)
        setLoadingMessage('正在加载房间');
        roomScreenLog.debug('Host initializing room', {
          roomCode,
          playerCount: template.numberOfPlayers,
          totalRoles: template.roles.length,
        });
        const result = await initializeRoom(roomCode, template);

        if (!result.success) {
          initInProgressRef.current = false;
          roomScreenLog.warn('Host initializeRoom failed', {
            roomCode,
            error: result.error,
          });
          setLoadingMessage(result.error);
          setShowRetryButton(true);
          return;
        }

        setIsInitialized(true);
        initInProgressRef.current = false;
        roomScreenLog.debug('Host init complete');
      } else {
        // Player joins existing room via RealtimeService
        setLoadingMessage('正在加入房间');
        roomScreenLog.debug('Player joining room', { roomCode });
        const result = await joinRoom(roomCode);

        if (result.success) {
          setIsInitialized(true);
          initInProgressRef.current = false;
          roomScreenLog.debug('Player join complete');
        } else {
          initInProgressRef.current = false;
          roomScreenLog.warn('joinRoom failed', {
            roomCode,
            error: result.error,
          });
          setLoadingMessage(result.error);
          setShowRetryButton(true);
        }
      }
    };

    void initRoom();
    // retryKey 变化时也会触发重试
  }, [isInitialized, retryKey, isHostParam, template, roomCode, initializeRoom, joinRoom]);

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
        // 区分两种超时场景：
        // - 已加入频道但没收到 state → 房主可能不在线
        // - 初始化本身失败 → 通用加载超时
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
    // 递增 retryKey 强制触发 useEffect 重试（即使 isInitialized 已经是 false）
    setRetryKey((prev) => prev + 1);
  }, []);

  return {
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,
  };
}
