import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  AiOutputValidationError,
  AiProviderError,
  getAiDiagnostic,
  parseAiOutput,
  readAiJson,
} from '../aiError';
import { requestGemini } from '../geminiRequest';
import { requestStructuredOutput } from '../structuredOutput';

const reportError = vi.fn();
const reportWarning = vi.fn();

const context = {
  game: 'drawguess',
  model: 'gemini-3.5-flash-lite',
  operation: 'generate',
  packId: 'pack-123',
} as const;
const options = {
  context,
  protocol: 'native',
  requestBytes: 123,
  apiKey: 'private-api-key',
  signal: new AbortController().signal,
  privateValues: ['private-api-key', 'private-candidate'],
  parseResponse: (response: Response) => response.json(),
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(reportError);
  vi.spyOn(console, 'warn').mockImplementation(reportWarning);
});
afterEach(() => vi.restoreAllMocks());

describe('Gemini attempt diagnostics', () => {
  it.each([
    { status: 401, failureKind: 'authenticationFailed' },
    { status: 403, failureKind: 'authenticationFailed' },
    { status: 429, failureKind: 'rateLimited' },
    { status: 503, failureKind: 'serviceUnavailable' },
    { status: 400, failureKind: 'requestFailed' },
  ])('classifies HTTP $status without guessing or retrying', async ({ status, failureKind }) => {
    const request = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            status: 'PROVIDER_STATUS',
            message: 'Unavailable private-api-key private-candidate',
            unknown: 'do-not-log-this',
          },
        },
        { status },
      ),
    );
    const failure = requestGemini({ ...options, request });
    await expect(failure).rejects.toMatchObject({
      diagnostic: { ...context, stage: 'http', httpStatus: status, failureKind, attempt: 1 },
    });
    await expect(failure).rejects.not.toThrow('private-api-key');
    await expect(failure).rejects.not.toThrow('private-candidate');
    await expect(failure).rejects.not.toThrow('do-not-log-this');
    expect(request).toHaveBeenCalledOnce();
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('fails fast on missing configuration without making a request', async () => {
    const request = vi.fn();
    await expect(requestGemini({ ...options, apiKey: '', request })).rejects.toMatchObject({
      diagnostic: { failureKind: 'configuration', stage: 'request' },
    });
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    { protocol: 'native', wrapped: false, code: 503, status: 'UNAVAILABLE', type: undefined },
    {
      protocol: 'openaiCompatible',
      wrapped: false,
      code: 'server_error',
      status: undefined,
      type: 'server_error',
    },
    {
      protocol: 'openaiCompatible',
      wrapped: true,
      code: 503,
      status: 'UNAVAILABLE',
      type: undefined,
    },
  ] as const)(
    'preserves safe $protocol error fields (array envelope: $wrapped) across serialization',
    async ({ protocol, wrapped, code, status, type }) => {
      const error = {
        code,
        status,
        type,
        message: `Overloaded private-api-key private-candidate Bearer credential ${'x'.repeat(600)}`,
        debugInfo: 'private-model-output',
      };
      const envelope = { error };
      const request = vi.fn().mockResolvedValue(
        Response.json(wrapped ? [envelope] : envelope, {
          status: 503,
          headers: { 'x-request-id': 'provider-request', 'retry-after': '30' },
        }),
      );
      let diagnostic: ReturnType<typeof getAiDiagnostic>;
      try {
        await requestGemini({ ...options, protocol, request });
      } catch (failure) {
        expect(failure).toBeInstanceOf(AiProviderError);
        diagnostic = getAiDiagnostic(new Error(String(failure)));
      }
      expect(diagnostic).toMatchObject({
        protocol,
        stage: 'http',
        httpStatus: 503,
        failureKind: 'serviceUnavailable',
        providerCode: code,
        providerRequestId: 'provider-request',
        retryAfter: '30',
        responseContentType: 'application/json',
      });
      expect(diagnostic?.providerStatus).toBe(status);
      expect(diagnostic?.providerType).toBe(type);
      expect(diagnostic?.providerMessage).toHaveLength(500);
      const serialized = JSON.stringify(diagnostic);
      for (const secret of [
        'private-api-key',
        'private-candidate',
        'credential',
        'private-model-output',
      ])
        expect(serialized).not.toContain(secret);
      expect(request).toHaveBeenCalledOnce();
      expect(reportError).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { body: { error: ['private-model-output'] }, shape: 'object.error:array' },
    {
      body: [{ secret: 'private-model-output' }, { error: { message: 'do not select one' } }],
      shape: 'array',
    },
    { body: 'private-model-output', shape: 'string' },
  ])(
    'retains only structural evidence for an unknown error shape: $shape',
    async ({ body, shape }) => {
      const request = vi.fn().mockResolvedValue(Response.json(body, { status: 503 }));
      const failure = requestGemini({ ...options, request });
      await expect(failure).rejects.toMatchObject({
        diagnostic: { httpStatus: 503, errorBody: 'unrecognized', errorBodyShape: shape },
      });
      await expect(failure).rejects.not.toThrow('private-model-output');
      await expect(failure).rejects.not.toThrow('do not select one');
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it.each(['http', 'responseEnvelope'] as const)(
    'persists request metrics and protocol for %s failures, including adapter parser errors',
    async (stage) => {
      const request = vi
        .fn()
        .mockResolvedValue(
          Response.json(
            { error: { message: 'Unavailable private-api-key' } },
            { status: stage === 'http' ? 503 : 200 },
          ),
        );
      vi.spyOn(performance, 'now').mockReturnValueOnce(100).mockReturnValue(137);
      const failure = requestGemini({
        ...options,
        protocol: 'openaiCompatible',
        request,
        parseResponse: async () =>
          parseAiOutput(context, 'responseEnvelope', () =>
            z.strictObject({ count: z.number() }).parse({ count: 'private-model-output' }),
          ),
      });
      let diagnostic: ReturnType<typeof getAiDiagnostic>;
      try {
        await failure;
      } catch (error) {
        expect(error).toBeInstanceOf(AiProviderError);
        diagnostic = getAiDiagnostic(new Error(String(error)));
      }
      expect(diagnostic).toMatchObject({
        ...context,
        stage,
        protocol: 'openaiCompatible',
        requestBytes: 123,
        durationMs: 37,
      });
      expect(JSON.stringify(diagnostic)).not.toContain('private-model-output');
      expect(reportError).toHaveBeenCalledOnce();
      expect(request).toHaveBeenCalledOnce();
    },
  );

  it.each([
    { reason: new DOMException('private reason', 'TimeoutError'), failureKind: 'timedOut' },
    { reason: new DOMException('private reason', 'AbortError'), failureKind: 'cancelled' },
  ])('distinguishes $failureKind from transport failure', async ({ reason, failureKind }) => {
    const controller = new AbortController();
    controller.abort(reason);
    const failure = requestGemini({
      ...options,
      signal: controller.signal,
      request: () => Promise.reject(new DOMException('private-api-key', 'AbortError')),
    });
    await expect(failure).rejects.toMatchObject({
      diagnostic: { failureKind, stage: 'request' },
    });
    await expect(failure).rejects.not.toThrow('private');
  });

  it('retains a bounded, redacted network reason without attaching the raw cause', async () => {
    const failure = requestGemini({
      ...options,
      request: () =>
        Promise.reject(
          new TypeError('fetch failed Bearer private-api-key https://host/key/private-api-key'),
        ),
    });
    await expect(failure).rejects.toMatchObject({
      diagnostic: {
        stage: 'request',
        failureKind: 'requestFailed',
        transportMessage: 'fetch failed Bearer [REDACTED] [URL]',
      },
    });
    await expect(failure).rejects.not.toHaveProperty('cause');
  });

  it('does not reclassify unexpected request or parser exceptions', async () => {
    const unexpected = new Error('programming failure');
    await expect(
      requestGemini({ ...options, request: () => Promise.reject(unexpected) }),
    ).rejects.toBe(unexpected);
    const parserBug = new TypeError('internal bug');
    expect(() =>
      parseAiOutput(context, 'outputValidation', () => {
        throw parserBug;
      }),
    ).toThrow(parserBug);
    const invalidState = new DOMException('programming failure', 'InvalidStateError');
    await expect(
      requestGemini({ ...options, request: () => Promise.reject(invalidState) }),
    ).rejects.toBe(invalidState);
    expect(reportError).not.toHaveBeenCalled();
  });

  it('does not report request serialization bugs as network failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(
      requestStructuredOutput({
        apiKey: options.apiKey,
        model: context.model,
        context,
        systemPrompt: 'instructions',
        payload: { unsupported: 1n },
        schema: z.strictObject({ count: z.number() }),
        fetchImpl,
      }),
    ).rejects.toBeInstanceOf(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('distinguishes interrupted JSON body reads from malformed JSON', async () => {
    const controller = new AbortController();
    const response = new Response(
      new ReadableStream({
        start(stream) {
          controller.abort(new DOMException('deadline', 'TimeoutError'));
          stream.error(new TypeError('private-api-key'));
        },
      }),
    );
    const failure = requestGemini({
      ...options,
      signal: controller.signal,
      request: () => Promise.resolve(response),
      parseResponse: (body) => readAiJson(context, body, controller.signal, options.privateValues),
    });
    await expect(failure).rejects.toMatchObject({
      diagnostic: { stage: 'responseJson', failureKind: 'timedOut' },
    });
  });

  it('reports retryable attempts once as warnings and final failures once as errors', async () => {
    for (const attempt of [1, 2]) {
      await expect(
        requestGemini({
          ...options,
          context: { ...context, attempt },
          request: () => Promise.resolve(new Response(null, { status: 503 })),
          shouldRetry: (status) => status === 503 && attempt === 1,
        }),
      ).rejects.toBeInstanceOf(AiProviderError);
    }
    expect(reportWarning).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('"attempt":1'));
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('"attempt":2'));
  });

  it('recovers a safe diagnostic after Error serialization, not from prose or custom fields', () => {
    const original = new AiProviderError(context, 'http', 'serviceUnavailable', {
      httpStatus: 503,
      providerMessage: 'Model overloaded',
    });
    const persisted = new Error(original.message);
    expect(getAiDiagnostic(persisted)).toEqual(original.diagnostic);
    expect(getAiDiagnostic(new Error('[rateLimited] arbitrary prose'))).toBeUndefined();
    expect(getAiDiagnostic(new Error('{"failureKind":"rateLimited"}'))).toBeUndefined();
  });
});

