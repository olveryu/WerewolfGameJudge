/** Classified failures at the Fib word-provider boundary. */

export type FibWordProviderFailureKind =
  | 'timedOut'
  | 'rateLimited'
  | 'serviceUnavailable'
  | 'invalidOutput'
  | 'requestFailed';

export class FibWordProviderError extends Error {
  readonly failureKind: FibWordProviderFailureKind;

  constructor(message: string, failureKind: FibWordProviderFailureKind, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FibWordProviderError';
    this.failureKind = failureKind;
  }
}

export function isFibWordProviderFallbackEligible(error: FibWordProviderError): boolean {
  return (
    error.failureKind === 'timedOut' ||
    error.failureKind === 'rateLimited' ||
    error.failureKind === 'serviceUnavailable' ||
    error.failureKind === 'invalidOutput'
  );
}

export function createFibWordProviderRequestError(
  providerName: string,
  signal: AbortSignal,
  cause: unknown,
): FibWordProviderError {
  return signal.aborted
    ? new FibWordProviderError(`${providerName} Fib word request timed out`, 'timedOut', { cause })
    : new FibWordProviderError(`${providerName} Fib word request failed`, 'requestFailed', {
        cause,
      });
}
