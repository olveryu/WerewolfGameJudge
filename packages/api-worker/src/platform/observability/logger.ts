/**
 * logger — Structured JSON logger for Cloudflare Workers
 *
 * Workers Logs automatically indexes JSON fields for filtering/querying.
 * Each module creates a named logger via `createLogger('module')`.
 *
 * Output format: { level, module, msg, ...ctx }
 * Workers Logs parses this and makes `module`, `msg`, and all ctx fields queryable.
 *
 * error() additionally reports to Sentry (via @sentry/cloudflare which hooks
 * into the current execution context set up by withSentry in index.ts).
 *
 * @see https://developers.cloudflare.com/workers/observability/logs/workers-logs/#logging-structured-json-objects
 */

import * as Sentry from '@sentry/cloudflare';

type LogContext = Record<string, unknown>;

interface WorkerLogger {
  debug(msg: string, ctx?: LogContext): void;
  info(msg: string, ctx?: LogContext): void;
  warn(msg: string, ctx?: LogContext): void;
  error(msg: string, ctx?: LogContext): void;
}

export function createLogger(module: string): WorkerLogger {
  return {
    debug(msg, ctx) {
      console.debug(JSON.stringify({ level: 'debug', module, msg, ...ctx }));
    },
    info(msg, ctx) {
      console.info(JSON.stringify({ level: 'info', module, msg, ...ctx }));
    },
    warn(msg, ctx) {
      console.warn(JSON.stringify({ level: 'warn', module, msg, ...ctx }));
    },
    error(msg, ctx) {
      console.error(JSON.stringify({ level: 'error', module, msg, ...ctx }));
      Sentry.captureException(ctx?.error ?? new Error(msg), {
        tags: { module },
        extra: ctx,
      });
    },
  };
}
