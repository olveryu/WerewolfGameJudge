/**
 * fibWordSource — server-side fibking word generator (runs in the Worker, never the DO).
 *
 * Three-tier fallback so a word is ALWAYS produced:
 *   Gemini (≤2 tries, fresh entropy each) → Workers AI (1 try) → built-in FIB_WORD_BANK.
 *
 * Diversity/dedup (avoid modal collapse + same-room repeats):
 *   - Prompt entropy injection (random domain + radical + nonce via Web Crypto) per call.
 *   - temperature ≈ 1.0, no fixed seed.
 *   - Hard post-dedup: a word already in `avoid` is rejected and retried (then falls through).
 *   - Content safety: blocklist filter on top of the prompt's safety instruction.
 */

import { z } from 'zod';

import type { Env } from '../env';
import { isContentSafe, pickFallbackWord } from '../lib/fibWordBank';
import {
  GEMINI_MODEL,
  GEMINI_OPENAI_BASE,
  GEMINI_TIMEOUT_MS,
  WORKERS_AI_MODEL,
} from '../lib/geminiConfig';
import { createLogger } from '../lib/logger';

const log = createLogger('fib-word');

export type FibWordSource = 'gemini' | 'workersai' | 'fallback';

export interface GeneratedFibWord {
  word: string;
  definition: string;
  source: FibWordSource;
}

const FibWordSchema = z.object({
  word: z.string().min(2).max(12),
  definition: z.string().min(8).max(120),
});

const DOMAINS = [
  '自然',
  '天气',
  '情绪',
  '动作',
  '器物',
  '身体',
  '饮食',
  '植物',
  '动物',
  '声音',
  '光影',
  '时间',
  '性格',
  '古汉语',
  '方言',
  '书面语',
  '拟声',
  '中医',
  '天文',
  '地理',
  '色彩',
  '服饰',
  '建筑',
  '山水',
  '行走',
  '乐器',
  '酒器',
  '花卉',
  '虫鱼',
  '文字',
] as const;

const RADICALS = [
  '氵',
  '艹',
  '木',
  '石',
  '心',
  '足',
  '目',
  '口',
  '纟',
  '金',
  '王',
  '虫',
  '鸟',
  '雨',
  '火',
  '月',
  '彳',
  '言',
] as const;

function randInt(max: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % max;
}

function pickRandom<T>(arr: readonly T[]): T {
  return arr[randInt(arr.length)];
}

function nonce(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0].toString(36);
}

function buildPromptParts(avoid: readonly string[]): { system: string; user: string } {
  const domain = pickRandom(DOMAINS);
  const radical = pickRandom(RADICALS);
  const system =
    '你是中文生僻词出题助手。只输出一个 JSON 对象 {"word":"...","definition":"..."},' +
    '不要任何额外文字或代码围栏。要求:word 是真实存在、较生僻的中文词(2-4 字);' +
    'definition 是真实、准确、简洁的释义(8-40 字)。严禁编造释义,' +
    '严禁涉及政治敏感、色情、暴力、赌博、毒品等不当内容。';
  const avoidList = avoid.length > 0 ? avoid.join('、') : '(无)';
  const user =
    `请出一个与「${domain}」相关、最好含部首「${radical}」的生僻词。` +
    `避免以下已用词:${avoidList}。随机种子:${nonce()}。`;
  return { system, user };
}

function parseWordResponse(text: string): { word: string; definition: string } | null {
  const stripped = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  let obj: unknown;
  try {
    obj = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    return null;
  }
  const parsed = FibWordSchema.safeParse(obj);
  return parsed.success ? parsed.data : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Safely extract the assistant text from an untrusted LLM response envelope. */
function extractText(data: unknown, shape: 'openai' | 'workersai'): string | null {
  const root = asRecord(data);
  if (!root) return null;
  if (shape === 'workersai') {
    return typeof root.response === 'string' ? root.response : null;
  }
  const choices = root.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = asRecord(choices[0])?.message;
  const content = asRecord(message)?.content;
  return typeof content === 'string' ? content : null;
}

async function callGemini(env: Env, avoid: readonly string[]): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  const { system, user } = buildPromptParts(avoid);
  const res = await fetch(`${GEMINI_OPENAI_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.GEMINI_API_KEY}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 1.0,
      max_tokens: 256,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
  });
  if (!res.ok) return null;
  const data: unknown = await res.json();
  return extractText(data, 'openai');
}

async function callWorkersAI(env: Env, avoid: readonly string[]): Promise<string | null> {
  const { system, user } = buildPromptParts(avoid);
  // Gemma has no system role → merge system into the single user message.
  const result: unknown = await env.AI.run(WORKERS_AI_MODEL, {
    messages: [{ role: 'user', content: `${system}\n\n${user}` }],
    temperature: 1.0,
    max_tokens: 256,
  });
  return extractText(result, 'workersai');
}

/** Try an LLM tier with fresh-entropy retries + content/dedup filtering. */
async function tryTier(
  call: (avoid: readonly string[]) => Promise<string | null>,
  baseAvoid: readonly string[],
  maxAttempts: number,
): Promise<{ word: string; definition: string } | null> {
  const avoid = [...baseAvoid];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let text: string | null;
    try {
      text = await call(avoid);
    } catch (err) {
      log.warn('word LLM tier error', {
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
    if (!text) return null;
    const parsed = parseWordResponse(text);
    if (!parsed) continue;
    const word = parsed.word.trim();
    const definition = parsed.definition.trim();
    if (!isContentSafe(word, definition) || avoid.includes(word)) {
      avoid.push(word);
      continue;
    }
    return { word, definition };
  }
  return null;
}

export async function generateFibWord(
  env: Env,
  opts: { avoid: readonly string[] },
): Promise<GeneratedFibWord> {
  const { avoid } = opts;

  const gemini = await tryTier((a) => callGemini(env, a), avoid, 2);
  if (gemini) return { ...gemini, source: 'gemini' };

  const workersAI = await tryTier((a) => callWorkersAI(env, a), avoid, 1);
  if (workersAI) return { ...workersAI, source: 'workersai' };

  const fallback = pickFallbackWord(avoid);
  return { word: fallback.word, definition: fallback.definition, source: 'fallback' };
}
