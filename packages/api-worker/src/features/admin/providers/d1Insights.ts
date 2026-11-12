/** Account-scoped D1 query insights from Cloudflare's sampled SQL analytics. */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { Env } from '../../../env';
import { createLogger } from '../../../platform/observability/logger';

const log = createLogger('admin-d1-insights');
const analyticsNumber = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/)
      .transform(Number),
  ])
  .pipe(z.number().finite().nonnegative());

const queryRowSchema = z.strictObject({
  databaseId: z.string().min(1),
  query: z.string(),
  reads: analyticsNumber,
  writes: analyticsNumber,
  count: analyticsNumber,
});
const trendRowSchema = z.strictObject({
  bucket: z.iso.datetime(),
  reads: analyticsNumber,
  writes: analyticsNumber,
});

export type D1InsightsRange = 'today' | '24h' | '7d';
export type D1InsightsSort = 'reads' | 'writes';

function rangeStart(range: D1InsightsRange, now: Date): Date {
  if (range === 'today') {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }
  return new Date(now.getTime() - (range === '24h' ? 1 : 7) * 86400000);
}

async function queryAnalytics<Row>(
  env: Env,
  query: string,
  from: string,
  to: string,
  rowSchema: z.ZodType<Row>,
  fetchImpl: typeof fetch,
): Promise<Row[]> {
  let response: Response;
  try {
    response = await fetchImpl('https://api.cloudflare.com/client/v4/analytics/sql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        scope: { accountTag: env.CLOUDFLARE_ACCOUNT_ID },
        params: { from, to },
      }),
    });
  } catch (error: unknown) {
    log.error('D1 insights transport failed', { error });
    throw new HTTPException(502, { message: 'D1_INSIGHTS_QUERY_FAILED' });
  }
  if (!response.ok) {
    log.error('D1 insights request failed', { status: response.status });
    throw new HTTPException(502, { message: 'D1_INSIGHTS_QUERY_FAILED' });
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    log.error('D1 insights returned invalid JSON', { error });
    throw new HTTPException(502, { message: 'D1_INSIGHTS_QUERY_FAILED' });
  }
  if (typeof body !== 'object' || body === null || !('data' in body)) {
    log.error('D1 insights response omitted data');
    throw new HTTPException(502, { message: 'D1_INSIGHTS_QUERY_FAILED' });
  }
  const parsed = z.array(rowSchema).safeParse(body.data);
  if (!parsed.success) {
    // Validation errors can contain SQL text; never log the provider's raw response.
    log.error('D1 insights response validation failed');
    throw new HTTPException(502, { message: 'D1_INSIGHTS_QUERY_FAILED' });
  }
  return parsed.data;
}

function describeQuery(query: string): string {
  const tables = [
    ['drawguess_word_packs', '你画我猜词包'],
    ['drawguess_word_candidates', '你画我猜候选词'],
    ['drawguess_words', '你画我猜词库'],
    ['undercover_word_packs', '谁是卧底词包'],
    ['undercover_word_candidates', '谁是卧底候选词'],
    ['undercover_word_pairs', '谁是卧底词库'],
    ['fib_word', '瞎掰王词库'],
    ['word_seen', '玩家已见记录'],
    ['word_draw_index', '抽词索引'],
    ['users', '用户'],
    ['rooms', '房间'],
  ] as const;
  const matches = tables.filter(([table]) => new RegExp(`\\b${table}\\w*\\b`, 'i').test(query));
  return matches.length === 0
    ? '未识别查询'
    : `可能涉及：${matches.map(([, label]) => label).join('、')}`;
}

async function queryId(databaseId: string, query: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${databaseId}\0${query}`),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Return sampled rankings and trends without exposing SQL text or accessing D1. */
export async function queryD1Insights(
  env: Env,
  range: D1InsightsRange,
  sort: D1InsightsSort,
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
  selectedBucket?: Date,
) {
  const start = rangeStart(range, now);
  const bucketMs = (range === '7d' ? 24 : 1) * 3600000;
  const bucketTime = selectedBucket?.getTime();
  if (
    bucketTime !== undefined &&
    (!Number.isFinite(bucketTime) ||
      bucketTime % bucketMs !== 0 ||
      bucketTime >= now.getTime() ||
      bucketTime + bucketMs <= start.getTime())
  ) {
    throw new HTTPException(400, { message: 'INVALID_TIME_BUCKET' });
  }
  const from = (
    bucketTime === undefined ? start : new Date(Math.max(start.getTime(), bucketTime))
  ).toISOString();
  const to = (
    bucketTime === undefined ? now : new Date(Math.min(now.getTime(), bucketTime + bucketMs))
  ).toISOString();
  const filter = 'timestamp >= $from AND timestamp < $to';
  const query = `
    SELECT databaseId, query, SUM(rowsRead) AS reads, SUM(rowsWritten) AS writes, COUNT(*) AS count
    FROM events.d1Queries WHERE ${filter}
    GROUP BY databaseId, query ORDER BY ${sort} DESC LIMIT 20
  `;
  const bucket = range === '7d' ? 'toStartOfDay' : 'toStartOfHour';
  const trend = `
    SELECT formatDateTime(${bucket}(timestamp), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS bucket,
      SUM(rowsRead) AS reads, SUM(rowsWritten) AS writes
    FROM events.d1Queries WHERE ${filter}
    GROUP BY bucket ORDER BY bucket ASC LIMIT 200
  `;
  const [rows, series] = await Promise.all([
    queryAnalytics(env, query, from, to, queryRowSchema, fetchImpl),
    queryAnalytics(env, trend, start.toISOString(), now.toISOString(), trendRowSchema, fetchImpl),
  ]);
  return {
    from,
    to,
    generatedAt: now.toISOString(),
    queries: await Promise.all(
      rows.map(async (row) => ({
        id: await queryId(row.databaseId, row.query),
        label: describeQuery(row.query),
        reads: row.reads,
        writes: row.writes,
        count: row.count,
      })),
    ),
    series: series.map((row) => ({
      timestamp: row.bucket,
      reads: row.reads,
      writes: row.writes,
    })),
  };
}
