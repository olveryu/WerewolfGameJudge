/** Safe diagnostics shared by Gemini's native and OpenAI-compatible protocols. */
import { z } from 'zod';

import { readErrorDiagnostic } from '../observability/errorDiagnostic';
import { createLogger } from '../observability/logger';

const log = createLogger('ai-provider');
const failureKindSchema = z.enum([
  'configuration',
  'timedOut',
  'cancelled',
  'requestFailed',
  'authenticationFailed',
  'rateLimited',
  'serviceUnavailable',
  'invalidOutput',
]);
const diagnosticSchema = z.strictObject({
  provider: z.literal('gemini'),
  game: z.string(),
  model: z.string(),
  operation: z.enum(['generate', 'review', 'classify', 'chat']).optional(),
  packId: z.string().optional(),
  workflowId: z.string().optional(),
  requestId: z.string().optional(),
  attempt: z.number().int().positive(),
  stage: z.enum([
    'request',
    'http',
    'responseJson',
    'responseEnvelope',
    'contentJson',
    'outputValidation',
  ]),
  failureKind: failureKindSchema,
  httpStatus: z.number().int().optional(),
  providerStatus: z.string().optional(),
  providerMessage: z.string().optional(),
  providerRequestId: z.string().optional(),
  retryAfter: z.string().optional(),
  retryDelay: z.string().optional(),
  quota: z.array(z.string()).optional(),
  errorBody: z.enum(['unrecognized', 'tooLarge', 'unreadable']).optional(),
  issueCodes: z.array(z.string()).optional(),
  validationCode: z.string().optional(),
  transportMessage: z.string().optional(),
});

export type AiFailureKind = z.output<typeof failureKindSchema>;
export type AiDiagnostic = z.output<typeof diagnosticSchema>;
export type AiContext = Required<Pick<AiDiagnostic, 'game' | 'model' | 'operation'>> &
  Partial<Pick<AiDiagnostic, 'packId' | 'workflowId' | 'requestId' | 'attempt'>>;
export type AiCorrelation = Pick<AiContext, 'packId' | 'workflowId' | 'requestId'>;

/** A known domain rejection of model output; only its stable code enters diagnostics. */
export class AiOutputValidationError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AiOutputValidationError';
  }
}

/** Contains only safe data; its JSON message survives Workflow Error serialization. */
export class AiProviderError extends Error {
  readonly diagnostic: AiDiagnostic;
  readonly failureKind: AiFailureKind;

  constructor(
    context: Omit<AiContext, 'operation'> & Partial<Pick<AiContext, 'operation'>>,
    stage: AiDiagnostic['stage'],
    failureKind: AiFailureKind,
    details: Partial<
      Omit<AiDiagnostic, keyof AiContext | 'provider' | 'stage' | 'failureKind'>
    > = {},
  ) {
    const diagnostic: AiDiagnostic = {
      ...context,
      provider: 'gemini',
      attempt: context.attempt ?? 1,
      stage,
      failureKind,
      ...details,
    };
    super(JSON.stringify(diagnostic));
    this.name = 'AiProviderError';
    this.diagnostic = diagnostic;
    this.failureKind = failureKind;
  }
}

/** Recover the validated diagnostic, not custom Error fields, after a durable step failed. */
export function getAiDiagnostic(error: unknown): AiDiagnostic | undefined {
  if (error instanceof AiProviderError) return error.diagnostic;
  return readErrorDiagnostic(error, diagnosticSchema, 'AiProviderError');
}

/** Remove secrets and request strings before any provider-controlled text is logged. */
export function redactAiDiagnostic(value: string, privateValues: unknown): string {
  const strings = new Set<string>();
  const collect = (item: unknown): void => {
    if (typeof item === 'string' && item.length > 0) {
      strings.add(item);
      for (const fragment of item.split(/[\s，。！？；：、,.!?;:]+/u))
        if (fragment.length >= 3) strings.add(fragment);
    } else if (Array.isArray(item)) item.forEach(collect);
    else if (item !== null && typeof item === 'object') Object.values(item).forEach(collect);
  };
  collect(privateValues);
  let redacted = value
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/https?:\/\/[^\s"']+/gi, '[URL]');
  for (const privateString of [...strings].sort((a, b) => b.length - a.length))
    redacted = redacted.replaceAll(privateString, '[REDACTED]');
  return redacted.replace(/[\r\n\t]/g, ' ').slice(0, 500);
}

/** Report each failed model attempt at its request boundary, before Workflow serialization. */
export function reportAiFailure(error: AiProviderError, retrying = false): void {
  if (retrying) log.warn('AI attempt failed; retrying', { ...error.diagnostic });
  else log.error('AI operation failed', { ...error.diagnostic, error });
}

/** Classify fetch/body transport errors without disguising unexpected programming exceptions. */
export function createAiTransportError(
  context: AiContext,
  signal: AbortSignal,
  error: unknown,
  privateValues: unknown,
  stage: AiDiagnostic['stage'] = 'request',
): AiProviderError {
  if (signal.aborted) {
    return new AiProviderError(
      context,
      stage,
      signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
        ? 'timedOut'
        : 'cancelled',
    );
  }
  if (error instanceof DOMException) {
    if (error.name === 'TimeoutError') return new AiProviderError(context, stage, 'timedOut');
    if (error.name === 'AbortError') return new AiProviderError(context, stage, 'cancelled');
    if (error.name !== 'NetworkError') throw error;
  } else if (!(error instanceof TypeError)) throw error;
  return new AiProviderError(context, stage, 'requestFailed', {
    transportMessage: redactAiDiagnostic(error.message, privateValues),
  });
}

/** Parse model-controlled output without including Zod inputs or domain error messages. */
export function parseAiOutput<Output>(
  context: AiContext,
  stage: 'responseEnvelope' | 'contentJson' | 'outputValidation',
  parse: () => Output,
): Output {
  try {
    return parse();
  } catch (error) {
    if (
      !(error instanceof z.ZodError) &&
      !(error instanceof SyntaxError) &&
      !(error instanceof AiOutputValidationError)
    )
      throw error;
    throw new AiProviderError(context, stage, 'invalidOutput', {
      ...(error instanceof z.ZodError
        ? { issueCodes: [...new Set(error.issues.map((issue) => issue.code))].slice(0, 12) }
        : {}),
      ...(error instanceof AiOutputValidationError ? { validationCode: error.code } : {}),
    });
  }
}

/** Decode the response JSON, distinguishing interrupted reads from invalid JSON. */
export async function readAiJson(
  context: AiContext,
  response: Response,
  signal: AbortSignal,
  privateValues: unknown,
): Promise<unknown> {
  try {
    return await response.json();
  } catch (error) {
    if (error instanceof SyntaxError && !signal.aborted)
      throw new AiProviderError(context, 'responseJson', 'invalidOutput');
    throw createAiTransportError(context, signal, error, privateValues, 'responseJson');
  }
}
