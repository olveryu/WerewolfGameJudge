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
import {
  consoleTransport,
  type ConsoleTransportOptions,
  logger,
  type transportFunctionType,
} from 'react-native-logs';
import { UAParser } from 'ua-parser-js';

import { debugLogTransport } from './debugLogTransport';

/**
 * Detect browser name via ua-parser-js.
 *
 * React Native Web envelopes do not provide browser.name to Structured Logs, so this
 * transport owns that attribute explicitly.
 */
function detectBrowserName(): string | undefined {
  if (Platform.OS !== 'web') return undefined;
  const { browser } = UAParser(navigator.userAgent);
  return browser.name;
}

// Cache once at module load — UA doesn't change during a session
const BROWSER_NAME = detectBrowserName();

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value);
}

function isStructuredAttributes(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

/**
 * Transport that forwards logs to Sentry Structured Logs (production only).
 *
 * Uses rawMsg (original arguments array) to extract structured attributes.
 * Sentry Structured Logs expect: Sentry.logger.info("message", { key: value })
 * react-native-logs passes rawMsg = [msg, ...rest] from log.info(msg, ...rest).
 */
const sentryTransport: transportFunctionType<ConsoleTransportOptions> = (props) => {
  const raw = isUnknownArray(props.rawMsg) ? props.rawMsg : [props.rawMsg];
  const rawFirstMsg = typeof raw[0] === 'string' ? raw[0] : props.msg;
  const module = props.extension ?? 'app';
  const firstMsg = `[${module}] ${rawFirstMsg}`;

  // Build structured attributes from remaining args + extension tag
  const attrs: Record<string, unknown> = { module };
  if (BROWSER_NAME) {
    attrs['browser.name'] = BROWSER_NAME;
  }
  for (let i = 1; i < raw.length; i++) {
    const arg = raw[i];
    if (isStructuredAttributes(arg)) {
      Object.assign(attrs, arg);
    }
  }

  const level = props.level.text;
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
 * quiet in production while debugLogTransport sees everything.
 */
const withMinSeverity = (
  minSeverity: number,
  inner: transportFunctionType<ConsoleTransportOptions>,
): transportFunctionType<ConsoleTransportOptions> => {
  return (props) => {
    if (props.level.severity >= minSeverity) {
      inner(props);
    }
  };
};

// severity levels: debug=0, info=1, warn=2, error=3
const WARN_SEVERITY = 2;

const config = {
  transport: [
    // In dev: console shows everything; in prod: console shows warn+ only
    __DEV__ ? consoleTransport : withMinSeverity(WARN_SEVERITY, consoleTransport),
    // Debug panel always receives all levels
    debugLogTransport,
    // Production: forward all levels to Sentry Structured Logs
    ...(__DEV__ ? [] : [sentryTransport]),
  ],
  // Global minimum = debug so debugLogTransport can receive everything
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
/** Shared room session and command lifecycle log */
export const roomSessionLog = log.extend('RoomSession');
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
/** Werewolf runtime command and audio orchestration log */
export const werewolfRuntimeLog = log.extend('WerewolfRuntime');
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
