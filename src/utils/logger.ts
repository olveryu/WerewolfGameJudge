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
