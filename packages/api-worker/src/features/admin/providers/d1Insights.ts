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

const queryTableLabels = new Map([
  ['users', '用户'],
  ['user_stats', '用户成长'],
  ['rooms', '房间'],
  ['room_participants', '房间参与记录'],
  ['room_game_starts', '房间开局记录'],
  ['password_reset_tokens', '账号认证'],
  ['refresh_tokens', '账号认证'],
  ['refresh_token_rotations', '账号认证'],
  ['login_attempts', '账号认证'],
  ['wx_claims', '账号认证'],
  ['draw_history', '抽奖记录'],
  ['idempotency_keys', '抽奖操作记录'],
  ['admin_reward_grants', '管理奖励发放'],
  ['product_game_reward_claims', '游戏奖励'],
  ['product_game_reward_results', '游戏奖励'],
  ['camp_settlements', '狼人杀结算'],
  ['game_settlement_results', '游戏结算'],
  ['werewolf_user_camp_stats', '狼人杀统计'],
  ['avalon_user_stats', '阿瓦隆统计'],
  ['undercover_user_stats', '谁是卧底统计'],
  ['drawguess_user_stats', '你画我猜统计'],
  ['fibking_user_stats', '瞎掰王统计'],
  ['pictionary_user_stats', 'pictionary 游戏统计'],
  ['storyrelay_user_stats', '故事接龙统计'],
  ['feedbacks', '用户反馈'],
  ['feedback_replies', '用户反馈'],
  ['feedback_deliveries', '反馈通知'],
  ['user_event_inbox', '用户收件箱'],
  ['editorial_model_requests', '词库模型请求'],
  ['drawguess_word_packs', '你画我猜词包'],
  ['drawguess_words', '你画我猜词库'],
  ['drawguess_word_candidates', '你画我猜候选词'],
  ['undercover_word_packs', '谁是卧底词包'],
  ['undercover_word_pairs', '谁是卧底词库'],
  ['undercover_word_candidates', '谁是卧底候选词'],
  ['undercover_round_word_selections', '谁是卧底选词记录'],
  ['fib_words', '瞎掰王词库'],
  ['fib_word_supply_state', '瞎掰王补词'],
  ['fib_word_generation_cycles', '瞎掰王补词'],
  ['fib_word_packs', '瞎掰王词包'],
  ['fib_word_supply_months', '瞎掰王补词用量'],
  ['fib_word_provider_requests', '瞎掰王补词请求'],
  ['fib_word_candidates', '瞎掰王候选词'],
  ['fib_word_candidate_reviews', '瞎掰王词条审核'],
  ['fib_round_word_selections', '瞎掰王选词记录'],
  ['fib_word_sequence', '瞎掰王抽词序列'],
  ['fib_word_usages', '瞎掰王用词记录'],
  ['word_seen', '玩家已见记录'],
  ['word_draw_index', '抽词索引'],
  ['word_draw_ordinals', '抽词序号'],
  ['word_candidate_approvals', '候选词批准'],
  ['word_candidate_dismissals', '候选词拒绝'],
  ['word_submission_limits', '词条投稿额度'],
  ['word_submission_agents', '词条投稿 Agent'],
  ['word_submission_credentials', '词条投稿认证'],
  ['word_submission_daily_usage', '词条投稿用量'],
  ['word_submission_batches', '词条投稿批次'],
  ['word_submission_items', '词条投稿'],
  ['word_submission_actions', '词条投稿操作'],
  ['word_submission_events', '词条投稿事件'],
  ['word_submission_evidence_requests', '词条投稿证据请求'],
  ['word_submission_control_events', '词条投稿管理'],
  ['database_capacity', '数据库容量记录'],
]);

function tableIdentifier(token: string | undefined): string | undefined {
  return token
    ?.match(
      /^(?:([a-z_][a-z0-9_$]*)|"([a-z_][a-z0-9_$]*)"|`([a-z_][a-z0-9_$]*)`|\[([a-z_][a-z0-9_$]*)\])$/i,
    )
    ?.slice(1)
    .find((identifier) => identifier !== undefined)
    ?.toLowerCase();
}

function describeQuery(query: string): string | undefined {
  // Keep literals and quoted identifiers atomic, so their contents cannot become SQL keywords.
  const tokens = (
    query.match(
      /--[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|'(?:''|[^'])*(?:'|$)|"(?:""|[^"])*(?:"|$)|`(?:``|[^`])*(?:`|$)|\[[^\]]*(?:\]|$)|[a-z_][a-z0-9_$]*|[^\s]/gi,
    ) ?? []
  ).filter((token) => !token.startsWith('--') && !token.startsWith('/*'));
  if (
    !/^(?:SELECT|INSERT|REPLACE|UPDATE|DELETE)$/i.test(tokens[0] ?? '') ||
    tokens.some((token) => /^WITH$/i.test(token))
  ) {
    return undefined;
  }
  const labels = new Set<string>();
  for (let index = 0; index < tokens.length; index += 1) {
    const keyword = tokens[index].toUpperCase();
    if (!['FROM', 'JOIN', 'INTO', 'UPDATE'].includes(keyword)) continue;
    let tableIndex = index + 1;
    if (keyword === 'UPDATE' && /^OR$/i.test(tokens[tableIndex] ?? '')) tableIndex += 2;
    let table = tableIdentifier(tokens[tableIndex]);
    if (tokens[tableIndex + 1] === '.') {
      if (table !== 'main') continue;
      tableIndex += 2;
      table = tableIdentifier(tokens[tableIndex]);
    }
    if (['FROM', 'JOIN'].includes(keyword) && tokens[tableIndex + 1] === '(') continue;
    const label = table === undefined ? undefined : queryTableLabels.get(table);
    if (label !== undefined) labels.add(label);
  }
  return labels.size === 0 ? undefined : `可能涉及：${[...labels].join('、')}`;
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
      rows.map(async (row) => {
        const id = await queryId(row.databaseId, row.query);
        return {
          id,
          label: describeQuery(row.query) ?? `未归类查询 · ${id.slice(0, 12)}`,
          reads: row.reads,
          writes: row.writes,
          count: row.count,
        };
      }),
    ),
    series: series.map((row) => ({
      timestamp: row.bucket,
      reads: row.reads,
      writes: row.writes,
    })),
  };
}