describe('Native structured-output parsing', () => {
  it.each([new Error('program bug'), new TypeError('program bug'), new SyntaxError('program bug')])(
    'does not classify a generation decoder programming exception as invalid model output: %s',
    async (error) => {
      const failure = requestStructuredOutput({
        apiKey: options.apiKey,
        model: context.model,
        context,
        systemPrompt: 'instructions',
        payload: {},
        schema: z.strictObject({ count: z.number() }),
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({
            candidates: [
              { finishReason: 'STOP', content: { parts: [{ text: '{"count":"wrong"}' }] } },
            ],
          }),
        ),
        parseOutput: () => {
          throw error;
        },
      });
      await expect(failure).rejects.toBe(error);
      expect(reportError).not.toHaveBeenCalled();
    },
  );

  it.each([
    { response: () => new Response('not json'), stage: 'responseJson' },
    { response: () => Response.json({ candidates: [] }), stage: 'responseEnvelope' },
    {
      response: () =>
        Response.json({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }],
        }),
      stage: 'contentJson',
    },
    {
      response: () =>
        Response.json({
          candidates: [
            {
              finishReason: 'STOP',
              content: { parts: [{ text: '{"count":"private-model-output"}' }] },
            },
          ],
        }),
      stage: 'outputValidation',
    },
  ])('reports $stage without logging response material', async ({ response, stage }) => {
    const failure = requestStructuredOutput({
      apiKey: options.apiKey,
      model: context.model,
      context,
      systemPrompt: 'private system instructions',
      payload: { word: 'private-candidate' },
      schema: z.strictObject({ count: z.number() }),
      fetchImpl: vi.fn<typeof fetch>().mockImplementation(async () => response()),
    });
    await expect(failure).rejects.toMatchObject({
      diagnostic: { stage, failureKind: 'invalidOutput' },
    });
    for (const privateText of ['private system', 'private-candidate', 'private-model-output'])
      await expect(failure).rejects.not.toThrow(privateText);
    expect(reportError).toHaveBeenCalledOnce();
  });

  it('reports a known domain rejection using only its stable validation code', async () => {
    const failure = requestStructuredOutput({
      apiKey: options.apiKey,
      model: context.model,
      context,
      systemPrompt: 'instructions',
      payload: {},
      schema: z.strictObject({ count: z.number() }),
      fetchImpl: vi.fn().mockResolvedValue(
        Response.json({
          candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"count":1}' }] } }],
        }),
      ),
      parseOutput: () => {
        throw new AiOutputValidationError('reviewIdentityMismatch', 'private-model-output');
      },
    });
    await expect(failure).rejects.toMatchObject({
      diagnostic: { stage: 'outputValidation', validationCode: 'reviewIdentityMismatch' },
    });
    await expect(failure).rejects.not.toThrow('private-model-output');
  });
});
