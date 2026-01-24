/**
 * Promise timeout utilities
 *
 * 统一的超时封装，确保 timer 在 resolve/reject/timeout 后正确清理
 *
 * 契约：
 * - 超时时必须 reject（不 resolve）
 * - finally 必须清理内部 timer
 * - 支持 errorFactory 自定义超时错误
 */

import { log } from './logger';

const timeoutLog = log.extend('Timeout');

/**
 * 超时错误工厂类型
 * @param ms - 超时时间（毫秒）
 * @param context - 可选上下文信息
 * @returns Error 对象
 */
export type TimeoutErrorFactory = (ms: number, context?: string) => Error;

/**
 * 默认超时错误工厂（技术消息，仅用于日志/调试）
 */
const defaultErrorFactory: TimeoutErrorFactory = (ms, context) =>
  new Error(context ? `Operation timed out after ${ms}ms: ${context}` : `Operation timed out after ${ms}ms`);

/**
 * 包装一个 Promise，在指定时间内未完成则 reject
 *
 * @param promise - 要包装的 Promise
 * @param ms - 超时时间（毫秒）
 * @param contextOrFactory - 上下文字符串（用于日志），或自定义错误工厂
 * @returns 原 Promise 的结果，或超时 reject
 *
 * @example
 * ```ts
 * // 使用默认技术消息
 * const result = await withTimeout(fetchData(), 5000, 'fetchData');
 *
 * // 使用自定义用户友好错误
 * const result = await withTimeout(authPromise, 10000, () => new Error('登录超时，请重试'));
 * ```
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  contextOrFactory?: string | TimeoutErrorFactory,
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  // 解析参数：字符串当 context，函数当 errorFactory
  const context = typeof contextOrFactory === 'string' ? contextOrFactory : undefined;
  const errorFactory = typeof contextOrFactory === 'function' ? contextOrFactory : defaultErrorFactory;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const error = errorFactory(ms, context);
      // 技术日志（带 context）
      timeoutLog.warn(`Timeout: ${context ?? 'unknown'} after ${ms}ms`);
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

/**
 * 创建一个可取消的延迟 Promise
 *
 * @param ms - 延迟时间（毫秒）
 * @returns { promise, cancel } - promise 会在 ms 后 resolve，cancel() 可提前取消
 *
 * @example
 * ```ts
 * const { promise, cancel } = cancellableDelay(1000);
 * // 在某处取消
 * cancel();
 * ```
 */
export function cancellableDelay(ms: number): {
  promise: Promise<void>;
  cancel: () => void;
} {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  let rejectFn: ((reason?: unknown) => void) | null = null;

  const promise = new Promise<void>((resolve, reject) => {
    rejectFn = reject;
    timeoutHandle = setTimeout(() => {
      timeoutHandle = null;
      resolve();
    }, ms);
  });

  const cancel = () => {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    // Reject with a known error type for cancellation
    rejectFn?.(new Error('Delay cancelled'));
  };

  return { promise, cancel };
}
