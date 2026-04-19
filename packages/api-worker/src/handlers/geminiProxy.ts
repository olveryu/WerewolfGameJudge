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

/**
 * 将 Workers AI SSE 流（`{"response":"..."}` 格式）转换为 OpenAI 兼容格式
 * （`{"choices":[{"delta":{"content":"..."}}]}`），客户端解析器只认后者。
 */
function toOpenAIStream(workersAIStream: ReadableStream): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return workersAIStream.pipeThrough(
    new TransformStream({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);

          if (data === '[DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(data);
            // Workers AI: {"response":"..."} → OpenAI: {"choices":[{"delta":{"content":"..."}}]}
            if ('response' in parsed) {
              const openAIChunk = {
                choices: [{ delta: { content: parsed.response } }],
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(openAIChunk)}\n\n`));
            } else {
              // Already OpenAI format or unknown — pass through
              controller.enqueue(encoder.encode(`${trimmed}\n\n`));
            }
          } catch {
            controller.enqueue(encoder.encode(`${trimmed}\n\n`));
          }
        }
      },
      flush(controller) {
        if (buffer.trim()) {
          controller.enqueue(encoder.encode(`${buffer}\n\n`));
        }
      },
    }),
  );
}

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

      // Geo-restriction, rate limit, or server error → fall through to Workers AI
      if (geminiResponse.status === 429) {
        console.info('[ai-chat] Gemini rate limited, falling back to Workers AI');
      } else if (geminiResponse.status >= 500) {
        console.info(`[ai-chat] Gemini ${geminiResponse.status}, falling back to Workers AI`);
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
      return new Response(toOpenAIStream(aiResponse as unknown as ReadableStream), {
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
