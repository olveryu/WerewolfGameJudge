/**
 * useRoomInit.ts - Room initialization hook
 *
 * Handles:
 * - Host creates room with template
 * - Player joins existing room
 * - Loading state and retry logic
 *
 * ❌ Do NOT: control night phase, push game actions
 * ✅ Allowed: call useGameRoom init APIs, manage local loading state
 */

import { useState, useEffect, useCallback } from 'react';
import type { GameTemplate } from '../../../models/Template';

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
}

export interface UseRoomInitResult {
  /** Whether initialization completed */
  isInitialized: boolean;
  /** Current loading message to display */
  loadingMessage: string;
  /** Whether to show retry/back buttons */
  showRetryButton: boolean;
  /** Callback to retry initialization */
  handleRetry: () => void;
}

/**
 * Manages room initialization lifecycle.
 * Host: createRoom → takeSeat(0) → initialized
 * Player: joinRoom → initialized
 */
export function useRoomInit({
  roomNumber,
  isHostParam,
  template,
  createRoom,
  joinRoom,
  takeSeat,
  hasGameState,
}: UseRoomInitParams): UseRoomInitResult {
  const [isInitialized, setIsInitialized] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('加载房间...');
  const [showRetryButton, setShowRetryButton] = useState(false);

  // Initialize room on mount
  useEffect(() => {
    if (isInitialized) return;

    const initRoom = async () => {
      setLoadingMessage('正在初始化...');

      if (isHostParam && template) {
        // Host creates room
        setLoadingMessage('正在创建房间...');
        const createdRoomNumber = await createRoom(template, roomNumber);

        if (createdRoomNumber) {
          // Host auto-takes seat 0
          setLoadingMessage('正在入座...');
          await takeSeat(0);
          setIsInitialized(true);
        } else {
          setLoadingMessage('创建失败');
          setShowRetryButton(true);
        }
      } else {
        // Player joins existing room
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
  }, [isInitialized, isHostParam, template, roomNumber, createRoom, joinRoom, takeSeat]);

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
  }, []);

  return {
    isInitialized,
    loadingMessage,
    showRetryButton,
    handleRetry,
  };
}
