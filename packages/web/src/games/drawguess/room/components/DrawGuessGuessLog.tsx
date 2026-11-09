/**
 * 猜词消息流：只渲染聊天式猜词记录，内部滚动。
 *
 * 猜中者的答案对其他猜题者隐藏：view model 里 text 为 null 时只显示「xxx 猜中了」。
 * 输入行已拆到 DrawGuessGuessComposer，作画视图把输入行钉在任务框底部，
 * 本组件只占剩余高度并随键盘弹起先收缩。
 */

import type { DrawGuessViewModel } from '@game-judge/game-engine/games/drawguess/public';
import { useEffect, useRef } from 'react';

type DrawGuessGuessMessage = DrawGuessViewModel['messages'][number];

/** 距底部小于该距离（px）才算「在底部」，此时新消息自动滚到底。 */
const NEAR_BOTTOM_TOLERANCE_PX = 40;

interface DrawGuessGuessLogProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
}

function GuessMessageRow({
  message,
  viewerSeat,
}: {
  readonly message: DrawGuessGuessMessage;
  readonly viewerSeat: number | null;
}) {
  if (message.correct && message.seat === viewerSeat) {
    return (
      <li className="drawguess-message" data-kind="own-correct">
        🎉 你猜中了！
      </li>
    );
  }
  if (message.correct) {
    return (
      <li className="drawguess-message" data-kind="other-correct">
        🎯 {message.displayName} 猜中了{message.text === null ? '' : `：${message.text}`}
      </li>
    );
  }
  return (
    <li className="drawguess-message">
      <span className="drawguess-message-name">{message.displayName}：</span>
      {message.text ?? ''}
    </li>
  );
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
      onScroll={(event) => {
        const { scrollHeight, scrollTop, clientHeight } = event.currentTarget;
        isNearBottomRef.current =
          scrollHeight - scrollTop - clientHeight < NEAR_BOTTOM_TOLERANCE_PX;
      }}
    >
      {messages.map((message) => (
        <GuessMessageRow
          key={`${message.seat}:${message.at}`}
          message={message}
          viewerSeat={viewerSeat}
        />
      ))}
    </ol>
  );
}
