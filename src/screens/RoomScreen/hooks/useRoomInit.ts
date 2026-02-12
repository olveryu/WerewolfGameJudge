/**
 * useRoomInit.ts - Room initialization hook
 *
 * ✅ Allowed:
 *   - Call useGameRoom init APIs (initializeHostRoom, joinRoom, takeSeat)
 *   - Manage local loading/retry UI state
 *   - Set role reveal animation on room creation (host only)
 *   - Surface gameRoomError for error display
 *
 * ❌ Do NOT:
 *   - Control night phase or push game actions
 *   - Import services or business logic
 *   - Access or modify BroadcastGameState fields
 *   - Contain any night flow / audio / policy logic
 *   - Create room record in DB (that's done in ConfigScreen before navigation)
 */

import { useCallback,useEffect, useState } from 'react';

import type { GameTemplate } from '@/models/Template';
import type { RoleRevealAnimation } from '@/types/RoleRevealAnimation';
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
  /** From useGameRoom: take a seat */
  takeSeat: (seatIndex: number) => Promise<boolean>;
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
 * Host: initializeHostRoom → setRoleRevealAnimation → takeSeat(0) → initialized
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
  takeSeat,
  hasGameState,
  initialRoleRevealAnimation,
  setRoleRevealAnimation,
  gameRoomError,
}: UseRoomInitParams): UseRoomInitResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  // Initialize room on mount (retryKey change forces re-trigger)
  useEffect(() => {
    if (isInitialized) return;

    const initRoom = async () => {
      setLoadingMessage('正在初始化...');

      if (isHostParam && template) {
        // Host initializes room (DB record already created before navigation)
        setLoadingMessage('正在初始化房间...');
        roomScreenLog.debug('[useRoomInit] Host initializing room', { roomNumber, roleCount: template.roles.length });
        const success = await initializeHostRoom(roomNumber, template);

        if (success) {
          // Set role reveal animation if provided from ConfigScreen
          if (initialRoleRevealAnimation && setRoleRevealAnimation) {
            roomScreenLog.debug('[useRoomInit] Setting role reveal animation', { animation: initialRoleRevealAnimation });
            await setRoleRevealAnimation(initialRoleRevealAnimation);
          }
          // Host auto-takes seat 0
          setLoadingMessage('正在入座...');
          roomScreenLog.debug('[useRoomInit] Host auto-taking seat 0');
          await takeSeat(0);
          setIsInitialized(true);
          roomScreenLog.debug('[useRoomInit] Host init complete');
        } else {
          roomScreenLog.warn('[useRoomInit] Host initializeHostRoom failed', { roomNumber });
          setLoadingMessage('创建失败');
          setShowRetryButton(true);
        }
      } else {
        // Player joins existing room via BroadcastService
        setLoadingMessage('正在加入房间...');
        roomScreenLog.debug('[useRoomInit] Player joining room', { roomNumber });
        const joined = await joinRoom(roomNumber);

        if (joined) {
          setIsInitialized(true);
          roomScreenLog.debug('[useRoomInit] Player join complete');
        } else {
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
    takeSeat,
    initialRoleRevealAnimation,
    setRoleRevealAnimation,
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
          roomScreenLog.warn('[useRoomInit] Loading timeout — waiting for host state', { isInitialized, hasGameState });
          setLoadingMessage('等待房主上线...（房主可能不在房间内）');
        } else {
          roomScreenLog.warn('[useRoomInit] Loading timeout — init incomplete', { isInitialized, hasGameState });
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
