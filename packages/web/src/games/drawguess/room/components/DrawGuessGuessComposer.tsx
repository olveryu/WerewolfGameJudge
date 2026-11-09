/**
 * 猜词输入行：输入框 + 发送 + 2 秒客户端节流。
 *
 * 草稿由作画视图持有并受控：提交失败时草稿保留，只有服务端确认成功后
 * 作画视图才清空草稿。猜中锁定后本行退化为锁定条。
 */

import { type FormEvent, useEffect, useRef, useState } from 'react';

const GUESS_THROTTLE_MS = 2000;
const TOO_FAST_HINT_MS = 1500;

interface DrawGuessGuessComposerProps {
  /** 受控草稿：作画视图持有，失败保留、成功清空。 */
  readonly draft: string;
  readonly onDraftChange: (value: string) => void;
  readonly isLocked: boolean;
  readonly canGuess: boolean;
  /** 提交命令并返回服务端是否受理；失败时不清空草稿。 */
  readonly onSubmitGuess: (text: string) => Promise<boolean>;
}

/** 猜词输入行；猜中锁定后显示锁定条，输入框置灰。 */
export function DrawGuessGuessComposer({
  draft,
  onDraftChange,
  isLocked,
  canGuess,
  onSubmitGuess,
}: DrawGuessGuessComposerProps) {
  const [isTooFast, setIsTooFast] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const lastSubmitAtRef = useRef(0);
  const tooFastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (tooFastTimerRef.current !== null) clearTimeout(tooFastTimerRef.current);
    },
    [],
  );

  if (isLocked) {
    return (
      <div className="drawguess-locked-bar" role="status" aria-label="已猜中，等待本轮结束">
        已猜中，等待本轮结束
      </div>
    );
  }

  const isInputDisabled = !canGuess;
  const trimmedDraft = draft.trim();

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (trimmedDraft.length === 0 || isInputDisabled) return;
    const now = Date.now();
    if (now - lastSubmitAtRef.current < GUESS_THROTTLE_MS) {
      // 客户端节流：超限只抖动提示，不发送命令。
      setIsTooFast(true);
      setIsShaking(true);
      if (tooFastTimerRef.current !== null) clearTimeout(tooFastTimerRef.current);
      tooFastTimerRef.current = setTimeout(() => setIsTooFast(false), TOO_FAST_HINT_MS);
      return;
    }
    lastSubmitAtRef.current = now;
    void (async () => {
      const isAccepted = await onSubmitGuess(trimmedDraft);
      if (isAccepted) onDraftChange('');
    })();
  };

  return (
    <form className="drawguess-composer" onSubmit={submit}>
      <div
        className="drawguess-composer-row"
        data-shaking={isShaking ? '' : undefined}
        onAnimationEnd={() => setIsShaking(false)}
      >
        <input
          className="drawguess-composer-input"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="请用简体输入"
          disabled={isInputDisabled}
          maxLength={32}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="猜词输入框"
        />
        <button
          type="submit"
          className="drawguess-composer-send"
          aria-label="发送猜词"
          disabled={isInputDisabled || trimmedDraft.length === 0}
        >
          发送
        </button>
      </div>
      {isTooFast && (
        <p className="drawguess-too-fast" role="status">
          慢一点
        </p>
      )}
    </form>
  );
}
