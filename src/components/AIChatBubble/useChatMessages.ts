/**
 * useChatMessages - Chat message state and API interaction
 *
 * Manages message list, streaming reception, cooldown timer,
 * AbortController lifecycle, MMKV persistence, haptic feedback.
 * Owns message CRUD, AIChatService calls, and haptics. No UI rendering or gesture handling.
 */

import { newRequestId } from '@werewolf/game-engine/utils/id';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard } from 'react-native';

import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { NETWORK_ERROR } from '@/config/errorMessages';
import { storage } from '@/lib/storage';
import {
  type ChatMessage,
  isAIChatReady,
  streamChatMessage,
} from '@/services/feature/AIChatService';
import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage, isNetworkError } from '@/utils/errorUtils';
import { chatLog } from '@/utils/logger';

import type { DisplayMessage } from './AIChatBubble.styles';
import { buildPlayerContext } from './playerContext';

// ── Constants ────────────────────────────────────────────

const STORAGE_KEY_MESSAGES = '@ai_chat_messages';
const COOLDOWN_SECONDS = 5;
const MAX_PERSISTED_MESSAGES = 50;
const MAX_CONTEXT_MESSAGES = 9;

/** Typewriter: minimum ms between flushing buffered tokens to UI */
const TYPEWRITER_INTERVAL_MS = 30;
/** Typewriter: characters to release per tick */
const TYPEWRITER_CHARS_PER_TICK = 2;

// ── Return type ──────────────────────────────────────────

export interface UseChatMessagesReturn {
  messages: DisplayMessage[];
  inputText: string;
  setInputText: (text: string) => void;
  isLoading: boolean;
  isStreaming: boolean;
  cooldownRemaining: number;
  handleSend: () => Promise<void>;
  handleQuickQuestion: (question: string) => void;
  /** Send full text to AI but display a shorter displayText in the chat bubble */
  sendWithDisplay: (fullText: string, displayText: string, maxTokens?: number) => void;
  handleClearHistory: () => void;
}

/**
 * @param facade Game facade (used to build player context)
 * @param isOpen Whether the chat window is open (abort request on close)
 */
