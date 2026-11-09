/**
 * 题目提示条：画手看答案，猜题者看字数 + 拼音首字母渐显。
 */

interface DrawGuessHintBarProps {
  /** 画手的题目原文；猜题者为 null。 */
  readonly word: string | null;
  /** 猜题者看到的提示串，如「3个字 · d _ m」；画手为 null。 */
  readonly hintText: string | null;
  readonly wordLength: number;
}

/** 画手看到答案条，猜题者看到字数与拼音首字母提示。 */
export function DrawGuessHintBar({ word, hintText, wordLength }: DrawGuessHintBarProps) {
  if (word !== null) {
    return (
      <div
        className="drawguess-panel drawguess-hint-bar"
        role="group"
        aria-label={`题目：${word}，共${wordLength}个字`}
      >
        <span className="drawguess-hint-word">{word}</span>
        <span className="drawguess-meta">{wordLength} 个字</span>
      </div>
    );
  }
  return (
    <div
      className="drawguess-panel drawguess-hint-bar"
      role="group"
      aria-label={hintText === null ? '等待题目' : `题目提示：${hintText}`}
    >
      <span className="drawguess-hint-text">{hintText ?? '等待题目…'}</span>
      <span className="drawguess-meta">每 20 秒揭示一个拼音首字母</span>
    </div>
  );
}
