/** Cloudflare Analytics Engine SQL API adapter with runtime response validation. */

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../../env';
import { createLogger } from '../../../platform/observability/logger';

const log = createLogger('admin-analytics-engine');
const ANALYTICS_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

const analyticsNumberSchema = z.union([
  z.number().finite(),
  z.string().regex(ANALYTICS_NUMBER_PATTERN).transform(Number).pipe(z.number().finite()),
]);
const analyticsCountSchema = analyticsNumberSchema.pipe(z.number().int().nonnegative());

const loadTimingRowSchema = z.strictObject({
  country: z.string(),
  colo: z.string(),
  isp: z.string(),
  cnt: analyticsCountSchema,
  avg_load_ms: analyticsNumberSchema,
  avg_ttfb_ms: analyticsNumberSchema,
});

const aiUsageRowSchema = z.strictObject({
  userId: z.string(),
  model: z.string(),
  provider: z.string(),
  country: z.string(),
  status: z.string(),
  cnt: analyticsCountSchema,
  avgTtfrMs: analyticsNumberSchema,
});

export type LoadTimingAnalyticsRow = z.infer<typeof loadTimingRowSchema>;
export type AIUsageAnalyticsRow = z.infer<typeof aiUsageRowSchema>;

async function queryAnalyticsEngine<TRow>(
  env: Env,
  sqlQuery: string,
  rowSchema: z.ZodType<TRow>,
  failureReason: 'ANALYTICS_QUERY_FAILED' | 'AI_USAGE_QUERY_FAILED',
  fetchImpl: typeof fetch,
): Promise<TRow[]> {
  const response = await fetchImpl(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: sqlQuery,
    },
  );

  if (!response.ok) {
    const detail = await response.text();
    log.error('Analytics Engine query failed', {
      reason: failureReason,
      status: response.status,
      detail,
    });
    throw new HTTPException(502, { message: failureReason });
  }

  const envelopeSchema = z.object({ data: z.array(rowSchema) });
  const parsed = envelopeSchema.safeParse(await response.json());
  if (!parsed.success) {
    log.error('Analytics Engine response validation failed', {
      reason: failureReason,
      issues: parsed.error.issues,
    });
    throw new HTTPException(502, { message: failureReason });
  }
  return parsed.data.data;
}

export function queryLoadTimingAnalytics(
  env: Env,
  sqlQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LoadTimingAnalyticsRow[]> {
  return queryAnalyticsEngine(
    env,
    sqlQuery,
    loadTimingRowSchema,
    'ANALYTICS_QUERY_FAILED',
    fetchImpl,
  );
}

export function queryAIUsageAnalytics(
  env: Env,
  sqlQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AIUsageAnalyticsRow[]> {
  return queryAnalyticsEngine(env, sqlQuery, aiUsageRowSchema, 'AI_USAGE_QUERY_FAILED', fetchImpl);
}
