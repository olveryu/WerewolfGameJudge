/**
 * errorPipeline — Unified error classification for catch blocks
 *
 * Replaces the repetitive pattern of isAbortError guard → log → Sentry
 * with a single `handleError(err, opts)` call. Classifies errors into:
 *   - **abort**: AbortError from fetch/navigation — log.warn only, no Sentry, no UI
 *   - **network**: network failure/timeout — log.warn + caller UI, no Sentry
 *   - **expected**: User input / rate-limit / known HTTP status — log.warn + caller UI, no Sentry
 *   - **unexpected**: Everything else — log.error + Sentry + caller UI
 *
 * UI-free by design: `handleError` never shows alerts or toasts. It returns a
 * {@link HandleErrorResult} and the caller decides how to present it
 * (e.g. `<AlertModal>` in components, `showRoomAlert()` in room controllers,
 * `toast.error()` for non-blocking feedback).
 *
 * Also provides `fireAndForget()` for promise rejections that need the same
 * classification but no UI (background tasks).
 * Does NOT replace `AuthContext.handleAuthError` (which uses `setError` state).
 */

import * as Sentry from '@sentry/react-native';

import { NETWORK_ERROR } from '@/config/errorMessages';
import { getErrorMessage, isAbortError, isNetworkError } from '@/utils/errorUtils';

import type { log as LoggerType } from './logger';

type Logger = Pick<ReturnType<typeof LoggerType.extend>, 'error' | 'warn'>;

/** Options for `handleError()` */
export interface HandleErrorOptions {
  /** Descriptive label for log output, e.g. '创建房间' or '[wolfVote]' */
  label: string;

  /** Logger instance — pass the module's named logger (e.g. `roomSessionLog`) */
  logger: Logger;

  /**
   * HTTP status codes considered "expected" (skip Sentry).
   * Common: [401, 403, 429]. Merged with built-in abort/expected checks.
   */
  expectedCodes?: number[];

  /**
   * Custom user-facing message. Defaults to `getErrorMessage(err)`.
   */
  alertMessage?: string;

  /**
   * Custom predicate to classify additional errors as "expected".
   * Return true to skip Sentry (caller still shows UI feedback).
   */
  isExpected?: (err: unknown) => boolean;
}

/**
 * Result of `handleError()` — the caller owns all UI decisions.
 */
export interface HandleErrorResult {
  /** User-facing message (Chinese). */
  message: string;
  /** True when Sentry was skipped (abort / network / expected). */
  isExpected: boolean;
  /**
   * True for AbortError — the caller must show NO UI at all
   * (the operation was cancelled, e.g. navigation away).
   */
  aborted: boolean;
}

/**
 * Extract HTTP status code from error shapes commonly seen in the codebase:
 * - `{ status: number }` (fetch Response-like)
 * - `{ code: number | string }` (PostgrestError-like)
 */
function extractStatusCode(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  if ('status' in err && typeof err.status === 'number') return err.status;
  if ('code' in err && typeof err.code === 'string') {
    const parsed = Number(err.code);
    if (!Number.isNaN(parsed) && parsed >= 100 && parsed < 600) return parsed;
  }
  return undefined;
}

/**
 * Unified error classifier — replaces repetitive catch block patterns.
 *
 * Never shows UI. The caller decides presentation:
 *
 * ```ts
 * try {
 *   await client.startNight();
 * } catch (err) {
 *   const result = handleError(err, { label: '开始夜晚', logger: roomScreenLog });
 *   if (!result.aborted) {
 *     setAlert({ title: '开始夜晚失败', message: result.message });
 *   }
 * }
 * ```
 */
export function handleError(err: unknown, opts: HandleErrorOptions): HandleErrorResult {
  const { label, logger, expectedCodes, alertMessage, isExpected } = opts;

  // ── Abort: log.warn only, no Sentry, caller must show no UI ──
  if (isAbortError(err)) {
    logger.warn(`[${label}] aborted`, err);
    return { message: '', isExpected: true, aborted: true };
  }

  // ── Network error: log.warn, no Sentry, network-specific message ──
  if (isNetworkError(err)) {
    logger.warn(`[${label}] network error`, err);
    return { message: alertMessage ?? NETWORK_ERROR, isExpected: true, aborted: false };
  }

  // ── Expected: HTTP status code match ──
  const statusCode = extractStatusCode(err);
  const isExpectedByCode =
    statusCode !== undefined && expectedCodes !== undefined && expectedCodes.includes(statusCode);

  // ── Expected: custom predicate ──
  const isExpectedByPredicate = isExpected?.(err) === true;

  const expected = isExpectedByCode || isExpectedByPredicate;

  if (expected) {
    logger.warn(`[${label}] expected error`, err);
  } else {
    logger.error(`[${label}] unexpected error`, err);
    Sentry.withScope((scope) => {
      scope.setTag('handler', label);
      if (statusCode !== undefined) scope.setTag('http.status_code', statusCode);
      scope.setFingerprint([label, getErrorMessage(err)]);
      Sentry.captureException(err);
    });
  }

  return {
    message: alertMessage ?? getErrorMessage(err),
    isExpected: expected,
    aborted: false,
  };
}

/**
 * Fire-and-forget a promise, routing any rejection through `handleError` with no UI.
 *
 * Replaces the repetitive pattern:
 * ```ts
 * void someAction().catch((err) => {
 *   log.error(label, err);
 *   Sentry.captureException(err);
 * });
 * ```
 * Classification (abort / network / expected / unexpected → Sentry) is identical
 * to `handleError`, so background tasks stay consistent with foreground ones.
 *
 * @param promise - The promise to fire and forget
 * @param label - A descriptive label for logging / Sentry fingerprint
 * @param logger - The module's named logger
 */
export function fireAndForget(promise: Promise<unknown>, label: string, logger: Logger): void {
  void promise.catch((err: unknown) => {
    handleError(err, { label, logger });
  });
}
