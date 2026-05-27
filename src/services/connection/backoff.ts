/**
 * calculateBackoff — exponential backoff + jitter
 *
 * Standard community implementation: exponential backoff with equal jitter.
 * Pure function, no side effects, exhaustively testable.
 *
 * @param attempt - current retry count (0-based)
 * @param baseMs - base delay (default 1000ms)
 * @param maxMs - maximum delay cap (default 30000ms)
 * @param random - random number generator (0~1); defaults to Math.random; injectable for testing
 * @returns jitter-adjusted delay in milliseconds
 */
export function calculateBackoff(
  attempt: number,
  baseMs: number = 1000,
  maxMs: number = 30_000,
  random: () => number = Math.random,
): number {
  const exponential = baseMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxMs);
  // Equal jitter: uniform random in [capped * 0.5, capped]
  const jitter = capped * (0.5 + random() * 0.5);
  return Math.round(jitter);
}
