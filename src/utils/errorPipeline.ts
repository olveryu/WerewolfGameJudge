/**
 * errorPipeline — Unified error handling for catch blocks
 *
 * Replaces the repetitive pattern of isAbortError guard → log → Sentry → showAlert
 * with a single `handleError(err, opts)` call. Classifies errors into:
 *   - **abort**: AbortError from fetch/navigation — log.warn only, no Sentry, no UI
 *   - **expected**: User input / rate-limit / known HTTP status — log.warn + UI feedback, no Sentry
 *   - **unexpected**: Everything else — log.error + Sentry + UI feedback
 *
 * Does NOT replace `fireAndForget()` (which handles promise rejection without UI).
 * Does NOT replace `AuthContext.handleAuthError` (which uses `setError` state, not showAlert).
 */

import * as Sentry from '@sentry/react-native';
import { toast } from 'sonner-native';

import { NETWORK_ERROR } from '@/config/errorMessages';
import { showAlert } from '@/utils/alert';
import { getErrorMessage, isAbortError, isNetworkError } from '@/utils/errorUtils';

import type { log as LoggerType } from './logger';

type Logger = Pick<ReturnType<typeof LoggerType.extend>, 'error' | 'warn'>;

/** Options for `handleError()` */
interface HandleErrorOptions {
  /** Descriptive label for log output, e.g. '创建房间' or '[wolfVote]' */
  label: string;

  /** Logger instance — pass the module's named logger (e.g. `facadeLog`) */
  logger: Logger;

  /**
   * HTTP status codes considered "expected" (skip Sentry).
   * Common: [401, 403, 429]. Merged with built-in abort/expected checks.
   */
  expectedCodes?: number[];

  /**
   * UI feedback mode:
   * - 'alert' (default): show modal alert via showAlert
   * - 'toast': show toast.error (use when called from within an open AlertModal callback)
   * - false: suppress UI feedback entirely (background operations)
   */
  feedback?: 'alert' | 'toast' | false;

  /**
   * Custom alert/toast message. Defaults to `getErrorMessage(err)`.
   */
  alertMessage?: string;

  /**
   * Custom predicate to classify additional errors as "expected".
   * Return true to skip Sentry but still show UI feedback.
   */
  isExpected?: (err: unknown) => boolean;
}

/**
 * Extract HTTP status code from error shapes commonly seen in the codebase:
 * - `{ status: number }` (fetch Response-like)
 * - `{ code: number | string }` (PostgrestError-like)
 */
function extractStatusCode(err: unknown): number | undefined {
  if (err == null || typeof err !== 'object') return undefined;
  const obj = err as Record<string, unknown>;
  if (typeof obj.status === 'number') return obj.status;
  if (typeof obj.code === 'string') {
    const parsed = Number(obj.code);
    if (!Number.isNaN(parsed) && parsed >= 100 && parsed < 600) return parsed;
  }
  return undefined;
}

/**
 * Unified error handler — replaces repetitive catch block patterns.
 *
 * Usage:
 * ```ts
 * try {
 *   await facade.startNight();
 * } catch (err) {
 *   handleError(err, { label: '开始夜晚', logger: roomScreenLog });
 * }
 * ```
 */
export function handleError(err: unknown, opts: HandleErrorOptions): void {
  const { label, logger, expectedCodes, alertMessage, isExpected } = opts;
  const feedbackMode: 'alert' | 'toast' | false = opts.feedback ?? 'alert';

  // ── Abort: log.warn only, no Sentry, no UI ──
  if (isAbortError(err)) {
    logger.warn(`[${label}] aborted`, err);
    return;
  }

  // ── Network error: log.warn, no Sentry, show network-specific message ──
  if (isNetworkError(err)) {
    logger.warn(`[${label}] network error`, err);
    if (feedbackMode === 'alert') {
      showAlert(`${label}失败`, NETWORK_ERROR);
    } else if (feedbackMode === 'toast') {
      toast.error(NETWORK_ERROR);
    }
    return;
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
    Sentry.captureException(err);
  }

  // ── UI feedback ──
  if (feedbackMode === false) return;

  const message = alertMessage ?? getErrorMessage(err);

  if (feedbackMode === 'toast') {
    toast.error(message);
  } else {
    showAlert(`${label}失败`, message);
  }
}
