/** Undercover wordings the room and the review share: one wording per fact. */

/** The configured blank mode: the room summary and the review's facts. */
export function formatUndercoverBlankMode(hasBlank: boolean): string {
  return hasBlank ? '有白板' : '无白板';
}
