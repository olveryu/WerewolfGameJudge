/**
 * useAIChat - AI 聊天泡泡编排层
 *
 * 组合 useBubbleDrag / useKeyboardHeight / useChatMessages 三个子 hook，
 * 管理 isOpen 状态和快捷问题刷新，对外暴露统一的 UseAIChatReturn 接口。
 * 组合子 hook 并管理打开/关闭状态。不直接实现拖动/键盘/消息逻辑，均委托给子 hook。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Animated, GestureResponderEvent } from 'react-native';

import { useGameFacade } from '@/contexts';

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
  const facade = useGameFacade();

  // ── Open/close state ─────────────────────────────────
  const [isOpen, setIsOpen] = useState(false);

  // ── Sub-hooks ────────────────────────────────────────
  const bubble = useBubbleDrag(useCallback(() => setIsOpen(true), []));
  const keyboardHeight = useKeyboardHeight();
  const chat: UseChatMessagesReturn = useChatMessages(facade, isOpen);

  // ── Context questions ────────────────────────────────
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);
  const prevStreamingRef = useRef(false);

  // Refresh quick questions when chat opens
  useEffect(() => {
    if (isOpen) {
      const gameState = facade.getState();
      const mySeat = facade.getMySeatNumber();
      setContextQuestions(generateQuickQuestions(gameState, mySeat));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // 故意不依赖 messages，只在打开时刷新一次

  // Refresh quick questions when streaming completes（每条回复后刷新建议问题）
  useEffect(() => {
    if (prevStreamingRef.current && !chat.isStreaming) {
      const gameState = facade.getState();
      const mySeat = facade.getMySeatNumber();
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
