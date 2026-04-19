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

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const GEMINI_OPENAI_BASE = `${GEMINI_API_BASE}/openai`;
const MAX_TOKENS_CAP = 4096;
const WORKERS_AI_MODEL = '@cf/google/gemma-3-12b-it';
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const EXCLUDE_PATTERN = /tts|image|audio|customtools|embed|vision|video|veo|gemma|live/i;

// ── Model discovery cache (isolate-scoped, stale-while-revalidate) ───────
let cachedModels: string[] = [];
let cacheTimestamp = 0;

interface GeminiModelEntry {
  name: string; // e.g. "models/gemini-3.1-flash-lite-preview"
  supportedGenerationMethods?: string[];
}

/**
 * 从 ListModels API 获取适合文本聊天的 Gemini Flash 模型，按版本降序排列。
 * 版本号高的优先，同版本内 non-lite 优先（质量高），lite 其次（额度多）。
 */
async function fetchSortedModels(apiKey: string): Promise<string[]> {
  const res = await fetch(`${GEMINI_API_BASE}/models?key=${apiKey}`);
  if (!res.ok) return [];

  const data = (await res.json()) as { models?: GeminiModelEntry[] };
  if (!data.models) return [];

  const candidates = data.models
    .filter((m) => {
      const id = m.name.replace('models/', '');
      return (
        id.startsWith('gemini-') &&
        id.includes('flash') &&
        !EXCLUDE_PATTERN.test(id) &&
        m.supportedGenerationMethods?.includes('generateContent')
      );
    })
    .map((m) => m.name.replace('models/', ''));

  return candidates.sort((a, b) => {
    const va = parseVersion(a);
    const vb = parseVersion(b);
    // Higher version first
    if (vb.major !== va.major) return vb.major - va.major;
    if (vb.minor !== va.minor) return vb.minor - va.minor;
    // Same version: non-lite before lite (higher quality first)
    if (va.lite !== vb.lite) return va.lite ? 1 : -1;
    return 0;
  });
}

/** Extract version number and lite flag from model ID like "gemini-3.1-flash-lite-preview" */
function parseVersion(modelId: string): { major: number; minor: number; lite: boolean } {
  const match = modelId.match(/gemini-(\d+)\.(\d+)/);
  return {
    major: match ? Number(match[1]) : 0,
    minor: match ? Number(match[2]) : 0,
    lite: modelId.includes('lite'),
  };
}

/** Get available Gemini models with 1h stale-while-revalidate cache. */
async function getGeminiModels(apiKey: string): Promise<string[]> {
  const now = Date.now();
  const stale = now - cacheTimestamp > MODEL_CACHE_TTL_MS;

  if (stale) {
    try {
      const fresh = await fetchSortedModels(apiKey);
      if (fresh.length > 0) {
        cachedModels = fresh;
        cacheTimestamp = now;
      }
    } catch {
      // ListModels failed — use stale cache if available
    }
  }

  return cachedModels;
}

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

  const messages = parsed.messages;
  const stream = parsed.stream ?? false;
  const temperature = parsed.temperature ?? 0.7;
  const maxTokens = parsed.max_tokens
    ? Math.min(parsed.max_tokens, MAX_TOKENS_CAP)
    : MAX_TOKENS_CAP;

  // ── Primary: Gemini API (dynamic model cascade) ─────────────────────────
  if (env.GEMINI_API_KEY) {
    const models = await getGeminiModels(env.GEMINI_API_KEY);

    for (const model of models) {
      try {
        const geminiBody = {
          messages,
          model,
          stream,
          temperature,
          max_tokens: maxTokens,
        };

        const geminiResponse = await fetch(`${GEMINI_OPENAI_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${env.GEMINI_API_KEY}`,
          },
          body: JSON.stringify(geminiBody),
        });

        if (geminiResponse.ok) {
          if (stream) {
            return new Response(geminiResponse.body, {
              headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
              },
            });
          }
          const data = await geminiResponse.json();
          return c.json(data, 200);
        }

        // Non-2xx: decide whether to try next model or bail to Workers AI
        const errorText = await geminiResponse.text();
        const status = geminiResponse.status;

        if (status === 429 || status === 503) {
          // Quota/overload — try next model
          console.info(`[ai-chat] Gemini ${model} → ${status}, trying next model`);
          continue;
        }

        // 400 (geo block, bad request) or other — no point trying more models
        console.info(
          `[ai-chat] Gemini ${model} → ${status}, skipping remaining models:`,
          errorText.slice(0, 200),
        );
        break;
      } catch (error) {
        console.error(`[ai-chat] Gemini ${model} network error:`, error);
        break;
      }
    }

    if (models.length === 0) {
      console.info('[ai-chat] No Gemini models discovered, falling back to Workers AI');
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
