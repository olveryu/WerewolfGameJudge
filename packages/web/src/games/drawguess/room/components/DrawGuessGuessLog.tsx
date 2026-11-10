/**
 * 猜词消息流：只渲染聊天式猜词记录，内部滚动。
 *
 * 猜中者的答案对其他猜题者隐藏：view model 里 text 为 null 时只显示「xxx 猜中了」。
 * 宽屏作画布局把本组件放在画布右侧栏，窄屏放在摘要条打开的记录抽屉里。
 */

import type { DrawGuessViewModel } from '@game-judge/game-engine/games/drawguess/public';
import { useEffect, useRef } from 'react';

import { TESTIDS } from '@/testids';

export type DrawGuessGuessMessage = DrawGuessViewModel['messages'][number];

/** 距底部小于该距离（px）才算「在底部」，此时新消息自动滚到底。 */
const NEAR_BOTTOM_TOLERANCE_PX = 40;

interface DrawGuessGuessLogProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
}

/** How a message reads to this viewer: their own hit, someone else's hit, or a plain guess. */
export function getGuessMessageKind(
  message: DrawGuessGuessMessage,
  viewerSeat: number | null,
): 'own-correct' | 'other-correct' | undefined {
  if (!message.correct) return undefined;
  return message.seat === viewerSeat ? 'own-correct' : 'other-correct';
}

/** The message text for this viewer, shared by the log rows and the peek strip lines. */
export function GuessMessageContent({
  message,
  viewerSeat,
}: {
  readonly message: DrawGuessGuessMessage;
  readonly viewerSeat: number | null;
}) {
  switch (getGuessMessageKind(message, viewerSeat)) {
    case 'own-correct':
      return <>🎉 你猜中了！</>;
    case 'other-correct':
      return (
        <>
          🎯 {message.displayName} 猜中了{message.text === null ? '' : `：${message.text}`}
        </>
      );
    case undefined:
      return (
        <>
          <span className="drawguess-message-name">{message.displayName}：</span>
          {message.text ?? ''}
        </>
      );
  }
}

/** 聊天式猜词记录；只在用户位于底部附近时自动滚动到底。 */
export function DrawGuessGuessLog({ messages, viewerSeat }: DrawGuessGuessLogProps) {
  const listRef = useRef<HTMLOListElement>(null);
  // 用户是否在底部附近：只有在底部时才自动滚，不打扰翻看历史的用户
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    const list = listRef.current;
    if (list !== null && messages.length > 0 && isNearBottomRef.current) {
      list.scrollTop = list.scrollHeight;
    }
  }, [messages.length]);

  return (
    <ol
      ref={listRef}
      className="drawguess-panel drawguess-message-list"
      aria-label="猜词消息"
      aria-live="polite"
      data-testid={TESTIDS.drawGuessGuessLog}
      onScroll={(event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        isNearBottomRef.current =
          scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_TOLERANCE_PX;
      }}
    >
      {messages.map((message) => (
        <li
          key={`${message.seat}:${message.at}`}
          className="drawguess-message"
          data-kind={getGuessMessageKind(message, viewerSeat)}
        >
          <GuessMessageContent message={message} viewerSeat={viewerSeat} />
        </li>
      ))}
    </ol>
  );
}
