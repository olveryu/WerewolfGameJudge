/**
 * logger - Unified logging module using react-native-logs
 *
 * 全项目统一日志入口，提供命名 logger 实例。
 *
 * Usage:
 *   import { log } from '@/utils/logger';
 *   log.info('Seat action', { seat: 1 });
 *
 * Or with extensions:
 *   const hostLog = log.extend('Host');
 *   hostLog.info('Seat action', { seat: 1 });
 *
 * ✅ 允许：创建命名 logger、配置 transport/severity
 * ❌ 禁止：import React / service / 游戏状态
 */

import { consoleTransport, logger } from 'react-native-logs';

import { mobileDebugTransport } from './mobileDebug';

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
export const nightFlowLog = log.extend('NightFlow');
export const broadcastLog = log.extend('Broadcast');
export const audioLog = log.extend('Audio');
export const authLog = log.extend('Auth');
export const roomLog = log.extend('Room');
export const gameRoomLog = log.extend('GameRoom');
export const configLog = log.extend('Config');
export const roomScreenLog = log.extend('RoomScreen');
export const homeLog = log.extend('Home');
export const facadeLog = log.extend('Facade');
export const settingsLog = log.extend('Settings');
export const settingsServiceLog = log.extend('SettingsService');
export const bgmLog = log.extend('BGM');
export const chatLog = log.extend('Chat');

/**
 * Map Supabase/GoTrue error messages to user-friendly Chinese messages.
 *
 * ✅ 允许：纯字符串映射
 * ❌ 禁止：副作用 / 依赖外部状态
 */
export function mapAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) return '邮箱或密码错误';
  if (lower.includes('user already registered')) return '该邮箱已注册';
  if (lower.includes('email not confirmed')) return '邮箱未验证，请查收验证邮件';
  if (lower.includes('password should be at least')) return '密码至少需要6个字符';
  if (lower.includes('unable to validate email address')) return '邮箱格式无效';
  if (lower.includes('anonymous sign-ins are disabled')) return '匿名登录已禁用';
  if (lower.includes('signups not allowed')) return '注册功能已关闭';
  if (lower.includes('email rate limit exceeded')) return '操作过于频繁，请稍后重试';
  if (lower.includes('only request this once every')) return '请求过于频繁，请稍等后重试';
  if (lower.includes('network') || lower.includes('fetch')) return '网络连接失败，请检查网络后重试';

  // 其他未匹配的英文错误信息，返回通用中文提示，避免用户看到原始英文
  if (/[a-z]/i.test(message) && !/[一-鿿]/.test(message)) {
    return '操作失败，请稍后重试';
  }

  return message;
}
