/**
 * useRoomInit.ts - Room initialization hook
 *
 * ✅ Allowed:
 *   - Call useGameRoom init APIs (createRoom, joinRoom, takeSeat)
 *   - Manage local loading/retry UI state
 *   - Set role reveal animation on room creation (host only)
 *   - Surface gameRoomError for error display
 *
 * ❌ Do NOT:
 *   - Control night phase or push game actions
 *   - Import services or business logic
 *   - Access or modify BroadcastGameState fields
 *   - Contain any night flow / audio / policy logic
 */

import { useState, useEffect, useCallback } from 'react';
import type { GameTemplate } from '../../../models/Template';
import type { RoleRevealAnimation } from '../../../services/types/RoleRevealAnimation';

export interface UseRoomInitParams {
  /** Room number (4-digit code) */
  roomNumber: string;
  /** Whether this client is creating the room (host) */
  isHostParam: boolean;
  /** Template for room creation (host only) */
  template: GameTemplate | undefined;
  /** From useGameRoom: create a new room */
  createRoom: (template: GameTemplate, roomNumber?: string) => Promise<string | null>;
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

export interface UseRoomInitResult {
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
 * Host: createRoom → setRoleRevealAnimation → takeSeat(0) → initialized
 * Player: joinRoom → initialized
 *
 * Retry: handleRetry resets state and increments retryKey to force re-trigger.
 */
export function useRoomInit({
  roomNumber,
  isHostParam,
  template,
  createRoom,
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
        // Host creates room with the provided roomNumber from ConfigScreen
        setLoadingMessage('正在创建房间...');
        const createdRoomNumber = await createRoom(template, roomNumber);

        if (createdRoomNumber) {
          // Set role reveal animation if provided from ConfigScreen
          if (initialRoleRevealAnimation && setRoleRevealAnimation) {
            await setRoleRevealAnimation(initialRoleRevealAnimation);
          }
          // Host auto-takes seat 0
          setLoadingMessage('正在入座...');
          await takeSeat(0);
          setIsInitialized(true);
        } else {
          setLoadingMessage('创建失败');
          setShowRetryButton(true);
        }
      } else {
        // Player joins existing room via BroadcastService
        setLoadingMessage('正在加入房间...');
        const joined = await joinRoom(roomNumber);

        if (joined) {
          setIsInitialized(true);
        } else {
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
    createRoom,
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
        setLoadingMessage('加载超时');
      }
    }, 5000);

    return () => clearTimeout(timeout);
  }, [isInitialized, hasGameState]);

  const handleRetry = useCallback(() => {
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
