/**
 * AI Chat Hono routes — Gemini (primary) + Workers AI (fallback)
 *
 * 主力：Gemini API（OpenAI 兼容层），固定模型 gemini-3.1-flash-lite。
 * 降级：地理限制（400）/ 配额耗尽（429）/ 过载（503 重试 1 次后）
 *       → fallback 到 Workers AI（@cf/google/gemma-4-26b-a4b-it）。
 * Workers AI 无地理限制，10K Neurons/天预算主要服务受限地区用户。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { createLogger } from '../lib/logger';
import { geminiProxySchema } from '../schemas/gemini';
import { jsonBody } from './shared';

const log = createLogger('ai-chat');

const GEMINI_OPENAI_BASE = 'https://generativelanguage.googleapis.com/v1beta/openai';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
const MAX_TOKENS_CAP = 10240;
const WORKERS_AI_MODEL = '@cf/google/gemma-4-26b-a4b-it';
const GEMINI_TIMEOUT_MS = 15_000;

/**
 * 将 Workers AI SSE 流（`{"response":"..."}` 格式）转换为 OpenAI 兼容格式
 * （`{"choices":[{"delta":{"content":"..."}}]}`），客户端解析器只认后者。
 */
function toOpenAIStream(workersAIStream: ReadableStream): ReadableStream {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';

  return workersAIStream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
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
            const parsed: unknown = JSON.parse(data);
            // Workers AI: {"response":"..."} → OpenAI: {"choices":[{"delta":{"content":"..."}}]}
            if (typeof parsed === 'object' && parsed !== null && 'response' in parsed) {
              const openAIChunk = {
                choices: [{ delta: { content: (parsed as { response: string }).response } }],
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

/** Gemini AI 代理路由。 */
export const geminiRoutes = new Hono<AppEnv>();

type Message = { role: string; content: string };

/**
 * Transform OpenAI-style messages for Workers AI (Gemma) compatibility:
 * 1. Merge "system" messages into the next "user" message (Gemma has no system role)
 * 2. Enforce strict user→assistant→user alternation by merging consecutive same-role messages
 * 3. Ensure conversation starts with "user" and ends with "user"
 */
function toWorkersAIMessages(messages: Message[]): Message[] {
  // Step 1: Merge system into next user message
  const merged: Message[] = [];
  let pendingSystem = '';
  for (const msg of messages) {
    if (msg.role === 'system') {
      pendingSystem += (pendingSystem ? '\n' : '') + msg.content;
    } else {
      if (pendingSystem && msg.role === 'user') {
        merged.push({ role: 'user', content: `${pendingSystem}\n\n${msg.content}` });
        pendingSystem = '';
      } else {
        if (pendingSystem) {
          // system before assistant — push as user message
          merged.push({ role: 'user', content: pendingSystem });
          pendingSystem = '';
        }
        merged.push({ role: msg.role, content: msg.content });
      }
    }
  }
  if (pendingSystem) {
    merged.push({ role: 'user', content: pendingSystem });
  }

  // Step 2: Enforce alternation — merge consecutive same-role messages
  const alternated: Message[] = [];
  for (const msg of merged) {
    const last = alternated[alternated.length - 1];
    if (last && last.role === msg.role) {
      last.content += '\n' + msg.content;
    } else {
      alternated.push({ ...msg });
    }
  }

  // Step 3: Ensure starts with user
  if (alternated.length > 0 && alternated[0].role !== 'user') {
    alternated.unshift({ role: 'user', content: '(continue)' });
  }

  // Step 4: Ensure ends with user (last message should be the question)
  if (alternated.length > 0 && alternated[alternated.length - 1].role !== 'user') {
    alternated.push({ role: 'user', content: '(continue)' });
  }

  return alternated;
}

geminiRoutes.post('/', requireAuth, jsonBody(geminiProxySchema), async (c) => {
  const env = c.env;
  const parsed = c.req.valid('json');
  const startTime = Date.now();
  const userId = c.var.userId;
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;
  const country = (cf?.country as string) ?? 'unknown';

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
  if (env.GEMINI_API_KEY) {
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
          const data: Record<string, unknown> = await geminiResponse.json();
          return c.json(data, 200);
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
  }

  // ── Fallback: Workers AI ───────────────────────────────────────────────
  // Gemma models don't support "system" role and require strict user/assistant alternation.
  // Merge system prompts into the first user message, then enforce alternation.
  const workersMessages = toWorkersAIMessages(messages);

  try {
    const aiResponse = await env.AI.run(WORKERS_AI_MODEL, {
      messages: workersMessages,
      stream,
      temperature,
      max_tokens: maxTokens,
    });

    writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'ok');
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
      writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'error');
      return c.json({ success: false, reason: 'QUOTA_EXHAUSTED' }, 429);
    }
    log.error('Workers AI unexpected error', { error: errMsg });
    writeUsage(WORKERS_AI_MODEL, 'workers-ai', 'error');
    return c.json({ success: false, reason: 'AI_UNAVAILABLE' }, 503);
  }
});
