/** Recent attempts are deprioritized, but remain eligible when every category is cooling down. */
const WORD_CATEGORY_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;

export function wordCategoryCooldownCutoff(now = Date.now()): string {
  return new Date(now - WORD_CATEGORY_COOLDOWN_MS).toISOString();
}
