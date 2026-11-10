/**
 * useChatMessages - Chat message state and API interaction
 *
 * Manages message list, streaming reception, cooldown timer,
 * AbortController lifecycle and local persistence.
 * Owns message CRUD and AIChatService calls. No UI rendering or gesture handling.
 */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { getWerewolfViewModel } from '@game-judge/game-engine/games/werewolf/public';
import { newRequestId } from '@game-judge/game-engine/platform/identifiers';
import { useEffect, useRef, useState } from 'react';

import { NETWORK_ERROR } from '@/config/errorMessages';
import {
  type AIChatStorageOwner,
  clearAIChatMessages,
  readAIChatMessages,
  writeAIChatMessages,
} from '@/games/werewolf/services/aiChatLocalStore';
import { type ChatMessage, streamChatMessage } from '@/games/werewolf/services/AIChatService';
import { getWerewolfUserSeat } from '@/games/werewolf/state/getWerewolfUserSeat';
import type { DisplayMessage } from '@/games/werewolf/state/WerewolfAIChatState';
import type { LinkSnapshot } from '@/platform/realtime/types';
import { showDestructiveAlert, showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage, isNetworkError } from '@/utils/errorUtils';
import { log } from '@/utils/logger';

import { buildPlayerContext } from './playerContext';

const chatLog = log.extend('AIChat');

// ── Constants ────────────────────────────────────────────

const COOLDOWN_SECONDS = 5;
const MAX_CONTEXT_MESSAGES = 9;

/** Typewriter: minimum ms between flushing buffered tokens to UI */
const TYPEWRITER_INTERVAL_MS = 30;
/** Typewriter: characters to release per tick */
const TYPEWRITER_CHARS_PER_TICK = 2;

const THINK_BLOCK = /<think>[\s\S]*?<\/think>/g;

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

interface WerewolfRoomContextSource {
  getSnapshot(): LinkSnapshot<GameState>;
}

