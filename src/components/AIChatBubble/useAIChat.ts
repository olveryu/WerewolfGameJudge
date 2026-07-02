/**
 * useAIChat - orchestration layer for the AI chat bubble.
 *
 * Composes three sub-hooks (useBubbleDrag / useKeyboardHeight / useChatMessages),
 * manages isOpen state and quick-question refresh, and exposes the unified UseAIChatReturn interface.
 * Composes sub-hooks and manages open/close state. Drag/keyboard/message logic is delegated entirely to sub-hooks.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Animated, GestureResponderEvent } from 'react-native';

import { useWerewolfFacade } from '@/contexts';
import { setAIChatBridgeListener } from '@/utils/aiChatBridge';

import type { DisplayMessage } from './AIChatBubble.styles';
import { generateQuickQuestions } from './quickQuestions';
import { useBubbleDrag } from './useBubbleDrag';
import { useChatMessages, type UseChatMessagesReturn } from './useChatMessages';
import { useKeyboardHeight } from './useKeyboardHeight';

// ══════════════════════════════════════════════════════════
// Public interface
// ══════════════════════════════════════════════════════════

interface UseAIChatReturn {
  // Chat state
  messages: DisplayMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  cooldownRemaining: number;
  contextQuestions: string[];

  // Actions
  handleSend: () => Promise<void>;
  handleQuickQuestion: (question: string) => void;
  handleClearHistory: () => void;

  // Bubble position & drag
  position: { x: number; y: number };
  scaleAnim: Animated.Value;
  handleTouchStart: (e: GestureResponderEvent) => void;
  handleTouchMove: (e: GestureResponderEvent) => void;
  handleTouchEnd: () => void;
  handleBubblePress: () => void;

  // Keyboard
  keyboardHeight: number;
}

// ══════════════════════════════════════════════════════════
// Hook
// ══════════════════════════════════════════════════════════

export function useAIChat(): UseAIChatReturn {
  const facade = useWerewolfFacade();

  // ── Open/close state ─────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);

  // ── Sub-hooks ────────────────────────────────────────
  const bubble = useBubbleDrag(useCallback(() => setIsOpen(true), []));
  const keyboardHeight = useKeyboardHeight();
  const chat: UseChatMessagesReturn = useChatMessages(facade, isOpen);

  // ── Bridge listener (cross-component message requests) ──
  const sendWithDisplay = chat.sendWithDisplay;
  useEffect(() => {
    setAIChatBridgeListener((payload) => {
      setIsOpen(true);
      // Use setTimeout to ensure isOpen propagates before sending
      setTimeout(() => {
        sendWithDisplay(payload.fullText, payload.displayText, payload.maxTokens);
      }, 0);
    });
    return () => setAIChatBridgeListener(null);
  }, [sendWithDisplay]);

  // ── Context questions ────────────────────────────────
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);
  const prevStreamingRef = useRef(false);

  // Refresh quick questions when chat opens
  useEffect(() => {
    if (isOpen) {
      const gameState = facade.getState();
      const mySeat = facade.getMySeat();
      setContextQuestions(generateQuickQuestions(gameState, mySeat));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open-only: facade is a stable singleton, refreshing quick questions only when panel opens
  }, [isOpen]); // intentionally not depending on messages — only refresh once on open

  // Refresh quick questions when streaming completes (refresh suggestions after each reply)
  useEffect(() => {
    if (prevStreamingRef.current && !chat.isStreaming) {
      const gameState = facade.getState();
      const mySeat = facade.getMySeat();
      setContextQuestions(generateQuickQuestions(gameState, mySeat));
    }
    prevStreamingRef.current = chat.isStreaming;
  }, [chat.isStreaming, chat.messages, facade]);

  // ── Return ───────────────────────────────────────────
  return {
    // Chat (delegated)
    messages: chat.messages,
    inputText: chat.inputText,
    setInputText: chat.setInputText,
    isLoading: chat.isLoading,
    isStreaming: chat.isStreaming,
    cooldownRemaining: chat.cooldownRemaining,
    handleSend: chat.handleSend,
    handleQuickQuestion: chat.handleQuickQuestion,
    handleClearHistory: chat.handleClearHistory,
    contextQuestions,

    // Open/close
    isOpen,
    setIsOpen,

    // Bubble drag (delegated)
    position: bubble.position,
    scaleAnim: bubble.scaleAnim,
    handleTouchStart: bubble.handleTouchStart,
    handleTouchMove: bubble.handleTouchMove,
    handleTouchEnd: bubble.handleTouchEnd,
    handleBubblePress: bubble.handleBubblePress,

    // Keyboard
    keyboardHeight,
  };
}
