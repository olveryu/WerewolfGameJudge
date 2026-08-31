/** Cloudflare Analytics Engine SQL API adapter with runtime response validation. */

import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../../env';
import { createLogger } from '../../../platform/observability/logger';
import { REALTIME_TRAFFIC_MESSAGE_TYPES } from '../../../platform/telemetry/realtimeTraffic';

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

const requestTrafficRowSchema = z.strictObject({
  bucket: analyticsCountSchema,
  method: z.string().min(1),
  route: z.string().min(1),
  status: analyticsNumberSchema.pipe(z.number().int().min(100).max(599)),
  requestCount: analyticsCountSchema.pipe(z.number().positive()),
  durationTotalMs: analyticsNumberSchema.pipe(z.number().nonnegative()),
});

const realtimeTrafficRowSchema = z.strictObject({
  messageType: z.enum(REALTIME_TRAFFIC_MESSAGE_TYPES),
  messageCount: analyticsCountSchema.pipe(z.number().positive()),
});

export type LoadTimingAnalyticsRow = z.infer<typeof loadTimingRowSchema>;
export type AIUsageAnalyticsRow = z.infer<typeof aiUsageRowSchema>;
export type RequestTrafficAnalyticsRow = z.output<typeof requestTrafficRowSchema>;
export type RealtimeTrafficAnalyticsRow = z.output<typeof realtimeTrafficRowSchema>;

type AnalyticsQueryFailureReason =
  | 'ANALYTICS_QUERY_FAILED'
  | 'AI_USAGE_QUERY_FAILED'
  | 'REQUEST_TRAFFIC_QUERY_FAILED';

async function queryAnalyticsEngine<TRow>(
  env: Env,
  sqlQuery: string,
  rowSchema: z.ZodType<TRow>,
  failureReason: AnalyticsQueryFailureReason,
  fetchImpl: typeof fetch,
): Promise<TRow[]> {
  let response: Response;
  try {
    response = await fetchImpl(
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
  } catch (error: unknown) {
    log.error('Analytics Engine transport failed', { reason: failureReason, error });
    throw new HTTPException(502, { message: failureReason });
  }

  if (!response.ok) {
    const detail = await response.text();
    log.error('Analytics Engine query failed', {
      reason: failureReason,
      status: response.status,
      detail,
    });
    throw new HTTPException(502, { message: failureReason });
  }

  let responseBody: unknown;
  try {
    responseBody = await response.json();
  } catch (error: unknown) {
    log.error('Analytics Engine returned invalid JSON', { reason: failureReason, error });
    throw new HTTPException(502, { message: failureReason });
  }

  const envelopeSchema = z.object({ data: z.array(rowSchema) });
  const parsed = envelopeSchema.safeParse(responseBody);
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

export function queryRequestTrafficAnalytics(
  env: Env,
  sqlQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RequestTrafficAnalyticsRow[]> {
  return queryAnalyticsEngine(
    env,
    sqlQuery,
    requestTrafficRowSchema,
    'REQUEST_TRAFFIC_QUERY_FAILED',
    fetchImpl,
  );
}

export function queryRealtimeTrafficAnalytics(
  env: Env,
  sqlQuery: string,
  fetchImpl: typeof fetch = fetch,
): Promise<RealtimeTrafficAnalyticsRow[]> {
  return queryAnalyticsEngine(
    env,
    sqlQuery,
    realtimeTrafficRowSchema,
    'REQUEST_TRAFFIC_QUERY_FAILED',
    fetchImpl,
  );
}
