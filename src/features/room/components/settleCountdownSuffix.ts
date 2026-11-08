/**
 * Settle-countdown suffix for a top main surface — the one implementation
 * every game appends when its vote/play settle countdown is armed.
 *
 * Moved verbatim from the werewolf sheriff presentation (the baseline):
 * while seconds remain it is `，N秒后<verb>`; once the deadline is
 * reached (0) or the armed deadline has not arrived in the snapshot yet
 * (null) it falls back to the game's settled suffix — never a literal 0.
 * Callers append it only to a top-surface line; while the vote/play is
 * still open there is no armed deadline, so `remainingSeconds` is null
 * and the settled suffix applies (empty for games that show nothing at 0).
 *
 * The wording is the game's own voice and lives in the game module that
 * calls this — this file holds no game copy, only the guard and the
 * composition.
 */
export interface SettleCountdownWording {
  /** Text after "N秒后" while seconds remain, e.g. "自动公布结果" / "揭晓". */
  readonly tickingVerb: string;
  /** Suffix once the deadline is reached (0) or has not arrived yet (null). */
  readonly settledSuffix: string;
}

export function getSettleCountdownSuffix(
  remainingSeconds: number | null,
  wording: SettleCountdownWording,
): string {
  if (remainingSeconds !== null && remainingSeconds > 0) {
    return `，${remainingSeconds}秒后${wording.tickingVerb}`;
  }
  return wording.settledSuffix;
}
