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
 * Detect fetch AbortError or TimeoutError (user cancel / AbortSignal.timeout / network blip).
 *
 * Handles three shapes:
 * - `DOMException` with `name === 'AbortError'` (user cancel) or `name === 'TimeoutError'` (AbortSignal.timeout)
 * - Standard `Error` instance with `name === 'AbortError'`
 * - Plain object `{ message, code, details, hint }` where `message` contains "AbortError"
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException) {
    return err.name === 'AbortError' || err.name === 'TimeoutError';
  }
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
  // ── Auth ──────────────────────────────────────────────────────────────────
  EMAIL_ALREADY_REGISTERED: '该邮箱已注册',
  INVALID_CREDENTIALS: '邮箱或密码错误',
  ACCOUNT_MERGE_FAILED: '账号合并失败，请稍后重试',
  TOO_MANY_ATTEMPTS: '登录尝试过于频繁，请稍后重试',
  UNAUTHORIZED: '身份验证失败',
  USER_NOT_FOUND: '用户不存在',
  TOKEN_REVOKED: '登录已过期，请重新登录',
  ITEM_NOT_UNLOCKED: '物品尚未解锁',
  NO_PASSWORD: '该账户未设置密码',
  INVALID_OLD_PASSWORD: '原密码错误',
  EMAIL_SEND_FAILED: '邮件发送失败，请稍后重试',
  INVALID_OR_EXPIRED_CODE: '验证码无效或已过期',
  WECHAT_NOT_CONFIGURED: '微信登录未配置',
  WECHAT_TIMEOUT: '微信服务超时，请重试',
  WECHAT_AUTH_FAILED: '微信认证失败',
  INVALID_REFRESH_TOKEN: '登录已过期，请重新登录',
  WECHAT_ALREADY_BOUND: '该微信已绑定其他账号',
  // ── Room / Avatar / Share ─────────────────────────────────────────────────
  ROOM_CODE_CONFLICT: '房间号冲突，请重试',
  STORAGE_NOT_CONFIGURED: '存储服务未配置',
  FILE_REQUIRED: '请选择文件',
  INVALID_FILE_TYPE: '文件类型无效，仅支持 JPEG/PNG/WebP',
  FILE_TOO_LARGE: '文件过大（最大 5MB）',
  INVALID_DATA: '数据格式无效',
  NOT_FOUND: '资源不存在',
  ANONYMOUS_NOT_SUPPORTED: '匿名用户不支持此操作',
  // ── Gacha ─────────────────────────────────────────────────────────────────
  NO_STATS: '请先完成一局游戏',
  INSUFFICIENT_DRAWS: '抽奖券不足',
  INSUFFICIENT_SHARDS: '碎片不足',
  ALREADY_OWNED: '已拥有该物品',
  INVALID_ITEM: '物品不存在',
  CONFLICT: '请求冲突，请重试',
  // ── AI ────────────────────────────────────────────────────────────────────
  QUOTA_EXHAUSTED: 'AI 额度已用完',
  AI_UNAVAILABLE: 'AI 服务暂不可用', // ── Validation ─────────────────────────────────────────────────────────────────
  VALIDATION_ERROR: '输入信息格式有误', // ── Seat / lifecycle ──────────────────────────────────────────────────────
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
 * 如果 reason 为 undefined/null 或不在映射表中，返回 fallback。
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
    // Network errors (native fetch/TypeError — not from our API)
    if (isNetworkError(error)) return REASON_CODE_MAP['NETWORK_ERROR']!;
    // Chinese message — already user-friendly
    if (/[\u4e00-\u9fff]/.test(message)) return message;
  }

  return fallback;
}

/**
 * Check if an error is expected (user input / rate-limit / known rejection)
 * and should NOT be reported to Sentry.
 *
 * Accepts either a reason code string or an error object with `.reason`.
 */
const EXPECTED_ERROR_CODES = new Set([
  'EMAIL_ALREADY_REGISTERED',
  'INVALID_CREDENTIALS',
  'TOO_MANY_ATTEMPTS',
  'INVALID_OLD_PASSWORD',
  'INVALID_OR_EXPIRED_CODE',
  'NO_PASSWORD',
  'WECHAT_ALREADY_BOUND',
  'WECHAT_AUTH_FAILED',
  'ITEM_NOT_UNLOCKED',
  'VALIDATION_ERROR',
  'INSUFFICIENT_DRAWS',
  'INSUFFICIENT_SHARDS',
  'ALREADY_OWNED',
  'NO_STATS',
]);

export function isExpectedError(error: unknown): boolean {
  if (typeof error === 'string') return EXPECTED_ERROR_CODES.has(error);
  if (error instanceof Error) {
    // error.message is the reason code after wire format unification
    if (EXPECTED_ERROR_CODES.has(error.message)) return true;
    // Also check .reason property (cfFetch attaches it)
    const reason = (error as { reason?: string }).reason;
    if (reason && EXPECTED_ERROR_CODES.has(reason)) return true;
  }
  if (error != null && typeof error === 'object' && 'reason' in error) {
    const reason = (error as { reason: unknown }).reason;
    if (typeof reason === 'string' && EXPECTED_ERROR_CODES.has(reason)) return true;
  }
  return false;
}
