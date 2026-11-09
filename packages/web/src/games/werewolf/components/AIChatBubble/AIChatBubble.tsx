/**
 * AIChatBubble - floating chat bubble over every page while a werewolf room is open
 *
 * A draggable button (bottom right by default) opens the chat dialog: streamed replies,
 * scroll-to-bottom, typing indicator, quick questions and the input row.
 * Logic lives in useAIChat; this file renders only.
 */
import './AIChatBubble.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { useLayoutEffect, useRef, useState } from 'react';

import { IconButton } from '@/components/IconButton';
import { Spinner } from '@/components/Spinner';
import type { WerewolfRoomSession } from '@/games/werewolf/model/WerewolfRoomSession';
import type { RoomIdentity } from '@/platform/realtime/types';
import IconClose from '~icons/ion/close';
import IconHandLeftOutline from '~icons/ion/hand-left-outline';
import IconSparklesOutline from '~icons/ion/sparkles-outline';
import IconTrashOutline from '~icons/ion/trash-outline';

import { MessageBubble } from './MessageBubble';
import { TypingIndicator } from './TypingIndicator';
import { useAIChat } from './useAIChat';

/** Distance from bottom to show scroll-to-bottom FAB */
const SCROLL_THRESHOLD = 100;
const MAX_QUICK_QUESTIONS = 6;

interface AIChatBubbleProps {
  readonly session: WerewolfRoomSession;
  readonly identity: RoomIdentity<'werewolf'>;
  /** When this turns from false to true, the bubble pulses to draw attention. */
  readonly triggerPulse: boolean;
}

export function AIChatBubble({ session, identity, triggerPulse }: AIChatBubbleProps) {
  const chat = useAIChat(session, identity);
  const { messages } = chat;

  // ── Pulse after roles are assigned (a false → true edge, not the initial value) ──
  const [previousTrigger, setPreviousTrigger] = useState(triggerPulse);
  const [pulseCount, setPulseCount] = useState(0);
  if (previousTrigger !== triggerPulse) {
    setPreviousTrigger(triggerPulse);
    if (triggerPulse) setPulseCount(pulseCount + 1);
  }

  // ── Scroll-to-bottom: the user scrolled away while the list had this many messages ──
  const listRef = useRef<HTMLDivElement | null>(null);
  const [scrolledAwayAt, setScrolledAwayAt] = useState<number | null>(null);
  // A new message (from any source) brings the list back to the bottom.
  const showScrollButton = scrolledAwayAt === messages.length;

  const handleScroll = () => {
    const list = listRef.current;
    if (list === null) return;
    const distanceFromBottom = list.scrollHeight - list.scrollTop - list.clientHeight;
    setScrolledAwayAt(distanceFromBottom > SCROLL_THRESHOLD ? messages.length : null);
  };

  // Follow new and streaming content unless the user scrolled away.
  useLayoutEffect(() => {
    const list = listRef.current;
    if (list === null || showScrollButton) return;
    list.scrollTop = list.scrollHeight;
  }, [messages, showScrollButton, chat.isStreaming]);

  const attachList = (list: HTMLDivElement | null) => {
    listRef.current = list;
    if (list !== null) list.scrollTop = list.scrollHeight;
  };

  const lastMessage = messages.at(-1);
  const isSendDisabled = !chat.inputText.trim() || chat.isLoading || chat.cooldownRemaining > 0;

  const renderSendContent = () => {
    if (chat.isLoading) return <Spinner label="发送中" />;
    if (chat.cooldownRemaining > 0) return chat.cooldownRemaining;
    return '↑';
  };

  return (
    <>
      <div
        className="ai-chat-bubble-anchor"
        style={{ left: chat.bubble.position.x, top: chat.bubble.position.y }}
      >
        {pulseCount > 0 && <span key={pulseCount} className="ai-chat-pulse" aria-hidden />}
        <button
          type="button"
          className="ai-chat-bubble"
          aria-haspopup="dialog"
          onPointerDown={chat.bubble.handlePointerDown}
          onPointerMove={chat.bubble.handlePointerMove}
          onPointerUp={chat.bubble.handlePointerUp}
          onPointerCancel={chat.bubble.handlePointerCancel}
          onClick={chat.bubble.handleClick}
        >
          <IconSparklesOutline className="ai-chat-bubble-icon" aria-hidden />
          <span className="ai-chat-bubble-label">小助手</span>
        </button>
      </div>

      <Dialog.Root
        open={chat.isOpen}
        onOpenChange={(details) => {
          if (!details.open) chat.close();
        }}
        lazyMount
        unmountOnExit
      >
        <Portal>
          <Dialog.Backdrop className="ai-chat-backdrop" />
          <Dialog.Positioner
            className="ai-chat-positioner"
            style={{ paddingBottom: `calc(${chat.keyboardHeight}px + var(--space-small))` }}
          >
            <Dialog.Content className="ai-chat-window">
              <header className="ai-chat-header">
                <Dialog.Title className="ai-chat-title">狼人杀助手</Dialog.Title>
                <div className="ai-chat-header-buttons">
                  <IconButton
                    label="清除聊天记录"
                    icon={<IconTrashOutline aria-hidden />}
                    onClick={chat.handleClearHistory}
                  />
                  <IconButton label="关闭" icon={<IconClose aria-hidden />} onClick={chat.close} />
                </div>
              </header>

              <div className="ai-chat-messages-wrapper">
                <div
                  ref={attachList}
                  className="ai-chat-messages"
                  role="log"
                  aria-label="聊天记录"
                  aria-busy={chat.isStreaming}
                  onScroll={handleScroll}
                >
                  {messages.length === 0 ? (
                    <p className="ai-chat-empty">
                      <IconHandLeftOutline aria-hidden /> 你好！我是狼人杀助手
                      <br />
                      可以问我游戏规则、策略建议等
                    </p>
                  ) : (
                    messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isStreaming={chat.isStreaming && message.id === lastMessage?.id}
                      />
                    ))
                  )}
                  {chat.isStreaming && lastMessage?.content === '' && <TypingIndicator />}
                </div>

                {showScrollButton && (
                  <button
                    type="button"
                    className="ai-chat-scroll-bottom"
                    aria-label="滚动到底部"
                    onClick={() =>
                      listRef.current?.scrollTo({
                        top: listRef.current.scrollHeight,
                        behavior: 'smooth',
                      })
                    }
                  >
                    ↓
                  </button>
                )}
              </div>

              <div className="ai-chat-quick-questions">
                {chat.contextQuestions.slice(0, MAX_QUICK_QUESTIONS).map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="ai-chat-quick-question"
                    disabled={chat.isLoading}
                    onClick={() => chat.handleQuickQuestion(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>

              <div className="ai-chat-input-row">
                <textarea
                  className="ai-chat-input"
                  placeholder="输入消息"
                  aria-label="输入消息"
                  value={chat.inputText}
                  onChange={(event) => chat.setInputText(event.target.value)}
                  maxLength={500}
                  rows={1}
                  disabled={chat.isLoading}
                />
                <button
                  type="button"
                  className="ai-chat-send"
                  aria-label="发送"
                  disabled={isSendDisabled}
                  onClick={() => void chat.handleSend()}
                >
                  {renderSendContent()}
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Portal>
      </Dialog.Root>
    </>
  );
}
