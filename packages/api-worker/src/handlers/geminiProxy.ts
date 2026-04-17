/**
 * AI Chat Hono routes — Gemini (primary) + Workers AI (fallback)
 *
 * 主力：Gemini API（OpenAI 兼容层），质量更高。
 * 降级：Gemini 地理限制（400 "User location is not supported"）或
 *       rate limit（429）时 fallback 到 Workers AI（@cf/google/gemma-3-12b-it）。
 * Workers AI 无地理限制，10K Neurons/天预算主要服务受限地区用户。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { geminiProxySchema } from '../schemas/gemini';
import { jsonBody } from './shared';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const MAX_TOKENS_CAP = 4096;
const WORKERS_AI_MODEL = '@cf/google/gemma-3-12b-it';

export const geminiRoutes = new Hono<AppEnv>();

geminiRoutes.post('/', requireAuth, jsonBody(geminiProxySchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');

  const messages = parsed.messages;
  const stream = parsed.stream ?? false;
  const temperature = parsed.temperature ?? 0.7;
  const maxTokens = parsed.max_tokens
    ? Math.min(parsed.max_tokens, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  // ── Primary: Gemini API ────────────────────────────────────────────────
  if (env.GEMINI_API_KEY) {
    try {
      const geminiBody = {
        messages,
        model: 'gemini-2.0-flash-lite',
        stream,
        temperature,
        max_tokens: maxTokens,
      };

      const geminiResponse = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.GEMINI_API_KEY}`,
        },
        body: JSON.stringify(geminiBody),
      });

      // Geo-restriction or rate limit → fall through to Workers AI
      if (geminiResponse.status === 429) {
        console.info('[ai-chat] Gemini rate limited, falling back to Workers AI');
      } else if (geminiResponse.status === 400) {
        const errorText = await geminiResponse.text();
        if (errorText.includes('User location is not supported')) {
          console.info('[ai-chat] Gemini geo-restricted, falling back to Workers AI');
        } else {
          return c.json({ error: 'ai_unavailable' }, 400);
        }
      } else if (stream) {
        return new Response(geminiResponse.body, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          status: geminiResponse.status,
        });
      } else {
        const data = await geminiResponse.json();
        return c.json(data, geminiResponse.status as 200);
      }
    } catch (error) {
      console.error('[ai-chat] Gemini error, falling back to Workers AI:', error);
    }
  }

  // ── Fallback: Workers AI ───────────────────────────────────────────────
  try {
    const aiResponse = await env.AI.run(WORKERS_AI_MODEL, {
      messages,
      stream,
      temperature,
      max_tokens: maxTokens,
    });

    if (stream) {
      return new Response(aiResponse as unknown as ReadableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
      });
    }
    return Response.json(aiResponse);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const isNeuronsExhausted = /exceeded|neurons|rate limit|too many/i.test(errMsg);
    if (isNeuronsExhausted) {
      return c.json({ error: 'quota_exhausted' }, 429);
    }
    console.error('[ai-chat] Workers AI unexpected error:', errMsg);
    return c.json({ error: 'ai_unavailable' }, 503);
  }
});
