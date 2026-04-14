/**
 * Gemini Proxy Hono routes (Workers 版)
 *
 * 透明代理 Gemini API（OpenAI 兼容层），服务端注入 API key。
 * 支持普通请求和 SSE 流式响应。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { geminiProxySchema } from '../schemas/gemini';
import { jsonBody } from './shared';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const MAX_TOKENS_CAP = 4096;

export const geminiRoutes = new Hono<AppEnv>();

geminiRoutes.post('/', requireAuth, jsonBody(geminiProxySchema), async (c) => {
  const env = c.env;

  if (!env.GEMINI_API_KEY) {
    return c.json({ error: 'GEMINI_API_KEY not configured' }, 500);
  }

  try {
    const parsed = c.req.valid('json');

    const sanitizedBody = {
      messages: parsed.messages,
      model: parsed.model,
      stream: parsed.stream,
      ...(parsed.temperature != null && { temperature: parsed.temperature }),
      ...(parsed.max_tokens != null && {
        max_tokens: Math.min(parsed.max_tokens, MAX_TOKENS_CAP),
      }),
    };

    const geminiResponse = await fetch(`${GEMINI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.GEMINI_API_KEY}`,
      },
      body: JSON.stringify(sanitizedBody),
    });

    if (sanitizedBody.stream) {
      return new Response(geminiResponse.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        status: geminiResponse.status,
      });
    }

    const data = await geminiResponse.json();
    return c.json(data, geminiResponse.status as 200);
  } catch (error) {
    console.error('[gemini-proxy] Unhandled error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