export function useChatMessages(facade: IWerewolfFacade, isOpen: boolean): UseChatMessagesReturn {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadingRef = useRef(false);
  const drainTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typewriterTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownRef = useRef(cooldownRemaining);
  cooldownRef.current = cooldownRemaining;
  // Ref to access latest messages inside callbacks without stale closure
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // ── Load saved messages ────────────────────────────
  useEffect(() => {
    const saved = storage.getString(STORAGE_KEY_MESSAGES);
    if (saved) setMessages(JSON.parse(saved) as DisplayMessage[]);
  }, []);

  // ── Persist messages (debounced 500ms) ─────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        storage.set(STORAGE_KEY_MESSAGES, JSON.stringify(messages.slice(-MAX_PERSISTED_MESSAGES)));
        saveTimerRef.current = null;
      }, 500);
    }
  }, [messages]);

  // ── Abort on close / unmount ───────────────────────
  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      if (drainTimerRef.current) {
        clearInterval(drainTimerRef.current);
        drainTimerRef.current = null;
      }
      if (typewriterTimerRef.current) {
        clearInterval(typewriterTimerRef.current);
        typewriterTimerRef.current = null;
      }
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, []);

  // ── Cooldown timer ─────────────────────────────────
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  // ── Send message (streaming) ───────────────────────
  const sendMessage = useCallback(
    async (text: string, displayText?: string, maxTokens?: number, skipHistory?: boolean) => {
      if (!text || loadingRef.current) return;
      if (cooldownRef.current > 0) return;
      if (!isAIChatReady()) {
        showErrorAlert('AI 助手', 'AI 助手暂不可用');
        return;
      }

      setCooldownRemaining(COOLDOWN_SECONDS);

      // Cancel previous request
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // Create user message (show displayText in bubble if provided)
      const userMessage: DisplayMessage = {
        id: newRequestId(),
        role: 'user',
        content: displayText ?? text,
        timestamp: Date.now(),
      };

      // Snapshot current messages for context
      const prevMessages = messagesRef.current;
      setMessages((prev) => [...prev, userMessage]);
      setInputText('');
      setIsLoading(true);
      loadingRef.current = true;
      setIsStreaming(true);

      Keyboard.dismiss();
      void triggerHaptic('light');

      // Create placeholder assistant message for streaming
      const assistantId = newRequestId();
      const assistantMessage: DisplayMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        const gameState = facade.getState();
        const mySeat = facade.getMySeat();
        const gameContext = buildPlayerContext(gameState, mySeat);

        const contextMessages: ChatMessage[] = skipHistory
          ? []
          : prevMessages
              .slice(-MAX_CONTEXT_MESSAGES)
              .map((m) => ({ role: m.role, content: m.content }));
        contextMessages.push({ role: 'user', content: text });

        let fullContent = '';
        // Typewriter buffer: accumulate tokens, flush at interval
        let displayedLength = 0;
        let typewriterTimer: ReturnType<typeof setInterval> | null = null;

        const flushBuffer = () => {
          const cleaned = fullContent.replaceAll(/<think>[\s\S]*?<\/think>/g, '').trim();
          if (cleaned.length > displayedLength) {
            displayedLength = Math.min(displayedLength + TYPEWRITER_CHARS_PER_TICK, cleaned.length);
            const visible = cleaned.slice(0, displayedLength);
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m)),
            );
          }
        };

        typewriterTimer = setInterval(flushBuffer, TYPEWRITER_INTERVAL_MS);
        typewriterTimerRef.current = typewriterTimer;

        for await (const chunk of streamChatMessage(
          contextMessages,
          gameContext,
          controller.signal,
          maxTokens,
        )) {
          if (controller.signal.aborted) {
            if (typewriterTimer) {
              clearInterval(typewriterTimer);
              typewriterTimerRef.current = null;
            }
            return;
          }

          if (chunk.type === 'delta') {
            fullContent += chunk.content;
          } else if (chunk.type === 'error') {
            if (typewriterTimer) {
              clearInterval(typewriterTimer);
              typewriterTimerRef.current = null;
            }
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            showErrorAlert('发送失败', chunk.content);
            break;
          }
          // 'done' — streaming finished, let typewriter drain remaining buffer
        }

        // Drain remaining buffer via typewriter (don't show final content instantly)
        if (typewriterTimer) {
          clearInterval(typewriterTimer);
          typewriterTimerRef.current = null;
        }
        if (fullContent) {
          const finalContent = fullContent.replaceAll(/<think>[\s\S]*?<\/think>/g, '').trim();

          // Wait for typewriter to drain remaining characters
          await new Promise<void>((resolve) => {
            const drainTimer = setInterval(() => {
              if (controller.signal.aborted) {
                clearInterval(drainTimer);
                drainTimerRef.current = null;
                resolve();
                return;
              }
              if (displayedLength >= finalContent.length) {
                clearInterval(drainTimer);
                drainTimerRef.current = null;
                // Ensure final content is fully displayed
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: finalContent } : m)),
                );
                resolve();
              } else {
                displayedLength = Math.min(
                  displayedLength + TYPEWRITER_CHARS_PER_TICK,
                  finalContent.length,
                );
                const visible = finalContent.slice(0, displayedLength);
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: visible } : m)),
                );
              }
            }, TYPEWRITER_INTERVAL_MS);
            drainTimerRef.current = drainTimer;
          });

          void triggerHaptic('success');
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Clear typewriter timer on abort to prevent leak
          if (typewriterTimerRef.current) {
            clearInterval(typewriterTimerRef.current);
            typewriterTimerRef.current = null;
          }
          // Remove empty placeholder on abort
          setMessages((prev) => {
            const msg = prev.find((m) => m.id === assistantId);
            if (msg && !msg.content) {
              return prev.filter((m) => m.id !== assistantId);
            }
            return prev;
          });
          return;
        }
        // Network errors: log.warn + UI feedback, no Sentry
        if (isNetworkError(err)) {
          chatLog.warn('sendMessage network error', err);
          setMessages((prev) => prev.filter((m) => m.id !== assistantId));
          showErrorAlert('发送失败', NETWORK_ERROR);
          return;
        }
        // Non-abort errors: route Sentry through the pipeline; custom UI cleanup stays inline
        handleError(err, { label: '发送消息', logger: chatLog, feedback: false });
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        showErrorAlert('发送失败', getUserFacingMessage(err));
      } finally {
        setIsLoading(false);
        loadingRef.current = false;
        setIsStreaming(false);
      }
    },
    [facade],
  );

  // ── Public actions ─────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    await sendMessage(text);
  }, [inputText, sendMessage]);

  const handleQuickQuestion = useCallback(
    (question: string) => {
      void sendMessage(question);
    },
    [sendMessage],
  );

  const sendWithDisplay = useCallback(
    (fullText: string, displayText: string, maxTokens?: number) => {
      void sendMessage(fullText, displayText, maxTokens, true);
    },
    [sendMessage],
  );

  const handleClearHistory = useCallback(() => {
    showDestructiveAlert(
      '清除聊天记录',
      '确定要清除所有聊天记录吗？此操作不可恢复。',
      '清除',
      () => {
        setMessages([]);
        storage.remove(STORAGE_KEY_MESSAGES);
      },
    );
  }, []);

  return {
    messages,
    inputText,
    setInputText,
    isLoading,
    isStreaming,
    cooldownRemaining,
    handleSend,
    handleQuickQuestion,
    sendWithDisplay,
    handleClearHistory,
  };
}
