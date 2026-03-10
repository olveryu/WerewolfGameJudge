/**
 * useSpeakingOrder — Speaking order display hook
 *
 * After night ends (status → Ended, audio finished), generates a seeded random
 * speaking order and shows it for 60 seconds. Resets on game restart.
 *
 * Uses a ref for gameState to avoid cancelling the 60s timer on every broadcast.
 */

import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import { createSeededRng } from '@werewolf/game-engine/utils/random';
import { useEffect, useRef, useState } from 'react';

import { STATUS } from '@/config/emojiTokens';
import type { LocalGameState } from '@/types/GameStateTypes';

import { generateSpeakOrder } from '../useRoomHostDialogs';

interface UseSpeakingOrderParams {
  roomStatus: GameStatus;
  isAudioPlaying: boolean;
  gameState: LocalGameState | null;
}

/**
 * @returns speakingOrderText — e.g. "🎙️ 从 3 号开始 顺时针发言", or undefined when hidden.
 */
export function useSpeakingOrder({
  roomStatus,
  isAudioPlaying,
  gameState,
}: UseSpeakingOrderParams): string | undefined {
  const [speakingOrderText, setSpeakingOrderText] = useState<string | undefined>();
  const speakingOrderShownRef = useRef(false);

  // Ref to read gameState inside effect without adding it as a dependency
  // (gameState object reference changes on every broadcast, which would cancel the 60s timer)
  const gameStateRef = useRef(gameState);
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    // Reset when leaving ended status (e.g. restart)
    if (roomStatus !== GameStatus.Ended) {
      speakingOrderShownRef.current = false;
      setSpeakingOrderText(undefined);
      return;
    }
    if (!gameStateRef.current || isAudioPlaying || speakingOrderShownRef.current) {
      return;
    }
    speakingOrderShownRef.current = true;

    const seed = gameStateRef.current.roleRevealRandomNonce ?? gameStateRef.current.roomCode;
    const rng = createSeededRng(seed);
    const playerCount = gameStateRef.current.template.roles.length;
    const { startSeat, direction } = generateSpeakOrder(playerCount, rng);
    setSpeakingOrderText(`${STATUS.SPEAKING} 从 ${startSeat} 号开始 ${direction}发言`);

    const timer = setTimeout(() => setSpeakingOrderText(undefined), 60_000);
    return () => clearTimeout(timer);
  }, [roomStatus, isAudioPlaying]);

  return speakingOrderText;
}
