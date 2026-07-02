/**
 * logger - Unified logging module using react-native-logs
 *
 * Unified logging entry for the whole project; provides named logger instances, supports creating named loggers and configuring transport/severity.
 *
 * Usage:
 *   import { log } from '@/utils/logger';
 *   log.info('Seat action', { seat: 1 });
 *
 * Or with extensions:
 *   const myLog = log.extend('MyModule');
 *   myLog.info('Seat action', { seat: 1 });
 *
 * Does not import React, services, or game state.
 */

import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import { consoleTransport, logger } from 'react-native-logs';
import { UAParser } from 'ua-parser-js';

import { mobileDebugTransport } from './mobileDebug';

/**
 * Detect browser name via ua-parser-js.
 *
 * Workaround: Sentry SDK 10.37 stopped auto-attaching browser.name to Structured Logs
 * after a server-side envelope format change (getsentry/sentry-javascript#20453).
 * TODO: Remove once we upgrade to the SDK version that includes the fix.
 */
function detectBrowserName(): string | undefined {
  if (Platform.OS !== 'web') return undefined;
  const { browser } = UAParser(navigator.userAgent);
  return browser.name;
}

// Cache once at module load — UA doesn't change during a session
const BROWSER_NAME = detectBrowserName();

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
  if (BROWSER_NAME) {
    attrs['browser.name'] = BROWSER_NAME;
  }
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

/** Global root logger instance; all named loggers derive via `log.extend('Module')`. */
export const log = logger.createLogger(config);

// Pre-configured extensions for common modules
/** Realtime/WebSocket layer log */
export const realtimeLog = log.extend('Realtime');
/** Audio playback log */
export const audioLog = log.extend('Audio');
/** Auth flow log */
export const authLog = log.extend('Auth');
/** Room management log */
export const roomLog = log.extend('Room');
/** GameRoom hook log */
export const gameRoomLog = log.extend('GameRoom');
/** WebSocket connection lifecycle log */
export const connectionLog = log.extend('Connection');
/** Config loading log */
export const configLog = log.extend('Config');
/** RoomScreen log */
export const roomScreenLog = log.extend('RoomScreen');
/** HomeScreen log */
export const homeLog = log.extend('Home');
/** Room facade log */
export const facadeLog = log.extend('Facade');
/** Settings page log */
export const settingsLog = log.extend('Settings');
/** SettingsService log */
export const settingsServiceLog = log.extend('SettingsService');
/** BGM playback log */
export const bgmLog = log.extend('BGM');
/** AI Chat log */
export const chatLog = log.extend('Chat');
/** cfFetch network layer log */
export const cfFetchLog = log.extend('cfFetch');
/** Stats / personal data log */
export const statsLog = log.extend('Stats');
/** Share feature log */
export const shareLog = log.extend('Share');
/** Gacha system log */
export const gachaLog = log.extend('Gacha');
