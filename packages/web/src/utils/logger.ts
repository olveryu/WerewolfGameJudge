/**
 * Named loggers for the web client.
 *
 * Every entry goes to the on-screen debug panel. The console receives everything in
 * development and warn+ in production; production also forwards info+ to Sentry Structured
 * Logs with the module name and any plain-object details as attributes.
 *
 * Usage: `apiLog.warn('request failed', { status })`.
 */
import { logger as sentryLogger } from '@sentry/react';

import { type DebugLogEntry, debugLogStore } from '@/utils/debugLogStore';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SEVERITY: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const DEBUG_PANEL_LEVEL: Record<LogLevel, DebugLogEntry['level']> = {
  debug: 'debug',
  info: 'log',
  warn: 'warn',
  error: 'error',
};
const CONSOLE_MIN_SEVERITY = import.meta.env.DEV ? SEVERITY.debug : SEVERITY.warn;

/** A module-scoped logger. */
export interface Logger {
  debug(message: string, ...details: unknown[]): void;
  info(message: string, ...details: unknown[]): void;
  warn(message: string, ...details: unknown[]): void;
  error(message: string, ...details: unknown[]): void;
}

function isAttributes(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    !(value instanceof Error)
  );
}

function describe(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`;
  if (typeof detail === 'string') return detail;
  return JSON.stringify(detail);
}

function write(module: string, level: LogLevel, message: string, details: unknown[]): void {
  const line = `[${module}] ${message}`;
  debugLogStore.addLog([line, ...details.map(describe)].join(' '), DEBUG_PANEL_LEVEL[level]);
  if (SEVERITY[level] >= CONSOLE_MIN_SEVERITY) {
    console[level](line, ...details);
  }
  if (import.meta.env.PROD && SEVERITY[level] >= SEVERITY.info) {
    const attributes: Record<string, unknown> = { module };
    for (const detail of details) {
      if (isAttributes(detail)) Object.assign(attributes, detail);
    }
    sentryLogger[level](line, attributes);
  }
}

/** Creates a logger whose lines are prefixed with `[module]`. */
export function createLogger(module: string): Logger {
  return {
    debug: (message, ...details) => write(module, 'debug', message, details),
    info: (message, ...details) => write(module, 'info', message, details),
    warn: (message, ...details) => write(module, 'warn', message, details),
    error: (message, ...details) => write(module, 'error', message, details),
  };
}

/** HTTP API client. */
export const apiLog = createLogger('Api');
/** Auth flow. */
export const authLog = createLogger('Auth');
/** Home page. */
export const homeLog = createLogger('Home');
