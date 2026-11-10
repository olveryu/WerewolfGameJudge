/**
 * 作画中有人猜中时浮在画布上的短提示。读屏用户已由猜词记录的播报区得知，这里只做视觉提示。
 * 初始值取进入时已有的最后一次猜中，历史猜中不再弹出。
 */

import { useEffect, useState } from 'react';

import type { DrawGuessGuessMessage } from './DrawGuessGuessLog';

const CORRECT_TOAST_DURATION_MS = 1800;

interface DrawGuessCorrectToastProps {
  readonly messages: readonly DrawGuessGuessMessage[];
  readonly viewerSeat: number | null;
}

function findLatestCorrect(
  messages: readonly DrawGuessGuessMessage[],
): DrawGuessGuessMessage | undefined {
  return messages.findLast((message) => message.correct);
}

/** Shows the newest correct guess for a moment; renders nothing otherwise. */
export function DrawGuessCorrectToast({ messages, viewerSeat }: DrawGuessCorrectToastProps) {
  const latestCorrect = findLatestCorrect(messages);
  const [dismissedAt, setDismissedAt] = useState(() => latestCorrect?.at ?? null);
  const visibleCorrect =
    latestCorrect !== undefined && latestCorrect.at !== dismissedAt ? latestCorrect : null;
  const visibleAt = visibleCorrect?.at ?? null;

  useEffect(() => {
    if (visibleAt === null) return;
    const timer = setTimeout(() => setDismissedAt(visibleAt), CORRECT_TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [visibleAt]);

  if (visibleCorrect === null) return null;
  return (
    <p className="drawguess-correct-toast" aria-hidden>
      {visibleCorrect.seat === viewerSeat ? '你猜中了！' : `${visibleCorrect.displayName} 猜中了！`}
    </p>
  );
}
