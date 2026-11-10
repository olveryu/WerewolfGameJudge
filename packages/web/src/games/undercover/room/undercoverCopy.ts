/** Undercover wordings the room and the review share: one wording per fact. */

/** An aborted round's conclusion: the room's bottom panel and the review's headline. */
export const UNDERCOVER_ABORTED_TEXT = '本局已中止';

/** What an abort keeps undisclosed: the host's abort confirmation and the aborted review. */
export const UNDERCOVER_ABORT_NOTICE = '本局不计胜负，不公开未揭晓身份和词语。';

/** The configured blank mode: the room summary and the review's facts. */
export function formatUndercoverBlankMode(hasBlank: boolean): string {
  return hasBlank ? '有白板' : '无白板';
}
