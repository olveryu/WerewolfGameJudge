/**
 * withTimeout - Promise timeout utilities
 *
 * Unified timeout wrapper, supports Promise timeout wrapping and retry with timeout,
 * ensures timer is properly cleaned up after resolve/reject/timeout.
 *
 * Contract:
 * - Must reject on timeout (not resolve)
 * - finally must clean up internal timer
 * - Supports errorFactory for custom timeout errors
 *
 * Does not introduce React, services, or game state.
 */

import { log } from './logger';

const timeoutLog = log.extend('Timeout');

/**
 * Timeout error factory type
 * @param ms - timeout duration (milliseconds)
 * @param context - optional context info
 * @returns Error object
 */
type TimeoutErrorFactory = (ms: number, context?: string) => Error;

/**
 * Default timeout error factory (technical message, used only for logs/debugging)
 */
const defaultErrorFactory: TimeoutErrorFactory = (ms, context) =>
  new Error(
    context ? `Operation timed out after ${ms}ms: ${context}` : `Operation timed out after ${ms}ms`,
  );

/**
 * Wraps a Promise, rejects if not completed within the specified time
 *
 * @param promise - the Promise to wrap
 * @param ms - timeout duration (milliseconds)
 * @param contextOrFactory - context string (for logs) or custom error factory
 * @returns the original Promise's result, or rejects on timeout
 *
 * @example
 * ```ts
 * // Use default technical message
 * const result = await withTimeout(fetchData(), 5000, 'fetchData');
 *
 * // Use custom user-friendly error
 * const result = await withTimeout(authPromise, 10000, () => new Error('登录超时，请重试'));
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  contextOrFactory?: string | TimeoutErrorFactory,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // Parse args: string is context, function is errorFactory
  const context = typeof contextOrFactory === 'string' ? contextOrFactory : undefined;
  const errorFactory =
    typeof contextOrFactory === 'function' ? contextOrFactory : defaultErrorFactory;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = errorFactory(ms, context);
      // Technical log (with context)
      timeoutLog.warn('Timeout', { context: context ?? 'unknown', ms });
      reject(error);
    }, ms);
  });

  // Race between original promise and timeout
  // Ensure timer is always cleaned up
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
  });
}
