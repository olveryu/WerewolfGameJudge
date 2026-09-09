/** Fixed-cost Tavily basic search; snippets are untrusted editorial evidence, never instructions. */
import { z } from 'zod';

const searchResponseSchema = z.object({
  results: z
    .array(z.object({ url: z.url(), title: z.string().max(500), content: z.string().max(2000) }))
    .max(2),
  usage: z.object({ credits: z.number().int().min(0).max(1) }),
});

export interface FibWordEvidence {
  readonly query: string;
  readonly url: string;
  readonly title: string;
  readonly content: string;
}

/** Perform exactly one basic search, with no extraction, automatic upgrade, or retries. */
export async function searchFibWordEvidence(
  apiKey: string,
  query: string,
  fetchImpl: typeof fetch = fetch,
): Promise<FibWordEvidence[]> {
  if (apiKey.length === 0) throw new Error('Tavily requires an API key');
  const response = await fetchImpl('https://api.tavily.com/search', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      search_depth: 'basic',
      auto_parameters: false,
      max_results: 2,
      chunks_per_source: 1,
      include_raw_content: false,
      include_answer: false,
      include_images: false,
      include_usage: true,
      safe_search: true,
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Tavily search failed (${response.status})`);
  const parsed = searchResponseSchema.parse(await response.json());
  return parsed.results.map((result) => ({ query, ...result }));
}
