/**
 * Werewolf AI chat routes — Gemini (primary) + Workers AI (fallback).
 *
 * Primary: Gemini API (OpenAI-compatible layer), fixed model gemini-3.1-flash-lite.
 * Fallback: geo block (400) / quota exhausted (429) / overload (503 after 1 retry)
 *       -> fall back to Workers AI Chat Completions (@cf/google/gemma-4-26b-a4b-it).
 * Workers AI has no geo restriction; 10K Neurons/day budget mainly serves users in restricted regions.
 *
 * @throws 401 — requireAuth failed
 * @throws 400 — zod validation failed
 * @returns 429 when both provider quotas are exhausted; 503 when both providers are unavailable.
 */

import { Hono } from 'hono';

import type { AppEnv } from '../../../env';
import { requireAuth } from '../../../features/auth/tokenAuth';
import { jsonBody } from '../../../platform/http/jsonBody';
import { readCloudflareRequestMetadata } from '../../../platform/http/requestMetadata';
import { createLogger } from '../../../platform/observability/logger';
import { werewolfAiChatRequestSchema } from './schema';

const log = createLogger('ai-chat');

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const MAX_TOKENS_CAP = 10240;
const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
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
  const writeUsage = (model: string, provider: 'gemini' | 'workers-ai', status: 'ok' | 'error') => {
    env.AI_USAGE.writeDataPoint({
      indexes: [userId],
      blobs: [userId, model, provider, country, status],
      doubles: [Date.now() - startTime],
    });
  };

  const messages = parsed.messages;
  const stream = parsed.stream ?? false;
  const temperature = parsed.temperature ?? 0.7;
  const maxTokens = parsed.max_tokens
    ? Math.min(parsed.max_tokens, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  // ── Primary: Gemini API (fixed model, retry once on 503) ─────────────────
  const geminiBody = JSON.stringify({
    messages,
    model: GEMINI_MODEL,
    stream,
    temperature,
    max_tokens: maxTokens,
  });

  const maxAttempts = 2; // 1 initial + 1 retry on 503
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const geminiResponse = await fetch(`${GEMINI_OPENAI_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        },
        body: geminiBody,
        signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      });

      if (geminiResponse.ok) {
        writeUsage(GEMINI_MODEL, 'gemini', 'ok');
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
      }

      const status = geminiResponse.status;

      // 503 overload — retry once
      if (status === 503 && attempt === 0) {
        log.info('Gemini 503, retrying once', { model: GEMINI_MODEL });
        continue;
      }

      // 400 (geo block) / 429 (quota) / other — fall through to Workers AI
      const errorText = await geminiResponse.text();
      log.info('Gemini failed, falling back to Workers AI', {
        model: GEMINI_MODEL,
        status,
        error: errorText.slice(0, 200),
      });
      break;
    } catch (error) {
      log.warn('Gemini request error, falling back to Workers AI', {
        model: GEMINI_MODEL,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
  }

  // ── Fallback: Workers AI ───────────────────────────────────────────────
  try {
    if (stream) {
      const aiStream = await env.AI.run(WORKERS_AI_MODEL, {
        messages,
        stream: true,
        temperature,
        max_tokens: maxTokens,
      });
      writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'ok');
      return new Response(aiStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const aiResponse = await env.AI.run(WORKERS_AI_MODEL, {
      messages,
      stream: false,
      temperature,
      max_tokens: maxTokens,
    });
    writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'ok');
    return Response.json(aiResponse);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isNeuronsExhausted = /exceeded|neurons|rate limit|too many/i.test(errMsg);
    if (isNeuronsExhausted) {
      writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'error');
      return c.json({ success: false, reason: 'QUOTA_EXHAUSTED' }, 429);
    }
    log.error('Workers AI unexpected error', { error: errMsg });
    writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'error');
    return c.json({ success: false, reason: 'AI_UNAVAILABLE' }, 503);
  }
});
