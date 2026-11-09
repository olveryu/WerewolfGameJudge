/**
 * useAIChat - orchestration layer for the AI chat bubble.
 *
 * Composes useBubbleDrag / useKeyboardHeight / useChatMessages, manages the open state, registers
 * the cross-component bridge and refreshes the quick questions.
 */

import { useEffect, useEffectEvent, useState } from 'react';

import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import { setAIChatBridgeListener } from '@/games/werewolf/services/aiChatBridge';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';
import type { RoomIdentity } from '@/platform/realtime/types';

import { generateQuickQuestions } from './quickQuestions';
import { useBubbleDrag } from './useBubbleDrag';
import { useChatMessages } from './useChatMessages';
import { useKeyboardHeight } from './useKeyboardHeight';

function questionsFor(roomSession: WerewolfRoomSession): string[] {
  const room = roomSession.getSnapshot();
  const gameState = room.phase === 'ready' ? room.room.state : null;
  const userId = room.phase === 'idle' ? null : room.identity.userId;
  return generateQuickQuestions(gameState, getWerewolfUserSeat(gameState, userId));
}

export function useAIChat(roomSession: WerewolfRoomSession, identity: RoomIdentity<'werewolf'>) {
  // The bubble is keyed by user and room, so the storage owner is fixed for its lifetime.
  const [storageOwner] = useState(() => ({
    userId: identity.userId,
    roomId: identity.room.roomId,
  }));

  const [isOpen, setIsOpen] = useState(false);
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);

  const open = () => {
    // Refresh quick questions when the chat opens.
    if (!isOpen) setContextQuestions(questionsFor(roomSession));
    setIsOpen(true);
  };

  const bubble = useBubbleDrag(open, identity.userId);
  const keyboardHeight = useKeyboardHeight();
  // Refresh quick questions after each reply settles.
  const chat = useChatMessages(roomSession, isOpen, storageOwner, () =>
    setContextQuestions(questionsFor(roomSession)),
  );

  // ── Bridge listener (cross-component message requests) ──
  const handleBridgeRequest = useEffectEvent(
    (payload: { fullText: string; displayText: string; maxTokens?: number }) => {
      open();
      chat.sendWithDisplay(payload.fullText, payload.displayText, payload.maxTokens);
    },
  );
  useEffect(() => {
    setAIChatBridgeListener((payload) => handleBridgeRequest(payload));
    return () => setAIChatBridgeListener(null);
  }, []);

  return {
    ...chat,
    contextQuestions,
    isOpen,
    open,
    close: () => setIsOpen(false),
    bubble,
    keyboardHeight,
  };
}
