/** Fixed-cost Tavily discovery and extraction; source text is untrusted editorial evidence. */
import { z } from 'zod';

import { createFibWordProviderRequestError, FibWordProviderError } from './providerError';

export const FIB_WORD_EVIDENCE_SOURCE_LIMIT = 2;
const FIB_WORD_EVIDENCE_CONTENT_LIMIT = 12_000;
const REQUEST_TIMEOUT_MS = 30_000;

export const fibWordEvidenceSchema = z.strictObject({
  query: z.string(),
  url: z.url(),
  title: z.string().max(500),
  content: z.string().max(FIB_WORD_EVIDENCE_CONTENT_LIMIT),
});

const searchResponseSchema = z.object({
  results: z
    .array(z.object({ url: z.url(), title: z.string().max(500), content: z.string().max(2000) }))
    .max(FIB_WORD_EVIDENCE_SOURCE_LIMIT),
  usage: z.object({ credits: z.number().int().min(0).max(1) }),
});

const extractionResponseSchema = z.object({
  results: z
    .array(z.object({ url: z.url(), raw_content: z.string().min(1) }))
    .max(FIB_WORD_EVIDENCE_SOURCE_LIMIT),
  failed_results: z
    .array(z.object({ url: z.url(), error: z.string() }))
    .max(FIB_WORD_EVIDENCE_SOURCE_LIMIT),
  usage: z.object({ credits: z.number().int().min(0).max(1) }),
});

export type FibWordEvidence = z.output<typeof fibWordEvidenceSchema>;

async function requestTavilyEvidence(
  apiKey: string,
  operation: 'search' | 'extract',
  body: Readonly<Record<string, unknown>>,
  fetchImpl: typeof fetch,
): Promise<unknown> {
  if (apiKey.length === 0) throw new Error('Tavily requires an API key');
  const signal = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetchImpl.call(globalThis, `https://api.tavily.com/${operation}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    throw createFibWordProviderRequestError('Tavily', signal, error, apiKey);
  }
  if (!response.ok) {
    const failureKind =
      response.status === 401 || response.status === 403
        ? 'authenticationFailed'
        : response.status === 429 || response.status === 432
          ? 'rateLimited'
          : response.status >= 500
            ? 'serviceUnavailable'
            : 'requestFailed';
    throw new FibWordProviderError(`Tavily ${operation} failed (${response.status})`, failureKind);
  }
  return response.json();
}

/** Perform exactly one basic search, with no automatic upgrade or retries. */
export async function searchFibWordEvidence(
  apiKey: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FibWordEvidence[]> {
  const response = await requestTavilyEvidence(
    apiKey,
    'search',
    {
      query,
      search_depth: 'basic',
      auto_parameters: false,
      max_results: FIB_WORD_EVIDENCE_SOURCE_LIMIT,
      chunks_per_source: 1,
      include_raw_content: false,
      include_answer: false,
      include_images: false,
      include_usage: true,
      safe_search: true,
    },
    fetchImpl,
  );
  const parsed = searchResponseSchema.parse(response);
  return parsed.results.map((result) => ({ query, ...result }));
}

/** Extract at most two discovered sources for one credit; report failures without snippet fallback. */
export async function extractFibWordEvidence(
  apiKey: string,
  sources: readonly FibWordEvidence[],
  fetchImpl: typeof fetch = fetch,
): Promise<{ evidence: FibWordEvidence[]; failedUrls: string[] }> {
  z.array(fibWordEvidenceSchema).min(1).max(FIB_WORD_EVIDENCE_SOURCE_LIMIT).parse(sources);
  const response = await requestTavilyEvidence(
    apiKey,
    'extract',
    {
      urls: sources.map(({ url }) => url),
      extract_depth: 'basic',
      format: 'text',
      include_images: false,
      include_usage: true,
      query: '词项、旧称、专名及其固定释义、用途和实际使用语境',
      chunks_per_source: 5,
      timeout: 20,
    },
    fetchImpl,
  );
  const parsed = extractionResponseSchema.parse(response);
  for (const result of [...parsed.results, ...parsed.failed_results]) {
    if (!sources.some(({ url }) => url === result.url)) {
      throw new FibWordProviderError(
        'Tavily extraction returned an unrequested source',
        'invalidOutput',
      );
    }
  }
  return {
    evidence: parsed.results.map((result) => {
      const source = sources.find(({ url }) => url === result.url);
      if (source === undefined) throw new Error('Fib extraction source missing');
      return { ...source, content: result.raw_content.slice(0, FIB_WORD_EVIDENCE_CONTENT_LIMIT) };
    }),
    failedUrls: parsed.failed_results.map(({ url }) => url),
  };
}
