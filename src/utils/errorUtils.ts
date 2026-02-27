/**
 * errorUtils - Shared error handling helpers
 *
 * 提供跨模块复用的错误处理工具函数，消除重复的 error-to-message 提取和 fire-and-forget 模式。
 * 纯函数工具，不引入 React / service / 游戏状态。
 */

import * as Sentry from '@sentry/react-native';

import type { log as LoggerType } from './logger';

/**
 * Extract a user-friendly error message from an unknown caught value.
 *
 * @param e - The caught error (unknown type)
 * @param fallback - Fallback message when `e` is not an Error instance (default: '请稍后重试')
 */
export function getErrorMessage(e: unknown, fallback = '请稍后重试'): string {
  return e instanceof Error ? e.message : fallback;
}

/**
 * Fire-and-forget a promise with unified error handling (log + Sentry).
 *
 * Replaces the repetitive pattern:
 * ```ts
 * void someAction().catch((err) => {
 *   log.error(label, err);
 *   Sentry.captureException(err);
 * });
 * ```
 *
 * @param promise - The promise to fire and forget
 * @param label - A descriptive label for logging (e.g., '[submitRevealAck]')
 * @param logger - A logger instance (must have `.error()`)
 */
export function fireAndForget(
  promise: Promise<unknown>,
  label: string,
  logger: Pick<ReturnType<typeof LoggerType.extend>, 'error'>,
): void {
  void promise.catch((err: unknown) => {
    logger.error(label, err);
    Sentry.captureException(err);
  });
}
