/**
 * Caches one lazy load: every call returns the same promise, so React's `use()` sees a stable
 * value. A failed load (e.g. a chunk fetch) may succeed on retry, so only a fulfilled load stays
 * cached; the next call after a rejection starts a new attempt.
 */
export function cacheLoad<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    if (loading !== null) return loading;
    const attempt = load();
    loading = attempt;
    attempt.catch(() => {
      loading = null;
    });
    return attempt;
  };
}
