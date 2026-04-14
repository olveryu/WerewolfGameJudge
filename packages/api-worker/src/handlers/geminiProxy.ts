/**
 * Gemini Proxy Handler (Workers 版)
 *
 * 与 Edge Functions 的 gemini-proxy/index.ts 逻辑一致：
 * 透明代理 Gemini API（OpenAI 兼容层），服务端注入 API key。
 * 支持普通请求和 SSE 流式响应。
 */

import type { Env } from '../env';
import { extractBearerToken, verifyToken } from '../lib/auth';
import { corsHeaders, jsonResponse } from '../lib/cors';
import { geminiProxySchema } from '../schemas/gemini';
import { parseBody } from './shared';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const MAX_TOKENS_CAP = 4096;

export async function handleGeminiProxy(request: Request, env: Env): Promise<Response> {
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  if (!env.GEMINI_API_KEY) {
    return jsonResponse({ error: 'GEMINI_API_KEY not configured' }, 500, env);
  }

  try {
    const parsed = await parseBody(request, geminiProxySchema, env);
    if (parsed instanceof Response) return parsed;

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

    const cors = corsHeaders(env);

    if (sanitizedBody.stream) {
      return new Response(geminiResponse.body, {
        headers: {
          ...cors,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        status: geminiResponse.status,
      });
    }

    const data = await geminiResponse.json();
    return new Response(JSON.stringify(data), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: geminiResponse.status,
    });
  } catch (error) {
    console.error('[gemini-proxy] Unhandled error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500, env);
  }
}
