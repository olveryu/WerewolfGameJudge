/** Classified failures at the Fib word-provider boundary. */

export type FibWordProviderFailureKind =
  | 'timedOut'
  | 'authenticationFailed'
  | 'rateLimited'
  | 'serviceUnavailable'
  | 'invalidOutput'
  | 'requestFailed';

export class FibWordProviderError extends Error {
  readonly failureKind: FibWordProviderFailureKind;

  constructor(message: string, failureKind: FibWordProviderFailureKind, options?: ErrorOptions) {
    super(`[${failureKind}] ${message}`, options);
    this.name = 'FibWordProviderError';
    this.failureKind = failureKind;
  }
}

/** Remove request credentials before exposing provider diagnostics to persisted logs. */
export function redactProviderError(message: string, apiKey: string): string {
  return message
    .replaceAll(apiKey, '[REDACTED]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s"']+/gi, '[URL]')
    .slice(0, 500);
}

export function createFibWordProviderRequestError(
  providerName: string,
  signal: AbortSignal,
  cause: unknown,
  apiKey: string,
): FibWordProviderError {
  const detail =
    cause instanceof Error ? redactProviderError(cause.message, apiKey) : 'Unknown transport error';
  return signal.aborted
    ? new FibWordProviderError(`${providerName} Fib word request timed out`, 'timedOut', { cause })
    : new FibWordProviderError(
        `${providerName} Fib word request failed: ${detail}`,
        'requestFailed',
        {
          cause,
        },
      );
}
