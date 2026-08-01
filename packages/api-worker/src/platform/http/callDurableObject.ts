/** Translate Durable Object availability signals at the HTTP boundary. */

import { HTTPException } from 'hono/http-exception';

import { createLogger } from '../observability/logger';

const log = createLogger('durable-object');

function isRetryableError(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && 'retryable' in error && error.retryable === true
  );
}

function isOverloadedError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'overloaded' in error &&
    error.overloaded === true
  );
}

function readErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) return error.message;
  if (typeof error !== 'object' || error === null || !('message' in error)) return undefined;
  return typeof error.message === 'string' ? error.message : undefined;
}

/** Execute one Durable Object call and preserve non-availability failures unchanged. */
export async function callDurableObject<TResult>(call: () => Promise<TResult>): Promise<TResult> {
  try {
    return await call();
  } catch (error: unknown) {
    const message = readErrorMessage(error);
    if (isRetryableError(error)) {
      log.warn('retryable error', { message });
      throw new HTTPException(503, { message: 'SERVICE_UNAVAILABLE' });
    }
    if (isOverloadedError(error)) {
      log.warn('overloaded', { message });
      throw new HTTPException(429, { message: 'OVERLOADED' });
    }
    throw error;
  }
}
