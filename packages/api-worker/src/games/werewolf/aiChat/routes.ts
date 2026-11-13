/**
 * Werewolf AI chat routes backed exclusively by Gemini.
 *
 * @throws 401 — requireAuth failed
 * @throws 400 — zod validation failed or Gemini rejected the request
 * @returns 429 when the Gemini quota is exhausted; 503 when Gemini is unavailable.
 */

import { Hono } from 'hono';

import type { AppEnv } from '../../../env';
import { requireAuth } from '../../../features/auth/tokenAuth';
import { AiProviderError } from '../../../platform/ai/aiError';
import { requestGemini } from '../../../platform/ai/geminiRequest';
import { jsonBody } from '../../../platform/http/jsonBody';
import { readCloudflareRequestMetadata } from '../../../platform/http/requestMetadata';
import { createLogger } from '../../../platform/observability/logger';
import { werewolfAiChatRequestSchema } from './schema';

const log = createLogger('ai-chat');

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-3.5-flash-lite';
const MAX_TOKENS_CAP = 10240;
const GEMINI_TIMEOUT_MS = 15_000;

/** Authenticated Werewolf AI chat routes. */
export const werewolfAiChatRoutes = new Hono<AppEnv>();

werewolfAiChatRoutes.post('/', requireAuth, jsonBody(werewolfAiChatRequestSchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');
  const startTime = Date.now();
  const userId = c.var.userId;
  const country = readCloudflareRequestMetadata(c.req.raw).country ?? 'unknown';

  /** Fire-and-forget: write one data point to AI_USAGE Analytics Engine. */
  const writeUsage = (status: 'ok' | 'error') => {
    env.AI_USAGE.writeDataPoint({
      indexes: [userId],
      blobs: [userId, GEMINI_MODEL, 'gemini', country, status],
      doubles: [Date.now() - startTime],
    });
  };

  const messages = parsed.messages;
  const stream = parsed.stream ?? false;
  const temperature = parsed.temperature ?? 0.7;
  const maxTokens = parsed.max_tokens
    ? Math.min(parsed.max_tokens, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  const geminiBody = JSON.stringify({
    messages,
    model: GEMINI_MODEL,
    stream,
    temperature,
    max_tokens: maxTokens,
  });

  const maxAttempts = 2; // 1 initial + 1 retry on 503
  const requestId = crypto.randomUUID();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const signal = AbortSignal.timeout(GEMINI_TIMEOUT_MS);
      const geminiResponse = await requestGemini({
        apiKey: env.GEMINI_API_KEY,
        protocol: 'openaiCompatible',
        requestBytes: new TextEncoder().encode(geminiBody).byteLength,
        context: {
          game: 'werewolf',
          model: GEMINI_MODEL,
          operation: 'chat',
          attempt: attempt + 1,
          requestId,
        },
        signal,
        privateValues: [env.GEMINI_API_KEY, messages],
        shouldRetry: (status) => status === 503 && attempt === 0,
        request: () =>
          fetch(`${GEMINI_OPENAI_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${env.GEMINI_API_KEY}`,
            },
            body: geminiBody,
            signal,
          }),
        // A 200 response starts forwarding; it does not attest that an SSE stream completed.
        parseResponse: (response) => Promise.resolve(response),
      });

      writeUsage('ok');
      if (stream) {
        return new Response(geminiResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
        });
      }
      return new Response(geminiResponse.body, {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const status = error instanceof AiProviderError ? error.diagnostic.httpStatus : undefined;
      if (status === 503 && attempt === 0) continue;
      writeUsage('error');
      if (status === 429) {
        return c.json({ success: false, reason: 'QUOTA_EXHAUSTED' }, 429);
      }
      if (status === undefined || status >= 500) {
        if (!(error instanceof AiProviderError))
          log.error('Unexpected Gemini request error', {
            model: GEMINI_MODEL,
            requestId,
            attempt: attempt + 1,
            errorType: error instanceof Error ? error.constructor.name : typeof error,
          });
        return c.json({ success: false, reason: 'AI_UNAVAILABLE' }, 503);
      }
      return c.json({ success: false, reason: 'GEMINI_REQUEST_REJECTED' }, 400);
    }
  }

  throw new Error('[FAIL-FAST] Gemini retry loop exited without a response');
});
