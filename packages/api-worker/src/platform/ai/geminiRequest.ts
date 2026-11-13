/** Single-attempt Gemini boundary. Protocol-specific success parsing stays with each adapter. */
import { z } from 'zod';

import {
  type AiContext,
  type AiDiagnostic,
  AiProviderError,
  createAiTransportError,
  redactAiDiagnostic,
  reportAiFailure,
} from './aiError';

const ERROR_BODY_BYTE_LIMIT = 16_384;
const recordSchema = z.record(z.string(), z.unknown());

async function readErrorBody(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (reader === undefined) throw new Error('emptyBody');
  const decoder = new TextDecoder();
  let bytes = 0;
  let body = '';
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      const value: unknown = result.value;
      if (!(value instanceof Uint8Array)) throw new Error('invalidBodyChunk');
      bytes += value.byteLength;
      if (bytes > ERROR_BODY_BYTE_LIMIT) throw new Error('bodyTooLarge');
      body += decoder.decode(value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } finally {
    // A broken stream must not replace the primary HTTP failure.
    try {
      await reader.cancel();
    } finally {
      reader.releaseLock();
    }
  }
}

async function describeHttpFailure(
  response: Response,
  privateValues: unknown,
): Promise<Partial<AiDiagnostic>> {
  const diagnostics: Partial<AiDiagnostic> = {};
  const safe = (value: string) => redactAiDiagnostic(value, privateValues);
  const retryAfter = response.headers.get('retry-after');
  const requestId =
    response.headers.get('x-goog-request-id') ?? response.headers.get('x-request-id');
  if (retryAfter !== null) diagnostics.retryAfter = safe(retryAfter);
  if (requestId !== null) diagnostics.providerRequestId = safe(requestId);
  try {
    const body = recordSchema.safeParse(await readErrorBody(response));
    const error = recordSchema.safeParse(body.success ? body.data.error : undefined);
    if (!error.success) {
      diagnostics.errorBody = 'unrecognized';
      return diagnostics;
    }
    if (typeof error.data.status === 'string') diagnostics.providerStatus = safe(error.data.status);
    if (typeof error.data.message === 'string')
      diagnostics.providerMessage = safe(error.data.message);
    const details = Array.isArray(error.data.details) ? error.data.details : [];
    const quotas: string[] = [];
    for (const item of details.slice(0, 8)) {
      const detail = recordSchema.safeParse(item);
      if (!detail.success) continue;
      if (
        detail.data['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
        typeof detail.data.retryDelay === 'string'
      )
        diagnostics.retryDelay = safe(detail.data.retryDelay);
      if (
        detail.data['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' &&
        Array.isArray(detail.data.violations)
      ) {
        for (const item of detail.data.violations.slice(0, 4)) {
          const violation = recordSchema.safeParse(item);
          if (!violation.success) continue;
          for (const name of ['quotaMetric', 'quotaId', 'quotaValue']) {
            const value = violation.data[name];
            if (typeof value === 'string' && quotas.length < 12)
              quotas.push(`${name}=${safe(value)}`);
          }
        }
      }
    }
    if (quotas.length > 0) diagnostics.quota = quotas;
  } catch (error) {
    diagnostics.errorBody =
      error instanceof Error && error.message === 'bodyTooLarge' ? 'tooLarge' : 'unreadable';
  }
  return diagnostics;
}

/** Fetch and parse one model attempt; never retry or log raw requests, responses, or causes. */
export async function requestGemini<Output>(options: {
  readonly context: AiContext;
  readonly apiKey: string;
  readonly signal: AbortSignal;
  readonly privateValues: unknown;
  readonly request: () => Promise<Response>;
  readonly parseResponse: (response: Response) => Promise<Output>;
  readonly shouldRetry?: (status: number) => boolean;
}): Promise<Output> {
  const { context, signal } = options;
  try {
    if (options.apiKey.length === 0) throw new AiProviderError(context, 'request', 'configuration');
    let response: Response;
    try {
      response = await options.request();
    } catch (error) {
      throw createAiTransportError(context, signal, error, options.privateValues);
    }
    if (!response.ok) {
      const failureKind =
        response.status === 401 || response.status === 403
          ? 'authenticationFailed'
          : response.status === 429
            ? 'rateLimited'
            : response.status >= 500
              ? 'serviceUnavailable'
              : 'requestFailed';
      const details = await describeHttpFailure(response, options.privateValues);
      throw new AiProviderError(context, 'http', failureKind, {
        ...details,
        httpStatus: response.status,
      });
    }
    return await options.parseResponse(response);
  } catch (error) {
    if (error instanceof AiProviderError) {
      reportAiFailure(
        error,
        error.diagnostic.httpStatus !== undefined &&
          options.shouldRetry?.(error.diagnostic.httpStatus) === true,
      );
    }
    throw error;
  }
}
