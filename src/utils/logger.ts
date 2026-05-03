/**
 * logger - Unified logging module using react-native-logs
 *
 * 全项目统一日志入口，提供命名 logger 实例，支持创建命名 logger 和配置 transport/severity。
 *
 * Usage:
 *   import { log } from '@/utils/logger';
 *   log.info('Seat action', { seat: 1 });
 *
 * Or with extensions:
 *   const myLog = log.extend('MyModule');
 *   myLog.info('Seat action', { seat: 1 });
 *
 * 不引入 React、service 或游戏状态。
 */

import * as Sentry from '@sentry/react-native';
import { consoleTransport, logger } from 'react-native-logs';

import { NETWORK_ERROR } from '@/config/errorMessages';

import { mobileDebugTransport } from './mobileDebug';

/**
 * Transport that forwards logs to Sentry Structured Logs (production only).
 *
 * Uses rawMsg (original arguments array) to extract structured attributes.
 * Sentry Structured Logs expect: Sentry.logger.info("message", { key: value })
 * react-native-logs passes rawMsg = [msg, ...rest] from log.info(msg, ...rest).
 */
const sentryTransport: typeof consoleTransport = (props) => {
  const raw = props.rawMsg as unknown[];
  const rawFirstMsg = typeof raw?.[0] === 'string' ? raw[0] : props.msg;
  const module = props.extension ?? 'app';
  const firstMsg = `[${module}] ${rawFirstMsg}`;

  // Build structured attributes from remaining args + extension tag
  const attrs: Record<string, unknown> = { module };
  if (Array.isArray(raw)) {
    for (let i = 1; i < raw.length; i++) {
      const arg = raw[i];
      if (arg && typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Error)) {
        Object.assign(attrs, arg);
      }
    }
  }

  const level = props.level?.text as string | undefined;
  if (level === 'error') {
    Sentry.logger.error(firstMsg, attrs);
  } else if (level === 'warn') {
    Sentry.logger.warn(firstMsg, attrs);
  } else if (level === 'info') {
    Sentry.logger.info(firstMsg, attrs);
  } else {
    Sentry.logger.debug(firstMsg, attrs);
  }
};

