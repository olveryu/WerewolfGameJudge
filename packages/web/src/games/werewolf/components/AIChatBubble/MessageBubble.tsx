/**
 * MessageBubble - Single chat message bubble
 *
 * User messages are right-aligned on the primary color; AI messages are left-aligned and
 * rendered as Markdown, with a blinking cursor ▊ while streaming.
 */

import type { DisplayMessage } from '@/games/werewolf/state/WerewolfAIChatState';

import { SimpleMarkdown } from './SimpleMarkdown';

export function MessageBubble({
  message,
  isStreaming,
}: {
  readonly message: DisplayMessage;
  /** Whether currently streaming (shows blinking cursor) */
  readonly isStreaming: boolean;
}) {
  return (
    <div className="ai-chat-message-row" data-role={message.role}>
      <div className="ai-chat-message">
        {message.role === 'user' ? (
          <p className="ai-chat-message-text">{message.content}</p>
        ) : (
          <>
            <SimpleMarkdown content={message.content} />
            {isStreaming && (
              <span className="ai-chat-cursor" aria-hidden>
                ▊
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
