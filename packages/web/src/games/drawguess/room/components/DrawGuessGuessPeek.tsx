/**
 * 窄屏作画布局的猜词摘要条：最近两条猜词 + 总条数，点开是完整猜词记录抽屉。
 * 摘要条本身是一个按钮；读屏用户由旁边的礼貌播报区听到最新一条。
 */

import { useState } from 'react';

import { BottomSheet } from '@/components/BottomSheet';
import { IconButton } from '@/components/IconButton';
import { TESTIDS } from '@/testids';
import IconChevronForward from '~icons/ion/chevron-forward';
import IconClose from '~icons/ion/close';

import {
  DrawGuessGuessLog,
  type DrawGuessGuessMessage,
  getGuessMessageKind,
  GuessMessageContent,
} from './DrawGuessGuessLog';

const PEEK_MESSAGE_COUNT = 2;
const LOG_SHEET_TITLE = '猜词记录';

interface DrawGuessGuessPeekProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
}

/** Renders the last guesses in one strip and owns the full log sheet's open state. */
export function DrawGuessGuessPeek({ messages, viewerSeat }: DrawGuessGuessPeekProps) {
  const [isLogOpen, setIsLogOpen] = useState(false);
  const latest = messages.slice(-PEEK_MESSAGE_COUNT);
  const newest = messages.at(-1);
  return (
    <>
      <button
        type="button"
        className="drawguess-guess-peek"
        aria-haspopup="dialog"
        aria-label={`查看全部${LOG_SHEET_TITLE}，共 ${messages.length} 条`}
        onClick={() => setIsLogOpen(true)}
        data-testid={TESTIDS.drawGuessGuessPeek}
      >
        <span className="drawguess-guess-peek-lines">
          {latest.length === 0 ? (
            <span className="drawguess-guess-peek-line" data-kind="empty">
              还没有人猜
            </span>
          ) : (
            latest.map((message) => (
              <span
                key={`${message.seat}:${message.at}`}
                className="drawguess-message drawguess-guess-peek-line"
                data-kind={getGuessMessageKind(message, viewerSeat)}
              >
                <GuessMessageContent message={message} viewerSeat={viewerSeat} />
              </span>
            ))
          )}
        </span>
        <span className="drawguess-guess-peek-count">{messages.length} 条</span>
        <IconChevronForward aria-hidden />
      </button>
      <p className="visually-hidden" aria-live="polite">
        {newest !== undefined && <GuessMessageContent message={newest} viewerSeat={viewerSeat} />}
      </p>
      {isLogOpen && (
        <BottomSheet
          title={LOG_SHEET_TITLE}
          onClose={() => setIsLogOpen(false)}
          testId={TESTIDS.drawGuessGuessLogSheet}
        >
          <header className="drawguess-log-sheet-header">
            <h2 className="drawguess-log-sheet-title">
              {LOG_SHEET_TITLE}
              <small className="drawguess-log-sheet-count">{messages.length} 条</small>
            </h2>
            <IconButton
              label={`关闭${LOG_SHEET_TITLE}`}
              icon={<IconClose aria-hidden />}
              onClick={() => setIsLogOpen(false)}
            />
          </header>
          <div className="drawguess-log-sheet-body">
            <DrawGuessGuessLog messages={messages} viewerSeat={viewerSeat} />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
