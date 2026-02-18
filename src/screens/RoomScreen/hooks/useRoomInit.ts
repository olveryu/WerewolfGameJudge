/**
 * useRoomInit.ts - Room initialization hook
 *
 * Calls useGameRoom init APIs (initializeHostRoom, joinRoom, takeSeat), manages local
 * loading/retry UI state, sets role reveal animation on room creation (host only), and
 * surfaces gameRoomError for error display. Does not control night phase or push game
 * actions, does not import services or business logic, does not access or modify
 * BroadcastGameState fields, does not contain night flow / audio / policy logic, and
 * does not create room record in DB (that's done in ConfigScreen before navigation).
 */

import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { roomScreenLog } from '@/utils/logger';

interface UseRoomInitParams {
  /** Room number (4-digit code) — confirmed/final, already created in DB */
  roomNumber: string;
  /** Whether this client is creating the room (host) */
  isHostParam: boolean;
  /** Template for room creation (host only) */
  template: GameTemplate | undefined;
  /** From useGameRoom: initialize host room (facade only, no DB) */
  initializeHostRoom: (roomNumber: string, template: GameTemplate) => Promise<boolean>;
  /** From useGameRoom: join existing room */
  joinRoom: (roomNumber: string) => Promise<boolean>;
  /** Check if we have received game state */
  hasGameState: boolean;
  /** Initial role reveal animation setting from ConfigScreen (host only) */
  initialRoleRevealAnimation?: RoleRevealAnimation;
  /** From useGameRoom: set role reveal animation (host only) */
  setRoleRevealAnimation?: (animation: RoleRevealAnimation) => Promise<void>;
  /** Error message from useGameRoom (shown when retry button is visible) */
  gameRoomError?: string | null;
}

interface UseRoomInitResult {
  /** Whether initialization completed */
  isInitialized: boolean;
  /** Current loading message to display (prefers gameRoomError when available + retrying) */
  loadingMessage: string;
  /** Whether to show retry/back buttons */
  showRetryButton: boolean;
  /** Callback to retry initialization (increments retryKey internally) */
  handleRetry: () => void;
}

/**
 * Manages room initialization lifecycle.
 * Host: initializeHostRoom → setRoleRevealAnimation → initialized
 * Player: joinRoom → initialized
 *
 * Note: DB room creation is done in ConfigScreen BEFORE navigation.
 * This hook only handles facade initialization (host) or joining (player).
 *
 * Retry: handleRetry resets state and increments retryKey to force re-trigger.
 */
export function useRoomInit({
  roomNumber,
  isHostParam,
  template,
  initializeHostRoom,
  joinRoom,
  hasGameState,
  initialRoleRevealAnimation,
  setRoleRevealAnimation,
  gameRoomError,
}: UseRoomInitParams): UseRoomInitResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  // Guard: prevent concurrent initialization from useEffect re-triggers
  const initInProgressRef = useRef(false);
  // Ref for gameRoomError — read in log only, must NOT be a dep to avoid infinite re-trigger
  const gameRoomErrorRef = useRef(gameRoomError);
  useEffect(() => {
    gameRoomErrorRef.current = gameRoomError;
  }, [gameRoomError]);

  // Initialize room on mount (retryKey change forces re-trigger)
  useEffect(() => {
    if (isInitialized) return;
    if (initInProgressRef.current) return;
    initInProgressRef.current = true;

    const initRoom = async () => {
      setLoadingMessage('正在初始化...');

      // Guard: template must be a real GameTemplate object, not a URL-parsed string.
      // On refresh, URL params may produce isHost=true + template="[object Object]".
      const hasValidTemplate =
        isHostParam &&
        template != null &&
        typeof template === 'object' &&
        Array.isArray(template.roles);

      if (hasValidTemplate) {
        // Host initializes room (DB record already created before navigation)
        setLoadingMessage('正在初始化房间...');
        roomScreenLog.debug('[useRoomInit] Host initializing room', {
          roomNumber,
          roleCount: template.roles.length,
        });
        const success = await initializeHostRoom(roomNumber, template);

        if (!success) {
          initInProgressRef.current = false;
          roomScreenLog.warn('[useRoomInit] Host initializeHostRoom failed', {
            roomNumber,
            error: gameRoomErrorRef.current ?? 'unknown',
          });
          setLoadingMessage('创建失败');
          setShowRetryButton(true);
          return;
        }

        // Set role reveal animation if provided from ConfigScreen
        if (initialRoleRevealAnimation && setRoleRevealAnimation) {
          roomScreenLog.debug('[useRoomInit] Setting role reveal animation', {
            animation: initialRoleRevealAnimation,
          });
          await setRoleRevealAnimation(initialRoleRevealAnimation);
        }
        setIsInitialized(true);
        initInProgressRef.current = false;
        roomScreenLog.debug('[useRoomInit] Host init complete');
      } else {
        // Player joins existing room via BroadcastService
        setLoadingMessage('正在加入房间...');
        roomScreenLog.debug('[useRoomInit] Player joining room', { roomNumber });
        const joined = await joinRoom(roomNumber);

        if (joined) {
          setIsInitialized(true);
          initInProgressRef.current = false;
          roomScreenLog.debug('[useRoomInit] Player join complete');
        } else {
          initInProgressRef.current = false;
          roomScreenLog.warn('[useRoomInit] joinRoom failed', { roomNumber });
          setLoadingMessage('加入房间失败');
          setShowRetryButton(true);
        }
      }
    };

    void initRoom();
    // retryKey 变化时也会触发重试
  }, [
    isInitialized,
    retryKey,
    isHostParam,
    template,
    roomNumber,
    initializeHostRoom,
    joinRoom,
    initialRoleRevealAnimation,
    setRoleRevealAnimation,
    // NOTE: gameRoomError intentionally excluded — read via ref to avoid
    // infinite loop (error → re-trigger → joinRoom → error → …)
  ]);

  // Loading timeout
  useEffect(() => {
    if (isInitialized && hasGameState) {
      setShowRetryButton(false);
      return;
    }

    const timeout = setTimeout(() => {
      if (!isInitialized || !hasGameState) {
        setShowRetryButton(true);
        // 区分两种超时场景：
        // - 已加入频道但没收到 state → 房主可能不在线
        // - 初始化本身失败 → 通用加载超时
        if (isInitialized && !hasGameState) {
          roomScreenLog.warn('[useRoomInit] Loading timeout — waiting for host state', {
            isInitialized,
            hasGameState,
          });
          setLoadingMessage('等待房主上线...（房主可能不在房间内）');
        } else {
          roomScreenLog.warn('[useRoomInit] Loading timeout — init incomplete', {
            isInitialized,
            hasGameState,
          });
          setLoadingMessage('加载超时');
        }
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isInitialized, hasGameState]);

  const handleRetry = useCallback(() => {
    roomScreenLog.debug('[useRoomInit] Retry triggered');
    setIsInitialized(false);
    setShowRetryButton(false);
    initInProgressRef.current = false;
    setLoadingMessage('重试中...');
    // 递增 retryKey 强制触发 useEffect 重试（即使 isInitialized 已经是 false）
    setRetryKey((prev) => prev + 1);
  }, []);

  // Prefer specific gameRoomError over generic loading message when retry is visible
  const displayMessage = showRetryButton && gameRoomError ? gameRoomError : loadingMessage;

  return {
    isInitialized,
    loadingMessage: displayMessage,
    showRetryButton,
    handleRetry,
  };
}
