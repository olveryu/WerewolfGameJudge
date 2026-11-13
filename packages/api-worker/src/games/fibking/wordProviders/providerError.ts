/** Classified failures at the Fib word-provider boundary. */
import { z } from 'zod';

import { readErrorDiagnostic } from '../../../platform/observability/errorDiagnostic';

const failureSchema = z.strictObject({
  failureKind: z.enum([
    'timedOut',
    'authenticationFailed',
    'rateLimited',
    'serviceUnavailable',
    'invalidOutput',
    'requestFailed',
  ]),
  detail: z.string(),
});
export type FibWordProviderFailureKind = z.output<typeof failureSchema>['failureKind'];

/** Non-model provider failure, retaining its classification across Workflow serialization. */
export class FibWordProviderError extends Error {
  readonly failureKind: FibWordProviderFailureKind;

  constructor(message: string, failureKind: FibWordProviderFailureKind, options?: ErrorOptions) {
    super(JSON.stringify({ failureKind, detail: `[${failureKind}] ${message}` }), options);
    this.name = 'FibWordProviderError';
    this.failureKind = failureKind;
  }
}

/** Read the explicit non-model failure contract, not a kind guessed from prose. */
export function getFibWordProviderFailureKind(
  error: unknown,
): FibWordProviderFailureKind | undefined {
  if (error instanceof FibWordProviderError) return error.failureKind;
  return readErrorDiagnostic(error, failureSchema, 'FibWordProviderError')?.failureKind;
}

/** Remove request credentials before exposing provider diagnostics to persisted logs. */
function redactProviderError(message: string, apiKey: string): string {
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