function dismissKeyboard(): void {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

/**
 * @param source Active Werewolf room session used to build player context.
 * @param isOpen Whether the chat window is open (abort request on close)
 * @param onReplySettled Called when a send finishes, fails or is aborted.
 */
export function useChatMessages(
  source: WerewolfRoomContextSource,
  isOpen: boolean,
  owner: AIChatStorageOwner,
  onReplySettled: () => void,
): UseChatMessagesReturn {
  const [messages, setMessages] = useState<DisplayMessage[]>(() => readAIChatMessages(owner));
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
  // Latest messages for callbacks and the unmount flush, without stale closures.
  const messagesRef = useRef(messages);

  useEffect(() => {
    cooldownRef.current = cooldownRemaining;
  }, [cooldownRemaining]);

  // ── Persist messages (debounced 500ms) ─────────────────────
  useEffect(() => {
    messagesRef.current = messages;
    if (messages.length > 0) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        writeAIChatMessages(owner, messages);
        saveTimerRef.current = null;
      }, 500);
    }
  }, [messages, owner]);

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
        writeAIChatMessages(owner, messagesRef.current);
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [owner]);

  // ── Cooldown timer ─────────────────────────────────
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setTimeout(() => {
      setCooldownRemaining((prev) => prev - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [cooldownRemaining]);

  const replaceAssistantContent = (assistantId: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content } : m)));
  };

  const removeMessage = (messageId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
  };

  // ── Send message (streaming) ───────────────────────
  const sendMessage = async (
    text: string,
    displayText?: string,
    maxTokens?: number,
    skipHistory?: boolean,
  ) => {
    if (!text || loadingRef.current) return;
    if (cooldownRef.current > 0) return;
    const room = source.getSnapshot();
    if (
      room.phase !== 'ready' ||
      room.identity.userId !== owner.userId ||
      room.identity.room.roomId !== owner.roomId
    ) {
      throw new Error('[FAIL-FAST] AI chat owner does not match the active room session');
    }
    const gameState = room.room.state;
    const mySeat = getWerewolfUserSeat(gameState, owner.userId);
    // The AI assistant speaks to the player's own card: it never gets the host's view of bots.
    const gameContext = buildPlayerContext(
      gameState,
      getWerewolfViewModel(gameState, { seat: mySeat, isHost: false }),
    );

    setCooldownRemaining(COOLDOWN_SECONDS);
    cooldownRef.current = COOLDOWN_SECONDS;

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
    setInputText('');
    setIsLoading(true);
    loadingRef.current = true;
    setIsStreaming(true);

    dismissKeyboard();

    // Placeholder assistant message filled by the stream
    const assistantId = newRequestId();
    const assistantMessage: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage, assistantMessage]);

    try {
      const contextMessages: ChatMessage[] = skipHistory
        ? []
        : prevMessages
            .slice(-MAX_CONTEXT_MESSAGES)
            .map((m) => ({ role: m.role, content: m.content }));
      contextMessages.push({ role: 'user', content: text });

      let fullContent = '';
      // Typewriter buffer: accumulate tokens, flush at interval
      let displayedLength = 0;

      const flushBuffer = () => {
        const cleaned = fullContent.replaceAll(THINK_BLOCK, '').trim();
        if (cleaned.length > displayedLength) {
          displayedLength = Math.min(displayedLength + TYPEWRITER_CHARS_PER_TICK, cleaned.length);
          replaceAssistantContent(assistantId, cleaned.slice(0, displayedLength));
        }
      };

      const typewriterTimer = setInterval(flushBuffer, TYPEWRITER_INTERVAL_MS);
      typewriterTimerRef.current = typewriterTimer;
      const stopTypewriter = () => {
        clearInterval(typewriterTimer);
        typewriterTimerRef.current = null;
      };

      for await (const chunk of streamChatMessage(
        contextMessages,
        gameContext,
        controller.signal,
        maxTokens,
      )) {
        if (controller.signal.aborted) {
          stopTypewriter();
          return;
        }

        if (chunk.type === 'delta') {
          fullContent += chunk.content;
        } else if (chunk.type === 'error') {
          stopTypewriter();
          removeMessage(assistantId);
          showErrorAlert('发送失败', chunk.content);
          break;
        }
        // 'done' — streaming finished, let typewriter drain remaining buffer
      }

      // Drain remaining buffer via typewriter (don't show final content instantly)
      stopTypewriter();
      if (fullContent) {
        const finalContent = fullContent.replaceAll(THINK_BLOCK, '').trim();

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
              replaceAssistantContent(assistantId, finalContent);
              resolve();
            } else {
              displayedLength = Math.min(
                displayedLength + TYPEWRITER_CHARS_PER_TICK,
                finalContent.length,
              );
              replaceAssistantContent(assistantId, finalContent.slice(0, displayedLength));
            }
          }, TYPEWRITER_INTERVAL_MS);
          drainTimerRef.current = drainTimer;
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
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
        removeMessage(assistantId);
        showErrorAlert('发送失败', NETWORK_ERROR);
        return;
      }
      // Non-abort errors: route Sentry through the pipeline; custom UI cleanup stays inline
      handleError(err, { label: '发送消息', logger: chatLog, feedback: false });
      removeMessage(assistantId);
      showErrorAlert('发送失败', getUserFacingMessage(err));
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
      setIsStreaming(false);
      onReplySettled();
    }
  };

  // ── Public actions ─────────────────────────────────

  const handleSend = async () => {
    await sendMessage(inputText.trim());
  };

  const handleQuickQuestion = (question: string) => {
    void sendMessage(question);
  };

  const sendWithDisplay = (fullText: string, displayText: string, maxTokens?: number) => {
    void sendMessage(fullText, displayText, maxTokens, true);
  };

  const handleClearHistory = () => {
    showDestructiveAlert(
      '清除聊天记录',
      '确定要清除所有聊天记录吗？此操作不可恢复。',
      '清除',
      () => {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        setMessages([]);
        clearAIChatMessages(owner);
      },
    );
  };

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
