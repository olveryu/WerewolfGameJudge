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
 * - Supabase `PostgrestError` plain object `{ message, code, details, hint }`
 *   where `message` contains the string "AbortError"
 */
export function isAbortError(err: unknown): boolean {
  if (err instanceof Error) return err.name === 'AbortError';
  if (err != null && typeof err === 'object' && 'message' in err) {
    return String((err as { message: unknown }).message).includes('AbortError');
  }
  return false;
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
