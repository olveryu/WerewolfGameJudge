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
 * Detect fetch AbortError (browser tab backgrounded / network blip / duplicate navigation).
 *
 * Handles two shapes:
 * - Standard `Error` instance with `name === 'AbortError'`
 * - Plain object `{ message, code, details, hint }` where `message` contains "AbortError"
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error) return err.name === 'AbortError';
  if (err != null && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message).includes('AbortError');
  }
  return false;
}

/**
 * Known error message substrings that indicate a network-level failure.
 *
 * Sources:
 * - `TypeError: Failed to fetch` — Chromium (fetch API network failure)
 * - `TypeError: Network request failed` — React Native / Safari
 * - `TypeError: Load failed` — Safari (newer)
 * - `TypeError: cancelled` — Safari (request cancelled by OS)
 * - `ECONNREFUSED` / `ETIMEDOUT` — Node.js / SSR environments
 * - `network` / `fetch` (case-insensitive) — SDK error messages
 * - `Operation timed out after` — withTimeout() utility
 * - `subscribe timeout` — RealtimeService channel subscription timeout
 */
const NETWORK_ERROR_PATTERNS = [
  'failed to fetch',
  'network request failed',
  'load failed',
  'cancelled',
  'econnrefused',
  'etimedout',
  'operation timed out after',
  'subscribe timeout',
];

/**
 * Detect network-level errors (offline, DNS, timeout, connection refused).
 *
 * Network errors are "expected" in the sense that they happen when the user
 * is offline or the server is unreachable — they should NOT be reported to Sentry.
 * Use this alongside `isAbortError()` for complete fetch error classification.
 */
export function isNetworkError(err: unknown): boolean {
  if (err == null) return false;

  // TypeError is the standard error type thrown by fetch() for network failures
  const message =
    err instanceof Error
      ? err.message.toLowerCase()
      : typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message).toLowerCase()
        : '';

  if (!message) return false;

  return NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
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
  logger: Pick<ReturnType<typeof LoggerType.extend>, 'error' | 'warn'>,
): void {
  void promise.catch((err: unknown) => {
    if (isAbortError(err)) {
      logger.warn(label, '(aborted)', err);
      return;
    }
    if (isNetworkError(err)) {
      logger.warn(label, '(network error)', err);
      return;
    }
    logger.error(label, err);
    Sentry.captureException(err);
  });
}

/** 服务端 reason code → 中文友好文案 */
const REASON_CODE_MAP: Record<string, string> = {
  // Seat / lifecycle
  game_in_progress: '游戏进行中，无法操作',
  not_authenticated: '身份验证失败',
  no_state: '房间不存在或已解散',
  invalid_seat: '座位不存在',
  seat_taken: '座位已被占用',
  not_seated: '你还没有入座',
  // Game control
  invalid_status: '当前状态不允许此操作',
  role_count_mismatch: '角色数量与座位数不匹配',
  forbidden_while_audio_playing: '请等待语音播放完毕',
  // Transport (processGameAction)
  CONFLICT_RETRY: '操作冲突，请重试',
  ROOM_NOT_FOUND: '房间不存在或已解散',
  INTERNAL_ERROR: '服务器内部错误',
  // Client API layer
  NETWORK_ERROR: '网络异常，请检查网络后重试',
  SERVER_ERROR: '服务暂时不可用，请稍后重试',
  TIMEOUT: '请求超时，请稍后重试',
  NOT_CONNECTED: '未连接到房间',
  // Night flow
  not_ongoing: '游戏未在进行中',
  no_pending_acks: '无待确认的操作',
  no_current_step: '当前步骤异常',
  not_group_confirm_step: '当前非确认步骤',
  no_player_at_seat: '该座位没有玩家',
  userId_mismatch: '身份不匹配',
  // Game engine
  invalid_step: '步骤无效',
  step_mismatch: '步骤不匹配',
  role_mismatch: '角色不匹配',
  no_resolver: '操作处理器不存在',
  wolfrobot_hunter_status_not_viewed: '请先查看猎人状态',
  night_not_complete: '夜晚流程未完成',
  not_learned_hunter: '还未获知猎人信息',
  // HTTP routing
  MISSING_PARAMS: '请求参数缺失',
  INVALID_ACTION: '无效操作',
  MISSING_SEAT: '座位参数缺失',
  METHOD_NOT_ALLOWED: '请求方法不允许',
  UNKNOWN_ACTION: '未知操作',
  UNKNOWN_NIGHT_ACTION: '未知夜间操作',
  host_only: '仅房主可执行此操作',
  forbidden: '无权执行此操作',
  no_db_state: '游戏状态不可用',
};

/**
 * Translate a server reason code to a user-friendly Chinese message.
 *
 * 遵循 mapAuthError 同款模式：已知 code 翻译，未知 code fallback。
 * 如果 reason 为 undefined/null 或不在映射表中，返回通用 fallback。
 */
export function translateReasonCode(
  reason: string | undefined | null,
  fallback = '请稍后重试',
): string {
  if (!reason) return fallback;
  return REASON_CODE_MAP[reason] ?? fallback;
}

/**
 * Extract a user-facing Chinese message from an unknown error object.
 *
 * Priority:
 * 1. Structured `{ reason }` → translateReasonCode
 * 2. Error.message that matches a known reason code
 * 3. Chinese message (contains CJK characters) → return as-is
 * 4. Fallback '操作失败，请稍后重试'
 */
export function getUserFacingMessage(error: unknown, fallback = '操作失败，请稍后重试'): string {
  if (error == null) return fallback;

  // Structured error with reason code (API responses)
  if (typeof error === 'object' && 'reason' in error) {
    const reason = (error as { reason: unknown }).reason;
    if (typeof reason === 'string') {
      const translated = REASON_CODE_MAP[reason];
      if (translated) return translated;
    }
  }

  // Error.message
  const message = error instanceof Error ? error.message : '';
  if (message) {
    // Check if message itself is a known reason code
    const translated = REASON_CODE_MAP[message];
    if (translated) return translated;
    // Chinese message — already user-friendly
    if (/[\u4e00-\u9fff]/.test(message)) return message;
  }

  return fallback;
}
