/**
 * mobileDebug - Mobile Debug Panel facade
 *
 * Thin facade over debugLogStore. Retains the same public API surface
 * (log/warn/error/debug/show/hide/toggle/clear/isVisible) so all existing
 * callers continue to work without changes.
 *
 * DOM rendering is removed — the React-based DebugPanel component subscribes
 * to debugLogStore directly via useSyncExternalStore.
 *
 * Usage:
 *   import { mobileDebug } from '@/utils/mobileDebug';
 *   mobileDebug.log('message');
 *   mobileDebug.show();
 *   mobileDebug.hide();
 */

import { Platform } from 'react-native';

import { type DebugLogEntry, debugLogStore } from './debugLogStore';

/**
 * react-native-logs transport that forwards all logger output to the debug log store.
 * This allows every logger extension (Audio, Host, NightFlow, etc.) to appear in the
 * on-screen debug panel automatically, without manual mobileDebug.log() calls.
 *
 * Skips console output because consoleTransport already handles that.
 */
export const mobileDebugTransport = (props: {
  msg: string;
  rawMsg: unknown;
  level: { severity: number; text: string };
  extension?: string | null;
}): void => {
  if (Platform.OS !== 'web') return;

  const levelMap: Record<string, DebugLogEntry['level']> = {
    debug: 'debug',
    info: 'log',
    warn: 'warn',
    error: 'error',
  };
  const level = levelMap[props.level.text] ?? 'log';
  const prefix = props.extension ? `[${props.extension}] ` : '';
  const message = `${prefix}${props.msg}`;

  debugLogStore.addLog(message, level);
};

export const mobileDebug = {
  log: (message: string) => {
    if (Platform.OS !== 'web') return;
    debugLogStore.addLog(message, 'log');
  },

  warn: (message: string) => {
    if (Platform.OS !== 'web') return;
    debugLogStore.addLog(message, 'warn');
  },

  error: (message: string) => {
    if (Platform.OS !== 'web') return;
    debugLogStore.addLog(message, 'error');
  },

  debug: (message: string) => {
    if (Platform.OS !== 'web') return;
    debugLogStore.addLog(message, 'debug');
  },

  show: () => {
    if (Platform.OS !== 'web') return;
    debugLogStore.setVisible(true);
  },

  hide: () => {
    if (Platform.OS !== 'web') return;
    debugLogStore.setVisible(false);
  },

  toggle: () => {
    if (debugLogStore.getVisible()) {
      mobileDebug.hide();
    } else {
      mobileDebug.show();
    }
  },

  clear: () => {
    debugLogStore.clear();
  },

  isVisible: () => debugLogStore.getVisible(),
};