/**
 * Wraps a transport so it only receives messages at or above `minSeverity`.
 * react-native-logs applies severity globally before transports, so we set
 * global severity to 'debug' and use this wrapper to keep consoleTransport
 * quiet in production while mobileDebugTransport sees everything.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withMinSeverity = <T extends (...args: any[]) => any>(minSeverity: number, inner: T): T => {
  return ((props: { level: { severity: number } }) => {
    if (props.level.severity >= minSeverity) {
      inner(props);
    }
  }) as unknown as T;
};

// severity levels: debug=0, info=1, warn=2, error=3
const WARN_SEVERITY = 2;

const config = {
  transport: [
    // In dev: console shows everything; in prod: console shows warn+ only
    __DEV__ ? consoleTransport : withMinSeverity(WARN_SEVERITY, consoleTransport),
    // Debug panel always receives all levels
    mobileDebugTransport,
    // Production: forward all levels to Sentry Structured Logs
    ...(__DEV__ ? [] : [sentryTransport]),
  ],
  // Global minimum = debug so mobileDebugTransport can receive everything
  severity: 'debug' as const,
  transportOptions: {
    colors: {
      debug: 'white',
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
    } as const,
  },
};

export const log = logger.createLogger(config);

// Pre-configured extensions for common modules
export const realtimeLog = log.extend('Realtime');
export const audioLog = log.extend('Audio');
export const authLog = log.extend('Auth');
export const roomLog = log.extend('Room');
export const gameRoomLog = log.extend('GameRoom');
export const connectionLog = log.extend('Connection');
export const configLog = log.extend('Config');
export const roomScreenLog = log.extend('RoomScreen');
export const homeLog = log.extend('Home');
export const facadeLog = log.extend('Facade');
export const settingsLog = log.extend('Settings');
export const settingsServiceLog = log.extend('SettingsService');
export const bgmLog = log.extend('BGM');
export const chatLog = log.extend('Chat');
export const cfFetchLog = log.extend('cfFetch');
export const statsLog = log.extend('Stats');
export const shareLog = log.extend('Share');
export const gachaLog = log.extend('Gacha');

/**
 * Map auth error messages to user-friendly Chinese messages.
 *
 * 纯字符串映射，不包含副作用，不依赖外部状态。
 */
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return '邮箱或密码错误';
  if (lower.includes('user already registered')) return '该邮箱已注册';
  if (lower.includes('email not confirmed')) return '邮箱未验证，请查收验证邮件';
  if (lower.includes('password should be at least')) return '密码至少需要6个字符';
  if (lower.includes('unable to validate email address')) return '邮箱格式无效';
  if (lower.includes('invalid email')) return '邮箱格式无效';
  if (lower.includes('anonymous sign-ins are disabled')) return '匿名登录已禁用';
  if (lower.includes('signups not allowed')) return '注册功能已关闭';
  if (lower.includes('email rate limit exceeded')) return '操作过于频繁，请稍后重试';
  if (lower.includes('only request this once every')) return '请求过于频繁，请稍等后重试';
  if (lower.includes('too many reset requests')) return '重置请求过于频繁，请稍后重试';
  if (lower.includes('too many login attempts')) return '登录尝试过于频繁，请稍后重试';
  if (lower.includes('email already registered')) return '该邮箱已注册';
  if (lower.includes('email and password required')) return '请输入邮箱和密码';
  if (lower.includes('email required')) return '请输入邮箱';
  if (lower.includes('invalid credentials')) return '邮箱或密码错误';
  if (lower.includes('invalid old password')) return '原密码错误';
  if (lower.includes('invalid or expired code')) return '验证码无效或已过期';
  if (lower.includes('failed to send email')) return '邮件发送失败，请稍后重试';
  if (lower.includes('account has no password')) return '该账户未设置密码';
  if (lower.includes('account merge failed')) return '账号合并失败，请稍后重试';
  if (lower.includes('oldpassword and newpassword required')) return '请输入原密码和新密码';
  if (lower.includes('email, code and newpassword required')) return '请填写完整信息';
  if (lower.includes('network') || lower.includes('fetch')) return NETWORK_ERROR;

  // 其他未匹配的英文错误信息，返回通用中文提示，避免用户看到原始英文
  if (/[a-z]/i.test(message) && !/[一-鿿]/.test(message)) {
    return '操作失败，请稍后重试';
  }

  return message;
}

/**
 * Check if an auth error is expected (user input / rate-limit) and should NOT be reported to Sentry.
 *
 * 用户输入错误（密码太短、邮箱格式、凭证错误等）和速率限制是可预期的，
 * 只需 `log.warn()` + UI 反馈，禁止上报 Sentry。
 */
export function isExpectedAuthError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes('invalid login credentials') ||
    lower.includes('user already registered') ||
    lower.includes('email not confirmed') ||
    lower.includes('password should be at least') ||
    lower.includes('unable to validate email address') ||
    lower.includes('email rate limit exceeded') ||
    lower.includes('only request this once every') ||
    lower.includes('signups not allowed') ||
    lower.includes('too many reset requests') ||
    lower.includes('too many login attempts') ||
    lower.includes('email already registered') ||
    lower.includes('email and password required') ||
    lower.includes('email required') ||
    lower.includes('invalid credentials') ||
    lower.includes('invalid old password') ||
    lower.includes('invalid or expired code') ||
    lower.includes('account has no password') ||
    lower.includes('oldpassword and newpassword required') ||
    lower.includes('email, code and newpassword required') ||
    lower.includes('validation_error') ||
    lower.includes('invalid email')
  );
}
